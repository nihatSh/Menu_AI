#!/usr/bin/env node
// Golden-set evaluation for the AI waiter.
//
// Runs every scenario in tests/ai/scenarios.json against a RUNNING server and
// checks constraints - not exact wording. Run it every time lib/prompt.js
// changes, before deploying.
//
//   npm run dev            (in one terminal, with GEMINI_API_KEY set)
//   npm run ai:eval        (in another)
//
//   AI_EVAL_URL=https://staging.example.com npm run ai:eval
//   npm run ai:eval -- --allow-fallback     (accept offline answers, for CI without a key)

import { readFileSync } from "node:fs";
import { fileURLToPath, pathToFileURL } from "node:url";
import path from "node:path";

const here = path.dirname(fileURLToPath(import.meta.url));
// pathToFileURL is required on Windows: a bare "C:\..." path is not a valid
// ESM specifier.
const load = (rel) => import(pathToFileURL(path.join(here, rel)).href);

const { restaurants } = await load("../src/data/restaurants.js");
const { hardFilter } = await load("../src/lib/menu.js");

const BASE = process.env.AI_EVAL_URL || "http://localhost:3000";
const ALLOW_FALLBACK = process.argv.includes("--allow-fallback");
// The free tier has a low per-minute request limit; firing 18 scenarios back
// to back trips it and reports false failures. Pace them, and retry once on a
// quota fallback. Set AI_EVAL_GAP=0 on a paid key to run at full speed.
const GAP_MS = Number(process.env.AI_EVAL_GAP ?? 4000);
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const scenarios = JSON.parse(readFileSync(path.join(here, "../tests/ai/scenarios.json"), "utf8"));

const LANG_TEST = {
  ru: (s) => /[Ѐ-ӿ]/.test(s),
  az: (s) => /[əışğüöçƏIŞĞÜÖÇ]/.test(s),
  en: (s) => !/[Ѐ-ӿ]/.test(s) && !/[əışğ]/.test(s),
};

async function callChat(body) {
  const res = await fetch(`${BASE}/api/chat`, {
    method: "POST",
    headers: { "Content-Type": "application/json", cookie: "se_guest=evalrunner0001" },
    body: JSON.stringify(body),
  });
  const type = res.headers.get("content-type") || "";
  if (!type.includes("ndjson")) return { status: res.status, ...(await res.json()) };

  const text = await res.text();
  const lines = text.trim().split("\n").map((l) => JSON.parse(l));
  const final = lines.find((l) => l.type === "final");
  const streamed = lines.filter((l) => l.type === "delta").map((l) => l.text).join("");
  return { status: res.status, ...final, streamedChars: streamed.length };
}

let pass = 0;
let fail = 0;
const failures = [];

