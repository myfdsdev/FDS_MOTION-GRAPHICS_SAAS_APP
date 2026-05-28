import { Router } from "express";
import mongoose from "mongoose";
import { Project } from "../models.js";
import { CreateProjectInput, UpdateProjectInput } from "../schemas.js";
import { toProjectDTO } from "../serialize.js";
import { requireAuth } from "../middleware/auth.js";
import { rateLimit } from "../middleware/rateLimit.js";
import { validate } from "../middleware/validate.js";
import { costForDuration, deductCredits } from "../lib/credits.js";
import { generationConfigError, runPipeline } from "../lib/pipeline.js";

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
      const { prompt, durationSec } = req.body;
      const userId = req.user.id;
      const configError = await generationConfigError(userId);
      if (configError) return res.status(500).json({ error: configError });

      const project = await Project.create({
        userId,
        prompt,
        durationSec,
        status: "PLANNING",
        progress: 0,
      });

      // Deduct atomically; on failure remove the project and return 402.
      const cost = costForDuration(durationSec);
      try {
        await deductCredits(userId, cost, String(project._id));
      } catch (err) {
        await Project.deleteOne({ _id: project._id });
        return next(err);
      }

      // Fire-and-forget — request returns immediately with the PLANNING project.
      runPipeline(String(project._id), userId, prompt, durationSec);

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
    if (sceneJson.template) project.template = sceneJson.template;
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

    project.progress = 0;
    project.errorMessage = null;
    project.outputUrl = null;

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
