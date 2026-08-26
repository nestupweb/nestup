/** The built-in hello offered after a like — no name, by the user's decision (2026-08-26). */
export const DEFAULT_INTRO = "Hi, I liked the room — can we schedule a viewing?";

/**
 * The message pre-filled in the "say hi" sheet: the seeker's own saved
 * template when they have one (Profile › Default hello message), otherwise
 * `DEFAULT_INTRO`. A {name} written into an older custom template still
 * becomes the host's first name, but the app no longer suggests it.
 */
export function renderIntro(template: string, hostName: string): string {
  const first = hostName.trim().split(/\s+/)[0] || "there";
  return (template.trim() || DEFAULT_INTRO).replace(/\{\s*name\s*\}/gi, first);
}
