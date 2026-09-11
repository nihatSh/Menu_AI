// The meal has an arc; the app should follow it.
//
// Three parallel tabs let a guest wander but never tell them where they are or
// what comes next. This derives the current phase from real state and returns
// the single action that matters right now, which the bottom bar renders. The
// result is that every screen has one obvious way forward.
//
//   arriving  -> nothing ordered, nothing chosen: help me decide
//   choosing  -> basket has items: help me finish
//   waiting   -> order sent, kitchen working: tell me what is happening
//   eating    -> food served: how was it, and do you want more
//
// Kept out of the components so the sequence is one readable function rather
// than conditions scattered across three screens.

export const PHASES = ["arriving", "choosing", "waiting", "eating"];

export function currentPhase({ cartCount = 0, myOrders = [] }) {
  const live = myOrders.filter((o) => o.status !== "cancelled");
  const unserved = live.filter((o) => o.status !== "served");

  if (unserved.length > 0) return cartCount > 0 ? "choosing" : "waiting";
  if (live.length > 0) return cartCount > 0 ? "choosing" : "eating";
  return cartCount > 0 ? "choosing" : "arriving";
}

/**
 * The one action the bottom bar should offer, given the phase.
 * `tone` picks the visual weight; `to` is the tab it moves the guest to.
 * Returns null when no action should be pushed (the guest is still exploring).
 */
export function primaryAction({ phase, cartCount, cartTotal, currency, myOrders, strings }) {
  switch (phase) {
    case "choosing":
      return {
        id: "review",
        label: strings.reviewOrder,
        detail: `${cartCount} ${cartCount === 1 ? strings.item : strings.items}`,
        amount: `${cartTotal.toFixed(2)} ${currency}`,
        tone: "accent",
        opens: "basket",
      };

    case "waiting": {
      const soonest = myOrders
        .filter((o) => o.status !== "served" && o.status !== "cancelled")
        .sort((a, b) => a.createdAt - b.createdAt)[0];
      const ready = soonest?.status === "ready";
      return {
        id: "track",
        label: ready ? strings.orderReady : strings.trackOrder,
        detail: soonest ? strings.status[soonest.status] : "",
        tone: ready ? "good" : "quiet",
        to: "orders",
      };
    }

    case "eating":
      return {
        id: "more",
        label: strings.orderMore,
        detail: strings.tapToBrowse,
        tone: "quiet",
        to: "menu",
      };

    default:
      return null; // arriving: let them look around, do not push
  }
}

/**
 * Rough minutes until the whole basket could be on the table, used to set
 * expectations at the moment of ordering. The kitchen works in parallel, so
 * the slowest dish sets the pace, not the sum.
 */
export function estimateWait(items, extraMinutes = 0) {
  if (!items.length) return 0;
  const slowest = Math.max(...items.map((i) => i.prepMinutes || 0));
  return slowest + extraMinutes;
}
