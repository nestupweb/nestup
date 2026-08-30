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
   * Free text — a name rather than a handle ("guy licht"), which on LinkedIn is
   * the normal thing to type: its profile URLs are slugs nobody knows by heart,
   * so the field ends up holding a name and the chip sat there dead, styled
   * exactly like the working ones beside it. A name is all LinkedIn's people
   * search wants, so the chip can lead somewhere that finds the person.
   *
   * Only LinkedIn. Facebook and Instagram free text stays an unlinked chip, as
   * `daily-life.test` pins down — this is the one field where a name is the
   * expected input rather than a mistake.
   */
  if (kind === "linkedin") {
    return `https://www.linkedin.com/search/results/people/?keywords=${encodeURIComponent(v)}`;
  }
  return undefined;
}
