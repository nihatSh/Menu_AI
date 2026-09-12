"use client";

import { useEffect, useRef, useState } from "react";
import {
  ArrowLeft,
  Heart,
  Star,
  Clock,
  Minus,
  Plus,
  Warning,
  Leaf,
  Sparkle,
  ShoppingCartSimple,
} from "@phosphor-icons/react";
import { localized } from "@/lib/menu";
import { dishRating } from "@/lib/rating";
import DishImage from "./DishImage";
import { cx } from "./ui";

/**
 * Full dish detail, following the reference: a full-bleed image filling the
 * top of the screen with floating back and favourite controls, then a rounded
 * white panel that overlaps it carrying the name, rating, nutrition, and the
 * add button pinned to the bottom.
 *
 * This is a full-screen layer rather than the shared bottom Sheet, because the
 * reference's image needs to run to all three edges and a sheet cannot do that.
 */
export default function DishSheet({
  dish,
  open,
  lang,
  currency,
  qty = 0,
  extraMinutes = 0,
  score,
  strings,
  isFavourite = false,
  onClose,
  onAdd,
  onSetQty,
  onToggleFavourite,
  onAskAbout,
}) {
  const [expanded, setExpanded] = useState(false);
  const panelRef = useRef(null);

  useEffect(() => {
    if (!open) return;
    setExpanded(false);
    const onKey = (e) => e.key === "Escape" && onClose();
    document.addEventListener("keydown", onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    panelRef.current?.focus();
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = prev;
    };
  }, [open, onClose]);

  if (!open || !dish) return null;

  const name = localized(dish.name, lang);
  const desc = localized(dish.desc, lang);
  const wait = dish.prepMinutes + extraMinutes;
  const rating = dishRating(score);

  // The reference's dark segmented nutrition strip. Our data carries exactly
  // these numbers already, which is why it maps so cleanly.
  const nutrition = [
    { value: dish.kcal, label: strings.calories, unit: "kcal" },
    { value: dish.protein, label: strings.protein, unit: "g" },
    { value: dish.carbs, label: strings.carbs, unit: "g" },
    { value: dish.fat, label: strings.fat, unit: "g" },
  ];

  const longDesc = desc.length > 110;

  return (
    <div
      ref={panelRef}
      role="dialog"
      aria-modal="true"
      aria-label={name}
      tabIndex={-1}
      className="fixed inset-0 z-sheet mx-auto flex max-w-lg flex-col bg-paper outline-none animate-fade-in"
    >
      {/* Hero image, running to all three top edges. */}
      <div className="relative h-[44dvh] min-h-[280px] shrink-0">
        <DishImage dish={dish} alt={name} rounded="rounded-none" glyphClass="text-[120px]" />

        <div className="absolute inset-x-0 top-0 flex items-center justify-between p-4">
          <button
            onClick={onClose}
            aria-label={strings.close}
            className="grid h-10 w-10 place-items-center rounded-full bg-paper/85 text-ink shadow-card backdrop-blur-sm transition-transform active:scale-90"
          >
            <ArrowLeft size={18} weight="bold" />
          </button>
          <button
            onClick={() => onToggleFavourite?.(dish.id)}
            aria-pressed={isFavourite}
            aria-label={
              isFavourite
                ? strings.unfavourite.replace("{dish}", name)
                : strings.favourite.replace("{dish}", name)
            }
            className="grid h-10 w-10 place-items-center rounded-full bg-paper/85 shadow-card backdrop-blur-sm transition-transform active:scale-90"
          >
            <Heart
              size={18}
              weight={isFavourite ? "fill" : "regular"}
              className={isFavourite ? "text-danger" : "text-ink"}
            />
          </button>
        </div>
      </div>

      {/* Panel overlapping the image, as in the reference. */}
      <div className="relative -mt-6 flex min-h-0 flex-1 flex-col rounded-t-sheet bg-paper">
        <div className="min-h-0 flex-1 overflow-y-auto px-5 pt-5">
          <div className="flex items-start justify-between gap-3">
            <h2 className="min-w-0 text-[22px] font-bold leading-tight tracking-[-0.01em]">{name}</h2>
            <p className="tnum shrink-0 text-[20px] font-bold leading-tight text-accent">
              {dish.price.toFixed(2)}
              <span className="ml-1 text-[11px] font-semibold uppercase">{currency}</span>
            </p>
          </div>

          <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1.5 text-[12.5px] text-muted">
            {rating ? (
              <span className="tnum inline-flex items-center gap-1">
                <Star size={13} weight="fill" className="text-amber-500" />
                <strong className="font-semibold text-ink">{rating.stars.toFixed(1)}</strong>
                <span className="text-faint">
                  ({rating.votes} {strings.reviews})
                </span>
              </span>
            ) : (
              <span className="text-faint">{strings.noRatingsYet}</span>
            )}
            <span className={cx("tnum inline-flex items-center gap-1", extraMinutes > 0 && "text-warn")}>
              <Clock size={13} weight="bold" />
              {wait} {strings.min}
            </span>
          </div>

          <h3 className="mt-5 text-[14px] font-semibold">{strings.nutritionFacts}</h3>
          <dl className="mt-2 flex overflow-hidden rounded-control bg-ink">
            {nutrition.map((n, i) => (
              <div
                key={n.label}
                className={cx(
                  "flex-1 px-2 py-2.5 text-center",
                  i > 0 && "border-l border-paper/15"
                )}
              >
                <dd className="tnum text-[15px] font-bold leading-none text-paper">
                  {n.value}
                  <span className="ml-0.5 text-[9.5px] font-medium opacity-60">{n.unit}</span>
                </dd>
                <dt className="mt-1 text-[10px] leading-tight text-paper/60">{n.label}</dt>
              </div>
            ))}
          </dl>

          <h3 className="mt-5 text-[14px] font-semibold">{strings.description}</h3>
          <p
            className={cx(
              "mt-1.5 text-[13.5px] leading-relaxed text-muted",
              !expanded && longDesc && "line-clamp-3"
            )}
          >
            {desc}
          </p>
          {longDesc && (
            <button
              onClick={() => setExpanded((v) => !v)}
              className="mt-1 text-[12.5px] font-semibold text-accent"
            >
              {expanded ? strings.readLess : strings.readMore}
            </button>
          )}

          {dish.diet?.length > 0 && (
            <div className="mt-3 flex flex-wrap gap-1.5">
              {dish.diet.map((d) => (
                <span
                  key={d}
                  className="inline-flex items-center gap-1 rounded-full bg-good-soft px-2.5 py-1 text-[12px] font-medium text-good"
                >
                  <Leaf size={11} weight="fill" />
                  {d}
                </span>
              ))}
            </div>
          )}

          {dish.allergens?.length > 0 && (
            <p className="mt-3 flex items-start gap-2 rounded-control bg-warn-soft px-3 py-2 text-[12.5px] leading-snug text-warn">
              <Warning size={14} weight="fill" className="mt-px shrink-0" />
              <span>
                {strings.containsAllergens}: <strong>{dish.allergens.join(", ")}</strong>.{" "}
                {strings.confirmWithStaff}
              </span>
            </p>
          )}

          <button
            onClick={() => onAskAbout(dish)}
            className="mt-4 mb-4 flex w-full items-center gap-2.5 rounded-control bg-accent-soft px-3.5 py-3 text-left transition-transform duration-200 active:scale-[0.99]"
          >
            <Sparkle size={17} weight="fill" className="shrink-0 text-accent" />
            <span className="flex-1 text-[13px] font-medium text-accent">
              {strings.askAboutThis.replace("{dish}", name)}
            </span>
          </button>
        </div>

        {/* Pinned action, as in the reference. */}
        <div className="shrink-0 border-t border-line px-5 pb-safe pt-3">
          {qty > 0 ? (
            <div className="flex items-center gap-3">
              <div className="flex flex-1 items-center justify-between rounded-full bg-sunken px-2 py-1.5">
                <button
                  onClick={() => onSetQty(dish.id, qty - 1)}
                  aria-label={qty === 1 ? strings.removeFromOrder : strings.oneFewer}
                  className="grid h-9 w-9 place-items-center rounded-full bg-raised text-ink shadow-card transition-transform active:scale-90"
                >
                  <Minus size={16} weight="bold" />
                </button>
                <span className="tnum text-[15px] font-semibold">
                  {qty} {strings.inOrder}
                </span>
                <button
                  onClick={() => onSetQty(dish.id, qty + 1)}
                  aria-label={strings.oneMore}
                  className="grid h-9 w-9 place-items-center rounded-full bg-raised text-ink shadow-card transition-transform active:scale-90"
                >
                  <Plus size={16} weight="bold" />
                </button>
              </div>
              <button
                onClick={onClose}
                className="rounded-full bg-ink px-5 py-3.5 text-[14px] font-semibold text-paper transition-transform active:scale-95"
              >
                {strings.done}
              </button>
            </div>
          ) : (
            <button
              onClick={() => {
                onAdd(dish);
                onClose();
              }}
              className="flex w-full items-center justify-center gap-2 rounded-full bg-accent py-4 text-[15px] font-semibold text-accent-ink transition-transform duration-200 active:scale-[0.98]"
            >
              {strings.addToOrder}
              <ShoppingCartSimple size={17} weight="fill" />
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
