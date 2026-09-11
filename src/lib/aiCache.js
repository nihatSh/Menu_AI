// Two independent caches, both aimed at the bill.
//
// 1. CONTEXT CACHE (Google-side). The static prompt - rules + menu - is
//    identical for every guest at a restaurant. Uploaded once to Gemini's
//    context cache, it is then billed at ~25% of the input price instead of
//    100% on every message.
//
//    Explicit caching needs a billing-enabled project; on the free tier the
//    create call returns 429 with limit=0. So we probe once, remember the
//    answer for an hour, and silently run without a cache until billing is
//    switched on - at which point it starts working with no code change.
//
// 2. RESPONSE CACHE (ours, in memory). Guests ask the same handful of things:
//    "what's good?", "something light", the quick-reply chips. If the same
//    question arrives at the same restaurant under the same conditions, the
//    previous answer is reused for free and instantly.

import { createHash } from "node:crypto";

function store() {
  if (!globalThis.__aiCache) {
    globalThis.__aiCache = {
      contexts: new Map(), // key -> { name, expiresAt, tokens }
      responses: new Map(), // key -> { value, at }
      unavailableUntil: 0, // context caching disabled (free tier) until this ms
      stats: { ctxHits: 0, ctxMisses: 0, respHits: 0, respMisses: 0, savedUsd: 0 },
    };
  }
  return globalThis.__aiCache;
}

export function cacheStats() {
  const s = store().stats;
  const ctxTotal = s.ctxHits + s.ctxMisses;
  const respTotal = s.respHits + s.respMisses;
  return {
    ...s,
    contextAvailable: store().unavailableUntil < Date.now(),
    activeContexts: store().contexts.size,
    contextHitRate: ctxTotal ? s.ctxHits / ctxTotal : 0,
    responseHitRate: respTotal ? s.respHits / respTotal : 0,
  };
}

export function noteSaving(usd) {
  store().stats.savedUsd += usd;
}

const sha = (s) => createHash("sha256").update(s).digest("hex").slice(0, 16);

// ---------------------------------------------------------------------------
// 1. Context cache
// ---------------------------------------------------------------------------

const CONTEXT_TTL_SECONDS = 3600; // 1 hour; renewed on demand
const PROBE_BACKOFF_MS = 60 * 60 * 1000; // don't re-probe a free-tier key for an hour

/**
 * Returns the name of a Gemini context cache holding `staticPrompt`, or null
 * if caching is unavailable (free tier) or failed. Never throws.
 */
export async function getOrCreateContextCache(ai, { model, staticPrompt, label }) {
  const db = store();

  // Minimum cacheable size varies by model; below ~1k tokens it is never
  // worth a round trip. Rough estimate: 4 chars per token.
  if (staticPrompt.length < 4000) return null;
  if (db.unavailableUntil > Date.now()) return null;

  const key = `${model}:${sha(staticPrompt)}`;
  const hit = db.contexts.get(key);
  if (hit && hit.expiresAt > Date.now() + 60_000) {
    db.stats.ctxHits++;
    return hit.name;
  }

  try {
    const cache = await ai.caches.create({
      model,
      config: {
        contents: [{ role: "user", parts: [{ text: staticPrompt }] }],
        ttl: `${CONTEXT_TTL_SECONDS}s`,
        displayName: label?.slice(0, 60),
      },
    });
    db.contexts.set(key, {
      name: cache.name,
      expiresAt: Date.now() + CONTEXT_TTL_SECONDS * 1000,
      tokens: cache.usageMetadata?.totalTokenCount || 0,
    });
    db.stats.ctxMisses++;
    return cache.name;
  } catch (err) {
    const msg = String(err?.message || "");
    // limit=0 means this project has no cache quota - free tier. Stop asking.
    if (err?.status === 429 || /limit=0|RESOURCE_EXHAUSTED/i.test(msg)) {
      db.unavailableUntil = Date.now() + PROBE_BACKOFF_MS;
      console.info("Gemini context caching unavailable (free tier) - running without it. Enable billing to cut input cost ~75%.");
    } else {
      console.warn("Context cache create failed:", msg.slice(0, 140));
      db.unavailableUntil = Date.now() + 5 * 60 * 1000;
    }
    db.stats.ctxMisses++;
    return null;
  }
}

/** Drop a cached context, e.g. after the owner edits the menu. */
export function invalidateContexts(predicate = () => true) {
  const db = store();
  for (const [key, val] of db.contexts) if (predicate(key, val)) db.contexts.delete(key);
}

// ---------------------------------------------------------------------------
// 2. Response cache
// ---------------------------------------------------------------------------

const RESPONSE_TTL_MS = 10 * 60 * 1000;
const MAX_RESPONSES = 500;

/**
 * Only questions with no personal detail are cacheable. A guest asking about
 * their own calories, their basket, or mid-conversation must never receive
 * another guest's answer.
 */
export function responseCacheKey({ slug, message, profile, hunger, justTrained, weather, kitchenLevel, safeIds, hasHistory, cartSize, lang }) {
  if (hasHistory || cartSize > 0) return null; // conversational or basket-specific
  if (profile.kcalTarget || profile.proteinTarget || profile.weightKg) return null; // personal numbers
  if (profile.fasting === "ramadan") return null; // iftar countdown changes by the minute

  const normalised = message.trim().toLowerCase().replace(/\s+/g, " ").replace(/[.!?]+$/, "");
  if (!normalised || normalised.length > 120) return null;

  // Temperature in 5°C buckets so ordinary weather drift doesn't miss.
  const tempBucket = weather ? Math.round(weather.tempC / 5) * 5 : "na";

  return sha(
    [
      slug,
      lang,
      normalised,
      hunger,
      justTrained ? 1 : 0,
      profile.kidsMode ? 1 : 0,
      profile.fasting || "none",
      tempBucket,
      kitchenLevel,
      safeIds, // menu availability - a sold-out dish must invalidate
    ].join("|")
  );
}

export function getCachedResponse(key) {
  if (!key) return null;
  const db = store();
  const hit = db.responses.get(key);
  if (!hit) {
    db.stats.respMisses++;
    return null;
  }
  if (Date.now() - hit.at > RESPONSE_TTL_MS) {
    db.responses.delete(key);
    db.stats.respMisses++;
    return null;
  }
  db.stats.respHits++;
  return hit.value;
}

export function setCachedResponse(key, value) {
  if (!key) return;
  const db = store();
  db.responses.set(key, { value, at: Date.now() });
  if (db.responses.size > MAX_RESPONSES) {
    // Drop the oldest quarter rather than one at a time.
    const sorted = [...db.responses.entries()].sort((a, b) => a[1].at - b[1].at);
    for (const [k] of sorted.slice(0, Math.floor(MAX_RESPONSES / 4))) db.responses.delete(k);
  }
}

export function clearResponseCache(slug) {
  const db = store();
  if (!slug) return db.responses.clear();
  // Keys are hashed, so a targeted clear isn't possible - clear all. Called
  // rarely (menu edits), so this is fine.
  db.responses.clear();
}
