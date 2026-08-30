import { chromium } from "playwright";

// End-to-end on the LIVE site: attach a video in a real chat as a real signed-in
// user, so the storage RLS policy is exercised with a user JWT (the earlier curl
// probe used the service role, which bypasses RLS entirely).
const base = "https://nestup-kappa.vercel.app";
const browser = await chromium.launch();
const ctx = await browser.newContext();
const page = await ctx.newPage();

const uploads = [];
page.on("response", (r) => {
  const u = r.url();
  if (u.includes("/storage/v1/object/chat-images/")) uploads.push({ status: r.status(), url: u });
});
page.on("console", (m) => {
  if (m.type() === "error") console.log("   console error:", m.text().slice(0, 160));
});

await page.goto(`${base}/login`, { waitUntil: "domcontentloaded", timeout: 60_000 });
await page.fill('input[name="email"]', "seed.user1@nestup.dev");
await page.fill('input[name="password"]', "Demo1234!");
await Promise.all([
  page.waitForURL((u) => !u.pathname.startsWith("/login"), { timeout: 60_000 }),
  page.click('button[type="submit"]'),
]);

await page.goto(`${base}/chat`, { waitUntil: "domcontentloaded", timeout: 60_000 });
const thread = page.locator('a[href^="/chat/"]').first();
await thread.waitFor({ timeout: 30_000 });
await thread.click();
await page.waitForURL(/\/chat\/[^/]+/, { timeout: 45_000 });
const conversationId = new URL(page.url()).pathname.split("/").pop();
console.log("conversation:", conversationId);

const fileInput = page.locator('input[type="file"]').first();
await fileInput.waitFor({ state: "attached", timeout: 30_000 });
await fileInput.setInputFiles({
  name: "probe-clip.mp4",
  mimeType: "video/mp4",
  buffer: Buffer.from("probe-video-bytes-not-a-real-codec"),
});

// Wait for the attachment to settle (Send enables only once the upload is ready).
const send = page.getByRole("button", { name: "Send" });
await page.waitForFunction(
  () => {
    const b = document.querySelector('button[type="submit"][aria-label="Send"]');
    return b && !b.disabled;
  },
  { timeout: 45_000 },
).catch(() => {});

const failure = await page.locator('[role="alert"]').first().textContent().catch(() => null);
console.log("composer error shown:", failure ? JSON.stringify(failure) : "none");
console.log("upload requests:", JSON.stringify(uploads.map((u) => `${u.status} ${u.url.split("/chat-images/")[1]}`)));

const enabled = await send.isEnabled().catch(() => false);
console.log("Send enabled after attach:", enabled);

if (enabled) {
  await send.click();
  await page.waitForTimeout(6000);
  const videos = await page.locator("main video, video").count();
  const fallback = await page.getByRole("link", { name: /open video/i }).count();
  console.log("video elements in thread:", videos, " fallback links:", fallback);
}

await browser.close();
console.log("\nconversation id for cleanup:", conversationId);
