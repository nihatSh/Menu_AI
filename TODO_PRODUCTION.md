# Production TODO — version 1, app side

Version 1 scope (your decisions): **Google Gemini** for the AI, **no login /
authentication** of any kind. Owner and kitchen pages are reachable by anyone
with the link — treat those links as secrets, and add auth in version 2.

Legend: ✅ done · ⚠️ partly done · ❌ not started · 🙋 needs YOU (account, key, decision)

---

## 0. The AI (Gemini)

### 0.1 Key and environments
- [x] ✅ Gemini API key in `.env.local`, verified working against the live API.
- [ ] 🙋 For production, create a **second key** in a Google Cloud project with
      billing enabled and set a **budget alert** in Google Cloud → Billing →
      Budgets. Never use the production key on a laptop.
- [ ] 🙋 Put `GEMINI_API_KEY` into Vercel → Environment Variables per environment.
- [x] ✅ `.env.example` documents every variable; `.env.local` is git-ignored and
      pre-created with a generated `TABLE_TOKEN_SECRET`; the key slot is empty.
- [x] ✅ Model is `gemini-3.5-flash-lite` by default, overridable with `GEMINI_MODEL`.

### 0.2 Verify the real model, not just the fallback
- [x] ✅ Golden test set: `tests/ai/scenarios.json` — 18 scenarios.
- [x] ✅ `npm run ai:eval` runs them against a live server and checks
      constraints (safe-list only, ≤3 recs, no markdown, language, flags,
      arithmetic present, latency).
- [x] ✅ **Run against the real model: 18/18 pass.** Four prompt bugs found and
      fixed in the process — see 0.9.

### 0.3 Reliability
- [x] ✅ Timeout: 12 s to first token, 30 s total → offline recommender.
- [x] ✅ Streaming NDJSON (`delta` events, then `final`).
- [x] ✅ Safety blocks (`SAFETY`, `PROHIBITED_CONTENT`, prompt `blockReason`)
      → offline answer, logged as `fallback-refusal`.
- [x] ✅ Malformed JSON → `fallback-parse`, logged.
- [x] ✅ Every call logged: tokens (prompt / output / thinking / cached), cost,
      latency, source, block reason, invented IDs dropped, prompt version.
- [x] ✅ Owner dashboard → **AI waiter** tab: fallback rate, blocks, cost,
      cost per conversation, avg/p95 latency, cache hit rate, last 20 calls,
      unmet requests.
- [ ] ❌ Alert when fallback rate > 5% over an hour (after deploy).

### 0.4 Cost control
- [x] ✅ Model switched to `gemini-3.5-flash-lite` ($0.10 / $0.40 per M) after
      benchmarking five models on the real workload — 4.6x cheaper than
      2.5-flash with no quality loss on the eval. `PRICE` in `lib/store.js`
      matches; update both if you change model.
- [x] ✅ Prompt **split into a cacheable static half and a per-turn half**
      (`buildStaticPrompt` / `buildTurnContext`). Live context used to sit in
      the system instruction, which changed the prefix on every call and made
      caching impossible. Turn context is now only 51 tokens.
- [x] ✅ **Explicit context caching** wired up with auto-detect (`lib/aiCache.js`).
      Measured: neither implicit nor explicit caching works on the free tier
      (`limit=0`). The code probes once, backs off for an hour, and starts using
      the cache automatically when billing is enabled.
- [ ] 🙋 **Enable billing** on the Google Cloud project to halve the cost again
      ($0.00021 → $0.00012 per conversation). Nothing to change in the code.
- [x] ✅ **Response cache** (`lib/aiCache.js`): repeat questions under the same
      conditions are served free. Verified 50% hit rate on a repeated question.
      Never shared for anything personal (own calories, basket, Ramadan
      countdown, ongoing conversation).
- [x] ✅ **Compact menu encoding** — menu block 1062 → 566 tokens; descriptions
      sent only when the guest asks what a dish is.
