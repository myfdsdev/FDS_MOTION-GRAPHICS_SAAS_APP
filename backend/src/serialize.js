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
    template: p.template ?? undefined,
    aspectRatio: p.aspectRatio,
    durationSec: p.durationSec,
    outputUrl: p.outputUrl ?? undefined,
    thumbnailUrl: p.thumbnailUrl ?? undefined,
    progress: p.progress,
    errorMessage: p.errorMessage ?? undefined,
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
