/** Turns a handle, bare domain or full URL into something a link can open. */
export function socialHref(kind: "instagram" | "facebook" | "linkedin", raw: string): string | undefined {
  const v = raw.trim();
  if (!v) return undefined;
  if (/^https?:\/\//i.test(v)) return v;
  if (/^(www\.)?(instagram|facebook|linkedin)\.com\//i.test(v)) return `https://${v.replace(/^www\./i, "")}`;
  const handle = v.replace(/^@/, "");
  if (/^[\w.\-/]+$/.test(handle)) {
    if (kind === "instagram") return `https://instagram.com/${handle}`;
    if (kind === "facebook") return `https://facebook.com/${handle}`;
    return `https://linkedin.com/in/${handle.replace(/^in\//, "")}`;
  }

  /*
   * Free text — a name rather than a handle ("guy licht"). It used to get no
   * link at all, which left a chip styled exactly like the working ones sitting
   * dead on the profile. LinkedIn and Facebook both take a people search in the
   * URL, so the chip leads somewhere that can actually find the person.
   *
   * Instagram is left out on purpose: it has no stable public people-search URL,
   * and a name with a space in it is never an Instagram handle anyway.
   */
  const q = encodeURIComponent(v);
  if (kind === "linkedin") return `https://www.linkedin.com/search/results/people/?keywords=${q}`;
  if (kind === "facebook") return `https://www.facebook.com/search/people/?q=${q}`;
  return undefined;
}
