// In-memory store for orders and feedback.
//
// This is deliberately swappable: every function below is the only place that
// touches storage, so moving to PostgreSQL later means rewriting this file and
// nothing else. Data resets when the dev server restarts.

function db() {
  if (!globalThis.__qrRestaurantDb) {
    globalThis.__qrRestaurantDb = {
      orders: new Map(), // orderId -> order
      feedback: [], // { slug, dishId, score, at }
      soldOut: new Map(), // slug -> Set(dishId)
      aiCalls: [], // one row per /api/chat call - see logAiCall()
      unmet: [], // requests the AI could not satisfy - owner demand signal
      chatLog: new Map(), // sessionKey -> [{role, content, at}] server-side history
      favourites: new Map(), // slug -> Map(dishId -> Set(guestId))
      seq: 1,
    };
  }
  return globalThis.__qrRestaurantDb;
}

// ---------------------------------------------------------------------------
// AI observability. Every call to Gemini (or the fallback) is recorded so the
// owner dashboard can show cost, fallback rate and latency, and so a
// complaint can be traced back to what the AI actually said.
// ---------------------------------------------------------------------------

// gemini-3.5-flash-lite list prices, USD per million tokens (paid tier). Thinking
// tokens are billed as output. Cached input is a quarter of the input price.
// Update here if you switch model or Google changes pricing.
const PRICE = { input: 0.1, output: 0.4, cacheRead: 0.025 };

export function estimateCostUsd(usage = {}) {
  const cached = usage.cachedContentTokenCount || 0;
  const inTok = Math.max(0, (usage.promptTokenCount || 0) - cached);
  const outTok = (usage.candidatesTokenCount || 0) + (usage.thoughtsTokenCount || 0);
  return (inTok * PRICE.input + outTok * PRICE.output + cached * PRICE.cacheRead) / 1_000_000;
}

export function logAiCall(row) {
  const d = db();
  const entry = { id: `ai${d.aiCalls.length + 1}`, at: Date.now(), ...row };
  d.aiCalls.push(entry);
  if (d.aiCalls.length > 5000) d.aiCalls.shift();
  return entry;
}

export function aiStats(slug, { sinceMs = 30 * 24 * 3600 * 1000 } = {}) {
  const cutoff = Date.now() - sinceMs;
  const rows = db().aiCalls.filter((r) => r.slug === slug && r.at >= cutoff);
  const ai = rows.filter((r) => r.source === "ai");
  const latencies = ai.map((r) => r.latencyMs).sort((a, b) => a - b);
  const p95 = latencies.length ? latencies[Math.floor(latencies.length * 0.95)] : 0;
  const cacheHits = ai.filter((r) => (r.cacheReadTokens || 0) > 0).length;

  return {
    calls: rows.length,
    aiCalls: ai.length,
    fallbackCalls: rows.length - ai.length,
    fallbackRate: rows.length ? (rows.length - ai.length) / rows.length : 0,
    refusals: rows.filter((r) => r.refused).length,
    emptyRecommendations: rows.filter((r) => r.emptyRecommendations).length,
    costUsd: rows.reduce((s, r) => s + (r.costUsd || 0), 0),
    avgLatencyMs: ai.length ? Math.round(ai.reduce((s, r) => s + r.latencyMs, 0) / ai.length) : 0,
    p95LatencyMs: p95,
    cacheHitRate: ai.length ? cacheHits / ai.length : 0,
    recent: rows.slice(-20).reverse(),
  };
}

// Spend this calendar month, used to enforce the per-restaurant AI budget.
export function monthSpendUsd(slug) {
  const start = new Date();
  start.setDate(1);
  start.setHours(0, 0, 0, 0);
  return db()
    .aiCalls.filter((r) => r.slug === slug && r.at >= start.getTime())
    .reduce((s, r) => s + (r.costUsd || 0), 0);
}

export function logUnmet({ slug, message, reason }) {
  const d = db();
  d.unmet.push({ slug, message: String(message).slice(0, 300), reason, at: Date.now() });
  if (d.unmet.length > 2000) d.unmet.shift();
}

export function listUnmet(slug) {
  return db()
    .unmet.filter((u) => u.slug === slug)
    .slice(-50)
    .reverse();
}

// Server-side conversation history keyed by table session + guest, so a page
// refresh doesn't wipe the chat and the owner can review it on a complaint.
export function getChat(sessionKey) {
  return db().chatLog.get(sessionKey) || [];
}

export function appendChat(sessionKey, entries) {
  const d = db();
  const list = [...(d.chatLog.get(sessionKey) || []), ...entries].slice(-30);
  d.chatLog.set(sessionKey, list);
  return list;
}

export const ORDER_STAGES = ["received", "cooking", "ready", "served"];

// Idempotency: a double-tap on "send order" must not create two orders. The
// client sends a random key per attempt; we remember it for ten minutes.
export function findOrderByKey(key) {
  if (!key) return null;
  const d = db();
  if (!d.idem) d.idem = new Map();
  const hit = d.idem.get(key);
  return hit && Date.now() - hit.at < 10 * 60 * 1000 ? d.orders.get(hit.id) : null;
}

