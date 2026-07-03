const allowedAuthNextPrefixes = [
  "/pricing",
  "/student",
  "/teacher",
  "/parent",
  "/admin",
  "/learn",
  "/demo",
  "/reset-password",
] as const;

export function sanitizeAuthNextPath(value: string | null | undefined) {
  if (!value) return null;
  if (!value.startsWith("/") || value.startsWith("//") || value.includes("://") || value.includes("\\") || /[\r\n]/.test(value)) {
    return null;
  }
  const pathOnly = value.split(/[?#]/, 1)[0];
  if (!allowedAuthNextPrefixes.some((prefix) => pathOnly === prefix || pathOnly.startsWith(`${prefix}/`))) {
    return null;
  }
  return value;
}
