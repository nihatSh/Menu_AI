"use client";

import { useState } from "react";
import { Minus, Plus, Trash, Drop, Warning, FirstAid, Clock } from "@phosphor-icons/react";
import { cartTotals, HUNGER_KCAL, waterTarget } from "@/lib/menu";
import { Button, Note, Sheet, EmptyState, cx } from "./ui";

const LATER_OPTIONS = [0, 15, 30];

export default function BasketSheet({
  open,
  cart,
  setCart,
  currency,
  strings,
  profile,
  hunger,
  justTrained,
  extraMinutes,
  onClose,
  onBrowse,
  onSend,
  sending,
  error,
}) {
  const [name, setName] = useState(profile.name || "");
  const [note, setNote] = useState("");

  const totals = cartTotals(cart);

  // Is this clearly more food than their hunger level suggests?
  const target = HUNGER_KCAL[hunger] || 650;
  const tooMuch = totals.kcal > target * 1.45 && totals.count > 1;

  const water = profile.weightKg ? waterTarget(Number(profile.weightKg), justTrained) : null;

  const kcalLeft = Number(profile.kcalTarget)
    ? Math.max(0, profile.kcalTarget - (profile.kcalEaten || 0))
    : null;
  const overBudget = kcalLeft !== null && totals.kcal > kcalLeft;

  const setQty = (dishId, qty) =>
    setCart((c) =>
      qty <= 0 ? c.filter((i) => i.dishId !== dishId) : c.map((i) => (i.dishId === dishId ? { ...i, qty } : i))
    );

  const setServeIn = (dishId, minutes) =>
    setCart((c) => c.map((i) => (i.dishId === dishId ? { ...i, serveInMinutes: minutes } : i)));

  return (
    <Sheet
      open={open}
      onClose={onClose}
      title={strings.yourOrder}
      footer={
        cart.length > 0 && (
          <>
            <div className="mb-3 flex items-baseline justify-between gap-3">
              <span className="tnum text-[12.5px] text-muted">
                {totals.count} {strings.items} &middot; {totals.kcal} kcal &middot; {totals.protein}g
              </span>
              <span className="tnum text-[22px] font-bold leading-none">
                {totals.price.toFixed(2)}
                <span className="ml-1 text-[12px] font-medium text-faint">{currency}</span>
              </span>
            </div>
            {error && (
              <Note tone="danger" icon={Warning} className="mb-2.5">
                {error}
              </Note>
            )}
            <Button
              variant="primary"
              size="lg"
              pill
              full
              disabled={sending}
              onClick={() => onSend({ name: name.trim() || "Guest", note })}
            >
              {sending ? strings.sending : strings.sendOrder}
            </Button>
          </>
        )
      }
    >
      {cart.length === 0 ? (
        <EmptyState
          icon={Clock}
          title={strings.emptyBasket}
          body={strings.emptyBasketBody}
          action={
            <Button variant="primary" pill onClick={onBrowse}>
              {strings.backToMenu}
            </Button>
          }
        />
      ) : (
        <div className="space-y-3 pb-4">
          {/* Lines are separated by hairlines, not stacked cards - a basket is
              a list, and boxing each row adds noise without hierarchy. */}
          <ul className="divide-y divide-line">
            {cart.map((i) => (
              <li key={i.dishId} className="py-3 first:pt-1">
                <div className="flex items-start gap-3">
                  <span
                    aria-hidden="true"
                    className="grid h-11 w-11 shrink-0 place-items-center rounded-control bg-sunken text-[20px]"
                  >
                    {i.emoji}
                  </span>

                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-semibold">{i.name}</p>
                    <p className="tnum mt-0.5 text-[12px] text-faint">
                      {i.kcal} kcal &middot; {i.protein}g &middot; {i.prepMinutes + extraMinutes} {strings.min}
                    </p>
                  </div>

                  <div className="flex shrink-0 items-center gap-1">
                    <button
                      onClick={() => setQty(i.dishId, i.qty - 1)}
                      aria-label={i.qty === 1 ? `Remove ${i.name}` : `One fewer ${i.name}`}
                      className="grid h-8 w-8 place-items-center rounded-full bg-sunken text-muted transition-colors hover:text-ink active:scale-90"
                    >
                      {i.qty === 1 ? <Trash size={14} weight="bold" /> : <Minus size={14} weight="bold" />}
                    </button>
                    <span className="tnum w-5 text-center text-sm font-semibold">{i.qty}</span>
                    <button
                      onClick={() => setQty(i.dishId, i.qty + 1)}
                      aria-label={`One more ${i.name}`}
                      className="grid h-8 w-8 place-items-center rounded-full bg-sunken text-muted transition-colors hover:text-ink active:scale-90"
                    >
                      <Plus size={14} weight="bold" />
                    </button>
                  </div>

                  <span className="tnum w-14 shrink-0 pt-1.5 text-right text-sm font-semibold">
                    {(i.price * i.qty).toFixed(2)}
                  </span>
                </div>

                {/* Serve-later timing, per line. */}
                <div className="mt-2 flex items-center gap-1.5 pl-14">
                  <span className="mr-0.5 text-[11px] text-faint">{strings.serveLater}</span>
                  {LATER_OPTIONS.map((m) => {
                    const on = (i.serveInMinutes || 0) === m;
                    return (
                      <button
                        key={m}
                        onClick={() => setServeIn(i.dishId, m)}
                        aria-pressed={on}
                        className={cx(
                          "tnum rounded-full px-2.5 py-1 text-[11px] font-medium transition-colors duration-200",
                          on ? "bg-ink text-paper" : "bg-sunken text-muted hover:text-ink"
                        )}
                      >
                        {m === 0 ? strings.now : `+${m}`}
                      </button>
                    );
                  })}
                </div>
              </li>
            ))}
          </ul>

          <div className="space-y-2">
            {tooMuch && (
              <Note tone="warn" icon={Warning}>
                {strings.tooMuch.replace("{kcal}", totals.kcal)}
              </Note>
            )}
            {overBudget && (
              <Note tone="danger" icon={Warning}>
                {strings.overBudget
                  .replace("{over}", totals.kcal - kcalLeft)
                  .replace("{left}", kcalLeft)}
              </Note>
            )}
            {water && (
              <Note tone="accent" icon={Drop}>
                {strings.waterNote.replace("{litres}", water.total)}
                {justTrained ? ` ${strings.waterTrained}` : ""}
              </Note>
            )}
            {profile.allergens.length > 0 && (
              <Note tone="danger" icon={FirstAid}>
                {strings.allergyOnTicket}: <strong>{profile.allergens.join(", ")}</strong>
              </Note>
            )}
          </div>

          <div className="space-y-3 pt-1">
            <label className="block">
              <span className="text-[13px] font-medium">{strings.yourName}</span>
              <input
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Guest"
                className="mt-1.5 w-full rounded-control border border-line bg-raised px-3 py-2.5 text-sm text-ink outline-none transition-colors placeholder:text-faint focus:border-accent"
              />
              <span className="mt-1 block text-[11.5px] leading-snug text-faint">
                {strings.nameHelp}
              </span>
            </label>

            <label className="block">
              <span className="text-[13px] font-medium">{strings.note}</span>
              <input
                value={note}
                onChange={(e) => setNote(e.target.value)}
                maxLength={200}
                placeholder={strings.notePlaceholder}
                className="mt-1.5 w-full rounded-control border border-line bg-raised px-3 py-2.5 text-sm text-ink outline-none transition-colors placeholder:text-faint focus:border-accent"
              />
            </label>
          </div>
        </div>
      )}
    </Sheet>
  );
}
