import { Router } from "express";
import { User } from "../models.js";
import { UpdateProfileInput } from "../schemas.js";
import { toUserDTO } from "../serialize.js";
import { requireAuth } from "../middleware/auth.js";
import { validate } from "../middleware/validate.js";
import { encryptSecret, secretSummary } from "../lib/secrets.js";

export const profileRouter = Router();

function toProfileDTO(user) {
  return {
    user: toUserDTO(user),
    apiKeys: {
      openai: secretSummary(user.apiKeys?.openai),
      gemini: secretSummary(user.apiKeys?.gemini),
      openrouter: secretSummary(user.apiKeys?.openrouter),
      fal: secretSummary(user.apiKeys?.fal),
    },
  };
}

function encryptedKeyPatch(apiKeys = {}) {
  const patch = {};
  for (const key of ["openai", "gemini", "openrouter", "fal"]) {
    if (!(key in apiKeys)) continue;
    const value = apiKeys[key]?.trim();
    patch[`apiKeys.${key}`] = value ? encryptSecret(value) : null;
  }
  return patch;
}

profileRouter.use(requireAuth);

profileRouter.get("/", async (req, res, next) => {
  try {
    const user = await User.findById(req.user.id).lean();
    if (!user) return res.status(401).json({ error: "Not authenticated" });
    res.json(toProfileDTO(user));
  } catch (err) {
    next(err);
  }
});

profileRouter.patch("/", validate(UpdateProfileInput), async (req, res, next) => {
  try {
    const update = {};
    if ("name" in req.body) update.name = req.body.name;
    Object.assign(update, encryptedKeyPatch(req.body.apiKeys));

    const user = await User.findByIdAndUpdate(req.user.id, update, {
      new: true,
      runValidators: true,
    }).lean();

    if (!user) return res.status(401).json({ error: "Not authenticated" });
  