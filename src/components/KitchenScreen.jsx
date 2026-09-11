"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { ArrowLeft, FirstAid, Clock, ForkKnife, CaretRight } from "@phosphor-icons/react";
import { ORDER_STAGE_LIST } from "@/lib/stages";
import { cx } from "./ui";

const NEXT_LABEL = {
  received: "Start cooking",
  cooking: "Mark ready",
  ready: "Mark served",
};

const STATUS_TONE = {
  received: "bg-amber-400/15 text-amber-300",
  cooking: "bg-sky-400/15 text-sky-300",
  ready: "bg-emerald-400/15 text-emerald-300",
  served: "bg-white/10 text-zinc-400",
  cancelled: "bg-rose-400/15 text-rose-300",
};

function minutesAgo(ts) {
  return Math.floor((Date.now() - ts) / 60000);
}

/**
 * The kitchen screen is deliberately dark ALL THE TIME - it is a tablet on a
 * wall in a working kitchen, not a page that should follow a guest's phone
 * theme. So it uses fixed zinc values rather than the themed tokens; an
 * earlier version used `bg-ink`, which inverts in dark mode and rendered white
 * text on a white page.
 */
export default function KitchenScreen({ restaurant }) {
  const [orders, setOrders] = useState(null);
  const [showServed, setShowServed] = useState(false);
  const [now, setNow] = useState(Date.now());

  const refresh = useCallback(async () => {
    try {
      const res = await fetch(`/api/orders?slug=${restaurant.slug}`, { cache: "no-store" });
      const data = await res.json();
      setOrders(data.orders || []);
    } catch {
      setOrders((o) => o ?? []);
    }
  }, [restaurant.slug]);

  useEffect(() => {
    refresh();
    const poll = setInterval(refresh, 4000);
    const tick = setInterval(() => setNow(Date.now()), 10000);
    return () => {
      clearInterval(poll);
      clearInterval(tick);
    };
  }, [refresh]);

  async function advance(order) {
    const next = ORDER_STAGE_LIST[ORDER_STAGE_LIST.indexOf(order.status) + 1];
    if (!next) return;
    setOrders((os) => os.map((o) => (o.id === order.id ? { ...o, status: next } : o)));
    await fetch(`/api/orders/${order.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: next }),
    }).catch(() => refresh());
  }

  const visible = (orders || []).filter((o) =>
    showServed ? true : o.status !== "served" && o.status !== "cancelled"
  );

  return (
    <div className="min-h-[100dvh] bg-zinc-950 px-4 py-5 text-zinc-100">
      <header className="mb-5 flex flex-wrap items-center justify-between gap-3">
        <div>
          <Link
            href={`/owner/${restaurant.slug}`}
            className="inline-flex items-center gap-1.5 text-[13px] text-zinc-400 transition-colors hover:text-zinc-200"
          >
            <ArrowLeft size={14} weight="bold" />
            Dashboard
          </Link>
          <h1 className="mt-1 text-[22px] font-bold tracking-[-0.02em]">
            Kitchen &middot; {restaurant.name}
          </h1>
        </div>

        <label className="flex cursor-pointer items-center gap-2 text-[13px] text-zinc-400">
          <input
            type="checkbox"
            checked={showServed}
            onChange={(e) => setShowServed(e.target.checked)}
            className="h-4 w-4 accent-emerald-500"
          />
          Show served
        </label>
      </header>

      {orders === null ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {[0, 1, 2].map((i) => (
            <div key={i} className="h-48 animate-pulse rounded-card bg-zinc-900" />
          ))}
        </div>
      ) : visible.length === 0 ? (
        <div className="flex flex-col items-center py-24 text-center">
          <ForkKnife size={28} weight="duotone" className="mb-3 text-zinc-600" />
          <p className="text-[15px] font-medium text-zinc-400">No orders on the pass</p>
          <p className="mt-1 text-[13px] text-zinc-600">New orders appear here within a few seconds.</p>
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {visible.map((o) => {
            const mins = minutesAgo(o.createdAt);
            const prepTarget = Math.max(...o.items.map((i) => i.prepMinutes || 0), 0);
            // Turns red once the order has been waiting longer than its
            // slowest dish should take - the signal the pass actually needs.
            const late = o.status !== "served" && o.status !== "cancelled" && mins > prepTarget;

            return (
              <article
                key={o.id}
                className={cx(
                  "flex flex-col rounded-card bg-zinc-900 p-4",
                  o.status === "served" && "opacity-50"
                )}
              >
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-[26px] font-black leading-none tracking-[-0.02em]">
                      Table {o.table}
                    </p>
                    <p className="tnum mt-1.5 flex items-center gap-1.5 text-[12px] text-zinc-500">
                      #{o.id} &middot; {o.guestName}
                      <span className={cx("inline-flex items-center gap-1", late && "font-semibold text-rose-400")}>
                        <Clock size={11} weight="bold" />
                        {mins}m
                      </span>
                    </p>
                  </div>
                  <span
                    className={cx(
                      "shrink-0 rounded-chip px-2 py-1 text-[11px] font-semibold uppercase tracking-wide",
                      STATUS_TONE[o.status]
                    )}
                  >
                    {o.status}
                  </span>
                </div>

                {/* The whole point of feature 12: this must be impossible to miss. */}
                {o.allergens?.length > 0 && (
                  <p className="mt-3 flex items-center gap-2 rounded-control border-2 border-rose-500 bg-rose-500/10 px-3 py-2 text-[13px] font-bold uppercase tracking-wide text-rose-300">
                    <FirstAid size={16} weight="fill" className="shrink-0" />
                    Allergy: {o.allergens.join(", ")}
                  </p>
                )}

                <ul className="mt-3 flex-1 space-y-1.5">
                  {o.items.map((i) => (
                    <li key={i.dishId} className="flex items-start gap-2 text-[14px]">
                      <span className="tnum font-bold text-zinc-100">{i.qty}&times;</span>
                      <span className="flex-1 text-zinc-300">
                        {i.name}
                        {i.serveInMinutes > 0 && (
                          <span className="ml-1.5 rounded-chip bg-violet-400/15 px-1.5 py-0.5 text-[11px] font-semibold text-violet-300">
                            serve +{i.serveInMinutes}m
                          </span>
                        )}
                      </span>
                      <span className="tnum text-[11px] text-zinc-600">{i.prepMinutes}m</span>
                    </li>
                  ))}
                </ul>

                {o.note && (
                  <p className="mt-2.5 rounded-control bg-zinc-800 px-3 py-2 text-[13px] italic text-zinc-300">
                    &ldquo;{o.note}&rdquo;
                  </p>
                )}

                <div className="mt-3.5 flex items-center justify-between gap-3 border-t border-zinc-800 pt-3">
                  <span className="tnum text-[14px] font-semibold">
                    {o.total.toFixed(2)}
                    <span className="ml-0.5 text-[11px] font-medium text-zinc-500">
                      {restaurant.currency}
                    </span>
                  </span>
                  {NEXT_LABEL[o.status] && (
                    <button
                      onClick={() => advance(o)}
                      className="inline-flex items-center gap-1.5 rounded-full bg-zinc-100 px-4 py-2.5 text-[13px] font-semibold text-zinc-900 transition-transform duration-200 ease-out active:scale-95"
                    >
                      {NEXT_LABEL[o.status]}
                      <CaretRight size={13} weight="bold" />
                    </button>
                  )}
                </div>
              </article>
            );
          })}
        </div>
      )}
    </div>
  );
}
