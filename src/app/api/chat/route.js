import { GoogleGenAI } from "@google/genai";
import { z } from "zod";

import { getRestaurant } from "@/data/restaurants";
import {
  getSoldOut,
  kitchenLoad,
  logAiCall,
  estimateCostUsd,
  monthSpendUsd,
  logUnmet,
  getChat,
  appendChat,
} from "@/lib/store";
import { hardFilter, scoreDishes, localized, waterTarget, partOfDayFor } from "@/lib/menu";
import { buildStaticPrompt, buildTurnContext, needsDescriptions, detectLanguage, PROMPT_VERSION } from "@/lib/prompt";
import { getWeather } from "@/lib/weather";
import { isRamadan, iftarInfo } from "@/lib/sun";
import { chatPerTable, chatPerIp, clientIp } from "@/lib/ratelimit";
import { ReplyExtractor } from "@/lib/replyExtractor";
import { guestIdFrom } from "@/lib/session";
import {
  getOrCreateContextCache,
  responseCacheKey,
  getCachedResponse,
  setCachedResponse,
  noteSaving,
} from "@/lib/aiCache";

export const runtime = "nodejs";

// gemini-3.5-flash-lite: $0.10/$0.40 per M tokens — 4.6x cheaper than
// gemini-2.5-flash on this workload and accurate enough for menu reasoning.
// Override with GEMINI_MODEL if you want a stronger model.
const MODEL = process.env.GEMINI_MODEL || "gemini-3.5-flash-lite";
const FIRST_TOKEN_TIMEOUT_MS = 12_000;
const TOTAL_TIMEOUT_MS = 30_000;
const MAX_MESSAGE_CHARS = 500;
// maxOutputTokens is only a ceiling - unused tokens are never billed - so it
// is set generously. A normal answer is ~200 tokens, but this model
// occasionally spends several hundred on thinking first; too low a ceiling
// truncates the JSON mid-string and wastes the whole call.
const MAX_OUTPUT_TOKENS = 1600;
// MINIMAL keeps thinking at zero for almost every request on the 3.x models.
// (thinkingBudget: 0 is rejected with a 400 by these models.)
const THINKING_LEVEL = "MINIMAL";

const WaiterReply = z.object({
  reply: z.string(),
  recommendations: z.array(z.object({ dishId: z.string(), reason: z.string() })).max(3),
  notes: z.array(z.string()).max(2),
  flags: z.object({
    upsellOffered: z.boolean(),
    drinkPaired: z.boolean(),
    hydrationReminded: z.boolean(),
    portionWarned: z.boolean(),
  }),
  unmet: z.boolean(),
});

// "reply" must come first so the stream extractor can show it while the rest
// is still being generated.
const RESPONSE_SCHEMA = {
  ...z.toJSONSchema(WaiterReply),
  propertyOrdering: ["reply", "recommendations", "notes", "flags", "unmet"],
};
delete RESPONSE_SCHEMA.$schema;

const RequestSchema = z.object({
  slug: z.string().min(1).max(64),
  table: z.union([z.string(), z.number()]).optional(),
  message: z.string().max(MAX_MESSAGE_CHARS).default(""),
  hunger: z.number().int().min(1).max(5).default(3),
  justTrained: z.boolean().default(false),
  flags: z
    .object({
      upsellOffered: z.boolean().optional(),
      drinkPaired: z.boolean().optional(),
      hydrationReminded: z.boolean().optional(),
      portionWarned: z.boolean().optional(),
    })
    .default({}),
  cart: z
    .array(
      z.object({
        dishId: z.string(),
        name: z.string(),
        qty: z.number().int().min(1).max(20),
        price: z.number(),
        kcal: z.number().optional(),
        protein: z.number().optional(),
      })
    )
    .max(30)
    .default([]),
  profile: z
    .object({
      lang: z.string().max(5).optional(),
      allergens: z.array(z.string()).max(20).optional(),
      diets: z.array(z.string()).max(10).optional(),
      fasting: z.string().max(16).optional(),
      kidsMode: z.boolean().optional(),
      weightKg: z.union([z.string(), z.number()]).optional(),
      kcalTarget: z.union([z.string(), z.number()]).optional(),
      proteinTarget: z.union([z.string(), z.number()]).optional(),
      kcalEaten: z.union([z.string(), z.number()]).optional(),
      proteinEaten: z.union([z.string(), z.number()]).optional(),
      favourites: z.array(z.string()).max(50).optional(),
    })
    .default({}),
});

