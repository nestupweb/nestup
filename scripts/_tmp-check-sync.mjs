/**
 * Signed-in check that every place the site states a roommate count agrees with
 * the faces it shows: listing page (House rules + "Who lives here" + CTA) and
 * the /browse results card for the same room.
 */
import { chromium } from "playwright";

const base = "https://nestup-kappa.vercel.app";
const ROOMS = [
  ["9828da3a-81a9-46b2-81fe-58268d18a95f", "Ground-floor room with a yard, Nazareth", 1],
  ["04caef34-fc05-4bdb-b839-eaf79cac3ca4", "Furnished studio near the center, Zichron Yaakov", 0],
  ["5f9f7a46-9c1e-48cf-8688-0670d3aa6a1c", "Upper-floor duplex room in Nazareth", 4],
  ["3094c88b-4976-48aa-892e-13d4464daf9a", "Ground-floor room with a yard, Acre", 3],
  ["651e3d8f-1448-407c-8494-b609a00cdd58", "Ground-floor room with a yard, Migdal HaEmek", 3],
];

const browser = await chromium.launch();
const page = await (await browser.newContext()).newPage();
let bad = 0;
try {
  await page.goto(`${base}/login`, { waitUntil: "networkidle" });
  await page.fill('input[name="email"]', "seed.user1@nestup.dev");
  await page.fill('input[name="password"]', "Demo1234!");
  await Promise.all([
    page.waitForURL((u) => !u.pathname.startsWith("/login"), { timeout: 45_000 }),
    page.click('button[type="submit"]'),
  ]);

  for (const [id, title, typedClaim] of ROOMS) {
    await page.goto(`${base}/browse/${id}`, { waitUntil: "networkidle" });
    const faces = await page.getByRole("link", { name: /'s profile$/ }).count();
    const houseRules = (await page.getByText(/^\d+ roommates?$/).first().innerText()).trim();
    const cta = (await page.getByRole("button", { name: /^Message the roommates?$/ }).innerText()).trim();

    // The same room as it appears in the results list.
    await page.goto(`${base}/browse?city=${encodeURIComponent(title.split(", ").pop())}`, { waitUntil: "networkidle" });
    const card = page.locator("article").filter({ has: page.locator(`a[href="/browse/${id}"]`) });
    const cardMeta = (await card.first().innerText().catch(() => "")).match(/(\d+) roommates?/);

    const wantNum = String(faces);
    const wantWord = `${faces} roommate${faces === 1 ? "" : "s"}`;
    const wantCta = faces > 1 ? "Message the roommates" : "Message the roommate";
    const okRules = houseRules === wantWord;
    const okCta = cta === wantCta;
    const okCard = !cardMeta || cardMeta[1] === wantNum;
    if (!(okRules && okCta && okCard)) bad++;
    console.log(
      `${okRules && okCta && okCard ? "PASS" : "FAIL"}  ${title}\n` +
      `      faces shown: ${faces} | House rules: "${houseRules}"${okRules ? "" : ` (want "${wantWord}")`} | ` +
      `card: ${cardMeta ? cardMeta[0] : "not in this page of results"}${okCard ? "" : ` (want ${wantNum})`} | ` +
      `CTA: "${cta}"${okCta ? "" : ` (want "${wantCta}")`} | typed roommates_count: ${typedClaim}`
    );
  }
} finally {
  await browser.close();
}
console.log(bad === 0 ? "\nEvery stated count matches the faces shown." : `\n${bad} room(s) still disagree.`);
process.exit(bad === 0 ? 0 : 1);
