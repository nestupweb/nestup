/** Turns a handle, bare domain or full URL into something a link can open. */
export function socialHref(kind: "instagram" | "facebook" | "linkedin", raw: string): string | undefined {
  const v = raw.trim();
  if (!v) return undefined;
  if (/^https?:\/\//i.test(v)) return v;
  if (/^(www\.)?(instagram|facebook|linkedin)\.com\//i.test(v)) return `https://${v.replace(/^www\./i, "")}`;
  const handle = v.replace(/^@/, "");
  if (!/^[\w.\-/]+$/.test(handle)) return undefined; // free text like "Dana Levi" — no link
  if (kind === "instagram") return `https://instagram.com/${handle}`;
  if (kind === "facebook") return `https://facebook.com/${handle}`;
  return `https://linkedin.com/in/${handle.replace(/^in\//, "")}`;
}
