import { InsufficientCreditsError } from "../lib/credits.js";

// eslint-disable-next-line no-unused-vars -- Express needs the 4-arg signature
export function errorHandler(err, _req, res, _next) {
  if (err instanceof InsufficientCreditsError) {
    return res.status(402).json({ error: err.message });
  }
  if (Number.isInteger(err?.status) && err.status >= 400 && err.status < 500) {
    return res.status(err.status).json({ error: err.message, code: err.code });
  }
  console.error("[api] unhandled error:", err);
  if (res.headersSent) return;
  res.status(500).json({ error: "Internal server error" });
}
