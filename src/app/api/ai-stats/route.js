// Owner-facing AI observability: cost, fallback rate, latency, cache hit rate,
// and the requests the AI could not satisfy (menu demand the owner is missing).
// Link-protected in v1 - see TODO_PRODUCTION.md section 2.

import { getRestaurant } from "@/data/restaurants";
import { aiStats, monthSpendUsd, listUnmet } from "@/lib/store";
import { cacheStats } from "@/lib/aiCache";

export const runtime = "nodejs";

export async function GET(req) {
  const { searchParams } = new URL(req.url);
  const slug = searchParams.get("slug");
  const restaurant = getRestaurant(slug);
  if (!restaurant) return Response.json({ error: "Unknown restaurant" }, { status: 404 });

  return Response.json({
    stats: aiStats(slug),
    monthSpendUsd: monthSpendUsd(slug),
    budgetUsd: restaurant.aiBudgetUsd ?? null,
    keyConfigured: Boolean(process.env.GEMINI_API_KEY),
    model: process.env.GEMINI_MODEL || "gemini-3.5-flash-lite",
    cache: cacheStats(),
    unmet: listUnmet(slug),
  });
}
