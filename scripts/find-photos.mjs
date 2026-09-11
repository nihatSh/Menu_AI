#!/usr/bin/env node
// Finds a real, freely-licensed photograph for every dish on Wikimedia Commons.
//
// Commons is used rather than a stock service on purpose: it has genuine
// photographs of the specific named dishes (Piti, Qutab, Dovga, Shah plov),
// so a guest sees the dish they are actually ordering rather than a
// lookalike. Everything there is freely licensed.
//
// Writes src/data/photos.json  ->  { "st-piti": { url, title, descriptionUrl } }
//
//   node scripts/find-photos.mjs            # search and write
//   node scripts/find-photos.mjs --verify   # re-check the URLs already written

import { readFileSync, writeFileSync, existsSync } from "node:fs";

const API = "https://commons.wikimedia.org/w/api.php";
const UA = "ScanAndEat-demo/1.0 (menu photo sourcing; contact: project owner)";
const OUT = "src/data/photos.json";
const WIDTH = 900;

// Search terms per dish, ordered best-first. The first query that returns a
// usable photograph wins, so put the most specific term first.
const QUERIES = {
  // Səhrli Təndir - Azerbaijani
  "st-dovga": ["Dovga", "Dovga soup", "Azerbaijani yogurt soup"],
  "st-piti": ["Piti Azerbaijani", "Piti soup", "Putuk piti"],
  "st-dolma": ["Yarpaq dolmasi", "Dolma grape leaves", "Stuffed grape leaves"],
  "st-plov": ["Shah plov", "Azerbaijani plov", "Plov rice"],
  "st-saj": ["Kebab meat vegetables plate", "Mixed grill meat", "Grilled lamb vegetables"],
  "st-lulya": ["Lyulya kebab", "Lula kebab", "Adana kebab", "Minced meat kebab"],
  "st-tavuq": ["Chicken shish kebab", "Chicken skewer grilled", "Chicken kebab"],
  "st-kutab": ["Qutab", "Kutab Azerbaijani", "Gutab"],
  "st-badimjan": ["Eggplant rolls walnut", "Badimjan", "Aubergine roll"],
  "st-choban": ["Shepherd salad", "Choban salad", "Tomato cucumber salad"],
  "st-mangal": ["Roasted pepper salad", "Grilled aubergine salad", "Ajvar pepper"],
  "st-pakhlava": ["Pakhlava Azerbaijani", "Baklava", "Baklava pastry"],
  "st-firni": ["Firni", "Rice pudding cinnamon", "Milk pudding"],
  "st-chay": ["Armudu glass tea", "Azerbaijani tea", "Tea pear shaped glass"],
  "st-ayran": ["Ayran drink", "Ayran glass", "Doogh", "Buttermilk glass"],
  "st-sherbet": ["Pomegranate juice", "Nar sherbeti", "Pomegranate drink glass"],

  // Iron Fork - high protein cafe
  "if-oats": ["Porridge bowl", "Oatmeal breakfast bowl", "Oats porridge fruit"],
  "if-eggs": ["Omelette plate", "Omelette breakfast", "Egg white omelette"],
  "if-chicken-bowl": ["Chicken rice broccoli", "Grilled chicken rice bowl", "Chicken and rice"],
  "if-beef-bowl": ["Steak sweet potato", "Beef steak plate", "Grilled beef sweet potato"],
  "if-salmon": ["Baked salmon quinoa", "Salmon fillet vegetables", "Grilled salmon"],
  "if-tofu": ["Tofu dish", "Fried tofu plate", "Tofu bowl"],
  "if-caesar": ["Caesar salad", "Caesar salad plate"],
  "if-greens": ["Spinach salad plate", "Green leaf salad bowl", "Mixed leaf salad"],
  "if-soup": ["Red lentil soup", "Lentil soup", "Turkish lentil soup"],
  "if-wrap": ["Chicken wrap", "Tortilla wrap chicken", "Wrap sandwich"],
  "if-shake": ["Banana smoothie", "Banana milkshake glass", "Protein shake"],
  "if-green-juice": ["Green smoothie glass", "Green juice drink", "Vegetable juice glass"],
  "if-americano": ["Americano coffee", "Black coffee cup", "Espresso coffee cup"],
  "if-brownie": ["Chocolate brownie", "Brownie cake", "Chocolate brownie square"],
  "if-yogurt": ["Yogurt bowl fruit", "Greek yogurt", "Yoghurt with fruit"],
};