- [x] ✅ `thinkingLevel: MINIMAL` (measured: 0 thinking tokens on nearly every
      call). `thinkingBudget: 0` is rejected with a 400 by the 3.x models, and
      a numeric budget is only a hint — it spiked to 668 tokens and truncated
      the JSON, so `maxOutputTokens` is now 1600. A ceiling costs nothing
      unless used.
- [x] ✅ Rate limits: 20 msgs / table / 15 min, 60 / IP / hour; 10 orders /
      table / 10 min. In-memory, Upstash-shaped.
- [ ] ❌ Swap to Upstash Redis on Vercel (🙋 needs an Upstash account).
- [x] ✅ 500-char message cap, 8-turn history, Zod validation on all input.
- [x] ✅ Per-restaurant monthly budget (`aiBudgetUsd`, default $50) → offline
      mode when spent.
- [ ] 🙋 After a week of real use, read cost per conversation and decide pricing.

### 0.5 Safety and guardrails
- [x] ✅ Allergy/diet/kids/fasting filtering *before* the model sees the menu.
- [x] ✅ Returned dish IDs re-validated; invented IDs dropped and counted.
- [x] ✅ Prompt-injection, off-topic and no-medical-advice rules; disclaimer
      under the chat in AZ/EN/RU.
- [x] ✅ Gemini's default safety filters stay on (no `safetySettings` override).

### 0.6 Conversation state
- [x] ✅ Server-side history keyed by restaurant + table + device cookie.
- [x] ✅ Recommendations logged per call.
- [ ] ❌ "AI recommended → guest ordered" number on the dashboard (needs DB join).

### 0.7 Prompt-driven features — all verified against the live model
| # | Feature | Status |
|---|---|---|
| 11 | Polite upsell | ✅ fires once after a main, never repeats (2 eval scenarios) |
| 13 | Weather drink pairing | ✅ suggests a weather-appropriate drink, once |
| 16 | Ramadan | ✅ auto-detected, iftar computed from sunset, opens with something light |
| 10 | Tourist mode | ✅ language of the *message* detected server-side and answered in |
| 18 | Post-gym | ✅ prioritises protein + carbs with a one-clause reason |
| 17 | Hydration | ✅ reminds once |
| 19 | Leftover warning | ✅ warns when the basket exceeds the hunger level |
| 7 | Honest wait time | ✅ favours fast dishes and says so |
| — | Budget | ✅ sums prices and stays under the stated budget |

### 0.9 Prompt bugs found by the eval and fixed
1. **Truncated JSON** — `thinkingBudget` is only a hint; thinking spiked to 668
   tokens and blew the 700-token ceiling. Fixed with `thinkingLevel: MINIMAL`
   and a 1600 ceiling.
2. **Tourist mode ignored** — the model did not reliably notice a language
   switch. Fixed by detecting the script server-side (`detectLanguage`) and
   stating the target language as a fact.
3. **Prompt injection partially worked** — the model answered "Ahoy there,
   matey". Rule 6 now forbids adopting any persona, character or accent.
4. **Budget ignored** — suggested 32 AZN of food on a 25 AZN budget. Rule 5b
   now requires summing prices and stating the total.

### 0.8 Prompt maintenance
- [x] ✅ `PROMPT_VERSION` stored on every logged call.
- [ ] ❌ CI job running `npm run ai:eval` on prompt changes.
- [ ] 🙋 Native Azerbaijani speaker reviews a week of AZ answers.

---

## 1. Data layer

- [ ] 🙋 Create a PostgreSQL database (Neon or Supabase, free tier) → `DATABASE_URL`.
- [ ] ❌ Prisma schema + migrations: `restaurants`, `menu_items`, `tables`,
      `orders`, `order_items`, `feedback`, `ai_calls`, `ai_unmet_requests`,
      `chat_messages`, `quiz_questions`. (No `owners` table in v1.)