export function createOrder({ slug, table, guestName, guestId, items, note, allergens, servedAt, idempotencyKey }) {
  const d = db();
  const id = `o${String(d.seq++).padStart(4, "0")}`;
  const order = {
    id,
    slug,
    table: String(table || "?"),
    guestId: guestId || "anon",
    guestName: guestName || "Guest",
    items, // [{ dishId, name, price, qty, serveInMinutes }]
    note: note || "",
    allergens: allergens || [], // copied onto the kitchen ticket
    status: "received",
    total: items.reduce((s, i) => s + i.price * i.qty, 0),
    createdAt: Date.now(),
    servedAt: servedAt || null,
  };
  d.orders.set(id, order);
  if (idempotencyKey) {
    if (!d.idem) d.idem = new Map();
    d.idem.set(idempotencyKey, { id, at: Date.now() });
  }
  return order;
}

// Cancel is only allowed while the kitchen hasn't started, and only by the
// device that placed it.
export function cancelOrder(id, guestId) {
  const o = getOrder(id);
  if (!o) return { error: "Not found", status: 404 };
  // An anonymous device can never prove ownership, so it can never cancel.
  if (guestId === "anon" || o.guestId !== guestId) return { error: "Not your order", status: 403 };
  if (o.status !== "received") return { error: "The kitchen has already started", status: 409 };
  if (Date.now() - o.createdAt > 60_000) return { error: "Too late to cancel - ask a member of staff", status: 409 };
  o.status = "cancelled";
  return { order: o };
}

export function getOrder(id) {
  return db().orders.get(id) || null;
}

export function listOrders(slug, { activeOnly = false } = {}) {
  const all = [...db().orders.values()].filter((o) => o.slug === slug);
  const rows = activeOnly ? all.filter((o) => o.status !== "served" && o.status !== "cancelled") : all;
  return rows.sort((a, b) => b.createdAt - a.createdAt);
}

export function listTableOrders(slug, table) {
  return listOrders(slug).filter((o) => o.table === String(table));
}

export function advanceOrder(id, status) {
  const o = getOrder(id);
  if (!o) return null;
  o.status = ORDER_STAGES.includes(status) ? status : o.status;
  return o;
}

// How busy the kitchen is right now. Drives the "kitchen is busy" banner and
// tells the AI to favour fast dishes when the queue is long.
export function kitchenLoad(slug) {
  const active = listOrders(slug, { activeOnly: true });
  const dishes = active.reduce((s, o) => s + o.items.reduce((n, i) => n + i.qty, 0), 0);
  let level = "calm";
  if (dishes >= 14) level = "slammed";
  else if (dishes >= 6) level = "busy";
  return { activeOrders: active.length, queuedDishes: dishes, level, extraMinutes: level === "slammed" ? 15 : level === "busy" ? 7 : 0 };
}

// ---------------------------------------------------------------------------
// Favourite counts. The menu shows "how many people saved this", so the number
// has to be real - it is keyed by device so one guest cannot inflate it.
// ---------------------------------------------------------------------------

function favMap(slug) {
  const d = db();
  if (!d.favourites.has(slug)) d.favourites.set(slug, new Map());
  return d.favourites.get(slug);
}

export function toggleFavouriteCount({ slug, dishId, guestId, on }) {
  const map = favMap(slug);
  if (!map.has(dishId)) map.set(dishId, new Set());
  const set = map.get(dishId);
  if (on) set.add(guestId);
  else set.delete(guestId);
  return set.size;
}

export function favouriteCounts(slug) {
  const out = {};
  for (const [dishId, set] of favMap(slug)) out[dishId] = set.size;
  return out;
}

/** Most-ordered dish ids first - drives the "Popular" tab. */
export function popularDishIds(slug, limit = 12) {
  const tally = {};
  for (const o of listOrders(slug)) {
    if (o.status === "cancelled") continue;
    for (const i of o.items) tally[i.dishId] = (tally[i.dishId] || 0) + i.qty;
  }
  return Object.entries(tally)
    .sort((a, b) => b[1] - a[1])
    .slice(0, limit)
    .map(([id]) => id);
}

export function addFeedback({ slug, dishId, score }) {
  const d = db();
  d.feedback.push({ slug, dishId, score, at: Date.now() });
  return true;
}

export function dishScores(slug) {
  const rows = db().feedback.filter((f) => f.slug === slug);
  const byDish = {};
  for (const r of rows) {
    byDish[r.dishId] = byDish[r.dishId] || { up: 0, down: 0 };
    if (r.score > 0) byDish[r.dishId].up++;
    else byDish[r.dishId].down++;
  }
  return byDish;
}

// Owner toggles kept in memory so the dashboard feels live.
export function setSoldOut(slug, dishId, soldOut) {
  const d = db();
  if (!d.soldOut.has(slug)) d.soldOut.set(slug, new Set());
  const set = d.soldOut.get(slug);
  if (soldOut) set.add(dishId);
  else set.delete(dishId);
  return [...set];
}

export function getSoldOut(slug) {
  return [...(db().soldOut.get(slug) || [])];
}
