// Live context for the guest page: weather, part of day and kitchen load.
// The guest UI polls this so the banners stay honest without a websocket.

import { getRestaurant } from "@/data/restaurants";
import { kitchenLoad, getSoldOut } from "@/lib/store";
import { getWeather } from "@/lib/weather";
import { partOfDayFor } from "@/lib/menu";

export const runtime = "nodejs";

export async function GET(req) {
  const { searchParams } = new URL(req.url);
  const slug = searchParams.get("slug");
  const restaurant = getRestaurant(slug);
  if (!restaurant) return Response.json({ error: "Unknown restaurant" }, { status: 404 });

  const weather = await getWeather(restaurant.coords);

  return Response.json({
    weather,
    partOfDay: partOfDayFor(new Date()),
    kitchen: kitchenLoad(slug),
    soldOut: getSoldOut(slug),
  });
}
