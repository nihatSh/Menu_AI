# Handoff

For the next agent picking this up. Read this before touching code — several
things here will otherwise cost you hours to rediscover.

Last updated: 2026-09-12, at commit `e0d3297`.

---

## 1. What this is

A QR-code restaurant ordering web app. A guest scans the code on their table,
the site opens on their phone, and instead of a PDF menu they can talk to an
**AI waiter** that knows that restaurant's real menu and recommends food by
mood, diet, calories, budget, the weather outside and how busy the kitchen is.
Then they order from the same screen.

**Owner:** nihatSh (Nihat). Building this as a product, not an exercise.
**Repo:** https://github.com/nihatSh/Menu_AI — **public**.
**Stack:** Next.js 15 (App Router, JS not TS) · Tailwind v3 · Google Gemini.

Two demo restaurants ship with it: **Səhrli Təndir** (Azerbaijani, 16 dishes)
and **Iron Fork** (high-protein café, 15 dishes).

---

## 2. Decisions the owner has already made

Do not relitigate these without asking.

| Decision | Detail |
|---|---|
| **AI provider** | Google Gemini. Was Claude; switched on request. `@google/genai`. |
| **No authentication in v1** | Owner and kitchen pages are reachable by link. Auth is v2. |
| **No online payment** | Order goes to the kitchen, guest pays at the table. |
| **Languages** | AZ / EN / RU. Turkish is wanted later. |
| **Feature set** | 21 features chosen from a longer list — see `EXTRA_IDEAS.md`. Ideas the owner rejected are deleted from that file, so anything still listed is in scope. |
| **Menu visual language** | Driven by two reference images the owner supplied, in `docs/reference/`. The current menu follows the second one (editorial rows). |
| **Photos on the left** | Explicitly asked for, against the reference which has them right. |
| **Database** | Supabase. MCP server is configured; see §8. |

---

## 3. State of play

### Works, verified end to end

- Guest flow: scan → browse or ask → add → send → live status → rate → split bill
- AI waiter: streaming, allergy-safe, 18/18 on the golden eval against live Gemini
- Signed QR table tokens (forged token → 404)
- Orders: server-side re-pricing, sold-out check, opening hours, 60s cancel,
  idempotency, per-device split bill
- Kitchen screen with unmissable allergy banner, permanently dark
- Owner dashboard incl. an **AI waiter** tab (cost, latency, fallback rate,
  cache savings, unmet requests)
- Real dish photography with attribution
- Favourite counts, keyed per device so the number is honest
- Light + dark, AZ/EN/RU throughout

### Does not work / not built

- **Everything is in memory.** `src/lib/store.js` is the only file that touches
  storage. Restart the server and all orders, ratings and favourites vanish.
  This is the single biggest gap and the next real task.
- No auth of any kind (by decision, but the owner/kitchen links are wide open)
- No menu editor — adding a dish means editing `src/data/restaurants.js`
- Order status polls every 5s; no SSE, no sound in the kitchen
- No tests other than the AI eval
- Not deployed

---

## 4. How to run and verify

```bash
npm install
npm run dev           # or: npm run build && npm start
```

`.env.local` already exists and holds a **live Gemini key** plus
`TABLE_TOKEN_SECRET`. It is git-ignored — verified absent from the remote.
Never commit it. Changing `TABLE_TOKEN_SECRET` invalidates every printed QR code.

Without a key the app still works: it falls back to a rule-based recommender,
so the whole product demos offline.

### The four scripts matter more than they look

```bash
npm run ai:eval            # 18 scenarios against live Gemini; run after ANY prompt change
npm run shoot --help       # phone-viewport screenshots + overflow check
npm run probe <url> "<js>" # read computed styles from the live page
npm run photos:verify      # re-check all 31 photo URLs still resolve
```

**`npm run shoot` is not optional when you change UI.** It drives headless
Chrome through the DevTools Protocol at a true 390×844 viewport and reports any
element outside it. It also runs interaction sequences, so you can screenshot a
state that only exists after real use:

```bash
node scripts/shoot.mjs --batch jobs.json
# jobs.json: [{"name":"x","url":"...","dark":true,
#   "actions":[{"click":"Not now"},{"click":"Add Piti","settle":1500}]}]
```

`click` matches against `aria-label` first, then text content.

---

## 5. Gotchas — read this section

Each of these cost real time to find.

### Tooling / environment

1. **Chrome `--window-size` does not set the layout viewport in headless mode.**
   A plain `--screenshot` at 390px renders the page at ~800px and crops it. My
   first three rounds of screenshots looked broken for this reason alone. Use
   `scripts/shoot.mjs`, which uses `Emulation.setDeviceMetricsOverride`.
2. **Stale `.next` gives `Cannot find module './873.js'`** and every route 500s.
   Fix: `rm -rf .next && npx next build`. Happens if a server starts mid-build.