- [ ] ❌ Rewrite `lib/store.js` against the DB (still the only storage file).
- [ ] ❌ Seed script from `data/restaurants.js`.
- [ ] ❌ Daily backups; test a restore.
- [ ] ❌ Weather cache and rate limiter → Redis/DB (Vercel instances don't
      share memory).

---

## 2. Access without authentication (v1 approach)

No login in v1, so the owner and kitchen URLs are the only protection.
- [ ] ❌ Make the owner and kitchen URLs **unguessable**: `/owner/<slug>/<secret>`
      where the secret is a long random string per restaurant, stored in the
      DB and shown once to the owner. Same for `/api/menu`, `/api/ai-stats` and
      `PATCH /api/orders/[id]` (secret in a header).
- [ ] ❌ A "regenerate link" button for when a link leaks.
- [ ] ❌ **Version 2:** real login (owner, staff, admin roles). Not in v1.

---

## 3. Guest ordering flow

### 3.1 QR and table identity
- [x] ✅ Signed table tokens in QR URLs; forged/edited → 404.
- [x] ✅ Plain `?table=N` only in development.
- [ ] ❌ Printable table tents as PDF with logo and colours.

### 3.2 Table sessions
- [x] ✅ Anonymous per-device cookie (30 days).
- [x] ✅ Split the bill groups by device; "(you)" marks the viewer.
- [x] ✅ Chat history keyed by table + device.
- [ ] ❌ Staff "close table" (needs DB).

