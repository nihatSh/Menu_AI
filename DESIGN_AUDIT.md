# Design audit — guest ordering UI

Run with `taste-skill` + `redesign-skill` before any changes were made.

**Design read:** consumer mobile ordering UI (a product surface at a table, not a
landing page) for a hungry guest with one hand free, in a premium-casual
hospitality language, leaning toward Tailwind v3 + a real display typeface +
motion that only fires as feedback.

**Mode:** Redesign — Overhaul. New visual language, information architecture and
copy preserved. Routes, API shapes and analytics-relevant names unchanged.

**Dials:** `DESIGN_VARIANCE 6` · `MOTION_INTENSITY 5` · `VISUAL_DENSITY 5`.
Lower variance than a landing page because a menu must stay scannable; motion is
feedback-only (tap, sheet, streaming reply), never decoration.

**Scope note:** taste-skill section 13 puts dense product UI out of scope. The
landing-page rules (hero discipline, eyebrow counts, logo walls, marquees) do
not apply here. The rules that do apply and were used: typography, colour
calibration, materiality, interactive states, AI tells, motion discipline,
accessibility, dark mode.

---

## What the audit found

### 1. The palette was a direct hit on the banned premium-consumer family

taste-skill 4.2 bans the warm beige + brass + espresso palette as the default
reach for premium-consumer briefs. The existing theme was exactly that:

| Token | Old value | Banned list |
|---|---|---|
| `cream` background | `#faf7f2` | `#faf7f1` — listed |
| `brand-500` accent | `#d4833c` | brass/clay/ochre family — listed |
| `brand-600` accent | `#b96a28` | same family |
| `brand-700` accent | `#94521f` | `#7d5621` — same family |
| `ink` text | `#15130f` | `#1a1714` espresso family — listed |

This is the single biggest finding. The app looked like every AI-generated
restaurant site because it used the palette every AI-generated restaurant site
uses.

### 2. No typeface

`fontFamily.sans` was `ui-sans-serif, system-ui, -apple-system, Segoe UI`. The
browser default. No display face, no weight hierarchy beyond 400/600/700, no
tabular figures on prices or macros despite the UI being full of numbers.

### 3. Emoji doing an icon's job

`🤖` `📖` `🧾` as tab icons, `🎤` mic, `👤` profile, `⏳` banner, `🚨` allergy,
`💧` hydration, `🎲` quiz. taste-skill 3.D discourages emoji in UI chrome.

### 4. One card pattern, fifteen times

`rounded-2xl border border-black/5 bg-white shadow-sm` appears in eight
components. taste-skill 4.4: cards only when elevation communicates hierarchy,
otherwise group with dividers or space.

### 5. Uniform radius everywhere

`rounded-2xl` on cards, sheets, banners and wells alike. No shape scale.

### 6. No dark mode

Light only. taste-skill 6.C makes dual-mode mandatory for consumer-facing
surfaces. A restaurant at 9pm is a dark room.

### 7. `window.alert()` for a cancel error

redesign-skill bans it outright. Needs an inline error.

### 8. Motion claimed but not shipped

Two keyframes existed (`fade-up`, `pulseDot`). No sheet transitions, no tap
feedback beyond `active:scale-95` on some buttons, no stagger on the menu list.

---

## What was deliberately kept

* **Dish emoji as dish markers.** Every other emoji became a real icon, but the
  dish glyphs stay, enlarged and set in a tinted well. The reason is honesty:
  there are no real dish photographs yet, and seeding `picsum.photos` would put
  a stock photo of someone else's food under the name "Piti". In an ordering
  flow that is misleading, not decorative. The markup has a real `<img>` slot
  that takes over the moment the owner uploads a photo (TODO section 5).
* **Information architecture** — three tabs, same order, same labels.
* **Copy voice and all three languages.**
* **Every route, API shape and prop name.**

---

## The new system

**Palette — neutral-cool base + per-restaurant accent.** The base deliberately
leaves the warm-craft family: a cool near-neutral paper in light, a true
low-chroma charcoal in dark. Each restaurant injects one accent from its own
brand (`restaurant.theme.accent`) as the only saturated colour on the page.
This is also the correct multi-tenant architecture: one system, many brands.

