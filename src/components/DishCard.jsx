"use client";

import { Plus, Minus, Star, Heart, ShoppingCartSimple, Clock, Fire } from "@phosphor-icons/react";
import { localized } from "@/lib/menu";
import { dishRating } from "@/lib/rating";
import DishImage from "./DishImage";
import { cx } from "./ui";

/**
 * One dish, in the reference design's language: photography on the left at a
 * size that lets it carry the card, then name, description, and a price-plus-
 * Quick-Add row along the bottom.
 *
 * Interaction from the previous round is kept:
 *  - the card body opens the full detail sheet (the description is clamped)
 *  - Quick Add becomes an inline stepper once the dish is in the order, so
 *    "one more" or "undo" never requires opening the basket
 */
export default function DishCard({
  dish,
  lang,
  currency,
  onAdd,
  onOpen,
  onSetQty,
  onToggleFavourite,
  isFavourite = false,
  inCart = 0,
  extraMinutes = 0,
  reason,
  score,
  index = 0,
  animate = false,
  strings,
}) {
  const name = localized(dish.name, lang);
  const wait = dish.prepMinutes + extraMinutes;
  const rating = dishRating(score);

  return (
    <article
      className={cx(
        "relative flex overflow-hidden rounded-card bg-raised shadow-card",
        "transition-shadow duration-200 ease-out hover:shadow-lift",
        animate && "animate-rise-in"
      )}
      style={animate ? { animationDelay: `${Math.min(index, 8) * 40}ms` } : undefined}
    >
      <button
        onClick={() => onOpen(dish)}
        aria-label={strings?.viewDish?.replace("{dish}", name) || `View ${name}`}
        className="w-[112px] shrink-0 self-stretch"
      >
        <DishImage
          dish={dish}
          alt={name}
          rounded="rounded-none"
          glyphClass="text-[44px]"
          className="min-h-[112px]"
        />
      </button>

      <div className="flex min-w-0 flex-1 flex-col p-2.5">
        <div className="flex items-start justify-between gap-1.5">
          <button
            onClick={() => onOpen(dish)}
            aria-label={strings?.viewDish?.replace("{dish}", name) || `View ${name}`}
            className="min-w-0 flex-1 text-left"
          >
            <span className="block truncate text-[14.5px] font-semibold leading-tight">{name}</span>
            <span className="mt-1 line-clamp-2 block text-[12px] leading-snug text-muted">
              {localized(dish.desc, lang)}
            </span>
          </button>

          {/* Rating and favourite share this corner, as in the reference.
              The rating only appears once enough people have actually voted -
              see lib/rating.js. */}
          <div className="flex shrink-0 flex-col items-end gap-1">
            <button
              onClick={() => onToggleFavourite?.(dish.id)}
              aria-label={
                isFavourite
                  ? strings?.unfavourite?.replace("{dish}", name) || `Remove ${name} from favourites`
                  : strings?.favourite?.replace("{dish}", name) || `Save ${name} to favourites`
              }
              aria-pressed={isFavourite}
              className="-m-1 grid h-7 w-7 place-items-center rounded-full transition-transform active:scale-90"
            >
              <Heart
                size={15}
                weight={isFavourite ? "fill" : "regular"}
                className={isFavourite ? "text-danger" : "text-faint"}
              />
            </button>

            {rating && (
              <span className="tnum inline-flex items-center gap-0.5 rounded-chip bg-sunken px-1.5 py-0.5 text-[10.5px] font-semibold">
                <Star size={9} weight="fill" className="text-amber-500" />
                {rating.stars.toFixed(1)}
              </span>
            )}
          </div>
        </div>

        {reason && (
          <p className="mt-1.5 line-clamp-1 rounded-control bg-accent-soft px-2 py-1 text-[11.5px] font-medium text-accent">
            {reason}
          </p>
        )}

        {/* Price and the add control share the bottom line, as in the
            reference. `mt-auto` pins it so the row lands at the same height on
            every card regardless of how long the description runs. */}
        <div className="mt-auto flex items-end justify-between gap-2 pt-1.5">
          <div className="min-w-0">
            <p className="tnum text-[15px] font-bold leading-none text-accent">
              {dish.price.toFixed(2)}
              <span className="ml-1 text-[10.5px] font-semibold uppercase">{currency}</span>
            </p>
            <p className="tnum mt-1 flex items-center gap-1.5 text-[10.5px] leading-none text-faint">
              <span className={cx("inline-flex items-center gap-0.5", extraMinutes > 0 && "text-warn")}>
                <Clock size={10} weight="bold" />
                {wait}m
              </span>
              <span>{dish.kcal} kcal</span>
              {dish.spice > 0 && (
                <span className="inline-flex items-center text-warn">
                  {Array.from({ length: dish.spice }, (_, i) => (
                    <Fire key={i} size={10} weight="fill" />
                  ))}
                </span>
              )}
            </p>
          </div>

          {inCart > 0 ? (
            <div className="flex shrink-0 items-center gap-1 rounded-full bg-accent px-1 py-1">
              <button
                onClick={() => onSetQty(dish.id, inCart - 1)}
                aria-label={
                  inCart === 1 ? strings?.removeFromOrder || "Remove" : strings?.oneFewer || "One fewer"
                }
                className="grid h-7 w-7 place-items-center rounded-full bg-accent-ink/20 text-accent-ink transition-transform active:scale-90"
              >
                <Minus size={13} weight="bold" />
              </button>
              <span className="tnum min-w-[16px] text-center text-[13px] font-bold text-accent-ink">
                {inCart}
              </span>
              <button
                onClick={() => onSetQty(dish.id, inCart + 1)}
                aria-label={strings?.oneMore || "One more"}
                className="grid h-7 w-7 place-items-center rounded-full bg-accent-ink/20 text-accent-ink transition-transform active:scale-90"
              >
                <Plus size={13} weight="bold" />
              </button>
            </div>
          ) : (
            <button
              onClick={() => onAdd(dish)}
              aria-label={strings?.addNamed?.replace("{dish}", name) || `Add ${name}`}
              className="inline-flex shrink-0 items-center gap-1.5 rounded-full bg-accent px-3 py-2 text-[12px] font-semibold text-accent-ink transition-transform duration-200 ease-out active:scale-95"
            >
              {strings?.quickAdd || "Quick Add"}
              <ShoppingCartSimple size={13} weight="fill" />
            </button>
          )}
        </div>
      </div>

    </article>
  );
}
