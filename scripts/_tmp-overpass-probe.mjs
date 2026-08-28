const UA = "NestUp/1.0 (student project; https://nestup-kappa.vercel.app)";
const EPS = ["https://overpass-api.de/api/interpreter", "https://overpass.kumi.systems/api/interpreter"];
async function ask(q, ep) {
  const res = await fetch(ep + "?data=" + encodeURIComponent(q), {
    headers: { "User-Agent": UA, Accept: "application/json" },
    signal: AbortSignal.timeout(90000),
  });
  if (!res.ok) return { status: res.status, body: (await res.text()).slice(0, 200) };
  return { status: 200, json: await res.json() };
}
const towns = [
  ["Katzrin", 32.99128, 35.68983],
  ["Jaljulia", 32.15525, 34.95401],
  ["Omer", 31.27061, 34.84607],
  ["Metula", 33.27861, 35.57917],
];
for (const [name, lat, lng] of towns) {
  const q = `[out:json][timeout:60];(nwr(around:2500,${lat},${lng})["addr:housenumber"]["addr:street"];);out center 4000;`;
  const t0 = Date.now();
  let out = await ask(q, EPS[0]);
  if (out.status !== 200) { console.log(name, "primary", out.status, out.body); out = await ask(q, EPS[1]); }
  if (out.status !== 200) { console.log(name, "FAILED", out.status, out.body); continue; }
  const els = out.json.elements || [];
  const streets = new Map();
  for (const e of els) streets.set(e.tags["addr:street"], (streets.get(e.tags["addr:street"]) || 0) + 1);
  const latin = [...streets.keys()].filter(s => /^[\x20-\x7E]+$/.test(s));
  console.log(`${name}: ${els.length} addr points, ${streets.size} streets, ${latin.length} latin. ${Date.now()-t0}ms`);
  console.log("   sample:", [...streets.entries()].slice(0, 6).map(([s,n])=>`${s}(${n})`).join(" | "));
  await new Promise(r => setTimeout(r, 2000));
}
