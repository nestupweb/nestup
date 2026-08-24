/**
 * Open-redirect guard: only same-origin, root-relative paths are safe to
 * redirect to. `//evil.com` is protocol-relative, and `/\evil.com` also
 * resolves off-origin because WHATWG URL parsing treats `\` as `/` for
 * http(s).
 */
export function sanitizeNextPath(raw: string, fallback = "/swipe"): string {
  return raw.startsWith("/") && !raw.startsWith("//") && !raw.startsWith("/\\") ? raw : fallback;
}
