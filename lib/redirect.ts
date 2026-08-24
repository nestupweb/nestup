/**
 * Open-redirect guard: only same-origin, root-relative paths are safe to
 * redirect to. `//evil.com` is protocol-relative, `/\evil.com` resolves
 * off-origin because WHATWG URL parsing treats `\` as `/` for http(s), and
 * browsers strip ASCII tab/newline/CR anywhere in a URL before resolving —
 * so `/\t/evil.com` would also escape. Checks run on the stripped value.
 */
export function sanitizeNextPath(raw: string, fallback = "/swipe"): string {
  const stripped = raw.replace(/[\t\n\r]/g, "");
  return stripped.startsWith("/") && !stripped.startsWith("//") && !stripped.startsWith("/\\")
    ? stripped
    : fallback;
}
