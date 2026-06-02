import { Router } from "express";
import { z } from "zod";
import { requireAuth } from "../middleware/auth.js";
import { validate } from "../middleware/validate.js";
import { generatePiperWav, localTtsScriptPath } from "../lib/localTts.js";

const LocalTtsInput = z.object({
  text: z.string().trim().min(1, "Enter text to generate audio").max(2000),
});

export const localTtsRouter = Router();

localTtsRouter.use(requireAuth);

localTtsRouter.get("/config", (_req, res) => {
  res.json({
    provider: "piper",
    scriptPath: localTtsScriptPath(),
  });
});

localTtsRouter.post("/generate", validate(LocalTtsInput), async (req, res, next) => {
  try {
    const audio = await generatePiperWav({
      text: req.body.text,
      userId: req.user.id,
    });

    const origin = `${req.protocol}://${req.get("host")}`;
    res.status(201).json({
      provider: "piper",
      url: `${origin}${audio.relativeUrl}`,
      path: audio.relativeUrl,
      fileName: audio.fileName,
      size: audio.size,
    });
  } catch (err) {
    next(err);
  }
});
