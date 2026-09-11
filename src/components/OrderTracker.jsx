"use client";

import { useEffect, useState } from "react";
import {
  Receipt,
  ThumbsUp,
  ThumbsDown,
  CheckCircle,
  Circle,
  ForkKnife,
} from "@phosphor-icons/react";
import { ORDER_STAGE_LIST } from "@/lib/stages";
import WaitQuiz from "./WaitQuiz";
import { Button, Badge, Note, EmptyState, cx } from "./ui";

export default function OrderTracker({
  slug,
  orders,
  me,
  myOrderIds,
  strings,
  currency,
  quiz,
  onRefresh,
  onRate,
  onBrowse,
}) {
  const [rated, setRated] = useState({});
  const [now, setNow] = useState(Date.now());
  const [cancelError, setCancelError] = useState("");

  // Only the cancel countdown needs a per-second tick; the order data itself
  // is polled once, by GuestApp.
  useEffect(() => {
    const tick = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(tick);
  }, []);

  const refresh = onRefresh;

  async function rate(dishId, score) {
    setRated((r) => ({ ...r, [dishId]: score }));
    onRate?.(dishId, score);
    await fetch("/api/feedback", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ slug, dishId, score }),
    }).catch(() => {});
  }

  async function cancel(id) {
    setCancelError("");
    const res = await fetch(`/api/orders/${id}`, { method: "DELETE" });
    if (res.ok) {
      refresh();
      return;
    }
    // Inline error, never window.alert().
    const d = await res.json().catch(() => ({}));
    setCancelError(d.error || strings.cancelFailed);
  }

  if (orders === null) {
    return (
      <div className="space-y-3" aria-busy="true" aria-label={strings.loading}>
        <div className="skeleton h-36 rounded-card" />
        <div className="skeleton h-28 rounded-card" />
      </div>
    );
  }

  const mine = orders.filter((o) => (me && o.guestId === me) || myOrderIds.includes(o.id));
  const cooking = mine.some((o) => o.status === "received" || o.status === "cooking");

  // Split the bill: group by device, fall back to name. Cancelled orders are out.
  const live = orders.filter((o) => o.status !== "cancelled");
  const byGuest = {};
  for (const o of live) {
    const key = o.guestId && o.guestId !== "anon" ? o.guestId : o.guestName;
    byGuest[key] = byGuest[key] || {
      name: o.guestName,
      total: 0,
      items: [],
      isMe: me && o.guestId === me,
    };
    byGuest[key].total += o.total;
    byGuest[key].items.push(...o.items);
  }
  const tableTotal = live.reduce((s, o) => s + o.total, 0);

  if (orders.length === 0) {
    return (
      <EmptyState
        icon={ForkKnife}
        title={strings.noOrdersYet}
        body={strings.noOrdersBody}
        action={
          <Button variant="primary" pill onClick={onBrowse}>
            {strings.backToMenu}
          </Button>
        }
      />
    );
  }

  return (
    <div className="space-y-3">
      {mine.map((o) => {
        const stageIndex = ORDER_STAGE_LIST.indexOf(o.status);
        const cancelWindow =
          o.status === "received" ? Math.max(0, 60 - Math.floor((now - o.createdAt) / 1000)) : 0;

        return (
          <article
            key={o.id}
            className={cx(
              "overflow-hidden rounded-card bg-raised shadow-card",
              o.status === "cancelled" && "opacity-60"
            )}
          >
            <header className="flex items-baseline justify-between gap-3 px-4 pt-3.5">
              <div>
                <h3 className="text-title">
                  {strings.table} {o.table}
                </h3>
                <p className="tnum mt-0.5 text-[11.5px] text-faint">#{o.id}</p>
              </div>
              <p className="tnum text-[17px] font-bold">
                {o.total.toFixed(2)}
                <span className="ml-0.5 text-[11px] font-medium text-faint">{currency}</span>
              </p>
            </header>

            {o.status === "cancelled" ? (
              <div className="px-4 pt-3">
                <Badge tone="danger">{strings.cancelled}</Badge>
              </div>
            ) : (
              /* Progress reads as a labelled track: the guest needs to know
                 which stage they are in, not just that something moved. */
              <ol className="mt-3.5 flex gap-1 px-4">
                {ORDER_STAGE_LIST.map((stage, i) => {
                  const done = i <= stageIndex;
                  const current = i === stageIndex;
                  return (
                    <li key={stage} className="flex-1">
                      <span
                        className={cx(
                          "block h-1 rounded-full transition-colors duration-500",
                          done ? "bg-good" : "bg-line"
                        )}
                      />
                      <span
                        className={cx(
                          "mt-1.5 flex items-center gap-1 text-[10.5px] leading-tight",
                          current ? "font-semibold text-good" : done ? "text-muted" : "text-faint"
                        )}
                      >
                        {current ? (
                          <Circle size={8} weight="fill" className="shrink-0 animate-caret" />
                        ) : done ? (
                          <CheckCircle size={9} weight="fill" className="shrink-0" />
                        ) : null}
                        {strings.status[stage]}
                      </span>
                    </li>
                  );
                })}
              </ol>
            )}

            <ul className="mt-3.5 divide-y divide-line border-t border-line">
              {o.items.map((i) => (
                <li key={i.dishId} className="flex items-center gap-2.5 px-4 py-2.5">
                  <span aria-hidden="true" className="text-[17px]">
                    {i.emoji}
                  </span>
                  <span className="min-w-0 flex-1 text-[13.5px]">
                    <span className="tnum font-semibold">{i.qty}&times;</span> {i.name}
                    {i.serveInMinutes > 0 && (
                      <Badge tone="accent" className="ml-1.5">
                        +{i.serveInMinutes} min
                      </Badge>
                    )}
                  </span>

                  {o.status === "served" &&
                    (rated[i.dishId] ? (
                      <span className="shrink-0 text-[11.5px] font-medium text-good">
                        {strings.thanks}
                      </span>
                    ) : (
                      <span className="flex shrink-0 gap-1">
                        <button
                          onClick={() => rate(i.dishId, 1)}
                          aria-label={`${strings.liked}: ${i.name}`}
                          className="grid h-8 w-8 place-items-center rounded-full bg-sunken text-muted transition-colors hover:text-good active:scale-90"
                        >
                          <ThumbsUp size={14} weight="bold" />
                        </button>
                        <button
                          onClick={() => rate(i.dishId, -1)}
                          aria-label={`${strings.disliked}: ${i.name}`}
                          className="grid h-8 w-8 place-items-center rounded-full bg-sunken text-muted transition-colors hover:text-danger active:scale-90"
                        >
                          <ThumbsDown size={14} weight="bold" />
                        </button>
                      </span>
                    ))}
                </li>
              ))}
            </ul>

            {o.status === "served" && (
              <p className="px-4 pb-3 pt-2 text-[12px] text-faint">{strings.howWasIt}</p>
            )}

            {cancelWindow > 0 && (
              <div className="px-4 pb-3.5 pt-3">
                <Button variant="danger" size="sm" full onClick={() => cancel(o.id)}>
                  <span className="tnum">
                    {strings.cancel} ({cancelWindow}s)
                  </span>
                </Button>
              </div>
            )}
          </article>
        );
      })}

      {cancelError && <Note tone="danger">{cancelError}</Note>}

      {cooking && <WaitQuiz questions={quiz} strings={strings} />}

      {/* Split the bill */}
      <section className="rounded-card bg-raised shadow-card">
        <header className="flex items-start gap-2.5 px-4 pt-3.5">
          <Receipt size={18} weight="duotone" className="mt-0.5 shrink-0 text-accent" />
          <div>
            <h3 className="text-title">{strings.tableBill}</h3>
            <p className="mt-0.5 text-[11.5px] leading-snug text-faint">{strings.splitNote}</p>
          </div>
        </header>

        <ul className="mt-3 divide-y divide-line border-t border-line">
          {Object.values(byGuest).map((g, idx) => (
            <li key={idx} className="flex items-baseline justify-between gap-3 px-4 py-2.5">
              <div className="min-w-0">
                <p className="text-[13.5px] font-medium">
                  {g.name}
                  {g.isMe && <span className="ml-1.5 text-[11px] text-accent">({strings.you})</span>}
                </p>
                <p className="mt-0.5 truncate text-[11.5px] text-faint">
                  {g.items.map((i) => `${i.qty}x ${i.name}`).join(", ")}
                </p>
              </div>
              <span className="tnum shrink-0 text-sm font-semibold">{g.total.toFixed(2)}</span>
            </li>
          ))}
        </ul>

        <div className="flex items-baseline justify-between gap-3 border-t border-line px-4 py-3">
          <span className="text-[13px] font-medium">{strings.total}</span>
          <span className="tnum text-[19px] font-bold">
            {tableTotal.toFixed(2)}
            <span className="ml-0.5 text-[11px] font-medium text-faint">{currency}</span>
          </span>
        </div>
      </section>

      <Button variant="outline" size="lg" pill full onClick={onBrowse}>
        {strings.newOrder}
      </Button>
    </div>
  );
}
