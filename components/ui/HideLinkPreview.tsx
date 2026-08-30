"use client";

import { useEffect } from "react";

/**
 * Hides the browser's link preview — the little URL chip painted in the bottom
 * corner of the window while you hover a link. It is browser chrome, not part
 * of the page, so no CSS can reach it. The one lever a page has is the `href`
 * attribute itself: no href, no chip.
 *
 * So the attribute is *parked* in `data-parked-href` for exactly as long as the
 * pointer (or keyboard focus) sits on the link, and handed straight back the
 * instant anything wants a real link again — a press, a right-click, an Enter.
 * Because the href is always back before the click, every native affordance
 * survives untouched: same-tab navigation, ⌘/ctrl-click, middle-click,
 * "Copy link address", and Next's own client-side routing.
 *
 * One anchor is parked at a time, which is all a single pointer can hover.
 */
export function HideLinkPreview() {
  useEffect(() => {
    let parked: HTMLAnchorElement | null = null;

    const release = () => {
      const a = parked;
      parked = null;
      if (!a) return;
      const href = a.dataset.parkedHref;
      if (href != null) {
        a.setAttribute("href", href);
        delete a.dataset.parkedHref;
      }
    };

    const park = (el: EventTarget | null) => {
      const a = el instanceof Element ? el.closest("a") : null;
      if (parked && (!a || !parked.contains(a))) release();
      if (!a || a === parked || !a.hasAttribute("href")) return;
      a.dataset.parkedHref = a.getAttribute("href") ?? "";
      a.removeAttribute("href");
      parked = a;
    };

    // Moving onto anything: park the link under the pointer, unpark the last one.
    const onOver = (e: Event) => park(e.target);
    // Tabbing to a link parks it too — the chip shows on keyboard focus as well.
    // Only for *keyboard* focus, though: pressing a link also focuses it, and
    // that focus lands after `pointerdown` has handed the href back, so parking
    // it again here would leave the click with no link to follow (which quietly
    // killed ⌘/ctrl-click). `:focus-visible` is exactly the "not from a pointer"
    // test, and browsers that can't match it simply never park on focus.
    const onFocus = (e: Event) => {
      const a = e.target instanceof Element ? e.target.closest("a") : null;
      try {
        if (a?.matches(":focus-visible")) park(a);
      } catch {
        /* :focus-visible unsupported — hover-parking still works */
      }
    };
    // Leaving the window entirely — nothing is hovered any more.
    const onLeave = () => release();
    // A press, a right-click or an Enter is about to need the real link back.
    const onDown = () => release();
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Enter") release();
    };
    // ...and after the click, re-park whatever the pointer is still resting on.
    const onClick = () => {
      setTimeout(() => {
        const hovered = document.querySelectorAll("a:hover");
        park(hovered[hovered.length - 1] ?? null);
      }, 0);
    };

    document.addEventListener("pointerover", onOver);
    document.addEventListener("pointerdown", onDown, true);
    document.addEventListener("contextmenu", onDown, true);
    document.addEventListener("keydown", onKeyDown, true);
    document.addEventListener("click", onClick);
    document.addEventListener("focusin", onFocus);
    document.addEventListener("focusout", onLeave);
    document.documentElement.addEventListener("pointerleave", onLeave);

    return () => {
      document.removeEventListener("pointerover", onOver);
      document.removeEventListener("pointerdown", onDown, true);
      document.removeEventListener("contextmenu", onDown, true);
      document.removeEventListener("keydown", onKeyDown, true);
      document.removeEventListener("click", onClick);
      document.removeEventListener("focusin", onFocus);
      document.removeEventListener("focusout", onLeave);
      document.documentElement.removeEventListener("pointerleave", onLeave);
      release();
    };
  }, []);

  return null;
}
