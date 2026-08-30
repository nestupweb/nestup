import { chromium, devices } from 'playwright';
const b = await chromium.launch();
for (const [name, vp] of [['iphone', { width: 390, height: 844 }], ['small', { width: 390, height: 667 }], ['tablet', { width: 820, height: 700 }]]) {
  const p = await b.newPage({ viewport: vp, isMobile: true, hasTouch: true });
  await p.goto('https://nestup-kappa.vercel.app/browse', { waitUntil: 'networkidle' });
  await p.getByRole('button', { name: 'Filters', exact: true }).click();
  await p.waitForTimeout(300);
  const drawerScroll = await p.evaluate(() => {
    const btn = [...document.querySelectorAll('button')].find(b => b.textContent.trim() === 'Apply filters');
    let sc = btn.parentElement;
    while (sc && !['auto','scroll'].includes(getComputedStyle(sc).overflowY)) sc = sc.parentElement;
    sc.scrollTop = sc.scrollHeight;
    return { max: sc.scrollHeight - sc.clientHeight, top: sc.scrollTop };
  });
  await p.waitForTimeout(200);
  const out = await p.evaluate(() => {
    const btn = [...document.querySelectorAll('button')].find(b => b.textContent.trim() === 'Apply filters');
    const r = btn.getBoundingClientRect();
    const cx = r.left + r.width / 2, cy = r.top + r.height / 2;
    const hit = document.elementFromPoint(cx, cy);
    return { btnTop: +r.top.toFixed(1), btnBottom: +r.bottom.toFixed(1), vh: innerHeight,
             visible: r.top >= 0 && r.bottom <= innerHeight,
             hitIsButton: hit === btn || btn.contains(hit),
             hitEl: hit ? hit.tagName + '.' + String(hit.className).slice(0,60) : null };
  });
  console.log(name, JSON.stringify({ ...drawerScroll, ...out }));
  await p.screenshot({ path: `scripts/_m-${name}.png` });
  await p.close();
}
await b.close();
