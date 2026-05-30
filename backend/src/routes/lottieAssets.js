import { Router } from "express";
import { requireAuth } from "../middleware/auth.js";
import { getLottieAnimationData } from "../lib/lottieLibrary.js";

// Read-only access to a Lottie asset's animation JSON. Admin-only writes (upload,
// create) stay on /api/admin/lottie-assets. The editor canvas uses this to render
// a lottie element by id when its animationData isn't already inlined.
export const lottieAssetsRouter = Router();

lottieAssetsRouter.use(requireAuth);

lottieAssetsRouter.get("/:id/animation", async (req, res, next) => {
  try {
    const animationData = await getLottieAnimationData(req.params.id);
    if (!animationData) return res.status(404).json({ error: "Lottie asset not found" });
    res.json({ animationData });
  } catch (err) {
    next(err);
  }
});
