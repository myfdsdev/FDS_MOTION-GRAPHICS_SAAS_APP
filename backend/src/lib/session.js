import crypto from "node:crypto";
import { Session } from "../models.js";

const SESSION_TTL_DAYS = 30;
const TTL_MS = SESSION_TTL_DAYS * 24 * 60 * 60 * 1000;
const SAME_SITE_VALUES = new Set(["lax", "strict", "none"]);

export function sessionCookieName() {
  return process.env.SESSION_COOKIE_NAME || "avs_session";
}

function boolFromEnv(value, fallback) {
  if (value === "true") return true;
  if (value === "false") return false;
  return fallback;
}

function sessionCookieOptions() {
  const isProduction = process.env.NODE_ENV === "production";
  const configuredSameSite = (process.env.SESSION_COOKIE_SAMESITE || "").toLowerCase();
  const sameSite = SAME_SITE_VALUES.has(configuredSameSite)
    ? configuredSameSite
    : isProduction
      ? "none"
      : "lax";
  const secure = boolFromEnv(
    process.env.SESSION_COOKIE_SECURE,
    isProduction || sameSite === "none"
  );
  const domain = process.env.SESSION_COOKIE_DOMAIN?.trim();

  return {
    httpOnly: true,
    secure,
    sameSite,
    maxAge: TTL_MS,
    path: "/",
    ...(domain ? { domain } : {}),
  };
}

export async function createSession(userId, res) {
  const id = crypto.randomBytes(32).toString("hex");
  const expiresAt = new Date(Date.now() + TTL_MS);
  await Session.create({ _id: id, userId, expiresAt });
  res.cookie(sessionCookieName(), id, sessionCookieOptions());
  return id;
}

export async function destroySession(sid, res) {
  await Session.deleteOne({ _id: sid });
  const { maxAge, ...clearOptions } = sessionCookieOptions();
  res.clearCookie(sessionCookieName(), clearOptions);
}
