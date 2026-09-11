import { addFeedback, dishScores } from "@/lib/store";

export const runtime = "nodejs";

export async function POST(req) {
  const { slug, dishId, score } = await req.json().catch(() => ({}));
  if (!slug || !dishId) return Response.json({ error: "slug and dishId required" }, { status: 400 });

  addFeedback({ slug, dishId, score: score > 0 ? 1 : -1 });
  return Response.json({ ok: true });
}

export async function GET(req) {
  const { searchParams } = new URL(req.url);
  const slug = searchParams.get("slug");
  if (!slug) return Response.json({ error: "slug required" }, { status: 400 });
  return Response.json({ scores: dishScores(slug) });
}
