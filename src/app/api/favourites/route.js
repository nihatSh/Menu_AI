// Favourite counts shown on the menu ("how many people saved this").
//
// Keyed by the anonymous device cookie so the number is real: one guest
// hearting a dish twice does not move it, and un-hearting takes it back down.

import { getRestaurant } from "@/data/restaurants";
import { toggleFavouriteCount, favouriteCounts } from "@/lib/store";
import { guestIdFrom } from "@/lib/session";

export const runtime = "nodejs";

export async function GET(req) {
  const { searchParams } = new URL(req.url);
  const slug = searchParams.get("slug");
  if (!slug) return Response.json({ error: "slug required" }, { status: 400 });
  return Response.json({ counts: favouriteCounts(slug) });
}

export async function POST(req) {
  const { slug, dishId, on } = await req.json().catch(() => ({}));
  const restaurant = getRestaurant(slug);
  if (!restaurant) return Response.json({ error: "Unknown restaurant" }, { status: 404 });
  if (!restaurant.menu.some((d) => d.id === dishId)) {
    return Response.json({ error: "Unknown dish" }, { status: 404 });
  }

  const guestId = guestIdFrom(req);
  if (guestId === "anon") {
    // No device identity means the count cannot be kept honest, so leave it.
    return Response.json({ counts: favouriteCounts(slug) });
  }

  toggleFavouriteCount({ slug, dishId, guestId, on: Boolean(on) });
  return Response.json({ counts: favouriteCounts(slug) });
}
