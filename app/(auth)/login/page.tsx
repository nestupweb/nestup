import { AuthForm } from "@/components/auth/AuthForm";
import { signInAction } from "@/app/actions/auth";

// A confirmation link is single-use, so the commonest way to land here is
// opening one that already did its job — in which case the account is fine and
// logging in is the answer, not signing up again.
const NOTICES: Record<string, string> = {
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
