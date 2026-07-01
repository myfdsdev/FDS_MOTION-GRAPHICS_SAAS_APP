import { isAdminUser } from "./lib/admin.js";

export function toUserDTO(u) {
  return {
    id: String(u._id),
    email: u.email,
    name: u.name ?? null,
    credits: u.credits,
    isAdmin: isAdminUser(u),
    createdAt: new Date(u.createdAt).toISOString(),
  };
}

export function toProjectDTO(p) {
  return {
    id: String(p._id),
    userId: String(p.userId),
    prompt: p.prompt,
    status: p.status,
    script: p.script ?? undefined,
    sceneJson: p.sceneJson ?? undefined,
    // Lightweight per-scene summary from the hybrid renderer's plan — lets the
    // editor list scenes and regenerate one individually without exposing the
    // full internal plan (asset prompts, provider ids, etc).
    scenes: p.renderPlan?.scenePlan?.scenes?.length
      ? p.renderPlan.scenePlan.scenes.map((s, i) => ({
          index: i,
          id: s.id,
          description: s.description ?? "",
          durationSeconds: s.durationSeconds ?? null,
          thumbnailUrl: p.renderPlan?.videoPlan?.scenes?.[i]?.background?.src ?? null,
        }))
      : undefined,
    aspectRatio: p.aspectRatio,
    durationSec: p.durationSec,
    recipe: p.recipe ?? "auto",
    outputUrl: p.outputUrl ?? undefined,
    thumbnailUrl: p.thumbnailUrl ?? undefined,
    voiceoverUrl: p.voiceoverUrl ?? undefined,
    voiceoverDuration: p.voiceoverDuration ?? undefined,
    voiceoverError: p.voiceoverError ?? undefined,
    progress: p.progress,
    errorMessage: p.errorMessage ?? undefined,
    // Structured error telemetry for the UI's "Why did this fail?" panel.
    errorPhase: p.errorPhase ?? undefined,
    errorCode: p.errorCode ?? undefined,
    errorStack: p.errorStack ?? undefined,
    errorAt: p.errorAt ? new Date(p.errorAt).toISOString() : undefined,
    warnings: Array.isArray(p.warnings) && p.warnings.length
      ? p.warnings.map((w) => ({
          phase: w.phase ?? undefined,
          message: w.message,
          at: w.at ? new Date(w.at).toISOString() : undefined,
        }))
      : undefined,
    renderAttempts: p.renderAttempts ?? undefined,
    renderStartedAt: p.renderStartedAt
      ? new Date(p.renderStartedAt).toISOString()
      : undefined,
    renderHeartbeatAt: p.renderHeartbeatAt
      ? new Date(p.renderHeartbeatAt).toISOString()
      : undefined,
    createdAt: new Date(p.createdAt).toISOString(),
    updatedAt: new Date(p.updatedAt).toISOString(),
  };
}

export function toCreditTxDTO(t) {
  return {
    id: String(t._id),
    delta: t.delta,
    reason: t.reason,
    projectId: t.projectId ?? undefined,
    createdAt: new Date(t.createdAt).toISOString(),
  };
}
