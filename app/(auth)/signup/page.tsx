import { AuthForm } from "@/components/auth/AuthForm";
import { signUpAction } from "@/app/actions/auth";

export default function SignupPage() {
  return <AuthForm mode="signup" action={signUpAction} />;
}
