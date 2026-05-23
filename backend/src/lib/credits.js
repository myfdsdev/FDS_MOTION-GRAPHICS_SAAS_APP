import { CreditTx, User } from "../models.js";

export class InsufficientCreditsError extends Error {
  constructor() {
    super("Not enough credits");
    this.name = "InsufficientCreditsError";
  }
}

export function costForDuration(seconds) {
  return seconds >= 30 ? 20 : 10;
}

// Atomic, conditional decrement — works on any MongoDB topology (no replica set
// required). The {$gte: amount} guard ensures credits never go negative.
export async function deductCredits(userId, amount, projectId) {
  const updated = await User.findOneAndUpdate(
    { _id: userId, credits: { $gte: amount } },
    { $inc: { credits: -amount } },
    { new: true }
  ).lean();
  if (!updated) throw new InsufficientCreditsError();
  await CreditTx.create({ userId, delta: -amount, reason: "render", projectId });
  return updated.credits;
}

export async function refundCredits(userId, amount, projectId) {
  await User.updateOne({ _id: userId }, { $inc: { credits: amount } });
  await CreditTx.create({ userId, delta: amount, reason: "render_refund", projectId });
}

export async function addCredits(userId, amount, reason) {
  const updated = await User.findOneAndUpdate(
    { _id: userId },
    { $inc: { credits: amount } },
    { new: true }
  ).lean();
  await CreditTx.create({ userId, delta: amount, reason });
  return updated;
}
