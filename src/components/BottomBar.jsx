"use client";

import { useEffect, useRef } from "react";
import { Sparkle, BookOpen, Receipt, CaretRight, Basket } from "@phosphor-icons/react";
import { cx } from "./ui";

const TABS = [
  { key: "ai", icon: Sparkle },
  { key: "menu", icon: BookOpen },
  { key: "orders", icon: Receipt },
];

const ACTION_TONE = {
  accent: "bg-accent text-accent-ink",
  good: "bg-good text-white",
  quiet: "bg-ink text-paper",
};

/**
 * Navigation and the one action that matters, in the same place at the bottom.
 *
 * Before, tabs sat at the top of the screen and the basket floated at the
 * bottom: the two things a guest reaches for most were at opposite ends of the
 * phone, and neither was under the thumb. They are now one component in the
 * reachable zone.
 *
 * The action slot is driven by `lib/journey.js` and changes with the phase of
 * the meal - review the order, track it, order more - so there is always a
 * single obvious way forward, and the three tabs stop feeling like parallel
 * silos.
 */
export default function BottomBar({ tab, onTab, action, onAction, orderCount, strings, onHeight }) {
  const ref = useRef(null);

  // The bar reports its real height so scroll areas and the chat composer can
  // clear it exactly. Hardcoded rem guesses were wrong by 6px (the nav renders
  // at 66px, not 60) and would drift again with a font or safe-area change.
  useEffect(() => {
    if (!ref.current || typeof ResizeObserver === "undefined") return;
    const el = ref.current;
    const report = () => onHeight?.(el.getBoundingClientRect().height);
    report();
    const ro = new ResizeObserver(report);
    ro.observe(el);
    return () => ro.disconnect();
  }, [onHeight, action]);

  return (
    <div ref={ref} className="fixed inset-x-0 bottom-0 z-nav mx-auto max-w-lg">
      {action && (
        <div className="px-4 pb-2">
          <button
            onClick={() => onAction(action)}
            className={cx(
              "flex w-full items-center gap-3 rounded-full px-4 py-3 shadow-lift",
              "transition-transform duration-200 ease-out active:scale-[0.98]",
              ACTION_TONE[action.tone] || ACTION_TONE.quiet
            )}
          >
            {action.id === "review" && (
              <span className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-white/15">
                <Basket size={17} weight="fill" />
              </span>
            )}
            <span className="min-w-0 flex-1 text-left">
              <span className="block text-[14px] font-semibold leading-tight">{action.label}</span>
              {action.detail && (
                <span className="tnum block text-[11.5px] leading-tight opacity-75">
                  {action.detail}
                </span>
              )}
            </span>
            {action.amount ? (
              <span className="tnum shrink-0 text-[15px] font-bold">{action.amount}</span>
            ) : (
              <CaretRight size={16} weight="bold" className="shrink-0 opacity-70" />
            )}
          </button>
        </div>
      )}

      <nav
        aria-label={strings.sections}
        className="border-t border-line bg-paper/95 pb-safe backdrop-blur-md"
      >
        <div className="flex">
          {TABS.map(({ key, icon: Icon }) => {
            const on = tab === key;
            return (
              <button
                key={key}
                onClick={() => onTab(key)}
                aria-current={on ? "page" : undefined}
                className={cx(
                  "relative flex flex-1 flex-col items-center gap-0.5 pb-1.5 pt-2.5",
                  "transition-colors duration-200",
                  on ? "text-accent" : "text-faint"
                )}
              >
                <span className="relative">
                  <Icon size={21} weight={on ? "fill" : "regular"} />
                  {key === "orders" && orderCount > 0 && (
                    <span className="tnum absolute -right-2 -top-1 grid h-4 min-w-4 place-items-center rounded-full bg-accent px-1 text-[10px] font-bold text-accent-ink">
                      {orderCount}
                    </span>
                  )}
                </span>
                <span className="text-[11px] font-medium leading-tight">{strings.tabs[key]}</span>
              </button>
            );
          })}
        </div>
      </nav>
    </div>
  );
}