// At least one of these must appear in the file's title for it to be accepted.
const MUST = {
  "st-dovga": ["dovga", "dovğa"],
  "st-piti": ["piti"],
  "st-dolma": ["dolma"],
  "st-plov": ["plov", "pilaf", "pilav"],
  "st-saj": ["saj", "sac", "sizzling", "lamb", "kebab"],
  "st-lulya": ["lula", "lyulya", "lule", "kebab", "kabab"],
  "st-tavuq": ["taouk", "chicken", "shish", "kebab", "skewer"],
  "st-kutab": ["qutab", "kutab", "gutab"],
  "st-badimjan": ["aubergine", "eggplant", "badimjan", "roulade"],
  "st-choban": ["coban", "shepherd", "salata", "salad"],
  "st-mangal": ["mangal", "grilled", "roasted", "pepper", "aubergine", "eggplant"],
  "st-pakhlava": ["pakhlava", "baklava", "пахлава"],
  "st-firni": ["firni", "phirni", "pudding", "kheer"],
  "st-chay": ["tea", "cay", "çay", "armudu"],
  "st-ayran": ["ayran", "doogh", "lassi", "buttermilk", "yogurt drink"],
  "st-sherbet": ["pomegranate", "nar", "sherbet", "juice"],

  "if-oats": ["oatmeal", "porridge", "oats"],
  "if-eggs": ["omelette", "omelet", "egg"],
  "if-chicken-bowl": ["chicken", "rice"],
  "if-beef-bowl": ["steak", "beef"],
  "if-salmon": ["salmon"],
  "if-tofu": ["tofu"],
  "if-caesar": ["caesar"],
  "if-greens": ["salad", "spinach", "greens"],
  "if-soup": ["lentil", "mercimek", "soup"],
  "if-wrap": ["wrap", "burrito", "tortilla"],
  "if-shake": ["smoothie", "shake", "milkshake"],
  "if-green-juice": ["juice", "smoothie", "celery"],
  "if-americano": ["americano", "coffee", "espresso"],
  "if-brownie": ["brownie"],
  "if-yogurt": ["yogurt", "yoghurt"],
};

const NEVER = {
  "st-saj": ["modele", "infanterie", "militaire", "backpack", "sac a", "bag"],
  "st-mangal": ["salmon", "kale", "pasta", "fruit"],
  "st-choban": ["bira", "beer"],
  "if-greens": ["pasta", "bowtie", "macaroni", "noodle"],
  "if-green-juice": ["juicer", "machine", "press", "depression glass"],
  "if-yogurt": ["sauce", "saksuka", "frozen", "drink", "soup"],
  "if-caesar": ["fettuccine", "alfredo", "pasta"],
  "if-oats": ["cookie", "biscuit", "bar", "cake"],
  "if-tofu": ["tendon", "tempura"],
  "if-shake": ["green", "kid"],
  "st-sherbet": ["salad", "ice cream"],
  "st-ayran": ["buddha", "statue", "temple"],
};

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function api(params, attempt = 0) {
  const url = `${API}?${new URLSearchParams({ format: "json", origin: "*", ...params })}`;
  const res = await fetch(url, { headers: { "User-Agent": UA } });

  if (res.status === 429 || res.status >= 500) {
    if (attempt >= 5) throw new Error(`Commons ${res.status} after ${attempt} retries`);
    const wait = Math.min(30000, 2000 * 2 ** attempt);
    await sleep(wait);
    return api(params, attempt + 1);
  }
  if (!res.ok) throw new Error(`Commons ${res.status}`);
  return res.json();
}

/** Strip accents so "dovğa" matches "dovga" and "çorbasi" matches "corbasi". */
const norm = (s) =>
  s
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[ğ]/g, "g")
    .replace(/[ış]/g, (c) => (c === "ı" ? "i" : "s"))
    .replace(/[^a-z0-9]+/g, " ");

