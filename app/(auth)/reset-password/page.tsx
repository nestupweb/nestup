import { redirect } from "next/navigation";
import { ResetPasswordForm } from "@/components/auth/ResetPasswordForm";
import { updatePasswordAction } from "@/app/actions/auth";
import { getAuthContext } from "@/lib/auth";

// TODO: Cache Components adoption. Refactor this route so this opt-out can be removed.
// See: https://nextjs.org/docs/app/guides/migrating-to-cache-components
export const instant = false;

/**
 * Reached from the recovery email via /auth/confirm, which has already
 * signed the user in. Without a session there's nothing to reset — send them
 * back to log in with a "link expired" notice.
 */
export default async function ResetPasswordPage() {
  const { user } = await getAuthContext();
  if (!user) redirect("/login?error=recovery");
  return <ResetPasswordForm action={updatePasswordAction} email={user.email} />;
}
