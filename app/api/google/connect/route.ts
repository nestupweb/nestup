import { NextResponse, type NextRequest } from "next/server";
import { getAuthContext } from "@/lib/auth";
import { googleAuthUrl, googleRedirectUri, isGoogleConfigured, siteOrigin } from "@/lib/google";
import { sanitizeNextPath } from "@/lib/redirect";

const STATE_COOKIE = "nestup_google_oauth";

/** Starts the Google OAuth consent flow; `return` is where to land afterwards. */
export async function GET(request: NextRequest) {
  const origin = siteOrigin(request.url);
  const returnPath = sanitizeNextPath(request.nextUrl.searchParams.get("return") ?? "", "/chat");

  const { user } = await getAuthContext();
  if (!user) {
    return NextResponse.redirect(`${origin}/login?next=${encodeURIComponent(returnPath)}`);
  }
  if (!isGoogleConfigured()) {
    return NextResponse.redirect(`${origin}${returnPath}?calendar=unconfigured`);
  }

  const state = crypto.randomUUID();
  const response = NextResponse.redirect(googleAuthUrl(googleRedirectUri(origin), state));
  // CSRF guard: the callback must echo this exact state. The return path rides along.
  response.cookies.set(STATE_COOKIE, `${state}|${returnPath}`, {
    httpOnly: true,
    sameSite: "lax",
    secure: origin.startsWith("https"),
    maxAge: 600,
    path: "/",
  });
  return response;
}
