import { redirect } from "next/navigation";

// Interim root: the full landing page is deferred by scope decision (2026-08-24);
// public browse is the natural home until it lands.
export default function PublicIndex() {
  redirect("/browse");
}
