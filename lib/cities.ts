/**
 * Cities and towns of Israel (English spellings), used for the listing
 * address, browse filter and profile preferences. Alphabetical; the
 * combobox ranks prefix matches first so "hai" → Haifa, "kir" → Kiryat …
 */
export const CITIES = [
  "Abu Ghosh", "Acre", "Afula", "Alfei Menashe", "Arad", "Ariel", "Ashdod", "Ashkelon", "Azor",
  "Baqa al-Gharbiyye", "Bat Yam", "Be'er Ya'akov", "Beer Sheva", "Beit Dagan", "Beit El", "Beit Jann",
  "Beit She'an", "Beit Shemesh", "Beitar Illit", "Binyamina", "Bnei Brak",
  "Daliyat al-Karmel", "Dimona",
  "Efrat", "Eilat", "Elad", "Elkana", "Even Yehuda",
  "Gan Yavne", "Ganei Tikva", "Gedera", "Giv'at Ada", "Givat Shmuel", "Givat Ze'ev", "Givatayim",
  "Hadera", "Haifa", "Hatzor HaGlilit", "Herzliya", "Hod HaSharon", "Holon",
  "Isfiya",
  "Jaljulia", "Jerusalem", "Jisr az-Zarqa",
  "Kadima-Zoran", "Kafr Qara", "Kafr Qasim", "Karmiel", "Karnei Shomron", "Katzrin", "Kfar Saba",
  "Kfar Shmaryahu", "Kfar Vradim", "Kfar Yona", "Kiryat Arba", "Kiryat Ata", "Kiryat Bialik",
  "Kiryat Ekron", "Kiryat Gat", "Kiryat Malakhi", "Kiryat Motzkin", "Kiryat Ono", "Kiryat Shmona",
  "Kiryat Tivon", "Kiryat Yam", "Kokhav Ya'ir",
  "Lehavim", "Lod",
  "Ma'ale Adumim", "Ma'alot-Tarshiha", "Majdal Shams", "Mazkeret Batya", "Meitar", "Metula",
  "Mevaseret Zion", "Migdal HaEmek", "Mitzpe Ramon", "Modi'in Illit", "Modi'in-Maccabim-Re'ut",
  "Nahariya", "Nazareth", "Nesher", "Ness Ziona", "Netanya", "Netivot", "Nof HaGalil",
  "Ofakim", "Omer", "Or Akiva", "Or Yehuda", "Oranit",
  "Pardes Hanna-Karkur", "Petah Tikva",
  "Qalansawe",
  "Raanana", "Rahat", "Ramat Gan", "Ramat HaSharon", "Ramat Yishai", "Ramla", "Rehovot",
  "Rishon LeZion", "Rosh HaAyin", "Rosh Pinna",
  "Safed", "Sakhnin", "Savyon", "Sderot", "Shefa-'Amr", "Shoham",
  "Tamra", "Tayibe", "Tel Aviv", "Tel Mond", "Tiberias", "Tira", "Tirat Carmel",
  "Umm al-Fahm",
  "Yavne", "Yehud-Monosson", "Yeruham", "Yokneam",
  "Zichron Yaakov",
] as const;

export type City = (typeof CITIES)[number];

const fold = (s: string) => s.toLowerCase().replace(/['’\-\s]/g, "");

/**
 * Suggestions for a partial city name: prefix matches first (by whole
 * name, then by any word — "sab" → Kfar Saba), then substring matches.
 */
export function suggestCities(query: string, limit = 8): City[] {
  const q = fold(query.trim());
  if (!q) return CITIES.slice(0, limit);
  const starts: City[] = [];
  const wordStarts: City[] = [];
  const contains: City[] = [];
  for (const city of CITIES) {
    const f = fold(city);
    if (f.startsWith(q)) starts.push(city);
    else if (city.toLowerCase().split(/[\s\-]+/).some((w) => fold(w).startsWith(q))) wordStarts.push(city);
    else if (f.includes(q)) contains.push(city);
  }
  return [...starts, ...wordStarts, ...contains].slice(0, limit);
}

/** The canonical city for free text ("haifa", "HAIFA" → "Haifa"), or null. */
export function matchCity(text: string): City | null {
  const q = fold(text);
  if (!q) return null;
  return CITIES.find((c) => fold(c) === q) ?? null;
}
