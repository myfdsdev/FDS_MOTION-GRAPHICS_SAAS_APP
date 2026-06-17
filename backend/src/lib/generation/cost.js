// Cost tracker — REAL credit integration. Reserve credits before a generation
// job (atomic conditional decrement so concurrent jobs can't overspend),
// reconcile actual spend after, refund the difference. Backed by User.credits
// + the CreditTx ledger in models.js.
//
// USD ↔ credits: estimators in capabilities.js return USD; we convert at
// CREDITS_PER_USD (default 100 → 1 credit = $0.01). Tune via env.

import { User, CreditTx } from "../../models.js";
import { estimateCost } from "./capabilities.js";

export const CREDITS_PER_USD = Number(process.env.CREDITS_PER_USD || 100);

// Hard ceiling per job type so one bad call can't drain an account.
const MAX_PER_JOB_USD = {
  text_to_image: 0.5,
  image_to_video: 5.0,
  text_to_video: 5.0,
  text_to_speech: 0.1,
  music: 0.5,
  transcribe: 0.5,
};

export function maxCostFor(capability) {
  const envKey = `MAX_COST_PER_${capability.toUpperCase()}`;
  return process.env[envKey] ? Number(process.env[envKey]) : MAX_PER_JOB_USD[capability] || 1.0;
}

export function usdToCredits(usd) {
  return Math.max(1, Math.ceil(usd * CREDITS_PER_USD));
}

/**
 * Reserve credits for a job. Atomic: only decrements if the user still has
 * enough, so two concurrent jobs can't both pass the check. Throws on
 * over-limit estimate or insufficient balance.
 *
 * @returns {Promise<{ estimatedCostUsd, reservedCredits, balance }>}
 */
export async function reserveBudget(userId, capability, params = {}, projectId = null) {
  const estimatedCostUsd = estimateCost(capability, params);
  const max = maxCostFor(capability);
  if (estimatedCostUsd > max) {
    throw new Error(
      `${capability} estimate $${estimatedCostUsd.toFixed(3)} exceeds per-job limit $${max.toFixed(3)}.`
    );
  }
  const reservedCredits = usdToCredits(estimatedCostUsd);

  const updated = await User.findOneAndUpdate(
    { _id: userId, credits: { $gte: reservedCredits } },
    { $inc: { credits: -reservedCredits } },
    { new: true }
  );
  if (!updated) {
    throw new Error(`Insufficient credits: need ${reservedCredits} for ${capability}.`);
  }
  await CreditTx.create({
    userId,
    delta: -reservedCredits,
    reason: `gen:${capability}:reserve`,
    projectId,
  });

  return { estimatedCostUsd, reservedCredits, balance: updated.credits };
}

/**
 * Reconcile after a job. If actual spend (provider-reported USD, else estimate)
 * is less than reserved, refund the difference to the user's balance + ledger.
 *
 * @returns {Promise<{ actualCredits, refundedCredits }>}
 */
export async function reconcileCost(userId, reservedCredits, actualUsd = null, projectId = null) {
  const actualCredits = actualUsd == null ? reservedCredits : usdToCredits(actualUsd);
  const refundedCredits = Math.max(0, reservedCredits - actualCredits);

  if (refundedCredits > 0) {
    await User.updateOne({ _id: userId }, { $inc: { credits: refundedCredits } });
    await CreditTx.create({
      userId,
      delta: refundedCredits,
      reason: `gen:reconcile:refund`,
      projectId,
    });
  }
  return { actualCredits, refundedCredits };
}
