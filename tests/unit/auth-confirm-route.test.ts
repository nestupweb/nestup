// @vitest-environment node
import { beforeEach, expect, test, vi } from "vitest";
import { NextRequest } from "next/server";

/**
 * /auth/confirm is where every emailed auth link lands: signup confirmations
 * continue to onboarding, password-recovery links to /reset-password, and a
 * bad link bounces to /login with a notice naming which flow failed.
 */
const verifyOtp = vi.fn();
const exchangeCodeForSession = vi.fn();
vi.mock("@/lib/supabase/server", () => ({
  createClient: async () => ({ auth: { verifyOtp, exchangeCodeForSession } }),
}));

beforeEach(() => {
  verifyOtp.mockReset().mockResolvedValue({ error: null });
  exchangeCodeForSession.mockReset().mockResolvedValue({ error: null });
});

async function land(query: string): Promise<string> {
  const { GET } = await import("@/app/auth/confirm/route");
  const res = await GET(new NextRequest(`https://nestup.test/auth/confirm?${query}`));
  return new URL(res.headers.get("location")!).pathname + new URL(res.headers.get("location")!).search;
}

test("signup confirmation token → onboarding", async () => {
  expect(await land("token_hash=abc&type=email")).toBe("/profile?onboarding=1");
  expect(verifyOtp).toHaveBeenCalledWith({ type: "email", token_hash: "abc" });
});

test("recovery token → set a new password", async () => {
  expect(await land("token_hash=abc&type=recovery")).toBe("/reset-password");
  expect(exchangeCodeForSession).not.toHaveBeenCalled();
});

test("Supabase's own recovery redirect (?code=…&next=/reset-password) exchanges the PKCE code", async () => {
  expect(await land("code=pkce-123&next=/reset-password")).toBe("/reset-password");
  expect(exchangeCodeForSession).toHaveBeenCalledWith("pkce-123");
  expect(verifyOtp).not.toHaveBeenCalled();
});

test("an expired recovery link says so on the login page", async () => {
  verifyOtp.mockResolvedValue({ error: { message: "expired" } });
  expect(await land("token_hash=old&type=recovery")).toBe("/login?error=recovery");
  exchangeCodeForSession.mockResolvedValue({ error: { message: "expired" } });
  expect(await land("code=old&next=/reset-password")).toBe("/login?error=recovery");
});

test("an expired or missing signup link keeps the confirmation notice", async () => {
  verifyOtp.mockResolvedValue({ error: { message: "expired" } });
  expect(await land("token_hash=old&type=email")).toBe("/login?error=confirmation");
  expect(await land("")).toBe("/login?error=confirmation");
});
