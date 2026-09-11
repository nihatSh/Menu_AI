// Owner actions on the menu: mark a dish sold out or back in stock.
// Link-protected in v1 - see TODO_PRODUCTION.md section 2.

import { getRestaurant } from "@/data/restaurants";
import { setSoldOut, getSoldOut } from "@/lib/store";
import { clearResponseCache } from "@/lib/aiCache";

export const runtime = "nodejs";

export async function POST(req) {
  const { slug, dishId, soldOut } = await req.json().catch(() => ({}));
  const restaurant = getRestaurant(slug);
  if (!restaurant) return Response.json({ error: "Unknown restaurant" }, { status: 404 });
  if (!restaurant.menu.some((d) => d.id === dishId)) {
    return Response.json({ error: "Unknown dish" }, { status: 404 });
  }

  setSoldOut(slug, dishId, !!soldOut);

  // Cached answers may name a dish that just sold out. The response-cache key
  // already includes the available-dish list, so old entries can never be
  // served - but clearing keeps memory tidy and makes the change obvious.
  clearResponseCache(slug);

  return Response.json({ soldOut: getSoldOut(slug) });
}
