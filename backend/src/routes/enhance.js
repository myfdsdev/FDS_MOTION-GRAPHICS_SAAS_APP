import { Router } from "express";
import { EnhancePromptInput } from "../schemas.js";
import { requireAuth } from "../middleware/auth.js";
import { validate } from "../middleware/validate.js";
import { enhancePromptWithAi, generationConfigError } from "../lib/pipeline.js";

export const enhanceRouter = Router();

enhanceRouter.post("/", requireAuth, validate(EnhancePromptInput), async (req, res, next) => {
  try {
    const configError = await generationConfigError(req.user.id);
    if (configError) return res.status(500).json({ error: configError });
    const prompt = await enhancePromptWithAi(req.body.prompt, req.user.id);
    res.json({ prompt });
  } catch (err) {
    next(err);
  }
});