const BLOCKED_FINISH = new Set(["SAFETY", "PROHIBITED_CONTENT", "BLOCKLIST", "SPII", "RECITATION"]);

const line = (obj) => JSON.stringify(obj) + "\n";

export async function POST(req) {
  const parsedBody = RequestSchema.safeParse(await req.json().catch(() => null));
  if (!parsedBody.success) {
    return Response.json({ error: "Invalid request", issues: parsedBody.error.issues.slice(0, 3) }, { status: 400 });
  }
  const { slug, message, profile, table, cart, hunger, justTrained, flags } = parsedBody.data;

  const restaurant = getRestaurant(slug);
  if (!restaurant) return Response.json({ error: "Unknown restaurant" }, { status: 404 });

  // ---- rate limits ---------------------------------------------------------
  const ip = clientIp(req);
  const [byTable, byIp] = await Promise.all([chatPerTable.limit(`${slug}:${table}`), chatPerIp.limit(ip)]);
  if (!byTable.success || !byIp.success) {
    const retryMs = Math.max(byTable.retryAfterMs, byIp.retryAfterMs);
    const wait = Math.ceil(retryMs / 60000);
    return Response.json(
      {
        reply: `You have sent a lot of messages - give me about ${wait} minute${wait === 1 ? "" : "s"} and ask again, or browse the menu meanwhile.`,
        recommendations: [],
        notes: [],
        flags: {},
        source: "rate-limited",
      },
      { status: 429, headers: { "Retry-After": String(Math.ceil(retryMs / 1000)) } }
    );
  }

  const lang = profile.lang || "en";
  const soldOut = getSoldOut(slug);
  const { safe, removed } = hardFilter(restaurant.menu, profile, soldOut);

  if (safe.length === 0) {
    return Response.json({
      reply:
        "With your allergies and diet settings there is nothing on this menu I can safely offer you. Please ask a member of staff.",
      recommendations: [],
      notes: [],
      flags: {},
      source: "filter",
    });
  }

  // ---- live context --------------------------------------------------------
  const now = new Date();
  const weather = await getWeather(restaurant.coords);
  const kitchen = kitchenLoad(slug);
  const ramadan = isRamadan(now);
  const iftar = ramadan || profile.fasting === "ramadan" ? iftarInfo(restaurant.coords, now, restaurant.timeZone) : null;

  const num = (v) => Number(v) || 0;
  const goal = {
    kcalTarget: num(profile.kcalTarget),
    proteinTarget: num(profile.proteinTarget),
    kcalEaten: num(profile.kcalEaten),
    proteinEaten: num(profile.proteinEaten),
  };
  goal.kcalLeft = goal.kcalTarget ? Math.max(0, goal.kcalTarget - goal.kcalEaten) : 0;
  goal.proteinLeft = goal.proteinTarget ? Math.max(0, goal.proteinTarget - goal.proteinEaten) : 0;

  const cartTotals = cart.reduce(
    (a, c) => ({ price: a.price + c.price * c.qty, kcal: a.kcal + (c.kcal || 0) * c.qty, protein: a.protein + (c.protein || 0) * c.qty }),
    { price: 0, kcal: 0, protein: 0 }
  );

  const ctx = {
    lang,
    table,
    hunger,
    justTrained,
    kidsMode: !!profile.kidsMode,
    fasting: profile.fasting || "none",
    isRamadan: ramadan,
    iftar,
    partOfDay: partOfDayFor(now),
    localTime: now.toTimeString().slice(0, 5),
    weather,
    kitchen,
    goal: goal.kcalTarget || goal.proteinTarget ? goal : null,
    water: profile.weightKg ? waterTarget(num(profile.weightKg), justTrained) : null,
    cart,
    cartTotals,
    favouriteDishIds: profile.favourites || [],
    flags,
    removedCount: removed.length,
  };

  const guestId = guestIdFrom(req);
  const sessionKey = `${slug}:${table}:${guestId}`;
  const history = getChat(sessionKey);
  const question = message.trim() || "What do you recommend?";

  // Tourist mode. The language is detected here rather than left for the model
  // to notice, and the whole static prompt is then built in that language -
  // otherwise its "ANSWER IN ENGLISH" line contradicts the per-turn
  // instruction and wins. One cached prompt per language is fine.
  const replyLang = detectLanguage(question, lang);
  ctx.replyLang = replyLang;

  const base = { slug, table: String(table), guestId, promptVersion: PROMPT_VERSION, model: MODEL, message: question.slice(0, 200) };

  const remember = (reply) =>
    appendChat(sessionKey, [
      { role: "user", content: question, at: Date.now() },
      { role: "assistant", content: reply, at: Date.now() },
    ]);

  // ---- response cache: a repeat of a common question costs nothing ---------
  const rcKey = responseCacheKey({
    slug,
    message: question,
    profile,
    hunger,
    justTrained,
    weather,
    kitchenLevel: kitchen.level,
    safeIds: safe.map((d) => d.id).join(","),
    hasHistory: history.length > 0,
    cartSize: cart.length,
    lang: replyLang,
  });
  const cached = getCachedResponse(rcKey);
  if (cached) {
    logAiCall({ ...base, source: "cache", latencyMs: 0, costUsd: 0, emptyRecommendations: cached.recommendations.length === 0 });
    noteSaving(cached.costUsd || 0);
    remember(cached.reply);
    return Response.json({ ...cached, source: "cache" });
  }

  // ---- budget / offline ----------------------------------------------------
  const budget = restaurant.aiBudgetUsd ?? Infinity;
  const spent = monthSpendUsd(slug);
  if (!process.env.GEMINI_API_KEY || spent >= budget) {
    const reason = !process.env.GEMINI_API_KEY ? "fallback" : "fallback-budget";
    const answer = offlineAnswer({ safe, ctx, message: question, lang, degraded: false, source: reason });
    logAiCall({ ...base, source: reason, latencyMs: 0, costUsd: 0, emptyRecommendations: answer.recommendations.length === 0 });
    remember(answer.reply);
    return Response.json(answer);
  }

  // ---- prompts -------------------------------------------------------------
  // Descriptions roughly double the menu's token count, so only send them when
  // the guest is actually asking what a dish is.
  const withDescriptions = needsDescriptions(question);
  const staticPrompt = buildStaticPrompt({ restaurant, safeMenu: safe, lang: replyLang, withDescriptions });
  const turnContext = buildTurnContext(ctx, restaurant.currency);

  const started = Date.now();
  const encoder = new TextEncoder();

  const stream = new ReadableStream({
    async start(controller) {
      const send = (obj) => controller.enqueue(encoder.encode(line(obj)));
      let finished = false;

      const finishWithFallback = (why, err, source = "fallback-error") => {
        if (finished) return;
        finished = true;
        if (err) console.error("AI waiter failed:", err?.status || "", String(err?.message || err).slice(0, 200));
        const answer = offlineAnswer({ safe, ctx, message: question, lang, degraded: true, source });
        logAiCall({ ...base, source, error: why, latencyMs: Date.now() - started, costUsd: 0, emptyRecommendations: false });
        remember(answer.reply);
        send({ type: "final", ...answer, replaceReply: true });
        controller.close();
      };

      const abort = new AbortController();
      const totalTimer = setTimeout(() => abort.abort("total-timeout"), TOTAL_TIMEOUT_MS);
      let firstTokenTimer = setTimeout(() => abort.abort("first-token-timeout"), FIRST_TOKEN_TIMEOUT_MS);

      try {
        const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

        // Context cache: the menu half of the prompt, billed at ~25% once
        // billing is enabled. Returns null on the free tier - we then send the
        // prompt inline as usual.
        const cacheName = await getOrCreateContextCache(ai, {
          model: MODEL,
          staticPrompt,
          label: `${slug}-${replyLang}-${withDescriptions ? "desc" : "compact"}`,
        });

        const config = {
          responseMimeType: "application/json",
          responseJsonSchema: RESPONSE_SCHEMA,
          temperature: 0.6,
          maxOutputTokens: MAX_OUTPUT_TOKENS,
          thinkingConfig: { thinkingLevel: THINKING_LEVEL },
          abortSignal: abort.signal,
        };
        if (cacheName) config.cachedContent = cacheName;
        else config.systemInstruction = staticPrompt;

        const contents = [
          ...history.slice(-6).map((m) => ({
            role: m.role === "assistant" ? "model" : "user",
            parts: [{ text: String(m.content).slice(0, 1200) }],
          })),
          { role: "user", parts: [{ text: `${turnContext}\n\nGuest: ${question}` }] },
        ];

        const extractor = new ReplyExtractor();
        let raw = "";
        let usage = {};
        let finishReason = null;
        let blockReason = null;

        const result = await ai.models.generateContentStream({ model: MODEL, contents, config });

        for await (const chunk of result) {
          if (chunk.promptFeedback?.blockReason) blockReason = chunk.promptFeedback.blockReason;
          const cand = chunk.candidates?.[0];
          if (cand?.finishReason) finishReason = cand.finishReason;
          if (chunk.usageMetadata) usage = chunk.usageMetadata;

          const text = chunk.text;
          if (!text) continue;
          if (firstTokenTimer) {
            clearTimeout(firstTokenTimer);
            firstTokenTimer = null;
          }
          raw += text;
          const piece = extractor.push(text);
          if (piece) send({ type: "delta", text: piece });
        }

        clearTimeout(totalTimer);
        if (firstTokenTimer) clearTimeout(firstTokenTimer);

        const costUsd = estimateCostUsd(usage);
        const latencyMs = Date.now() - started;

        if (blockReason || BLOCKED_FINISH.has(finishReason)) {
          logAiCall({ ...base, source: "fallback-refusal", refused: true, reason: blockReason || finishReason, latencyMs, costUsd, ...tokenFields(usage) });
          return finishWithFallback(blockReason || finishReason, null, "fallback-refusal");
        }

        let parsed;
        try {
          parsed = WaiterReply.parse(JSON.parse(raw));
        } catch (e) {
          // Truncated JSON means the ceiling was hit despite the headroom
          // above. Log it distinctly so the dashboard shows a cap problem
          // rather than a model problem.
          const why = finishReason === "MAX_TOKENS" ? "truncated" : "parse";
          logAiCall({ ...base, source: "fallback-parse", finishReason, reason: why, latencyMs, costUsd, ...tokenFields(usage) });
          return finishWithFallback(why, e, "fallback-parse");
        }

        // Second safety net: drop any id the model invented or that was filtered out.
        const allowed = new Set(safe.map((d) => d.id));
        const recommendations = parsed.recommendations
          .filter((r) => allowed.has(r.dishId))
          .slice(0, 3)
          .map((r) => ({ ...r, dish: publicDish(safe.find((d) => d.id === r.dishId), lang, kitchen) }));
        const dropped = parsed.recommendations.length - recommendations.length;

        if (parsed.unmet) logUnmet({ slug, message: question, reason: "ai-flagged" });

        logAiCall({
          ...base,
          source: "ai",
          servedBy: MODEL,
          cached: Boolean(cacheName),
          latencyMs,
          costUsd,
          ...tokenFields(usage),
          emptyRecommendations: recommendations.length === 0,
          droppedIds: dropped,
          unmet: parsed.unmet,
          reply: parsed.reply.slice(0, 300),
        });

        remember(parsed.reply);

        const payload = {
          reply: parsed.reply,
          recommendations,
          notes: parsed.notes,
          flags: parsed.flags,
          unmet: parsed.unmet,
          costUsd,
        };
        // Only cache clean answers - never a refusal or an empty result.
        if (recommendations.length > 0 && !parsed.unmet) setCachedResponse(rcKey, payload);

        finished = true;
        send({
          type: "final",
          ...payload,
          source: "ai",
          replaceReply: !extractor.done,
        });
        controller.close();
      } catch (err) {
        clearTimeout(totalTimer);
        if (firstTokenTimer) clearTimeout(firstTokenTimer);
        // A 429 from Google is a quota problem, not a model problem - label it
        // so the dashboard says "out of quota" instead of blaming the AI.
        const quota = err?.status === 429 || /RESOURCE_EXHAUSTED|exceeded your current quota/i.test(String(err?.message || ""));
        const why = abort.signal.aborted ? abort.signal.reason : quota ? "quota" : err?.status || "error";
        finishWithFallback(String(why), quota ? null : err, quota ? "fallback-quota" : "fallback-error");
        if (quota) console.warn("Gemini quota exhausted - serving the offline recommender. Enable billing or wait for the quota to reset.");
      }
    },
  });

  return new Response(stream, {
    headers: { "Content-Type": "application/x-ndjson; charset=utf-8", "Cache-Control": "no-store", "X-Accel-Buffering": "no" },
  });
}

