# What the website will be

## The idea
Every restaurant gets its own QR code. A guest scans it at the table, opens our
website on their phone (no app install), and instead of a boring menu they talk
to an **AI waiter** that knows this restaurant's menu and recommends what to
order based on their mood, goal, diet or budget. Then they order right there.

## What the guest sees (step by step)

1. **Scan QR** -> website opens already on that restaurant's page
   (logo, colors, cover photo, table number already known).
2. **Two choices:** "Browse menu" or "Ask the AI".
3. **AI chat** — guest types or picks quick buttons:
   - "I'm tired and want comfort food"
   - "Something light after breakfast"
   - "I'm an athlete, I need 900 kcal and 60g protein"
   - "Vegan, no nuts, under 20 AZN"
   - "What goes well with the steak?"
4. **AI answers with 3 dishes from THIS menu only**, each with a reason,
   price, calories and protein. It can never invent a dish and never suggests
   something that is sold out.
5. **Add to cart -> send order** to the kitchen. Guest sees live status:
   Received -> Cooking -> Served.
6. Language switch (AZ / EN / RU + more later).

## What the restaurant owner sees

- Dashboard to add/edit menu: name, photo, price, description, ingredients,
  calories, protein / carbs / fat, allergens, spice level, prep time.
- One tap "sold out" -> AI instantly stops recommending it.
- Generate and print QR codes (one per table).
- Live kitchen screen with incoming orders.
- Simple stats: best sellers, what the AI recommended vs what people bought.

## What you (platform owner) see

- Add new restaurants, turn them on/off, see how much each one is used.

## Rules for the AI
- Only recommends real menu items from the current restaurant.
- Allergies are a hard filter, never a suggestion.
- For fitness requests it shows the math (e.g. 620 kcal + 280 kcal = 900).
- Short answers, max 3 suggestions, then "want something else?".

## Built with
- Next.js + Tailwind (mobile-first website)
- PostgreSQL database
- Google Gemini API for the AI waiter
- QR codes link to `site.com/r/<restaurant>?table=<n>`
- Hosted on Vercel

## Build order
1. Demo restaurant + menu data
2. Guest menu page (mobile design)
3. QR codes + routing
4. AI waiter chat  <- after this you can already demo it
5. Cart + ordering + kitchen screen
6. Owner dashboard
7. Extra ideas you approve from EXTRA_IDEAS.md

## Questions for you
1. Pay online, or just send the order and pay at the table like normal?
2. Which languages first?
3. Do you have a real menu for the demo, or should I invent one?
