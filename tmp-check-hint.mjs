/**
 * Prod check: the /chat right-pane placeholder says "Pick a conversation on the
 * left." for a member who has chats, and the how-to-start line when they don't.
 *
 *   node check-chat-hint.mjs https://nestup-kappa.vercel.app <shots-dir>
 */
import { chromium } from "playwright";

const base = (process.argv[2] ?? "https://nestup-kappa.vercel.app").replace(/\/$/, "");
const shots = process.argv[3] ?? ".";
const WITH_CHATS = "seed.user1@nestup.dev";
const NO_CHATS = process.env.EMPTY_EMAIL ?? "seed.user814@nestup.dev";

const browser = await chromium.launch();
const problems = [];

const look = async (email, tag) => {
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 }, deviceScaleFactor: 2 });
  const page = await ctx.newPage();
  await page.goto(`${base}/login`, { waitUntil: "networkidle" });
  await page.fill('input[name="email"]', email);
  await page.fill('input[name="password"]', "Demo1234!");
  await Promise.all([
    page.waitForURL((u) => !u.pathname.startsWith("/login"), { timeout: 60_000 }),
    page.click('button[type="submit"]'),
  ]);
  await page.goto(`${base}/chat`, { waitUntil: "networkidle" });
  await page.waitForTimeout(3500);
  const rows = await page.locator('a[href^="/chat/"]').count();
  // The placeholder pane is the one holding the "Your messages" heading.
  const pane = page.locator("div", { has: page.getByText("Your messages", { exact: true }) }).last();
  const text = (await pane.innerText()).replace(/\s+/g, " ").trim();
  console.log(`${tag} (${email}): rows=${rows} :: ${JSON.stringify(text)}`);
  await page.screenshot({ path: `${shots}/prod-chat-${tag}.png` });
  await ctx.close();
  return { rows, text };
};

try {
  const withChats = await look(WITH_CHATS, "has-chats");
  if (withChats.rows === 0) problems.push("seed.user1 unexpectedly has no chats");
  if (!withChats.text.includes("Pick a conversation on the left.")) problems.push("chats: wrong line");
  if (/Start a conversation by matching/.test(withChats.text)) problems.push("chats: empty line shown");

  const empty = await look(NO_CHATS, "no-chats");
  if (empty.rows > 0) console.log("  note: this account has chats, cannot judge the empty line");
  else {
    if (!empty.text.includes("Start a conversation by matching in Swipe or messaging a listing."))
      problems.push("no chats: wrong line");
    if (/Pick a conversation on the left/.test(empty.text)) problems.push("no chats: picker line shown");
  }
} catch (e) {
  problems.push(`threw: ${e.message}`);
}

await browser.close();
console.log(problems.length ? `FAIL\n- ${problems.join("\n- ")}` : "PASS");
process.exit(problems.length ? 1 : 0);
