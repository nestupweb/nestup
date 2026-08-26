import { AuthForm } from "@/components/auth/AuthForm";
import { signInAction } from "@/app/actions/auth";

const NOTICES: Record<string, string> = {
  confirmation: "That confirmation link was invalid or expired. Sign up again or try logging in.",
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
