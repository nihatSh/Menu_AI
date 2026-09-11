"use client";

import { cx } from "./ui";

/**
 * The dish image slot.
 *
 * The reference design is photography-led: the picture is the largest element
 * on every card and fills the top half of the detail screen. Our menu data has
 * no photographs yet, so this renders `dish.photoUrl` when it exists and an
 * illustrated tile when it does not.
 *
 * The fallback is built to look deliberate rather than broken - a soft
 * accent-tinted field with the dish glyph centred - because a grey box would
 * read as a failed image. It is NOT a stock photo: putting a picture of
 * somebody else's food under the name "Piti" would mislead a guest who is
 * ordering from it.
 *
 * Every size below matches the reference's proportions, so the day real photos
 * land they drop straight in with no layout change.
 */
export default function DishImage({ dish, alt = "", className, glyphClass = "text-[30px]", rounded = "rounded-xl" }) {
  if (dish.photoUrl) {
    return (
      <img
        src={dish.photoUrl}
        alt={alt}
        loading="lazy"
        className={cx("h-full w-full object-cover", rounded, className)}
      />
    );
  }

  return (
    <div
      className={cx(
        "relative grid h-full w-full place-items-center overflow-hidden",
        rounded,
        className
      )}
      style={{
        // A tint of the restaurant's own accent, so the placeholder still
        // belongs to the brand instead of being neutral grey.
        backgroundImage:
          "radial-gradient(120% 120% at 30% 20%, rgb(var(--accent) / 0.16), rgb(var(--accent) / 0.05) 55%, rgb(var(--sunken)) 100%)",
      }}
    >
      <span aria-hidden="true" className={cx("leading-none drop-shadow-sm", glyphClass)}>
        {dish.emoji}
      </span>
    </div>
  );
}
