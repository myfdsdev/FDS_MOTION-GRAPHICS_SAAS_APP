import crypto from "node:crypto";

const PREFIX = "v1";

function encryptionKey() {
  const secret =
    process.env.API_KEY_ENCRYPTION_SECRET ||
    process.env.SESSION_SECRET ||
    process.env.SESSION_COOKIE_NAME ||
    "dev-api-key-secret";
  return crypto.createHash("sha256").update(secret).digest();
}

export function encryptSecret(value) {
  if (!value) return null;
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv("aes-256-gcm", encryptionKey(), iv);
  const encrypted = Buffer.concat([cipher.update(value, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return [PREFIX, iv.toString("base64url"), tag.toString("base64url"), encrypted.toString("base64url")].join(":");
}

export function decryptSecret(value) {
  if (!value) return "";
  const [prefix, ivRaw, tagRaw, encryptedRaw] = String(value).split(":");
  if (prefix !== PREFIX || !ivRaw || !tagRaw || !encryptedRaw) return "";
  const decipher = crypto.createDecipheriv(
    "aes-256-gcm",
    encryptionKey(),
    Buffer.from(ivRaw, "base64url")
  );
  decipher.setAuthTag(Buffer.from(tagRaw, "base64url"));
  return Buffer.concat([
    decipher.update(Buffer.from(encryptedRaw, "base64url")),
    decipher.final(),
  ]).toString("utf8");
}

export function secretSummary(value) {
  const decrypted = decryptSecret(value);
  return {
    configured: Boolean(decrypted),
    last4: decrypted ? decrypted.slice(-4) : null,
  };
}
