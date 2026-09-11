# Scan & Eat — QR restaurant with an AI waiter

Guests scan the QR code on their table, the website opens on their phone, and an
AI waiter recommends food **from that restaurant's real menu** based on mood,
diet, calories, budget, the weather outside and how busy the kitchen is.

Built with Next.js 15 (App Router) + Tailwind CSS + Google Gemini.

---

## Run it

```bash
npm install
npm run dev
```

Open <http://localhost:3000>.

The app works immediately with **no API key** — it falls back to a built-in
rule-based recommender so you can demo the whole product offline. To switch the
real AI on, put your key in `.env.local`:

```
GEMINI_API_KEY=AIza...
```

Get a free key at <https://aistudio.google.com/apikey>. `.env.local` already
exists with a generated `TABLE_TOKEN_SECRET` (used to sign the QR-code URLs —
keep it). The model defaults to `gemini-3.5-flash-lite`; set `GEMINI_MODEL` to
change it.

### Look at the UI

```bash
npm run build && npm start          # terminal 1
npm run shoot menu http://localhost:3000/r/sehrli-tendir?table=4 --dark
```

Screenshots at a real 390x844 phone viewport through the DevTools Protocol and
reports anything sitting outside it. Chrome's `--window-size` does not set the
layout viewport in headless mode, so a plain `--screenshot` silently renders at
~800px and crops; this does it properly. `npm run probe <url> "<expr>"` reads
computed styles from the live page.

The design system and the reasoning behind it are in
[DESIGN_AUDIT.md](DESIGN_AUDIT.md).

### Check the AI's answers

```bash
npm run dev        # terminal 1
npm run ai:eval    # terminal 2
```

Runs the 18 scenarios in `tests/ai/scenarios.json` against the live server and
checks constraints: only safe dishes, ≤3 recommendations, right language,
arithmetic shown for fitness goals, budget respected, upsell never repeats,
injection resisted. **All 18 pass against live Gemini.** Run it every time
`src/lib/prompt.js` changes.

### Try it on your phone

1. `npm run dev -- -H 0.0.0.0`
2. Find your computer's network address (`ipconfig` on Windows).
3. Put it in `.env.local` as `NEXT_PUBLIC_BASE_URL=http://192.168.x.x:3000`.
4. Open the owner dashboard → **QR codes** tab → scan a table code with your
   phone camera.

---

## The three screens

| Who | URL | What it does |
|---|---|---|
| Guest | `/r/<restaurant>/t/<signed-token>` (what the QR code holds) or `/r/<restaurant>?table=4` (dev only) | Menu, AI waiter, basket, order tracking, table bill |
| Owner | `/owner/<restaurant>` | Menu + sold-out toggles, QR codes, what sells, **AI waiter stats** |
| Kitchen | `/owner/<restaurant>/kitchen` | Live order tickets, allergy warnings, advance status |

Two demo restaurants ship with the app: **Səhrli Təndir** (Azerbaijani, 16
dishes) and **Iron Fork** (high-protein cafe, 15 dishes).

To see an order move through the kitchen, open the guest page and the kitchen
screen side by side — the kitchen screen is what advances the status, exactly as
it would in a real restaurant.

---

## Where each of your 21 features lives

| # | Feature | File |
|---|---|---|
| 1 | Hunger slider | `components/HungerSlider.jsx` (native range, styled) |
| 2 | Weather & time aware | `lib/weather.js`, `lib/menu.js` (`scoreDishes`) |
| 3 | Remember me everywhere | `lib/profile.js` |
| 4 | One-tap feedback | `components/OrderTracker.jsx`, `api/feedback` |
| 5 | Split the bill | `components/OrderTracker.jsx` (grouped per device) |
| 6 | Voice ordering | `components/AiWaiter.jsx` (Web Speech API) |
| 7 | Honest wait time | `components/DishCard.jsx` + `kitchenLoad()` |
| 8 | Allergy on kitchen ticket | `components/KitchenScreen.jsx` (red bordered banner) |
| 9 | Daily calorie budget | `lib/profile.js`, `lib/prompt.js` |
| 10 | Tourist mode | `lib/i18n.js` + AI answers in the guest's language |
| 11 | Polite upsell | `lib/prompt.js` (rule: once, after a main) |
| 12 | Order for later | `components/BasketSheet.jsx` |
| 13 | Weather drink pairing | `lib/prompt.js` |
| 14 | Kids mode | `lib/menu.js` (`hardFilter`) |
| 15 | Wait-time quiz | `components/WaitQuiz.jsx` |
| 16 | Fasting mode | `lib/menu.js` (Lent) + `lib/prompt.js` (Ramadan) |
| 17 | Hydration reminder | `lib/menu.js` (`waterTarget`) |
| 18 | Post-gym timing | `components/AiWaiter.jsx` → `lib/prompt.js` |
| 19 | Leftover warning | `components/BasketSheet.jsx` |
| 20 | Kitchen busy signal | `lib/store.js` (`kitchenLoad`) |
| 21 | Goal tracking across visits | `lib/profile.js` |

Features **11, 13 and the Ramadan half of 16** are behaviours written into the
AI's instructions, so they only appear once you set an API key. Everything else
works with or without one.

---

## How the AI is kept honest

The AI cannot invent a dish, and it cannot break an allergy rule. Three layers:

1. **Pre-filter.** `hardFilter()` removes every dish that clashes with the
   guest's allergies, diet, fasting rule, kids mode, or that is sold out. The
   model is only ever *shown* the safe list.
2. **Structured output.** The model must return dish **IDs** matching a JSON
   schema (Gemini `responseJsonSchema`, generated from Zod), not free text.
