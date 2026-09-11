import { advanceOrder, getOrder, cancelOrder } from "@/lib/store";
import { guestIdFrom } from "@/lib/session";

export const runtime = "nodejs";

export async function GET(_req, { params }) {
  const { id } = await params;
  const order = getOrder(id);
  if (!order) return Response.json({ error: "Not found" }, { status: 404 });
  return Response.json({ order });
}

// Kitchen advances the status. (Needs staff auth before production - see TODO.)
export async function PATCH(req, { params }) {
  const { id } = await params;
  const { status } = await req.json().catch(() => ({}));
  const order = advanceOrder(id, status);
  if (!order) return Response.json({ error: "Not found" }, { status: 404 });
  return Response.json({ order });
}

// Guest cancels within 60 s, only if the kitchen hasn't started.
export async function DELETE(req, { params }) {
  const { id } = await params;
  const result = cancelOrder(id, guestIdFrom(req));
  if (result.error) return Response.json({ error: result.error }, { status: result.status });
  return Response.json({ order: result.order });
}
