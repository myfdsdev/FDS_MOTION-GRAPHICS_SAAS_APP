export function configuredAdminEmails() {
  return new Set(
    (process.env.ADMIN_EMAILS || "")
      .split(",")
      .map((email) => email.trim().toLowerCase())
      .filter(Boolean)
  );
}

export function isAdminUser(user) {
  if (!user) return false;
  if (user.role === "admin") return true;
  return configuredAdminEmails().has(String(user.email || "").toLowerCase());
}
