import { NextResponse, type NextRequest } from "next/server";
import type { EmailOtpType } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/server";

/**
 * Where every emailed auth link lands. Two shapes arrive here:
 *  - `?token_hash=…&type=email|recovery` — templates that link straight to the
 *    site (verified with `verifyOtp`);
 *  - `?code=…&next=/reset-password` — Supabase's own `{{ .ConfirmationURL }}`
 *    bouncing back to the `redirectTo` we gave `resetPasswordForEmail` (PKCE
 *    code exchanged for a session).
 * Signup confirmations continue to onboarding; recovery links go to the
 * set-a-new-password screen. Anything invalid or expired lands on /login with
 * a notice that says which link failed.
 */
export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl;
  const token_hash = searchParams.get("token_hash");
  const type = searchParams.get("type") as EmailOtpType | null;
  const code = searchParams.get("code");
  const recovery = type === "recovery" || searchParams.get("next") === "/reset-password";

  let ok = false;
  if (token_hash && type) {
    const supabase = await createClient();
    ok = !(await supabase.auth.verifyOtp({ type, token_hash })).error;
  } else if (code) {
    const supabase = await createClient();
    ok = !(await supabase.auth.exchangeCodeForSession(code)).error;
  }

  const to = ok
    ? recovery ? "/reset-password" : "/profile?onboarding=1"
    : recovery ? "/login?error=recovery" : "/login?error=confirmation";
  return NextResponse.redirect(new URL(to, request.url));
}
