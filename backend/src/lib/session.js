import crypto from "node:crypto";
import { Session } from "../models.js";

const SESSION_TTL_DAYS = 30;
const TTL_MS = SESSION_TTL_DAYS * 24 * 60 * 60 * 1000;

export function sessionCookieName() {
  return process.env.SESSION_COOKIE_NAME || "avs_session";
}

export async function createSession(userId, res) {
  const id = crypto.randomBytes(32).toString("hex");
  const expiresAt = new Date(Date.now() + TTL_MS);
  await Session.create({ _id: id, userId, expiresAt });
  res.cookie(sessionCookieName(), id, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    maxAge: TTL_MS,
    path: "/",
  });
  return id;
}

export async function destroySession(sid, res) {
  await Session.deleteOne({ _id: sid });
  res.clearCookie(sessionCookieName(), { path: "/" });
}
