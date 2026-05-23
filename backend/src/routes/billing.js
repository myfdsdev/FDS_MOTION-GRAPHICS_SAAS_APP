import { Router } from "express";
import { CreditTx } from "../models.js";
import { CREDIT_PACKS } from "../schemas.js";
import { toCreditTxDTO } from "../serialize.js";
import { requireAuth } from "../middleware/auth.js";

export const billingRouter = Router();

billingRouter.get("/transactions", requireAuth, async (req, res, next) => {
  try {
    const txs = await CreditTx.find({ userId: req.user.id }).sort({ createdAt: -1 }).lean();
    res.json(txs.map(toCreditTxDTO));
  } catch (err) {
    next(err);
  }
});

// Static list, no auth required.
billingRouter.get("/packs", (_req, res) => {
  res.json(CREDIT_PACKS);
});
