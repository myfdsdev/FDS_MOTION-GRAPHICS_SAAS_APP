import { Router } from "express";
import mongoose from "mongoose";
import { Project } from "../models.js";
import { CreateProjectInput, GenerateProjectInput, UpdateProjectInput } from "../schemas.js";
import { toProjectDTO } from "../serialize.js";
import { requireAuth } from "../middleware/auth.js";
import { rateLimit } from "../middleware/rateLimit.js";
import { validate } from "../middleware/validate.js";
import { costForDuration, costForSceneRegeneration, deductCredits, refundCredits } from "../lib/credits.js";
import { requireVideoAssistantTopic } from "../lib/domainGuard.js";
import { generationConfigError, runPipeline } from "../lib/pipeline.js";
import { saveProjectImages } from "../lib/generation/imageStore.js";
import { regenerateScene } from "../lib/generation/planScenes.js";
import { buildVideoPlan } from "../lib/generation/buildVideoPlan.js";
import { preferredHybridProvider } from "../lib/generation/index.js";

export const projectsRouter = Router();

projectsRouter.use(requireAuth);

const isValidId = (id) => mongoose.isValidObjectId(id);

projectsRouter.get("/", async (req, res, next) => {
  try {
    const projects = await Project.find({ userId: req.user.id, deletedAt: null })
      .sort({ createdAt: -1 })
      .lean();
    res.json(projects.map(toProjectDTO));
  } catch (err) {
    next(err);
  }
});

projectsRouter.post(
  "/",
  rateLimit({ max: 10, windowMs: 60 * 60 * 1000 }),
  validate(CreateProjectInput),
  async (req, res, next) => {
    try {
      const { prompt, durationSec, aspectRatio, recipe, narration, music, sfx, referenceImage, images } = req.body;
      requireVideoAssistantTopic(prompt);
      const userId = req.user.id;
      const configError = await generationConfigError(userId);
      if (configError) return res.status(500).json({ error: configError });

      const project = await Project.create({
        userId,
        prompt,
        aspectRatio,
        durationSec,
        recipe: recipe || "auto",
        narration: narration ?? true,
        music: music ?? true,
        sfx: sfx ?? false,
        status: "PLANNING",
        progress: 0,
      });

      // Persist any uploaded images → the video is built FROM them.
      if (Array.isArray(images) && images.length) {
        const saved = saveProjectImages(String(project._id), images);
        if (saved.length) {
          project.images = saved;
          await project.save();
        }
      }

      // Deduct atomically; on failure remove the project and return 402.
      const cost = costForDuration(durationSec);
      try {
        await deductCredits(userId, cost, String(project._id));
      } catch (err) {
        await Project.deleteOne({ _id: project._id });
        return next(err);
      }

      // Fire-and-forget — request returns immediately with the PLANNING project.
      runPipeline(String(project._id), userId, prompt, durationSec, referenceImage);

      res.status(201).json(toProjectDTO(project));
    } catch (err) {
      next(err);
    }
  }
);

projectsRouter.get("/:id", async (req, res, next) => {
  try {
    if (!isValidId(req.params.id)) return res.status(404).json({ error: "Project not found" });
    const project = await Project.findOne({ _id: req.params.id, deletedAt: null }).lean();
    if (!project) return res.status(404).json({ error: "Project not found" });
    if (String(project.userId) !== req.user.id)
      return res.status(403).json({ error: "Forbidden" });
    res.json(toProjectDTO(project));
  } catch (err) {
    next(err);
  }
});

