import { z } from "zod";
import { getRestaurant } from "@/data/restaurants";
import { createOrder, findOrderByKey, listOrders, listTableOrders, getSoldOut } from "@/lib/store";
import { isOpen } from "@/lib/hours";
import { ordersPerTable } from "@/lib/ratelimit";
import { guestIdFrom } from "@/lib/session";

export const runtime = "nodejs";

const OrderSchema = z.object({
  slug: z.string().min(1).max(64),
  table: z.union([z.string(), z.number()]),
  guestName: z.string().max(40).optional(),
  note: z.string().max(200).optional(),
  allergens: z.array(z.string().max(20)).max(20).default([]),
  idempotencyKey: z.string().max(64).optional(),
  items: z
    .array(
      z.object({
        dishId: z.string().max(64),
        qty: z.number().int().min(1).max(20).default(1),
        serveInMinutes: z.number().int().min(0).max(120).default(0),
      })
    )
    .min(1)
    .max(30),
});

export async function POST(req) {
  const parsed = OrderSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return Response.json({ error: "Invalid order" }, { status: 400 });

  const { slug, table, guestName, items, note, allergens, idempotencyKey } = parsed.data;

  const restaurant = getRestaurant(slug);
  if (!restaurant) return Response.json({ error: "Unknown restaurant" }, { status: 404 });

  // Same double-tap → same order, not two.
  const existing = findOrderByKey(idempotencyKey);
  if (existing) return Response.json({ order: existing, deduplicated: true }, { status: 200 });

  if (!isOpen(restaurant)) {
    return Response.json(
      { error: `The kitchen is closed. Opening hours: ${restaurant.hours.open}–${restaurant.hours.close}.` },
      { status: 423 }
    );
  }

  const limit = await ordersPerTable.limit(`${slug}:${table}`);
  if (!limit.success) return Response.json({ error: "Too many orders from this table - please ask staff." }, { status: 429 });

  const soldOut = getSoldOut(slug);

  // Re-price server-side. Never trust prices that came from the browser.
  const priced = [];
  for (const item of items) {
    const dish = restaurant.menu.find((d) => d.id === item.dishId);
    if (!dish) return Response.json({ error: `Unknown dish ${item.dishId}` }, { status: 400 });
    if (soldOut.includes(dish.id)) return Response.json({ error: `${dish.name.en} just sold out` }, { status: 409 });

    priced.push({
      dishId: dish.id,
      name: dish.name.en,
      emoji: dish.emoji,
      price: dish.price,
      qty: item.qty,
      serveInMinutes: item.serveInMinutes,
      prepMinutes: dish.prepMinutes,
      allergens: dish.allergens,
    });
  }

  const order = createOrder({
    slug,
    table,
    guestName: guestName?.trim() || "Guest",
    guestId: guestIdFrom(req),
    items: priced,
    note,
    allergens,
    idempotencyKey,
  });
  return Response.json({ order }, { status: 201 });
}

export async function GET(req) {
  const { searchParams } = new URL(req.url);
  const slug = searchParams.get("slug");
  const table = searchParams.get("table");
  if (!slug) return Response.json({ error: "slug required" }, { status: 400 });

  const orders = table ? listTableOrders(slug, table) : listOrders(slug);
  return Response.json({ orders, me: guestIdFrom(req) });
}
