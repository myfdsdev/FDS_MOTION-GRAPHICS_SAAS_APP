// Bot Engine route — stateful chat sessions that can also CREATE videos.
//
// The video "tool" reuses the EXISTING generation pipeline: a tool call creates
// a real Project + runPipeline(), and the session's `activeGeneration` snapshot
// points at it. On every GET we reconcile that snapshot from the Project's live
// status (QUEUED→RENDERING→DONE), so the chat shows a progress card that updates
// as the worker renders — and a page reload resumes it (resilience).

import { Router } from "express";
import mongoose from "mongoose";
import { BotChatSession, Project } from "../models.js";
import { BotMessageInput } from "../schemas.js";
import { requireAuth } from "../middleware/auth.js";
import { validate } from "../middleware/validate.js";
import { rateLimit } from "../middleware/rateLimit.js";
import { costForDuration, deductCredits } from "../lib/credits.js";
import { generationConfigError, runPipeline } from "../lib/pipeline.js";
import { runAgent } from "../lib/botAgent.js";

export const botRouter = Router();
botRouter.use(requireAuth);

const isValidId = (id) => mongoose.isValidObjectId(id);

/* ---------- serialization ---------- */
function messageDTO(m) {
  return {
    id: String(m._id),
    role: m.role,
    type: m.type,
    content: m.content,
    toolName: m.toolName ?? undefined,
    projectId: m.projectId ? String(m.projectId) : undefined,
    outputUrl: m.outputUrl ?? undefined,
    createdAt: m.createdAt,
  };
}
function sessionDTO(s) {
  const ag = s.activeGeneration;
  return {
    id: String(s._id),
    title: s.title,
    messages: (s.messages || []).map(messageDTO),
    activeGeneration: ag?.projectId
      ? { projectId: String(ag.projectId), status: ag.status, progress: ag.progress ?? 0 }
      : null,
    updatedAt: s.updatedAt,
  };
}

function clearGeneration(session) {
  session.activeGeneration = { projectId: null, status: null, progress: 0, messageId: null };
}

/**
 * Sync the active-generation snapshot from its Project. Mutates + saves the
 * session when the task finishes (appends an asset/text message). Returns the
 * (possibly saved) session.
 */
async function reconcile(session) {
  const ag = session.activeGeneration;
  if (!ag?.projectId) return session;

  const proj = await Project.findById(ag.projectId).lean();
  if (!proj) {
    clearGeneration(session);
    await session.save();
    return session;
  }

  const toolMsg = ag.messageId ? session.messages.id(ag.messageId) : null;

  if (proj.status === "DONE" && proj.outputUrl) {
    if (toolMsg) toolMsg.content = "Your video is ready.";
    session.messages.push({
      role: "assistant",
      type: "asset",
      content: (proj.prompt || "Your video").slice(0, 90),
      projectId: proj._id,
      outputUrl: proj.outputUrl,
    });
    clearGeneration(session);
    await session.save();
  } else if (proj.status === "FAILED") {
    if (toolMsg) toolMsg.content = "Generation failed.";
    session.messages.push({
      role: "assistant",
      type: "text",
      content: `That one didn't render: ${proj.errorMessage || "render error"}. Want me to try again?`,
    });
    clearGeneration(session);
    await session.save();
  } else {
    // still running — reflect live progress on the tool card
    const pct = Number(proj.progress) || 0;
    ag.status = proj.status;
    ag.progress = pct;
    if (toolMsg) toolMsg.content = `Generating your video… ${pct}%`;
    await session.save();
  }
  return session;
}

/* ---------- routes ---------- */

// List sessions (lightweight).
botRouter.get("/sessions", async (req, res, next) => {
  try {
    const sessions = await BotChatSession.find({ userId: req.user.id, deletedAt: null })
      .sort({ updatedAt: -1 })
      .select("title updatedAt")
      .lean();
    res.json(sessions.map((s) => ({ id: String(s._id), title: s.title, updatedAt: s.updatedAt })));
  } catch (err) {
    next(err);
  }
});

// Create a new (empty) session.
botRouter.post("/sessions", async (req, res, next) => {
  try {
    const session = await BotChatSession.create({ userId: req.user.id, title: "New chat", messages: [] });
    res.status(201).json(sessionDTO(session));
  } catch (err) {
    next(err);
  }
});

