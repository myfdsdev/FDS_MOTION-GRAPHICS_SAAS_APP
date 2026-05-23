import { Router } from "express";
import { PresignInput } from "../schemas.js";
import { requireAuth } from "../middleware/auth.js";
import { validate } from "../middleware/validate.js";

export const assetsRouter = Router();

assetsRouter.post("/presign", requireAuth, validate(PresignInput), (req, res) => {
  res.status(500).json({
    error: "S3/R2 presigned uploads are not configured yet.",
  });
});
