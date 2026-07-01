// imageStore — persist user-uploaded images (data URLs) to backend/public/uploads
// so the renderer can load them via staticFile("uploads/<file>") and the vision
// model can read them off disk. Returns staticFile-relative paths.

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
// src/lib/generation -> backend/public/uploads
export const PUBLIC_DIR = path.resolve(__dirname, "../../../public");
const UPLOADS_DIR = path.join(PUBLIC_DIR, "uploads");

const EXT_BY_MIME = { "image/png": "png", "image/jpeg": "jpg", "image/jpg": "jpg", "image/webp": "webp", "image/gif": "gif" };

/**
 * Save an array of data-URL images. Non-image / malformed entries are skipped.
 * @returns {string[]} staticFile-relative paths, e.g. "uploads/<projectId>-0.jpg"
 */
export function saveProjectImages(projectId, dataUrls = []) {
  if (!Array.isArray(dataUrls) || !dataUrls.length) return [];
  fs.mkdirSync(UPLOADS_DIR, { recursive: true });

  const saved = [];
  dataUrls.slice(0, 8).forEach((durl, i) => {
    const m = /^data:(image\/[a-zA-Z+]+);base64,(.+)$/.exec(String(durl || ""));
    if (!m) return;
    const ext = EXT_BY_MIME[m[1].toLowerCase()] || "jpg";
    const file = `${projectId}-${i}.${ext}`;
    try {
      fs.writeFileSync(path.join(UPLOADS_DIR, file), Buffer.from(m[2], "base64"));
      saved.push(`uploads/${file}`);
    } catch {
      /* skip a bad image, keep the rest */
    }
  });
  return saved;
}

export function mimeFromPath(p) {
  const e = String(p).toLowerCase().split(".").pop();
  return e === "png" ? "image/png" : e === "webp" ? "image/webp" : e === "gif" ? "image/gif" : "image/jpeg";
}