3. **`next/font/google` is ESM-only** — `require()` reports 0 exports. It
   resolves at build time; just use it and let the build tell you.
4. **Raw Node cannot import the app's modules the way Next does.** Extensionless
   imports fail, and on Windows an absolute path is not a valid ESM specifier —
   use `pathToFileURL()`. This is why `scripts/*.mjs` has a `load()` helper.
5. **JSON imports need import attributes in raw Node.** That is why dish photos
   live in `src/data/photos.js` (a JS module) and not only `photos.json` — the
   `.json` is the script's output, the `.js` is what the app imports.
6. **Bash heredocs break on apostrophes** in this environment. For multi-line
   patches, write the patch script to a file and run it.
7. **The kitchen closes at 23:30 Asia/Baku.** Order API tests return `423` at
   night. That is `lib/hours.js` working, not a bug.

### Gemini

8. **`thinkingBudget: 0` returns 400** on the 3.x models. Use
   `thinkingConfig: { thinkingLevel: "MINIMAL" }`.
9. **Thinking can spike unpredictably** and blow `maxOutputTokens`, truncating
   the JSON mid-string and wasting the call. `maxOutputTokens` is only a
   ceiling — unused tokens are never billed — so it is deliberately set to 1600.
   Do not "optimise" it down.
10. **`gemini-2.5-flash` is retired for new accounts** (404 with a message
    pointing at 3.x). Current default is `gemini-3.5-flash-lite`.
11. **Context caching needs a billing-enabled project.** The free tier returns
    429 `limit=0` for both implicit and explicit caching. `lib/aiCache.js`
    probes once, backs off for an hour, and starts using the cache automatically
    when billing is switched on — no code change needed.
12. **Free-tier rate limits bite.** The eval paces itself (`AI_EVAL_GAP`, default
    4s) and retries once on a quota fallback. It also uses a distinct table per
    scenario, because otherwise **our own** rate limiter (20 msgs/table/15min)
    throttles the test run.
13. **One eval scenario is mildly flaky**: "upsell after main in basket"
    occasionally offers the upsell in the reply text without setting the
    `upsellOffered` flag. Re-run before assuming you broke something.

### CSS / React

14. **`bg-ink` inverts in dark mode.** `--ink` is near-black in light and
    near-white in dark. The kitchen screen used `bg-ink` + `text-white` and
    rendered white-on-white. Permanently-dark surfaces must use fixed values
    (it now uses `bg-zinc-950`).
15. **`animate-rise-in` writes `transform`**, which silently cancels
    `-translate-x-1/2`. A centred toast rendered off-centre because of this.
    Centre with a wrapper, animate the child.
16. **Do not hardcode the bottom bar height.** It measures itself with a
    `ResizeObserver` and publishes `--bar-h`; my rem guess was 6px short (the
    nav renders at 66px, not 60). The chat composer and all scroll padding
    depend on that variable.
17. **Theme state and the DOM class can diverge.** Setting React state alone let
    the icon say "dark" while the page rendered light. `GuestApp` now writes
    both on mount. If you touch theming, keep them together.
18. **JSX inserts whitespace across line breaks** — `{label}` newline `<span>:
    {count}</span>` renders "Favourites : 0". Keep them on one line or wrap.

---

## 6. Architecture

```
src/
  app/
    page.jsx                     platform home (restaurant list)
    r/[slug]/t/[token]/          guest app via SIGNED token — what QR codes hold
    r/[slug]/page.jsx            plain ?table=N, DEV ONLY (blocked in production)
    owner/[slug]/                dashboard (menu, QR codes, sales, AI stats)
    owner/[slug]/kitchen/        kitchen screen, permanently dark
    api/chat                     the AI waiter, streams NDJSON
    api/orders, orders/[id]      place / advance / cancel
    api/context                  weather, part of day, kitchen load, sold out, popular
    api/favourites               per-device favourite counts
    api/feedback                 one-tap ratings
    api/menu                     sold-out toggle
    api/ai-stats                 cost, latency, fallback rate, unmet requests
  middleware.js                  sets the anonymous `se_guest` device cookie
  lib/
    store.js         ALL storage. Rewrite this one file for Postgres.
    prompt.js        static (cacheable) + per-turn prompt halves. PROMPT_VERSION here.
    aiCache.js       Google context cache (auto-detect) + our response cache
    journey.js       the meal's phase -> the single action the bottom bar offers
    menu.js          hardFilter() safety + the offline recommender
    session.js       device cookie + HMAC-signed table tokens
    theme.js         colour mode + per-restaurant accent (WCAG-safe by luminance)
    rating.js        stars derived honestly from thumbs, hidden below 3 votes
    sun.js           sunset (iftar) + Ramadan via the Hijri calendar
    hours.js, ratelimit.js, replyExtractor.js, weather.js, profile.js, i18n.js
  data/
    restaurants.js   the demo menus; merges photos.js in
    photos.js        dish photo URLs (what the app imports)
    photos.json      the photo script's output, with credits
```

