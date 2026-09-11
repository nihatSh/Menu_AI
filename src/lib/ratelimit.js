// Sliding-window rate limiter.
//
// In-memory today. The `limit(key)` signature deliberately matches
// @upstash/ratelimit so that on Vercel (where server instances don't share
// memory) you swap the body of `limit()` for an Upstash Redis call and nothing
// else changes. Until then, each server instance limits on its own — still
// enough to stop a single script hammering the AI route.

function buckets() {
  if (!globalThis.__rateBuckets) globalThis.__rateBuckets = new Map();
  return globalThis.__rateBuckets;
}

export function createLimiter({ name, max, windowMs }) {
  return {
    async limit(key) {
      const now = Date.now();
      const k = `${name}:${key}`;
      const store = buckets();
      const hits = (store.get(k) || []).filter((t) => now - t < windowMs);

      if (hits.length >= max) {
        const retryAfterMs = windowMs - (now - hits[0]);
        store.set(k, hits);
        return { success: false, remaining: 0, retryAfterMs };
      }

      hits.push(now);
      store.set(k, hits);

      // Opportunistic cleanup so the map doesn't grow forever.
      if (store.size > 5000) {
        for (const [key2, times] of store) {
          if (!times.some((t) => now - t < windowMs)) store.delete(key2);
        }
      }

      return { success: true, remaining: max - hits.length, retryAfterMs: 0 };
    },
  };
}

// One AI conversation per table shouldn't need more than this.
export const chatPerTable = createLimiter({ name: "chat:table", max: 20, windowMs: 15 * 60 * 1000 });
export const chatPerIp = createLimiter({ name: "chat:ip", max: 60, windowMs: 60 * 60 * 1000 });
export const ordersPerTable = createLimiter({ name: "orders:table", max: 10, windowMs: 10 * 60 * 1000 });

export function clientIp(req) {
  return (
    req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    req.headers.get("x-real-ip") ||
    "local"
  );
}
