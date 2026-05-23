import { Session, User } from "../models.js";
import { isAdminUser } from "../lib/admin.js";
import { sessionCookieName } from "../lib/session.js";

export async function loadUser(req, _res, next) {
  try {
    const sid = req.cookies?.[sessionCookieName()];
    if (!sid) return next();
    const session = await Session.findById(sid).lean();
    if (!session || new Date(session.expiresAt) < new Date()) return next();
    const user = await User.findById(session.userId).lean();
    if (!user) return next();
    req.user = {
      id: String(user._id),
      email: user.email,
      credits: user.credits,
      role: user.role || "user",
      isAdmin: isAdminUser(user),
    };
    next();
  } catch (err) {
    next(err);
  }
}

export function requireAuth(req, res, next) {
  if (!req.user) return res.status(401).json({ error: "Not authenticated" });
  next();
}

export function requireAdmin(req, res, next) {
  if (!req.user) return res.status(401).json({ error: "Not authenticated" });
  if (!req.user.isAdmin) return res.status(403).json({ error: "Admin access required" });
  next();
}
