// ---------------------------------------------------------------------------
// Structural variety engine. Two jobs:
//   1. Given a user, summarize what their RECENT videos already used so the
//      AI plan generator can be told "don't repeat any of this".
//   2. Given a freshly generated plan, persist its signature to user.recentSignatures
//      so the next generation can avoid it too.
//
// We intentionally only track STRUCTURE here (themes + variant fingerprints)
// — palette/colors get layered on in a later phase.
// ---------------------------------------------------------------------------

import { User } from "../models.js";

const MAX_HISTORY = 20;
// How many of the most recent videos count as "do not repeat" when planning
// the next one. Smaller window = stricter avoidance.
const AVOID_WINDOW = 10;

/**
 * Build the "don't repeat" payload to inject into the AI prompt. Picks up
 * which themes have been overused recently, common theme sequences, and
 * any structural variants we want to discourage.
 */
export async function getAvoidanceHints(userId) {
  if (!userId) return { themes: [], sequences: [], variants: [] };
  const user = await User.findById(userId).select("recentSignatures").lean();
  const sigs = (user?.recentSignatures || []).slice(-AVOID_WINDOW);
  if (!sigs.length) return { themes: [], sequences: [], variants: [] };

  // Count theme usage in the window. Themes used 2+ times recently are
  // strongly discouraged; themes used 3+ times are explicitly avoided.
  const themeCount = new Map();
  for (const s of sigs) {
    for (const t of s.themes || s.templates || []) {
      themeCount.set(t, (themeCount.get(t) || 0) + 1);
    }
  }
  const overused = [...themeCount.entries()]
    .filter(([, n]) => n >= 2)
    .sort((a, b) => b[1] - a[1])
    .map(([t]) => t);

  // Recent full sequences so the AI doesn't reuse the same theme order again.
  const sequences = sigs
    .map((s) => (s.themes || s.templates || []).join(" → "))
    .filter(Boolean)
    .slice(-5);

  // Variant fingerprints (corner / grid / align combos) — these are what
  // makes a structural look feel repetitive even when the theme differs.
  const variants = sigs.flatMap((s) => s.variants || []);

  return {
    themes: overused,
    sequences,
    variants: Array.from(new Set(variants)).slice(0, 20),
  };
}

/**
 * Append a video's structural signature to the user's history. Capped so
 * the doc never bloats. Called from the pipeline right after a plan is
 * accepted and persisted.
 */
export async function recordVideoSignature(userId, projectId, plan) {
  if (!userId || !plan) return;
  const themes = (plan.scenes || [])
    .map((s) => s?.sceneTheme || s?.sceneTemplate)
    .filter(Boolean);
  // Variant fingerprints come from the same hash the renderer uses to pick
  // chrome/grid/align — recompute here so a planned scene has a stable id.
  const variants = (plan.scenes || []).map((s, i) =>
    structureVariantId(s, i, plan.structureSeed || 0)
  );
  try {
    await User.updateOne(
      { _id: userId },
      {
        $push: {
          recentSignatures: {
            $each: [
              {
                projectId: String(projectId),
                themes,
                variants,
                createdAt: new Date(),
              },
            ],
            $slice: -MAX_HISTORY,
          },
        },
      }
    );
  } catch {
    // Non-critical — variety memory failing must never block the user.
  }
}

/**
 * Stable fingerprint for a scene's *structural* variant — corner positions,
 * grid density, alignment, size class, background treatment. NOT colors.
 *
 * Keep this in sync with the variant tuple the renderer uses (Video.jsx
 * `pickSceneVariant`). When new structural dimensions are added, extend
 * the tuple here so anti-repetition stays accurate.
 */
export function structureVariantId(scene, index, seed) {
  const text = scene?.headline || scene?.text || "";
  const tpl = scene?.sceneTheme || scene?.sceneTemplate || "?";
  // Cheap djb2-ish hash so we don't pull in crypto.
  let h = 5381 ^ Number(seed || 0);
  const mix = `${index}|${tpl}|${text}`;
  for (let i = 0; i < mix.length; i++) h = ((h << 5) + h + mix.charCodeAt(i)) >>> 0;
  // Mirror dimensions of pickSceneVariant for a stable shape: bg|corner|grid|align|size|flip
  const bg = ["radial", "diagonal", "spotlight", "mesh", "noise"][h % 5];
  const corner = ["tl", "tr", "bl", "br"][(h >> 3) % 4];
  const grid = ["none", "thin", "med", "dense"][(h >> 6) % 4];
  const align = ["left", "center", "right"][(h >> 9) % 3];
  const size = ["xs", "s", "m", "l", "xl"][(h >> 12) % 5];
  const flip = ((h >> 15) & 1) ? "flip" : "norm";
  return `${tpl}/${bg}/${corner}/${grid}/${align}/${size}/${flip}`;
}
