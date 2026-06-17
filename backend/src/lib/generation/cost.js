// Cost tracker — reserve budget before generation, reconcile actual spend after.
// Integrates with the credits system so users can't burn cash on failed/wasted
// jobs. Workflow: estimate → reserve → run job → reconcile (deduct actual, refund delta).

import { estimateCost } from "./capabilities.js";

export const COST = {
  // Hard cap per job type so one bad call doesn't drain the account. Override
  // via MAX_COST_PER_<CAPABILITY> env. Estimate should land *under* these.
  MAX_PER_JOB: {
    text_to_image: 0.50,
    image_to_video: 5.0,
    text_to_video: 5.0,
    text_to_speech: 0.10,
    music: 0.50,
    transcribe: 0.50,
  },
};

export function maxCostFor(capability) {
  const envKey = `MAX_COST_PER_${capability.toUpperCase()}`;
  return process.env[envKey] ? Number(process.env[envKey]) : COST.MAX_PER_JOB[capability] || 1.0;
}

/**
 * Reserve budget for a generation job. Throws if user's balance is too low or
 * the estimated cost exceeds per-job limits.
 *
 * @returns { estimatedCostUsd, reserved: true }
 */
export async function reserveBudget(userId, capability, params = {}) {
  const estimated = estimateCost(capability, params);
  const max = maxCostFor(capability);

  if (estimated > max) {
    throw new Error(
      `${capability} estimated cost $${estimated.toFixed(3)} exceeds job limit $${max.toFixed(3)}. Use cheaper params.`
    );
  }

  // In a real app, fetch user's credit balance from DB. For now, assume
  // sufficient (guards are here; integrate with your credits table when ready).
  // placeholder: assume user has credits
  const userBalance = 100; // TODO: fetch from User.credits
  if (estimated > userBalance) {
    throw new Error(`Insufficient balance. Estimated $${estimated.toFixed(3)}, have $${userBalance.toFixed(3)}.`);
  }

  return { estimatedCostUsd: estimated, reserved: true };
}

/**
 * Reconcile actual spend after a job completes. If the provider returned a
 * `costUsd` in the result, use it; otherwise fall back to the estimate.
 * Refund the difference between reserved and actual.
 *
 * @returns { actualCostUsd, refundedUsd }
 */
export async function reconcileCost(userId, estimatedUsd, actualUsd = null) {
  const final = actualUsd ?? estimatedUsd;
  const refunded = Math.max(0, estimatedUsd - final);

  // TODO: update User.credits with the deduction + refund
  // await User.updateOne({ _id: userId }, { $inc: { credits: -final } });

  return { actualCostUsd: final, refundedUsd: refunded };
}
