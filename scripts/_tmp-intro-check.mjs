import { chromium } from "playwright";

const base = (process.argv[2] ?? "https://nestup-kappa.vercel.app").replace(/\/$/, "");
const email = process.env.SEED_EMAIL ?? "seed.user1@nestup.dev";
const password = process.env.SEED_PASSWORD ?? "Demo1234!";

const browser = await chromium.launch();
const context = await browser.newContext();
const page = await context.newPage();
const out = [];

try {
  await page.goto(`${base}/login`, { waitUntil: "networkidle" });
  await page.fill('input[name="email"]', email);
  await page.fill('input[name="password"]', password);
  await Promise.all([
    page.waitForURL((u) => !u.pathname.startsWith("/login"), { timeout: 60_000 }),
    page.click('button[type="submit"]'),
  ]);

  // A listing this account does not own, so the "Message the owner" button is there.
  await page.goto(`${base}/browse`, { waitUntil: "networkidle" });
  const hrefs = await page.evaluate(() =>
    [...document.querySelectorAll('a[href^="/browse/"]')].map((a) => a.getAttribute("href"))
  );
  const ids = [...new Set(hrefs.map((h) => h.split("/")[2]).filter(Boolean))];
  let opened = null;
  for (const id of ids.slice(0, 6)) {
    await page.goto(`${base}/browse/${id}`, { waitUntil: "networkidle" });
    if (await page.getByRole("link", { name: "Message the owner" }).count()) { opened = id; break; }
  }
  if (!opened) throw new Error("no listing with a Message-the-owner button");
  out.push(`listing: ${opened}`);

  await page.getByRole("link", { name: "Message the owner" }).click();
  await page.waitForURL(/\/chat\/[0-9a-f-]{36}/, { timeout: 60_000 });
  await page.waitForSelector("#chat-message", { timeout: 30_000 });
  const prefilled = await page.inputValue("#chat-message");
  out.push(`url: ${new URL(page.url()).pathname}${new URL(page.url()).search}`);
  out.push(`composer value: ${JSON.stringify(prefilled)}`);

  // Editable, not locked.
  await page.fill("#chat-message", prefilled + " (edited)");
  out.push(`after edit: ${JSON.stringify(await page.inputValue("#chat-message"))}`);
  await page.screenshot({ path: "scripts/_tmp-intro-chat.png", fullPage: false });

  await page.goto(`${base}/profile/edit`, { waitUntil: "networkidle" });
  const headings = await page.evaluate(() =>
    [...document.querySelectorAll("h2, h3")].map((h) => h.textContent.trim())
  );
  out.push(`profile headings: ${JSON.stringify(headings)}`);
  const swipeLeft = headings.some((h) => /^\d*\.?\s*Swipe$/.test(h));
  out.push(`still a "Swipe" section: ${swipeLeft}`);
  const hint = await page.evaluate(() => {
    const h = [...document.querySelectorAll("h2, h3")].find((x) => x.textContent.includes("Default Message"));
    return h ? h.closest("section")?.innerText.slice(0, 320) : null;
  });
  out.push(`section text:\n${hint}`);
  await page.screenshot({ path: "scripts/_tmp-intro-profile.png", fullPage: false });
} catch (e) {
  out.push(`ERROR: ${e.message}`);
} finally {
  console.log(out.join("\n"));
  await browser.close();
}