// Get one session (reconciles any active generation → resume-on-reload).
botRouter.get("/sessions/:id", async (req, res, next) => {
  try {
    if (!isValidId(req.params.id)) return res.status(404).json({ error: "Not found" });
    const session = await BotChatSession.findOne({ _id: req.params.id, deletedAt: null });
    if (!session || String(session.userId) !== req.user.id)
      return res.status(404).json({ error: "Not found" });
    await reconcile(session);
    res.json(sessionDTO(session));
  } catch (err) {
    next(err);
  }
});

botRouter.delete("/sessions/:id", async (req, res, next) => {
  try {
    if (!isValidId(req.params.id)) return res.status(404).json({ error: "Not found" });
    const session = await BotChatSession.findOne({ _id: req.params.id, deletedAt: null });
    if (!session || String(session.userId) !== req.user.id)
      return res.status(404).json({ error: "Not found" });
    session.deletedAt = new Date();
    await session.save();
    res.status(204).end();
  } catch (err) {
    next(err);
  }
});

// Send a message → run the agent → chat reply or kick off a video generation.
botRouter.post(
  "/sessions/:id/messages",
  rateLimit({ max: 40, windowMs: 60 * 60 * 1000 }),
  validate(BotMessageInput),
  async (req, res, next) => {
    try {
      if (!isValidId(req.params.id)) return res.status(404).json({ error: "Not found" });
      const session = await BotChatSession.findOne({ _id: req.params.id, deletedAt: null });
      if (!session || String(session.userId) !== req.user.id)
        return res.status(404).json({ error: "Not found" });

      const { message } = req.body;

      // Append the user's message; title the thread from the first one.
      session.messages.push({ role: "user", type: "text", content: message });
      if (session.title === "New chat") {
        session.title = message.split(/\s+/).slice(0, 7).join(" ").slice(0, 60) || "New chat";
      }

      // If a generation is already running, just reconcile + nudge.
      if (session.activeGeneration?.projectId) {
        await session.save();
        await reconcile(session);
        return res.json(sessionDTO(session));
      }

      // Run the agent over the text history.
      const history = session.messages
        .filter((m) => m.type === "text")
        .map((m) => ({ role: m.role, content: m.content }));
      const result = await runAgent(history);

      if (result.kind === "tool" && result.tool === "create_video") {
        const { prompt, durationSec, aspectRatio, recipe } = result.args;

        // Provider guard (same as the projects route). Scope is enforced by the
        // agent's own system prompt, so we don't re-run the domain guard here.
        const configError = await generationConfigError(req.user.id);
        if (configError) {
          session.messages.push({ role: "assistant", type: "text", content: configError });
          await session.save();
          return res.json(sessionDTO(session));
        }

        // Create the Project (the "tool execution") + charge credits.
        const project = await Project.create({
          userId: req.user.id,
          prompt,
          aspectRatio,
          durationSec,
          recipe: recipe || "auto",
          status: "PLANNING",
          progress: 0,
        });

        const cost = costForDuration(durationSec);
        try {
          await deductCredits(req.user.id, cost, String(project._id));
        } catch {
          await Project.deleteOne({ _id: project._id });
          session.messages.push({
            role: "assistant",
            type: "text",
            content: "You're out of credits for that video. Top up in **Billing** and I'll get right on it.",
          });
          await session.save();
          return res.json(sessionDTO(session));
        }

        runPipeline(String(project._id), req.user.id, prompt, durationSec);

        // A friendly text line + the tool/progress card.
        session.messages.push({
          role: "assistant",
          type: "text",
          content: "On it — generating your video now. 🎬",
        });
        session.messages.push({
          role: "assistant",
          type: "tool",
          toolName: "create_video",
          content: "Generating your video… 0%",
          projectId: project._id,
        });
        const toolMsg = session.messages[session.messages.length - 1];
        session.activeGeneration = {
          projectId: project._id,
          status: "QUEUED",
          progress: 0,
          messageId: toolMsg._id,
        };
        await session.save();
        return res.json(sessionDTO(session));
      }

      // Plain chat reply.
      session.messages.push({ role: "assistant", type: "text", content: result.text });
      await session.save();
      res.json(sessionDTO(session));
    } catch (err) {
      next(err);
    }
  }
);