for (const sc of scenarios) {
  const restaurant = restaurants.find((r) => r.slug === sc.slug);
  const { safe } = hardFilter(restaurant.menu, sc.profile || {}, []);
  const safeIds = new Set(safe.map((d) => d.id));
  const hiddenNames = restaurant.menu.filter((d) => !safeIds.has(d.id)).map((d) => d.name.en.toLowerCase());

  const body = {
    slug: sc.slug,
    // A unique table per scenario so the app's own per-table rate limit
    // (20 messages / 15 min) doesn't throttle the eval itself.
    table: sc.table || `eval-${scenarios.indexOf(sc)}`,
    message: sc.message,
    profile: sc.profile || {},
    hunger: sc.hunger || 3,
    justTrained: !!sc.justTrained,
    cart: sc.cart || [],
    flags: sc.flags || {},
  };

  const started = Date.now();
  let out;
  try {
    if (GAP_MS) await sleep(GAP_MS);
    out = await callChat(body);
    // A quota fallback is the free tier's rate limit, not a model failure.
    // Wait for the window to roll over and try once more.
    if (out.source === "fallback-quota") {
      console.log(`  (quota hit on "${sc.name}", waiting 30s and retrying)`);
      await sleep(30000);
      out = await callChat(body);
    }
  } catch (e) {
    fail++;
    failures.push(`${sc.name}: request failed - ${e.message}`);
    continue;
  }
  const ms = Date.now() - started;
  const exp = sc.expect || {};
  const problems = [];

  // "cache" is a real model answer being reused, so it counts as a pass.
  // Only the rule-based fallbacks mean the model did not answer.
  const modelAnswered = out.source === "ai" || out.source === "cache";
  if (out.status !== 200) problems.push(`HTTP ${out.status}`);
  if (!ALLOW_FALLBACK && !modelAnswered) problems.push(`source=${out.source} (expected ai)`);
  if (!out.reply || out.reply.trim().length < 5) problems.push("empty reply");
  if (out.reply?.length > (exp.maxReplyChars || 600)) problems.push(`reply too long (${out.reply.length})`);
  if (/[*#_`]{2,}|^\s*[-•]\s/m.test(out.reply || "")) problems.push("markdown in reply");

  const recs = out.recommendations || [];
  if (recs.length > 3) problems.push(`${recs.length} recommendations (max 3)`);
  if (exp.minRecs && recs.length < exp.minRecs) problems.push(`only ${recs.length} recommendations (min ${exp.minRecs})`);
  for (const r of recs) if (!safeIds.has(r.dishId)) problems.push(`UNSAFE dish recommended: ${r.dishId}`);

  const lower = (out.reply || "").toLowerCase();
  for (const name of hiddenNames) if (lower.includes(name)) problems.push(`mentions hidden dish "${name}"`);
  for (const w of exp.mustNotMention || []) if (lower.includes(w.toLowerCase())) problems.push(`mentions "${w}"`);
  for (const w of exp.mustMention || []) if (!lower.includes(w.toLowerCase())) problems.push(`does not mention "${w}"`);
  for (const id of exp.mustInclude || []) if (!recs.some((r) => r.dishId === id)) problems.push(`missing expected dish ${id}`);
  if (exp.mustIncludeAnyOf && !recs.some((r) => exp.mustIncludeAnyOf.includes(r.dishId))) {
    problems.push(`none of the expected dishes recommended (${exp.mustIncludeAnyOf.join("/")})`);
  }
  if (exp.maxTotalPrice) {
    const total = recs.reduce((s, r) => s + (r.dish?.price || 0), 0);
    if (total > exp.maxTotalPrice) problems.push(`suggested ${total.toFixed(2)} over a budget of ${exp.maxTotalPrice}`);
  }

  if (exp.expectMath && modelAnswered && !/\d+\s*[+=]\s*\d+/.test(out.reply + " " + (out.notes || []).join(" "))) {
    problems.push("no arithmetic line for a goal-based request");
  }
  if (exp.lang && modelAnswered && !LANG_TEST[exp.lang]?.(out.reply)) problems.push(`reply not in ${exp.lang}`);
  if (exp.flagsTrue) for (const f of exp.flagsTrue) if (!out.flags?.[f]) problems.push(`flag ${f} not set`);
  if (exp.flagsFalse) for (const f of exp.flagsFalse) if (out.flags?.[f]) problems.push(`flag ${f} should be false`);
  if (exp.unmet !== undefined && out.source === "ai" && !!out.unmet !== exp.unmet) problems.push(`unmet=${out.unmet}`);
  if (exp.maxMs && ms > exp.maxMs) problems.push(`slow: ${ms} ms`);

  if (problems.length) {
    fail++;
    failures.push(`${sc.name}:\n    ${problems.join("\n    ")}\n    reply: ${JSON.stringify(out.reply)}\n    recs: ${recs.map((r) => r.dishId).join(", ") || "-"}`);
    console.log(`✗ ${sc.name} (${ms} ms)`);
  } else {
    pass++;
    console.log(`✓ ${sc.name} (${ms} ms, ${out.source}) — ${recs.map((r) => r.dishId).join(", ") || "no recs"}`);
  }
}

console.log(`\n${pass} passed, ${fail} failed`);
if (failures.length) console.log("\n" + failures.join("\n\n"));
process.exit(fail ? 1 : 0);