/**
 * The title has to actually name the dish. Without this the search returned
 * "Tian Tan Buddha" for Ayran and "Chicken fettuccine alfredo" for a Caesar
 * salad - plausible-looking files that would mislead somebody ordering food.
 */
function relevant(title, must, never) {
  const t = norm(title);
  if (never?.some((word) => t.includes(norm(word)))) return false;
  if (!must?.length) return true;
  return must.some((word) => t.includes(norm(word)));
}

/** Photographs only: skip diagrams, maps, logos and anything tiny. */
function usable(info, title) {
  if (!info?.thumburl) return false;
  if (!/\.(jpe?g|png|webp)$/i.test(title)) return false;
  if (info.width < 600 || info.height < 400) return false;
  // Landscape-ish or square reads best in the card and the hero.
  const ratio = info.width / info.height;
  return ratio > 0.85 && ratio < 2.4;
}

async function search(term, must, never) {
  const data = await api({
    action: "query",
    generator: "search",
    gsrsearch: `filetype:bitmap ${term}`,
    gsrnamespace: "6",
    gsrlimit: "8",
    prop: "imageinfo",
    iiprop: "url|size|extmetadata",
    iiurlwidth: String(WIDTH),
  });

  const pages = Object.values(data?.query?.pages || {});
  // Commons returns search-ranked; keep that order and take the first usable.
  for (const p of pages) {
    const info = p.imageinfo?.[0];
    if (usable(info, p.title) && relevant(p.title, must, never)) {
      return {
        url: info.thumburl,
        title: p.title.replace(/^File:/, ""),
        descriptionUrl: info.descriptionurl,
        credit:
          info.extmetadata?.Artist?.value?.replace(/<[^>]*>/g, "").trim() || "Wikimedia Commons",
        licence: info.extmetadata?.LicenseShortName?.value || "see Commons",
      };
    }
  }
  return null;
}

async function verify(url) {
  try {
    const res = await fetch(url, { method: "HEAD", headers: { "User-Agent": UA } });
    const type = res.headers.get("content-type") || "";
    return res.ok && type.startsWith("image/");
  } catch {
    return false;
  }
}

// ---------------------------------------------------------------------------

if (process.argv.includes("--verify")) {
  if (!existsSync(OUT)) {
    console.error(`${OUT} does not exist - run without --verify first`);
    process.exit(1);
  }
  const found = JSON.parse(readFileSync(OUT, "utf8"));
  let bad = 0;
  for (const [id, entry] of Object.entries(found)) {
    const ok = await verify(entry.url);
    if (!ok) bad++;
    console.log(`${ok ? "✓" : "✗"} ${id.padEnd(18)} ${entry.title.slice(0, 60)}`);
  }
  console.log(`\n${Object.keys(found).length - bad} good, ${bad} broken`);
  process.exit(bad ? 1 : 0);
}

const found = existsSync(OUT) ? JSON.parse(readFileSync(OUT, "utf8")) : {};
const missing = [];

for (const [id, terms] of Object.entries(QUERIES)) {
  if (found[id]) continue; // already sourced by an earlier run
  let hit = null;
  for (const term of terms) {
    try {
      hit = await search(term, MUST[id], NEVER[id]);
    } catch (e) {
      console.log(`  ! ${id} "${term}": ${e.message}`);
    }
    if (hit) {
      hit.query = term;
      break;
    }
    await sleep(700); // be polite to the API
  }

  if (hit && (await verify(hit.url))) {
    found[id] = hit;
    console.log(`✓ ${id.padEnd(18)} ${hit.query.padEnd(26)} ${hit.title.slice(0, 48)}`);
  } else {
    missing.push(id);
    console.log(`✗ ${id.padEnd(18)} no usable photograph found`);
  }
  await sleep(900);
}

writeFileSync(OUT, JSON.stringify(found, null, 2) + "\n");
console.log(`\n${Object.keys(found).length} found, ${missing.length} missing -> ${OUT}`);
if (missing.length) console.log("missing:", missing.join(", "));
