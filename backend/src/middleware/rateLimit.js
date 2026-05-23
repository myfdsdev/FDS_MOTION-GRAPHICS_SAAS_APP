const buckets = new Map();

// In-memory per-user rate limiter. Resets on process restart.
export function rateLimit({ max, windowMs }) {
  return (req, res, next) => {
    const key = req.user?.id ?? req.ip ?? "anon";
    const now = Date.now();
    const existing = buckets.get(key);
    if (!existing || existing.resetAt < now) {
      buckets.set(key, { count: 1, resetAt: now + windowMs });
      return next();
    }
    if (existing.count >= max) {
      return res.status(429).json({ error: "Too many requests, slow down" });
    }
    existing.count += 1;
    next();
  };
}
