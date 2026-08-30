import { AuthForm } from "@/components/auth/AuthForm";
import { signInAction } from "@/app/actions/auth";

import { SUSPENDED_MESSAGE } from "@/lib/moderation";

// TODO: Cache Components adoption. Refactor this route so this opt-out can be removed.
// See: https://nextjs.org/docs/app/guides/migrating-to-cache-components
export const instant = false;

// A confirmation link is single-use, so the commonest way to land here is
// opening one that already did its job — in which case the account is fine and
// logging in is the answer, not signing up again.
const NOTICES: Record<string, string> = {
  // A session that was live when the suspension landed gets bounced here.
  suspended: SUSPENDED_MESSAGE,
  confirmation:
    "That confirmation link didn't work — it has either expired or already been used. Try logging in below; if that fails, sign up again for a fresh link.",
  recovery: "That password-reset link was invalid or expired. Request a new one below.",
};

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string; error?: string }>;
}) {
  const { next, error } = await searchParams;
  const notice = error ? NOTICES[error] : undefined;
  return <AuthForm mode="login" action={signInAction} next={next} notice={notice} />;
}
