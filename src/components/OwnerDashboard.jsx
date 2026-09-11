"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import QrCodes from "./QrCodes";

export default function OwnerDashboard({ restaurant, tablePaths }) {
  const [tab, setTab] = useState("menu");
  const [soldOut, setSoldOut] = useState([]);
  const [orders, setOrders] = useState([]);
  const [scores, setScores] = useState({});
  const [ai, setAi] = useState(null);

  const refresh = useCallback(async () => {
    const [ctxRes, ordersRes, feedbackRes, aiRes] = await Promise.all([
      fetch(`/api/context?slug=${restaurant.slug}`, { cache: "no-store" }),
      fetch(`/api/orders?slug=${restaurant.slug}`, { cache: "no-store" }),
      fetch(`/api/feedback?slug=${restaurant.slug}`, { cache: "no-store" }),
      fetch(`/api/ai-stats?slug=${restaurant.slug}`, { cache: "no-store" }),
    ]);
    if (ctxRes.ok) setSoldOut((await ctxRes.json()).soldOut || []);
    if (ordersRes.ok) setOrders((await ordersRes.json()).orders || []);
    if (feedbackRes.ok) setScores((await feedbackRes.json()).scores || {});
    if (aiRes.ok) setAi(await aiRes.json());
  }, [restaurant.slug]);

  useEffect(() => {
    refresh();
    const id = setInterval(refresh, 10000);
    return () => clearInterval(id);
  }, [refresh]);

  async function toggleSoldOut(dishId, next) {
    setSoldOut((s) => (next ? [...s, dishId] : s.filter((x) => x !== dishId)));
    await fetch("/api/menu", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ slug: restaurant.slug, dishId, soldOut: next }),
    }).catch(() => refresh());
  }

  const live = orders.filter((o) => o.status !== "cancelled");
  const sold = {};
  let revenue = 0;
  for (const o of live) {
    revenue += o.total;
    for (const i of o.items) sold[i.dishId] = (sold[i.dishId] || 0) + i.qty;
  }
  const ranked = restaurant.menu
    .map((d) => ({ dish: d, qty: sold[d.id] || 0, score: scores[d.id] }))
    .sort((a, b) => b.qty - a.qty);

  const s = ai?.stats;
  const pct = (x) => `${Math.round((x || 0) * 100)}%`;

  return (
    <div className="mx-auto max-w-5xl px-4 py-6">
      <header className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <div>
          <Link href="/" className="text-sm text-muted hover:underline">
            ← All restaurants
          </Link>
          <h1 className="mt-1 text-2xl font-bold">
            {restaurant.emoji} {restaurant.name}
          </h1>
          <p className="text-sm text-muted">Owner dashboard</p>
        </div>
        <Link href={`/owner/${restaurant.slug}/kitchen`} className="rounded-full bg-ink px-4 py-2 text-sm font-medium text-paper">
          Open kitchen screen →
        </Link>
      </header>

      <div className="mb-5 grid grid-cols-2 gap-3 sm:grid-cols-4">
        {[
          ["Orders", live.length],
          ["Revenue", `${revenue.toFixed(2)} ${restaurant.currency}`],
          ["Sold out", soldOut.length],
          ["AI spend (month)", ai ? `$${ai.monthSpendUsd.toFixed(2)} / $${ai.budgetUsd}` : "…"],
        ].map(([label, value]) => (
          <div key={label} className="rounded-card bg-raised p-4">
            <p className="text-xs uppercase tracking-wide text-faint">{label}</p>
            <p className="mt-1 text-xl font-bold tnum">{value}</p>
          </div>
        ))}
      </div>

      <nav className="mb-4 flex flex-wrap gap-2">
        {[
          ["menu", "Menu"],
          ["qr", "QR codes"],
          ["stats", "What sells"],
          ["ai", "AI waiter"],
        ].map(([key, label]) => (
          <button
            key={key}
            onClick={() => setTab(key)}
            className={`rounded-full px-4 py-2 text-sm font-medium transition ${tab === key ? "bg-ink text-paper" : "bg-raised text-muted"}`}
          >
            {label}
          </button>
        ))}
      </nav>

      {tab === "menu" && (
        <div className="space-y-2">
          <p className="mb-3 text-sm text-muted">
            Turning a dish off removes it from the menu <em>and</em> from the AI&apos;s recommendations immediately.
          </p>
          {restaurant.menu.map((d) => {
            const off = soldOut.includes(d.id);
            return (
              <div
                key={d.id}
                className={`flex items-center gap-3 rounded-card border p-3 transition ${off ? "border-danger/25 bg-danger-soft" : "border-line bg-raised"}`}
              >
                <span className="text-2xl">{d.emoji}</span>
                <div className="min-w-0 flex-1">
                  <p className={`font-medium ${off ? "text-faint line-through" : ""}`}>{d.name.en}</p>
                  <p className="text-xs text-muted tnum">
                    {d.category} · {d.price.toFixed(2)} {restaurant.currency} · {d.kcal} kcal · {d.protein}g protein · {d.prepMinutes} min
                    {d.allergens.length > 0 && ` · ⚠️ ${d.allergens.join(", ")}`}
                  </p>
                </div>
                <button
                  onClick={() => toggleSoldOut(d.id, !off)}
                  className={`shrink-0 rounded-full px-3 py-1.5 text-xs font-medium transition ${off ? "bg-danger text-paper" : "bg-sunken text-muted"}`}
                >
                  {off ? "Sold out" : "Available"}
                </button>
              </div>
            );
          })}
        </div>
      )}

      {tab === "qr" && <QrCodes tablePaths={tablePaths} accent={restaurant.theme.accent} />}

      {tab === "stats" && (
        <div className="overflow-x-auto rounded-card bg-raised">
          <table className="w-full text-sm">
            <thead className="border-b border-line text-left text-xs uppercase tracking-wide text-faint">
              <tr>
                <th className="p-3">Dish</th>
                <th className="p-3 text-right">Sold</th>
                <th className="p-3 text-right">Revenue</th>
                <th className="p-3 text-right">Liked</th>
              </tr>
            </thead>
            <tbody>
              {ranked.map(({ dish, qty, score }) => {
                const votes = score ? score.up + score.down : 0;
                return (
                  <tr key={dish.id} className="border-b border-line last:border-0">
                    <td className="p-3">
                      {dish.emoji} {dish.name.en}
                    </td>
                    <td className="p-3 text-right tnum">{qty}</td>
                    <td className="p-3 text-right tnum">{(qty * dish.price).toFixed(2)}</td>
                    <td className="p-3 text-right tnum">{votes ? `${Math.round((score.up / votes) * 100)}% (${votes})` : "—"}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {tab === "ai" && ai && (
        <div className="space-y-4">
          {!ai.keyConfigured && (
            <p className="rounded-xl bg-warn-soft px-3 py-2 text-sm text-warn">
              No <code>GEMINI_API_KEY</code> is set — guests are getting the offline recommender. Add the key to
              <code> .env.local</code> (or the hosting environment) to switch the AI on.
            </p>
          )}

          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            {[
              ["Conversations (30d)", s.calls],
              ["Model", ai.model.replace("gemini-", "")],
              ["Cost (30d)", `$${s.costUsd.toFixed(4)}`],
              ["Cost / conversation", s.aiCalls ? `$${(s.costUsd / s.aiCalls).toFixed(5)}` : "—"],
              ["Answered by AI", `${s.aiCalls} (${pct(1 - s.fallbackRate)})`],
              ["Fallback rate", pct(s.fallbackRate), s.fallbackRate > 0.05 && s.calls > 10 ? "text-danger" : ""],
              ["Blocked by safety", s.refusals],
              ["Avg / p95 latency", `${(s.avgLatencyMs / 1000).toFixed(1)}s / ${(s.p95LatencyMs / 1000).toFixed(1)}s`],
            ].map(([label, value, cls]) => (
              <div key={label} className="rounded-card bg-raised p-4">
                <p className="text-xs uppercase tracking-wide text-faint">{label}</p>
                <p className={`mt-1 text-lg font-bold tnum ${cls || ""}`}>{value}</p>
              </div>
            ))}
          </div>

          {/* Cost savings */}
          <div className="rounded-card bg-raised p-4">
            <h3 className="font-semibold">💰 Cost savings</h3>
            <div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-4">
              {[
                ["Repeat answers reused", `${ai.cache.respHits} (${pct(ai.cache.responseHitRate)})`],
                ["Saved by reuse", `$${ai.cache.savedUsd.toFixed(5)}`],
                ["Menu cached at Google", ai.cache.contextAvailable ? `yes (${pct(ai.cache.contextHitRate)} hit)` : "no"],
                ["Prompt tokens cached", s.aiCalls ? pct(s.cacheHitRate) : "—"],
              ].map(([label, value]) => (
                <div key={label}>
                  <p className="text-xs uppercase tracking-wide text-faint">{label}</p>
                  <p className="mt-0.5 text-base font-bold tnum">{value}</p>
                </div>
              ))}
            </div>
            {!ai.cache.contextAvailable && (
              <p className="mt-3 rounded-xl bg-amber-50 px-3 py-2 text-xs text-amber-900">
                Google&apos;s context caching needs a billing-enabled project (the free tier has no cache
                quota). Enabling billing cuts the menu part of every prompt to about a quarter of its
                price — roughly <strong>60–70% off each conversation</strong>. Nothing to change in the
                code: it switches on automatically.
              </p>
            )}
          </div>

          <div className="rounded-card bg-raised p-4">
            <h3 className="font-semibold">What guests asked for that you don&apos;t have</h3>
            <p className="mt-0.5 text-xs text-muted">Each line is a request the AI could not satisfy from your menu. This is demand you are missing.</p>
            {ai.unmet.length === 0 ? (
              <p className="mt-3 text-sm text-muted">Nothing yet.</p>
            ) : (
              <ul className="mt-3 space-y-1.5 text-sm">
                {ai.unmet.map((u, i) => (
                  <li key={i} className="flex justify-between gap-3 border-b border-line pb-1.5 last:border-0">
                    <span>“{u.message}”</span>
                    <span className="shrink-0 text-xs text-faint">{new Date(u.at).toLocaleString()}</span>
                  </li>
                ))}
              </ul>
            )}
          </div>

          <div className="overflow-x-auto rounded-card bg-raised">
            <table className="w-full text-sm">
              <thead className="border-b border-line text-left text-xs uppercase tracking-wide text-faint">
                <tr>
                  <th className="p-3">When</th>
                  <th className="p-3">Table</th>
                  <th className="p-3">Guest asked</th>
                  <th className="p-3">Source</th>
                  <th className="p-3 text-right">ms</th>
                  <th className="p-3 text-right">Cost</th>
                </tr>
              </thead>
              <tbody>
                {s.recent.map((r) => (
                  <tr key={r.id} className="border-b border-line last:border-0">
                    <td className="p-3 whitespace-nowrap text-xs text-muted">{new Date(r.at).toLocaleTimeString()}</td>
                    <td className="p-3 tnum">{r.table}</td>
                    <td className="p-3 max-w-xs truncate" title={r.reply}>{r.message}</td>
                    <td className="p-3">
                      <span
                        className={`rounded-full px-2 py-0.5 text-xs ${
                          r.source === "ai"
                            ? "bg-good-soft text-good"
                            : r.source === "cache"
                            ? "bg-accent-soft text-accent"
                            : "bg-warn-soft text-warn"
                        }`}
                      >
                        {r.source}
                      </span>
                    </td>
                    <td className="p-3 text-right tnum">{r.latencyMs}</td>
                    <td className="p-3 text-right tnum">{r.costUsd ? `$${r.costUsd.toFixed(4)}` : "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