function tokenFields(usage) {
  return {
    inputTokens: usage.promptTokenCount || 0,
    outputTokens: (usage.candidatesTokenCount || 0) + (usage.thoughtsTokenCount || 0),
    cacheReadTokens: usage.cachedContentTokenCount || 0,
    thinkingTokens: usage.thoughtsTokenCount || 0,
  };
}

function publicDish(d, lang, kitchen) {
  if (!d) return null;
  return {
    id: d.id,
    name: localized(d.name, lang),
    desc: localized(d.desc, lang),
    price: d.price,
    kcal: d.kcal,
    protein: d.protein,
    emoji: d.emoji,
    category: d.category,
    prepMinutes: d.prepMinutes + (kitchen?.extraMinutes || 0),
    allergens: d.allergens,
  };
}

/**
 * Rule-based answer used when there is no API key, the budget is spent, the
 * model errors or times out, or the request is blocked. Keeps the product
 * usable always.
 */
function offlineAnswer({ safe, ctx, message, lang, degraded = false, source }) {
  const ranked = scoreDishes(safe, {
    text: message,
    hunger: ctx.hunger,
    weather: ctx.weather,
    partOfDay: ctx.partOfDay,
    goal: ctx.goal,
    kitchen: ctx.kitchen,
    justTrained: ctx.justTrained,
  }).slice(0, 3);

  const notes = [];
  const flags = {};
  if (ctx.weather?.isCold) notes.push(`It is ${ctx.weather.tempC}°C outside, so I leaned towards warm dishes.`);
  if (ctx.weather?.isHot) notes.push(`It is ${ctx.weather.tempC}°C outside, so I leaned towards cold and light.`);
  if (ctx.kitchen?.level !== "calm") notes.push(`The kitchen is ${ctx.kitchen.level} right now - add about ${ctx.kitchen.extraMinutes} minutes.`);
  if (ctx.water && !ctx.flags?.hydrationReminded) {
    notes.push(`Aim for about ${ctx.water.total} L of water today.`);
    flags.hydrationReminded = true;
  }
  if (ctx.fasting === "ramadan" && ctx.iftar?.minutesUntil > 0) notes.unshift(`Iftar is at ${ctx.iftar.time}, in about ${ctx.iftar.minutesUntil} minutes.`);

  const reply = degraded
    ? "The AI is unavailable at the moment, so here is my best match from the menu."
    : ctx.goal?.kcalLeft
    ? `You have about ${ctx.goal.kcalLeft} kcal and ${ctx.goal.proteinLeft}g protein left today. These fit best:`
    : "Here is what I would bring you right now:";

  return {
    reply,
    recommendations: ranked.map(({ dish }) => ({
      dishId: dish.id,
      reason: offlineReason(dish, ctx),
      dish: publicDish(dish, lang, ctx.kitchen),
    })),
    notes: notes.slice(0, 2),
    flags,
    source,
  };
}

function offlineReason(d, ctx) {
  const bits = [];
  if (ctx.justTrained && d.protein >= 30) bits.push(`${d.protein}g protein for recovery`);
  else if (d.protein >= 30) bits.push(`${d.protein}g protein`);
  if (ctx.weather?.isCold && d.temp === "hot") bits.push("served hot");
  if (ctx.weather?.isHot && d.temp === "cold") bits.push("cold and light");
  if (d.prepMinutes <= 8) bits.push(`ready in ${d.prepMinutes} min`);
  if (!bits.length) bits.push(`${d.kcal} kcal`);
  return bits.join(", ");
}