3. **Post-validation.** Any ID that isn't in the safe list is dropped before it
   reaches the guest.

Prices are also re-calculated server-side on every order, so a tampered browser
cannot change what a dish costs.

On top of that:

- **Guardrails in the prompt** — guest messages are untrusted; off-topic gets a
  one-line redirect; no medical advice; allergy answers add "confirm with staff".
- **Streaming** — the reply streams word by word; recommendations arrive at the
  end. 12 s to first token / 30 s total, then the offline recommender answers.
- **Once-only behaviours** — the model reports which extras it did (upsell,
  drink pairing, water reminder, portion warning); the client sends them back so
  none can repeat.
- **Rate limits** — 20 messages per table per 15 min, 60 per IP per hour.
- **Monthly budget** per restaurant (`aiBudgetUsd`); when spent, offline mode.
- **Every call logged** — tokens, cost, latency, source, refusals — visible in
  the owner's *AI waiter* tab, along with the requests the menu couldn't satisfy.
- **Signed table tokens** — the QR URL is HMAC-signed, so a guest can't send
  food to another table by editing the address bar.

---

## How the AI bill is kept small

A conversation costs about **$0.0002**. At 200 conversations a day that is
roughly **$1.28 per restaurant per month** — and about **$0.70** once billing is
enabled. Five things get it there:

| Lever | Effect |
|---|---|
| **Model** — `gemini-3.5-flash-lite` instead of a full Flash model | 4.6× cheaper on this workload, ~1–2 s answers |
| **Compact menu encoding** — `id\|name\|price\|kcal\|…` instead of prose | menu block 1062 → 566 tokens |
| **Descriptions only on demand** — sent only when the guest asks what a dish *is* | saves ~150 tokens on most calls |
| **Split prompt** — static (rules + menu) vs per-turn (weather, goals, basket) | makes caching possible at all; turn context is only 51 tokens |
| **Response cache** — same question, same conditions → previous answer reused | repeat questions cost **$0** |

The response cache only serves questions with nothing personal in them: anything
involving the guest's own calories, their basket, a Ramadan countdown, or an
ongoing conversation is never shared between guests.

**Enable billing on your Google Cloud project to halve it again.** Google's
context caching has no quota on the free tier, so the menu is re-sent at full
price on every message. With billing on, it is billed at a quarter — the code
detects this automatically and starts using it, with nothing to change. The
owner dashboard's *AI waiter* tab shows whether it is active.

---

## Project layout

```
src/
  app/
    page.jsx                     platform home
    r/[slug]/page.jsx            guest app
    owner/[slug]/page.jsx        owner dashboard
    owner/[slug]/kitchen/        kitchen screen
    r/[slug]/t/[token]/          guest app via signed QR token
    api/chat                     the AI waiter (streams NDJSON)
    api/orders, api/orders/[id]  place, advance, cancel orders
    api/context                  weather, time, kitchen load
    api/menu                     sold-out toggle
    api/feedback                 one-tap ratings
    api/ai-stats                 cost / latency / fallback / unmet requests
  middleware.js                  anonymous per-device guest cookie
  components/                    all UI
  data/restaurants.js            the demo menus
  components/ui.jsx              Button, Chip, Badge, Card, Sheet, Note, skeletons
  components/BottomBar.jsx       navigation + the phase-driven primary action
  components/DishSheet.jsx       full dish detail, add, or ask the AI about it
  components/DishImage.jsx       the photo slot (photoUrl, else an illustrated tile)
  lib/
    journey.js         the meal's phase and the one action that matters now
    rating.js          stars derived honestly from one-tap feedback
    theme.js           colour mode + per-restaurant accent (WCAG-safe by luminance)
    menu.js            filtering + offline recommender
    prompt.js          builds the AI's instructions (PROMPT_VERSION here)
    replyExtractor.js  streams the reply text out of the JSON response
    weather.js         Open-Meteo, cached, fails soft
    sun.js             sunset (iftar) + Ramadan detection
    hours.js           opening hours
    aiCache.js         context cache (Google-side) + response cache (ours)
    ratelimit.js       sliding-window limiter (Upstash-shaped)
    session.js         guest cookie + signed table tokens
    profile.js         guest profile (localStorage)
    store.js           orders, feedback, AI call log (in memory)
    i18n.js            UI strings AZ / EN / RU
scripts/ai-eval.mjs              golden-set evaluation
scripts/shoot.mjs                phone-viewport screenshots + overflow check
scripts/probe.mjs                read computed styles from the live page
tests/ai/scenarios.json          the 18 scenarios
```

---

## Known limits (next steps)

- **No dish photography.** The menu follows a photography-led reference design
  (`docs/reference/menu-reference.webp`) but the data has no images, so
  `DishImage` falls back to an illustrated tile at the same size. Set
  `photoUrl` on a dish and the real picture takes over with no layout change.
  This is the biggest single visual gap.
- **Storage is in memory.** Orders and ratings reset when the dev server
  restarts. `lib/store.js` is the only file that touches storage, so swapping in
  PostgreSQL means rewriting that one file.
- **No payment.** By design — the order goes to the kitchen and the guest pays
  at the table. Online payment can be added later.
- **No owner login.** The dashboard is open; it needs authentication before any
  real restaurant uses it.
- **Voice input** uses the browser's speech API, so it works in Chrome, Edge and
  Safari but not Firefox, and Azerbaijani recognition depends on the device.
- The owner can toggle dishes on and off, but adding a brand-new dish still
  means editing `data/restaurants.js`.
#   M e n u _ A I  
 