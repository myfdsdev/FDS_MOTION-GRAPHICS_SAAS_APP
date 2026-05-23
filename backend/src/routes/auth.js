import argon2 from "argon2";
import { Router } from "express";
import { CreditTx, User } from "../models.js";
import { LoginInput, RegisterInput } from "../schemas.js";
import { toUserDTO } from "../serialize.js";
import { requireAuth } from "../middleware/auth.js";
import { validate } from "../middleware/validate.js";
import { createSession, destroySession, sessionCookieName } from "../lib/session.js";

export const authRouter = Router();

authRouter.post("/register", validate(RegisterInput), async (req, res, next) => {
  try {
    const { email, password, name } = req.body;
    const existing = await User.findOne({ email: email.toLowerCase() }).lean();
    if (existing) return res.status(409).json({ error: "Email already registered" });

    const passwordHash = await argon2.hash(password);
    const user = await User.create({ email, name, passwordHash, credits: 30 });
    await CreditTx.create({ userId: user._id, delta: 30, reason: "signup_bonus" });

    await createSession(String(user._id), res);
    res.status(201).json(toUserDTO(user));
  } catch (err) {
    next(err);
  }
});

authRouter.post("/login", validate(LoginInput), async (req, res, next) => {
  try {
    const { email, password } = req.body;
    const user = await User.findOne({ email: email.toLowerCase() });
    if (!user) return res.status(401).json({ error: "Invalid email or password" });

    const ok = await argon2.verify(user.passwordHash, password);
    if (!ok) return res.status(401).json({ error: "Invalid email or password" });

    await createSession(String(user._id), res);
    res.status(200).json(toUserDTO(user));
  } catch (err) {
    next(err);
  }
});

authRouter.post("/logout", async (req, res, next) => {
  try {
    const sid = req.cookies?.[sessionCookieName()];
    if (sid) await destroySession(sid, res);
    res.status(204).end();
  } catch (err) {
    next(err);
  }
});

authRouter.get("/me", requireAuth, async (req, res, next) => {
  try {
    const user = await User.findById(req.user.id).lean();
    if (!user) return res.status(401).json({ error: "Not authenticated" });
    res.status(200).json(toUserDTO(user));
  } catch (err) {
    next(err);
  }
});
