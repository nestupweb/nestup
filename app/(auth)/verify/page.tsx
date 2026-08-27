import { VerifyForm } from "@/components/auth/VerifyForm";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/**
 * Where the confirmation e-mail's "closed the tab?" link lands. The address
 * rides in the query string so the usual visit is code-only; anything that
 * isn't an address is dropped and the form asks for one, which keeps a
 * hand-written `?email=` from putting arbitrary text on the page.
 */
export default async function VerifyPage({
  searchParams,
}: {
  searchParams: Promise<{ email?: string }>;
}) {
  const { email } = await searchParams;
  const clean = typeof email === "string" && EMAIL_RE.test(email.trim()) ? email.trim().toLowerCase() : "";
  return <VerifyForm email={clean} />;
}