### Things worth understanding before editing

**The AI cannot invent a dish or break an allergy rule.** Three layers:
1. `hardFilter()` removes every unsafe dish *before* the model sees the menu
2. structured output forces it to return dish **IDs** from a JSON schema
3. any ID not on the safe list is dropped server-side

Keep all three. This is the most important property of the codebase.

**The prompt is split in two on purpose.** `buildStaticPrompt()` (rules + menu)
is byte-identical between guests so it can be cached; `buildTurnContext()`
carries weather, goals and basket. Putting live context back into the system
instruction would silently destroy caching. The turn context is only ~51 tokens.

**Cost design.** ~$0.0002 per conversation, roughly $1.28/restaurant/month at
200 conversations a day. Levers: the lite model, compact menu encoding,
descriptions only when asked, the split prompt, and a response cache that
serves repeat questions free. The response cache deliberately refuses anything
personal (own calories, basket, Ramadan countdown, mid-conversation).

---

## 7. Known open items

### Inconsistency you should decide on

**There are two dish components.** `DishRow` (editorial rows, current menu) and
`DishCard` (the older photo-left card), and `DishCard` is still used by
`AiWaiter` for chat recommendations. So the Ask tab and the Menu tab look
different. Either port the chat to `DishRow` or keep the split deliberately —
but it is currently accidental. Ask the owner which they prefer.

### Not built, asked about

- **Side options / modifiers** (onion, ketchup, fries — in the first reference).
  No modifier concept in the data model at all. The owner was told; not requested yet.
- **`dish.isNew`** — `DishRow` renders a "New" badge from this flag, but no dish
  sets it. Needs either manual flags or an `addedAt` date.

### Photography

All 31 dishes have real, freely-licensed Wikimedia Commons photos
(`docs/PHOTO_CREDITS.md`). **They are placeholders** — right dish, not this
restaurant's food. An owner replaces them via `photoUrl`.

Do not swap them for a stock photo service. A keyword-only pass returned a
**Buddha statue for Ayran**, a military backpack for saj (French "sac"), a glass
juicer for green juice and a **pork chop for a halal salad**. Every image was
reviewed by eye. If you re-source any, review it visually — build a contact
sheet and look at it.

---

## 8. What to do next

`TODO_PRODUCTION.md` is the full list with 🙋 marking anything that needs the
owner. In priority order:

1. **PostgreSQL via Supabase.** The MCP server is configured in `.mcp.json` but
   the owner still has to authenticate (`claude /mcp`, in a real terminal, not
   the IDE extension). Two Supabase Agent Skills are installed in
   `.agents/skills/` and symlinked into `.claude/skills/` — run `/reload-skills`
   to pick them up, and **load `supabase-postgres-best-practices` before writing
   any schema.** RLS design matters especially here because the guest app has no
   auth in v1. Rewrite `lib/store.js`; nothing else should need to change.
   Schema sketch is in `TODO_PRODUCTION.md` §1.
2. **Unguessable owner/kitchen links** (`/owner/<slug>/<secret>`) — the v1
   substitute for auth. No owner input needed.
3. **SSE + kitchen sound.** Staff are not watching the screen.
4. **Tests** on the safety-critical paths: `hardFilter` (property test), the
   chat route dropping invented IDs, order re-pricing, signed tokens.
5. **14 legal allergens** — the app tracks 7; EU law requires 14. Real liability.

---

## 9. Working style that fit this owner

- They move fast and change direction; ask one question, not five, and make
  progress on what is unambiguous.
- They want to be told when something is wrong. Several times the right answer
  was to push back (stock photos, the banned colour palette) — and once they
  reaffirmed, to do it properly rather than half-heartedly.
- **Verify by looking.** Most real bugs in this project were invisible in code
  review and obvious in a screenshot: dead space in cards, white-on-white,
  an off-centre toast, a control that read as five input fields.
- Report honestly. If a test fails, say so with the output. If something is a
  placeholder, say that too.

---

## 10. Design system, briefly

Full reasoning in `DESIGN_AUDIT.md`, which also records what was rejected and
why. The short version:

- **Palette**: cool-neutral base, one accent **per restaurant** injected from
  its own brand (`restaurant.theme.accent`). `accent-ink` is chosen by luminance
  so button labels always clear WCAG AA whatever colour an owner picks.
- The original palette was the warm cream + brass + espresso family that reads
  as generic AI design. Do not go back to it.
- **Type**: Outfit + JetBrains Mono. Every price, macro and timer uses `.tnum`
  so columns align.
- **Shape scale**: 4px chips · 10px controls · 16px cards · 28px sheets · full
  pill for primary actions. Follow it.
- **Motion** must be justifiable in one sentence, and all of it collapses under
  `prefers-reduced-motion`.
