import { AuthForm } from "@/components/auth/AuthForm";
import { signUpAction } from "@/app/actions/auth";

// TODO: Cache Components adoption. Refactor this route so this opt-out can be removed.
// See: https://nextjs.org/docs/app/guides/migrating-to-cache-components
export const instant = false;

export default function SignupPage() {
  return <AuthForm mode="signup" action={signUpAction} />;
}
