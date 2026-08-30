import { chromium } from "playwright";

const base = "https://nestup-kappa.vercel.app";
const LISTING = "6d2be2c9-b688-4b47-9217-91940b362d52";
const CUSTOM = "Hey {name}! Your place looks great — is the room still available?";

const browser = await chromium.launch();
const context = await browser.newContext();
const page = await context.newPage();
const out = [];

const setTemplate = async (value) => {
  await page.goto(`${base}/profile/edit`, { waitUntil: "networkidle" });
  await page.fill('textarea[name="intro_template"]', value);
  await Promise.all([
    page.waitForLoadState("networkidle"),
    page.getByRole("button", { name: /Save profile/i }).click(),
  ]);
  await page.waitForTimeout(2500);
};

try {
  await page.goto(`${base}/login`, { waitUntil: "networkidle" });
  await page.fill('input[name="email"]', "seed.user1@nestup.dev");
  await page.fill('input[name="password"]', "Demo1234!");
  await Promise.all([
    page.waitForURL((u) => !u.pathname.startsWith("/login"), { timeout: 60_000 }),
    page.click('button[type="submit"]'),
  ]);

  await setTemplate(CUSTOM);
  await page.goto(`${base}/profile/edit`, { waitUntil: "networkidle" });
  out.push(`saved template: ${JSON.stringify(await page.inputValue('textarea[name="intro_template"]'))}`);

  await page.goto(`${base}/browse/${LISTING}`, { waitUntil: "networkidle" });
  await page.getByRole("link", { name: "Message the owner" }).click();
  await page.waitForURL(/\/chat\/[0-9a-f-]{36}/, { timeout: 60_000 });
  await page.waitForSelector("#chat-message", { timeout: 30_000 });
  out.push(`composer value: ${JSON.stringify(await page.inputValue("#chat-message"))}`);

  // A thread reached from the inbox (no ?intro=1) must NOT be pre-filled.
  const threadUrl = page.url().split("?")[0];
  await page.goto(threadUrl, { waitUntil: "networkidle" });
  await page.waitForSelector("#chat-message", { timeout: 30_000 });
  out.push(`no-intro visit: ${JSON.stringify(await page.inputValue("#chat-message"))}`);
} catch (e) {
  out.push(`ERROR: ${e.message}`);
} finally {
  try {
    await setTemplate("");
    await page.goto(`${base}/profile/edit`, { waitUntil: "networkidle" });
    out.push(`restored to: ${JSON.stringify(await page.inputValue('textarea[name="intro_template"]'))}`);
  } catch (e) {
    out.push(`RESTORE FAILED: ${e.message}`);
  }
  console.log(out.join("\n"));
  await browser.close();
}