### 3.3 Orders
- [x] ✅ Server-side re-pricing, sold-out check, Zod validation.
- [x] ✅ Opening hours → 423 when closed.
- [x] ✅ Cancel within 60 s, own device only; anonymous can never cancel.
- [x] ✅ Idempotency key (double-tap safe).
- [x] ✅ Cancelled orders excluded from load, revenue and bill.
- [ ] ❌ Short daily order number (#12).
- [ ] ❌ Bill-request button.

### 3.4 Tracking
- [ ] ❌ Polling → Server-Sent Events.
- [ ] ❌ Web Push when ready (needs service worker).

---

## 4. The 21 chosen features

| # | Feature | Status | Left |
|---|---|---|---|
| 1 | Hunger slider | ✅ | — |
| 2 | Weather & time aware | ✅ | cache in Redis on Vercel |
| 3 | Remember me everywhere | ⚠️ | localStorage only (no accounts in v1 — this is the ceiling) |
| 4 | One-tap feedback | ✅ | tie to order in DB |
| 5 | Split the bill | ✅ | — |
| 6 | Voice ordering | ⚠️ | server-side STT fallback (Gemini can transcribe audio — good v1.1 option) |
| 7 | Honest wait time | ✅ | per-restaurant thresholds |
| 8 | Allergy on kitchen ticket | ✅ | printed ticket (§6) |
| 9 | Daily calorie budget | ✅ | — |
| 10 | Tourist mode | ✅ | TR strings; auto-translate empty dish names |
| 11 | Polite upsell | ✅ | 🙋 verify |
| 12 | Order for later | ✅ | kitchen countdown |
| 13 | Weather drink pairing | ✅ | 🙋 verify |
| 14 | Kids mode | ✅ | playful UI |
| 15 | Wait-time quiz | ✅ | owner-editable questions |
| 16 | Fasting mode | ✅ | 🙋 verify wording |
| 17 | Hydration reminder | ✅ | — |
| 18 | Post-gym timing | ✅ | 🙋 verify |
| 19 | Leftover warning | ✅ | — |
| 20 | Kitchen busy signal | ✅ | per-restaurant thresholds |
| 21 | Goal tracking across visits | ⚠️ | same ceiling as #3 |

---

## 5. Owner dashboard (no login — link-protected)

- [ ] ❌ Full menu editor (add / edit / delete / reorder).
- [ ] ❌ Photo upload (🙋 pick Vercel Blob or Cloudinary).
- [ ] ❌ Nutrition + 14 legal allergens entry; update `ALL_ALLERGENS`.
- [ ] ❌ CSV bulk import.
- [ ] ❌ Translations tab with "translate with Gemini" button.
- [ ] ❌ Opening hours, tables, branding, AI budget editable.
- [x] ✅ Sold-out toggle.
- [ ] ❌ Onboarding: you (admin) create the restaurant, owner gets the secret link.
- [x] ⚠️ Reports: best sellers ✅, feedback ✅, AI stats ✅, unmet requests ✅,
      AI→order conversion ❌.
- [ ] ❌ Weekly summary email.

---

## 6. Kitchen screen

- [ ] ❌ Polling → SSE.
- [ ] ❌ Sound + flash on new order.
- [ ] ❌ Thermal printer ticket, allergy line bold at top.
- [ ] ❌ Elapsed-time timer, red past prep time.
- [ ] ❌ Countdown for "serve in +N min".
- [x] ✅ Cancelled orders handled.
- [ ] ❌ Offline tolerance.

---

## 7. Reliability, quality, ops

- [x] ✅ AI golden eval.
- [ ] ❌ Unit tests: `hardFilter` (property test), `scoreDishes`, `sunsetAt`,
      `isOpen`, `ReplyExtractor`, `verifyTableToken`.
- [ ] ❌ API tests on `/api/orders` and `/api/chat` safety net.
- [ ] ❌ E2E (Playwright).
- [ ] 🙋 Sentry account → DSN.
- [ ] ❌ Uptime check, structured logs.
- [ ] ❌ Lighthouse on 3G < 3 s; `next/image` once photos exist.
- [ ] ❌ PWA: manifest, icons, service worker.
- [ ] 🙋 Test on a real iPhone and Android.
- [x] ⚠️ Accessibility: labels done; focus trap / Escape on sheets pending.

---

## 8. Legal and content

- [x] ✅ AI disclaimer under the chat.
- [ ] ❌ Allergen disclaimer on profile sheet and basket.
- [ ] 🙋 Privacy policy, terms, cookie notice — I draft, a lawyer reviews.
- [ ] ❌ Data retention job (30 days sessions, 90 days AI text).
- [ ] 🙋 Azerbaijani e-receipt / fiscal rules.

---

## 9. Deployment

- [ ] 🙋 Vercel account + project connected to the repo.
- [ ] 🙋 Env vars in Vercel: `GEMINI_API_KEY`, `TABLE_TOKEN_SECRET` (copy from
      `.env.local` — must never change once QR codes are printed),
      `NEXT_PUBLIC_BASE_URL`, later `DATABASE_URL`.
- [ ] 🙋 Domain — QR codes must be printed with the final domain.
- [ ] ❌ Staging restaurant flagged out of reports.

---

## Order of work — v1

| Step | What | Status |
|---|---|---|
| 1 | Gemini key → run eval → fix prompt for Flash | 🙋 **blocked on you** |
| 2 | Streaming, timeouts, logging, budget, rate limits | ✅ done |
| 3 | Signed tokens, device cookie, cancel, idempotency, hours | ✅ done |
| 4 | Secret owner/kitchen links (§2) | ❌ next, no input needed |
| 5 | SSE + kitchen sound (§6) | ❌ no input needed |
| 6 | Unit + API tests (§7) | ❌ no input needed |
| 7 | PostgreSQL (§1) | 🙋 needs `DATABASE_URL` |
| 8 | Menu editor, photos, 14 allergens, CSV, translations (§5) | ❌ after DB |
| 9 | Legal drafts (§8) | ❌ no input needed |
| 10 | PWA + real-device test | ❌ / 🙋 |
| 11 | Deploy (§9) | 🙋 accounts |

---

## What I need from you right now

1. **Gemini API key** → https://aistudio.google.com/apikey → paste into
   `.env.local` on the `GEMINI_API_KEY=` line. Then tell me, and I'll run the
   eval against the real model and tune the prompt for Flash.
2. Soon: **`DATABASE_URL`** from Neon or Supabase.

Meanwhile I'll continue with steps 4, 5, 6 and 9 — none need anything from you.