**Type — Outfit for display, Geist Mono for figures.** Prices, calories, protein
and timers all sit in tabular mono so columns align. Outfit carries weight
500/600/700 for hierarchy without shouting.

**Shape scale, documented and followed:** `4px` on chips and badges, `10px` on
controls and inputs, `16px` on cards and wells, `28px` on sheets, full pill on
primary actions only.

**Motion, each one motivated:** sheets spring from the bottom edge (they come
from the thumb), menu items stagger in on first paint only (hierarchy), the AI
reply cursor pulses while streaming (state), taps depress (feedback). All of it
collapses under `prefers-reduced-motion`.

---

## How it was checked

`npm run shoot` drives headless Chrome through the DevTools Protocol at a real
390x844 phone viewport and reports any element sitting outside it.

This matters: Chrome's `--window-size` does **not** set the layout viewport in
headless mode, so a plain `--screenshot` at 390px renders the page at ~800px and
crops. The first three rounds of screenshots looked broken for that reason
alone. `Emulation.setDeviceMetricsOverride` is the only truthful way.

`npm run probe <url> "<expression>"` evaluates JavaScript in the page, used to
read computed colours rather than judging them from a downscaled PNG.

### What iterating actually found

Each of these was invisible in code review and obvious on screen:

1. **Dead space in dish cards.** With no allergens the add button sat alone on
   its own row. Restructured to three columns; 6 dishes now fit where 2.5 did.
2. **Six coloured blocks down the page.** Tinting the dish wells with the accent
   made the list read as colour, not food. The accent now belongs only to
   things you can act on.
3. **The accent was still the banned brass.** The palette lived in the seed data,
   not just the theme, so the audit fix was incomplete until the restaurant
   records changed too.
4. **The hunger control read as five input fields.** Two attempts (tap-target
   bars, then an equaliser) both failed - wide blocks look like fields whatever
   their height. A native range input fixed it and brought drag, keyboard and
   screen-reader support with it.
5. **The kitchen screen rendered white-on-white in dark mode.** It used `bg-ink`
   with `text-white`, and `--ink` inverts. It is now permanently dark, which is
   what a wall-mounted tablet in a kitchen should be.
6. **The category rail hid its last chip** under the search button, because
   `-mx-4` bled it rightwards as well as leftwards.

### Not fixed, deliberately

**Dish photographs.** Every dish still shows a glyph. Seeding a placeholder
photo service would put a stock picture of someone else's food under the name
"Piti", and a guest ordering from that picture is being misled. The markup
already renders `dish.photoUrl` when it exists, so this resolves itself the day
the owner can upload real images (TODO section 5).


---

# Round two: UX only

Scope: flow, affordances and sequence. The menu's visual language is unchanged
and waiting on reference images.

## The core problem

Three tabs sitting side by side let a guest wander, but never told them where
they were in the meal or what came next. Navigation lived at the top of the
screen and the basket floated at the bottom, so the two most-used controls were
at opposite ends of the phone and neither was under the thumb. Tapping a dish
did nothing at all.

## What changed

### 1. The app follows the meal, not a tab bar

`lib/journey.js` derives a phase from real state and returns the one action
that matters:

| Phase | When | The bar offers |
|---|---|---|
| arriving | nothing chosen, nothing ordered | nothing - let them look |
| choosing | basket has items | Review order, with count and total |
| waiting | order sent, kitchen working | Track your order, with live status |
| eating | food served | Order something else |

The sequence lives in one readable function instead of conditions scattered
across three screens. The action never offers to take you where you already
are, which also removed a collision with the order confirmation.

### 2. Navigation and the primary action moved to the thumb

One `BottomBar` carries both. It measures its own height with a ResizeObserver
and publishes it as `--bar-h`, which the chat composer and every scroll area
use to clear it. The first attempt hardcoded rem values and was 6px wrong - the
nav renders at 66px, not the 60px I assumed.

### 3. A dish is no longer a dead end

Tapping a card opens `DishSheet`: the full description (the card clamps to two
lines), the complete macro split, every allergen spelled out, diet badges, and
two ways forward - add it, or **ask the AI about this dish**, which hands the
question straight into the chat. The menu and the AI are now connected in both
directions.

### 4. Adding is adjustable in place