// Persist editor changes to a project's plan/timeline. Does NOT re-render —
// the client triggers /rerender separately when ready.
projectsRouter.patch("/:id", validate(UpdateProjectInput), async (req, res, next) => {
  try {
    if (!isValidId(req.params.id)) return res.status(404).json({ error: "Project not found" });
    const project = await Project.findOne({ _id: req.params.id, deletedAt: null });
    if (!project) return res.status(404).json({ error: "Project not found" });
    if (String(project.userId) !== req.user.id)
      return res.status(403).json({ error: "Forbidden" });
    if (project.status === "QUEUED" || project.status === "RENDERING")
      return res.status(409).json({ error: "Cannot edit a project while it is rendering" });

    const { sceneJson } = req.body;
    project.sceneJson = sceneJson;
    if (sceneJson.aspectRatio) project.aspectRatio = sceneJson.aspectRatio;
    // Keep durationSec in sync with the timeline's total length.
    const totalSec = sceneJson.timeline?.duration ?? sceneJson.duration;
    if (Number.isFinite(totalSec)) project.durationSec = Math.round(totalSec);
    await project.save();

    res.status(200).json(toProjectDTO(project));
  } catch (err) {
    next(err);
  }
});

projectsRouter.delete("/:id", async (req, res, next) => {
  try {
    if (!isValidId(req.params.id)) return res.status(404).json({ error: "Project not found" });
    const project = await Project.findOne({ _id: req.params.id, deletedAt: null });
    if (!project) return res.status(404).json({ error: "Project not found" });
    if (String(project.userId) !== req.user.id)
      return res.status(403).json({ error: "Forbidden" });
    project.deletedAt = new Date();
    await project.save();
    res.status(204).end();
  } catch (err) {
    next(err);
  }
});

// (Re)generate a project's plan from a prompt — used by the in-editor chat.
// Runs the AI pipeline and overwrites sceneJson (the editor then loads it).
projectsRouter.post(
  "/:id/generate",
  rateLimit({ max: 20, windowMs: 60 * 60 * 1000 }),
  validate(GenerateProjectInput),
  async (req, res, next) => {
    try {
      if (!isValidId(req.params.id)) return res.status(404).json({ error: "Project not found" });
      const project = await Project.findOne({ _id: req.params.id, deletedAt: null });
      if (!project) return res.status(404).json({ error: "Project not found" });
      if (String(project.userId) !== req.user.id)
        return res.status(403).json({ error: "Forbidden" });
      if (project.status === "QUEUED" || project.status === "RENDERING")
        return res.status(409).json({ error: "Project is rendering — wait for it to finish" });

      const configError = await generationConfigError(req.user.id);
      if (configError) return res.status(500).json({ error: configError });

      const { prompt, durationSec, referenceImage } = req.body;
      requireVideoAssistantTopic(prompt);
      const seconds = durationSec ?? project.durationSec ?? 20;

      const cost = costForDuration(seconds);
      await deductCredits(req.user.id, cost, String(project._id));

      project.prompt = prompt;
      project.durationSec = seconds;
      project.status = "PLANNING";
      project.progress = 0;
      project.errorMessage = null;
      project.outputUrl = null;
      await project.save();

      runPipeline(String(project._id), req.user.id, prompt, seconds, referenceImage);

      res.status(202).json(toProjectDTO(project));
    } catch (err) {
      next(err);
    }
  }
);

projectsRouter.post("/:id/rerender", async (req, res, next) => {
  try {
    if (!isValidId(req.params.id)) return res.status(404).json({ error: "Project not found" });
    const project = await Project.findOne({ _id: req.params.id, deletedAt: null });
    if (!project) return res.status(404).json({ error: "Project not found" });
    if (String(project.userId) !== req.user.id)
      return res.status(403).json({ error: "Forbidden" });
    const configError = await generationConfigError(req.user.id);
    if (configError) return res.status(500).json({ error: configError });

    const cost = costForDuration(project.durationSec);
    await deductCredits(req.user.id, cost, String(project._id));

    // User-initiated retry — wipe the failure state AND reset the orphan/
    // watchdog counters. A retry from the UI is a fresh start; we shouldn't
    // count the prior auto-attempts against the new try.
    project.progress = 0;
    project.errorMessage = null;
    project.errorPhase = null;
    project.errorCode = null;
    project.errorStack = null;
    project.errorAt = null;
    project.outputUrl = null;
    project.renderAttempts = 0;
    project.renderStartedAt = null;
    project.renderHeartbeatAt = null;

    // If the project has an edited timeline, render it directly (skip the AI
    // pipeline so manual edits are preserved). The worker claims QUEUED jobs.
    const hasTimeline =
      project.sceneJson?.timeline?.tracks?.length > 0;
    if (hasTimeline) {
      project.status = "QUEUED";
      await project.save();
    } else {
      project.status = "PLANNING";
      await project.save();
      runPipeline(String(project._id), req.user.id, project.prompt, project.durationSec);
    }

    res.status(200).json(toProjectDTO(project));
  } catch (err) {
    next(err);
  }
});

