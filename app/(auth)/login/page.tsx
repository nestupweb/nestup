import { AuthForm } from "@/components/auth/AuthForm";
import { signInAction } from "@/app/actions/auth";

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string; error?: string }>;
}) {
  const { next, error } = await searchParams;
  const notice =
    error === "confirmation"
      ? "That confirmation link was invalid or expired. Sign up again or try logging in."
      : undefined;
  return <AuthForm mode="login" action={signInAction} next={next} notice={notice} />;
}
