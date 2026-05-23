import { Router } from "express";
import { User } from "../models.js";
import { CREDIT_PACKS, TopUpInput } from "../schemas.js";
import { toUserDTO } from "../serialize.js";
import { requireAuth } from "../middleware/auth.js";
import { validate } from "../middleware/validate.js";
import { addCredits } from "../lib/credits.js";

export const stripeRouter = Router();

// Level 1: simulate instant credit after a short delay instead of redirecting
// to a real Stripe checkout session.
stripeRouter.post("/checkout", requireAuth, validate(TopUpInput), async (req, res, next) => {
  try {
    const { packId } = req.body;
    const pack = CREDIT_PACKS.find((p) => p.id === packId);
    if (!pack) return res.status(400).json({ error: "Unknown pack" });

    await new Promise((r) => setTimeout(r, 600));
    await addCredits(req.user.id, pack.credits, "stripe_topup");

    const user = await User.findById(req.user.id).lean();
    if (!user) return res.status(401).json({ error: "Not authenticated" });
    res.status(200).json(toUserDTO(user));
  } catch (err) {
    next(err);
  }
});

// Raw-body webhook handler. Mounted in app.js before express.json(). Optional
// for Level 1 since checkout simulates completion.
export function stripeWebhookHandler(_req, res) {
  res.status(200).json({ received: true });
}