// Regenerate ONE scene of an already-rendered hybrid project — re-plans just
// that scene's content and re-generates its footage, then re-renders the
// full video (the worker skips planning/footage-gen for the untouched scenes
// since scenePlan + videoPlan are already present in renderPlan).
projectsRouter.post(
  "/:id/scenes/:index/regenerate",
  rateLimit({ max: 30, windowMs: 60 * 60 * 1000 }),
  async (req, res, next) => {
    try {
      if (!isValidId(req.params.id)) return res.status(404).json({ error: "Project not found" });
      const project = await Project.findOne({ _id: req.params.id, deletedAt: null });
      if (!project) return res.status(404).json({ error: "Project not found" });
      if (String(project.userId) !== req.user.id)
        return res.status(403).json({ error: "Forbidden" });
      if (project.status === "QUEUED" || project.status === "RENDERING")
        return res.status(409).json({ error: "Project is rendering — wait for it to finish" });

      const scenePlan = project.renderPlan?.scenePlan;
      const videoPlan = project.renderPlan?.videoPlan;
      if (!scenePlan || !videoPlan)
        return res.status(409).json({ error: "This project hasn't finished its first render yet" });

      const index = Number(req.params.index);
      if (!Number.isInteger(index) || index < 0 || index >= scenePlan.scenes.length)
        return res.status(400).json({ error: "Invalid scene index" });

      const instruction =
        typeof req.body?.instruction === "string" ? req.body.instruction.slice(0, 500) : "";

      const configError = await generationConfigError(req.user.id);
      if (configError) return res.status(500).json({ error: configError });

      const cost = costForSceneRegeneration();
      await deductCredits(req.user.id, cost, String(project._id));

      try {
        const newScene = await regenerateScene({
          userPrompt: project.prompt,
          scenePlan,
          sceneIndex: index,
          instruction,
          recipe: scenePlan.recipeId || project.recipe || "auto",
        });

        const provider = preferredHybridProvider();
        const aspectRatio = project.aspectRatio || "16:9";
        const rebuilt = await buildVideoPlan(
          { scenes: [newScene] },
          { provider, aspectRatio, jobId: String(project._id) }
        );
        const newVideoScene = rebuilt.scenes[0];

        const nextScenePlan = { ...scenePlan, scenes: [...scenePlan.scenes] };
        nextScenePlan.scenes[index] = newScene;
        const nextVideoPlan = { ...videoPlan, scenes: [...videoPlan.scenes] };
        nextVideoPlan.scenes[index] = newVideoScene;

        project.renderPlan = { scenePlan: nextScenePlan, videoPlan: nextVideoPlan };
        project.status = "QUEUED";
        project.progress = 0;
        project.errorMessage = null;
        project.errorPhase = null;
        project.errorCode = null;
        project.errorStack = null;
        project.errorAt = null;
        project.outputUrl = null;
        await project.save();

        res.status(202).json(toProjectDTO(project));
      } catch (err) {
        await refundCredits(req.user.id, cost, String(project._id)).catch(() => {});
        throw err;
      }
    } catch (err) {
      next(err);
    }
  }
);