The "+" becomes a stepper on the card itself. The most common thing after
adding is adding another or undoing it, and neither should require opening the
basket. The add toast was then deleted: the stepper shows the count and the bar
shows the total, so a third confirmation was noise - and it physically
overlapped the action button.

### 5. The menu has sections again

Browsing everything groups dishes into their real categories with sticky
headers, so a long scroll always says where you are. Filtering or searching
flattens to one ranked list, because the guest has already narrowed it. Both
orders use the same signals the AI uses.

### 6. Allergies are asked once, up front

The most important safety input was behind a person icon in the corner, where a
first-time guest would never find it. It is now a dismissible card on the first
visit, and the "N dishes hidden" banner is tappable to change the setting.

### 7. Expectations set at the moment of ordering

Sending an order used to switch tabs silently. It now confirms with a real
estimate from the slowest dish plus current kitchen load: "Sent to the kitchen,
about 8 min."

## Bugs found by driving the flow

`npm run shoot` now accepts an `actions` list, so a screenshot can capture a
state that only exists after real interaction. That caught:

- The toast rendering off-centre: `animate-rise-in` writes `transform`, which
  silently cancelled its `-translate-x-1/2`.
- `--bar-h` being 6px short of the real nav height.
- The protein tile in the dish sheet rendering a value with no label, because
  `strings.protein` had never been defined.
- "Track your order" being offered while already on the Orders screen.

## Verified after the rework

All routes 200, forged QR tokens still 404, ordering and the allergy ticket
intact, AI still allergy-safe, and the 18-scenario eval passes.

One note on that eval: a single run showed "upsell after main in basket"
failing because the model offered the upsell in the reply text but did not set
the `upsellOffered` flag. A re-run passed 18/18. That scenario is mildly flaky
on flash-lite, not a regression - nothing in this round touched the prompt or
the chat route.


---

# Round three: the reference design

Reference: `docs/reference/menu-reference.webp` (Mohamed Essam).

## What the reference establishes

A photography-led food app. The picture is the largest element on every card
and fills the top of the detail screen; everything else is arranged around it.

| Element | Reference | Built |
|---|---|---|
| Menu card | image left, name, 2-line description, price in accent, filled "Quick Add" pill, heart, rating badge | ✅ |
| Category rail | pills carrying a small food image plus a label, active filled | ✅ (dish glyph stands in for the photo) |
| Detail screen | full-bleed hero, floating back and heart, rounded panel overlapping it, title, rating + prep time | ✅ |
| Nutrition facts | dark segmented strip of values | ✅ maps exactly onto data we already hold |
| Description | clamped with "Read more" | ✅ |
| Primary action | wide filled pill pinned to the bottom | ✅ |
| Side options | horizontal photo chips with + badges | ❌ no modifiers in the data model |
| Bottom nav | Home / Menu / My Cart / Profile | partly - we have Ask / Menu / Orders, and the basket lives in the contextual bar from round two |

## Ratings are derived, not invented

The reference shows a star rating on every dish. We collect one-tap thumbs
after a meal, so `lib/rating.js` derives stars from real votes, pulls the score
toward a neutral prior while the sample is small, and shows nothing at all
below three votes. A handful of thumbs must not render as "4.8 stars".

## The open problem: photography

This design lives or dies on food photography, and the menu data has none.

`DishImage` renders `dish.photoUrl` when it exists and an accent-tinted
illustrated tile when it does not, at exactly the reference's sizes - so real
photos drop in with no layout change. The fallback is deliberately styled
rather than a grey box, but it cannot carry the design the way a photograph
does, and the current screens show that plainly.

Deliberately **not** used: a stock photo service. Putting a picture of
somebody else's food under the name "Piti" misleads a guest who is ordering
from it. Image generation was the other option and is wired up in the
environment, but the Higgsfield account has 0 credits on the free plan.

Three ways forward, in order of preference:

1. **Real photographs from the restaurant.** Correct for production anyway -
   the owner uploads them, and the field already exists in the data model.
2. **Generated photography** for the demo, once there are credits. One image
   per dish, 31 in total across both restaurants.
3. **Ship as is** with illustrated tiles, and treat photography as a launch
   blocker in `TODO_PRODUCTION.md` section 5.
