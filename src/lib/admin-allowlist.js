// Email allowlist for admin dashboard access.
// Configured via ADMIN_EMAILS (comma-separated). Authentication alone is NOT
// sufficient — a user must also be on this list. Fails closed: if ADMIN_EMAILS
// is unset/empty, NO ONE is treated as an admin.
//
// This is plain (not "server-only") so the middleware can import it too.
export function adminEmails() {
  return (process.env.ADMIN_EMAILS || "")
    .split(",")
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean);
}

export function isAdminEmail(email) {
  if (!email) return false;
  return adminEmails().includes(String(email).toLowerCase());
}
