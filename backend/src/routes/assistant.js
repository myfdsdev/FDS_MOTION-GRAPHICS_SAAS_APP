import { Router } from "express";
import { AssistantChatInput } from "../schemas.js";
import { requireAuth } from "../middleware/auth.js";
import { validate } from "../middleware/validate.js";
import { callLLM, hasAnyProvider } from "../lib/providers/index.js";
import {
  isVideoAssistantTopic,
  VIDEO_ASSISTANT_SCOPE_MESSAGE,
} from "../lib/domainGuard.js";

export const assistantRouter = Router();

const ASSISTANT_SYSTEM_PROMPT = `You are the product assistant inside an AI video-making app.

Allowed scope:
- How to use this app to make, render, edit, or debug videos.
- Remotion components, imports, animation, timelines, frames, previews, bundles, and render errors.
- Video creative direction: prompts, scripts, storyboards, scene planning, motion graphics, typography, captions, ads, promos, explainers, shorts, reels, YouTube, and templates.
- Audio for videos: TTS, voiceover, music, sound effects, sync, Piper, ElevenLabs.
- Software setup that directly supports this video app: frontend, backend, API keys, MongoDB, workers, deployment, storage, and production rendering.

If the user asks about anything outside that scope, reply with this exact sentence:
"${VIDEO_ASSISTANT_SCOPE_MESSAGE}"

For allowed video creation requests, do not draft a long prompt by default. Tell the user to type the video idea, paste a script, or attach a reference image, then use the generate arrow.

For allowed technical questions, be practical and clear. Keep replies under 90 words unless the user asks for exact code or steps.`;

assistantRouter.post("/chat", requireAuth, validate(AssistantChatInput), async (req, res, next) => {
  try {
    const { message } = req.body;
    if (!isVideoAssistantTopic(message)) {
      return res.json({ reply: VIDEO_ASSISTANT_SCOPE_MESSAGE });
    }
    if (!hasAnyProvider()) {
      return res.json({
        reply:
          "Assistant AI is not configured yet. Add an AI provider key on the backend, then I can answer video-making, Remotion, rendering, and software setup questions here.",
      });
    }

    const reply = await callLLM({
      system: ASSISTANT_SYSTEM_PROMPT,
      user: message,
      maxTokens: 260,
    });

    res.json({ reply: reply.trim() || VIDEO_ASSISTANT_SCOPE_MESSAGE });
  } catch (err) {
    next(err);
  }
});
