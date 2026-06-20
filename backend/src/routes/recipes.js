// GET /api/recipes — the video templates a user can choose from when creating a
// project. Static reference data from lib/generation/recipes.js; the chosen id
// is stored on the project and steers the scene planner.

import { Router } from "express";
import { listRecipes } from "../lib/generation/recipes.js";

export const recipesRouter = Router();

recipesRouter.get("/", (_req, res) => {
  // "auto" is offered first so the UI can default to "let AI pick".
  res.json([
    { id: "auto", label: "Auto (let AI pick)", description: "We choose the best template from your prompt.", aspectRatio: "16:9", background: "mixed" },
    ...listRecipes(),
    { id: "none", label: "No template (AI codes it)", description: "The AI writes the entire video as custom Remotion code. Most flexible, slower, needs a strong LLM.", aspectRatio: "16:9", background: "code" },
  ]);
});
