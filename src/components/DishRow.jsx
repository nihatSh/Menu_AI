"use client";

import { useState } from "react";
import { Heart, Plus, Minus, Clock, Fire, Star, Warning } from "@phosphor-icons/react";
import { localized } from "@/lib/menu";
import { dishRating } from "@/lib/rating";
import DishImage from "./DishImage";
import { cx } from "./ui";

/**
 * One dish as an editorial row, following the second reference: no card, rows
 * divided by a dashed rule, the name and the price stacked and both loud, the
 * description in a quieter tone with an inline "show more", and a favourite
 * control carrying how many people saved it.
 *
 * The photo sits on the LEFT here (the reference has it right), which is what
 * was asked for and also puts the picture first in reading order.
 */
export default function DishRow({
  dish,
  lang,
  currency,
  strings,
  onAdd,
  onOpen,
  onSetQty,
  onToggleFavourite,
  isFavourite = false,
  favouriteCount = 0,
  inCart = 0,
  extraMinutes = 0,
  reason,
  score,
  index = 0,
  animate = false,
}) {
  const [expanded, setExpanded] = useState(false);

  const name = localized(dish.name, lang);
  const desc = localized(dish.desc, lang);
  const wait = dish.prepMinutes + extraMinutes;
  const rating = dishRating(score);
  const longDesc = desc.length > 78;

  return (
    <article
      className={cx("flex gap-3.5 py-4", animate && "animate-rise-in")}
      style={animate ? { animationDelay: `${Math.min(index, 8) * 40}ms` } : undefined}
    >
      <button
        onClick={() => onOpen(dish)}
        aria-label={strings.viewDish.replace("{dish}", name)}
        className="h-[104px] w-[104px] shrink-0 overflow-hidden rounded-card"
      >
        <DishImage dish={dish} alt={name} rounded="rounded-card" glyphClass="text-[40px]" />
      </button>

      <div className="flex min-w-0 flex-1 flex-col">
        <button
          onClick={() => onOpen(dish)}
          aria-label={strings.viewDish.replace("{dish}", name)}
          className="min-w-0 text-left"
        >
          <h3 className="text-[15.5px] font-bold leading-tight tracking-[-0.01em]">{name}</h3>
          <p className="tnum mt-1 text-[14px] font-bold leading-none text-accent">
            {dish.price.toFixed(2)} {currency}
          </p>
        </button>

        <p
          className={cx(
            "mt-1.5 text-[12.5px] leading-snug text-muted",
            !expanded && longDesc && "line-clamp-2"
          )}
        >
          {desc}
          {/* Inline show-more, as in the reference, rather than a separate row. */}
          {longDesc && !expanded && (
            <button
              onClick={() => setExpanded(true)}
              className="ml-1 font-semibold text-ink underline decoration-line underline-offset-2"
            >
              {strings.showMore}
            </button>
          )}
        </p>
        {longDesc && expanded && (
          <button
            onClick={() => setExpanded(false)}
            className="mt-0.5 self-start text-[12px] font-semibold text-faint"
          >
            {strings.showLess}
          </button>
        )}

        {reason && (
          <p className="mt-2 rounded-control bg-accent-soft px-2 py-1 text-[11.5px] font-medium leading-snug text-accent">
            {reason}
          </p>
        )}

        {/* Facts and flags on one quiet line. */}
        <div className="tnum mt-2 flex flex-wrap items-center gap-x-2 gap-y-1 text-[11px] text-faint">
          {dish.isNew && (
            <span className="inline-flex items-center gap-1 font-semibold uppercase tracking-wide text-danger">
              <Star size={10} weight="fill" />
              {strings.newDish}
            </span>
          )}
          <span className={cx("inline-flex items-center gap-0.5", extraMinutes > 0 && "text-warn")}>
            <Clock size={10} weight="bold" />
            {wait}m
          </span>
          <span>{dish.kcal} kcal</span>
          <span>{dish.protein}g protein</span>
          {dish.spice > 0 && (
            <span className="inline-flex items-center text-warn">
              {Array.from({ length: dish.spice }, (_, i) => (
                <Fire key={i} size={10} weight="fill" />
              ))}
            </span>
          )}
          {rating && (
            <span className="inline-flex items-center gap-0.5">
              <Star size={10} weight="fill" className="text-amber-500" />
              {rating.stars.toFixed(1)}
            </span>
          )}
          {dish.allergens?.length > 0 && (
            <span className="inline-flex items-center gap-0.5">
              <Warning size={10} weight="fill" />
              {dish.allergens.join(", ")}
            </span>
          )}
        </div>

        {/* Favourite-with-count on the left, order control on the right - the
            reference's boxed heart, paired with the add action. */}
        <div className="mt-2.5 flex items-center gap-2">
          <button
            onClick={() => onToggleFavourite(dish.id)}
            aria-pressed={isFavourite}
            aria-label={
              isFavourite
                ? strings.unfavourite.replace("{dish}", name)
                : strings.favourite.replace("{dish}", name)
            }
            className="inline-flex items-center overflow-hidden rounded-control border border-line transition-transform active:scale-95"
          >
            <span className="grid h-8 w-9 place-items-center">
              <Heart
                size={15}
                weight={isFavourite ? "fill" : "regular"}
                className={isFavourite ? "text-danger" : "text-muted"}
              />
            </span>
            <span className="tnum grid h-8 min-w-7 place-items-center border-l border-line bg-sunken px-1.5 text-[12px] font-semibold text-muted">
              {favouriteCount}
            </span>
          </button>

          <div className="flex-1" />

          {inCart > 0 ? (
            <div className="flex shrink-0 items-center gap-1 rounded-full bg-accent p-1">
              <button
                onClick={() => onSetQty(dish.id, inCart - 1)}
                aria-label={inCart === 1 ? strings.removeFromOrder : strings.oneFewer}
                className="grid h-7 w-7 place-items-center rounded-full bg-accent-ink/20 text-accent-ink transition-transform active:scale-90"
              >
                <Minus size={13} weight="bold" />
              </button>
              <span className="tnum min-w-[16px] text-center text-[13px] font-bold text-accent-ink">
                {inCart}
              </span>
              <button
                onClick={() => onSetQty(dish.id, inCart + 1)}
                aria-label={strings.oneMore}
                className="grid h-7 w-7 place-items-center rounded-full bg-accent-ink/20 text-accent-ink transition-transform active:scale-90"
              >
                <Plus size={13} weight="bold" />
              </button>
            </div>
          ) : (
            <button
              onClick={() => onAdd(dish)}
              aria-label={strings.addNamed.replace("{dish}", name)}
              className="inline-flex shrink-0 items-center gap-1.5 rounded-full bg-accent px-3.5 py-2 text-[12px] font-semibold text-accent-ink transition-transform duration-200 ease-out active:scale-95"
            >
              <Plus size={13} weight="bold" />
              {strings.add}
            </button>
          )}
        </div>
      </div>
    </article>
  );
}
