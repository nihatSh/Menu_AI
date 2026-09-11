"use client";

import { useEffect, useRef } from "react";
import { X } from "@phosphor-icons/react";

export const cx = (...parts) => parts.filter(Boolean).join(" ");

/* ------------------------------------------------------------------ Button */

const VARIANTS = {
  // `accent-ink` is computed per restaurant by luminance, so the label always
  // clears WCAG AA against whatever accent the restaurant chose.
  primary: "bg-accent text-accent-ink shadow-card hover:brightness-[1.06]",
  solid: "bg-ink text-paper hover:brightness-110",
  soft: "bg-sunken text-ink hover:bg-line",
  outline: "border border-line bg-transparent text-ink hover:bg-sunken",
  ghost: "bg-transparent text-muted hover:bg-sunken hover:text-ink",
  danger: "border border-danger/30 bg-danger-soft text-danger hover:bg-danger/15",
};

const SIZES = {
  sm: "h-9 px-3.5 text-[13px] gap-1.5",
  md: "h-11 px-5 text-sm gap-2",
  lg: "h-14 px-6 text-[15px] gap-2.5",
};

export function Button({
  variant = "soft",
  size = "md",
  pill = false,
  full = false,
  className,
  children,
  ...rest
}) {
  return (
    <button
      className={cx(
        "inline-flex shrink-0 select-none items-center justify-center font-medium",
        "transition-[transform,background-color,filter] duration-200 ease-out",
        "active:scale-[0.97] disabled:pointer-events-none disabled:opacity-40",
        pill ? "rounded-full" : "rounded-control",
        full && "w-full",
        VARIANTS[variant],
        SIZES[size],
        className
      )}
      {...rest}
    >
      {children}
    </button>
  );
}

/* -------------------------------------------------------------------- Chip */

/** Small selectable token. Used for allergens, diets, categories, quick asks. */
export function Chip({ active, className, children, ...rest }) {
  return (
    <button
      type="button"
      aria-pressed={active}
      className={cx(
        "inline-flex shrink-0 items-center gap-1.5 rounded-full border px-3 py-1.5",
        "text-[13px] font-medium transition-all duration-200 ease-out active:scale-[0.96]",
        active
          ? "border-transparent bg-ink text-paper"
          : "border-line bg-raised text-muted hover:border-faint hover:text-ink",
        className
      )}
      {...rest}
    >
      {children}
    </button>
  );
}

/* ------------------------------------------------------------------- Badge */

const BADGE_TONES = {
  neutral: "bg-sunken text-muted",
  accent: "bg-accent-soft text-accent",
  warn: "bg-warn-soft text-warn",
  danger: "bg-danger-soft text-danger",
  good: "bg-good-soft text-good",
};

export function Badge({ tone = "neutral", className, children }) {
  return (
    <span
      className={cx(
        "inline-flex items-center gap-1 rounded-chip px-1.5 py-0.5",
        "text-[11px] font-semibold leading-tight",
        BADGE_TONES[tone],
        className
      )}
    >
      {children}
    </span>
  );
}

/* -------------------------------------------------------------------- Card */

/**
 * A raised surface. Used only where elevation carries hierarchy - a dish you
 * can act on, a sheet, an order. Plain groupings use `divide-y` and space
 * instead (taste-skill 4.4).
 */
export function Card({ as: Tag = "div", interactive = false, className, children, ...rest }) {
  return (
    <Tag
      className={cx(
        "rounded-card bg-raised shadow-card",
        interactive && "transition-shadow duration-200 ease-out hover:shadow-lift",
        className
      )}
      {...rest}
    >
      {children}
    </Tag>
  );
}

/* ------------------------------------------------------------------- Sheet */

/**
 * Bottom sheet. It rises from the bottom edge because that is where the thumb
 * is - the motion explains where the panel came from (taste-skill: motion must
 * be motivated). Traps focus and closes on Escape.
 */
export function Sheet({ open, onClose, title, children, footer }) {
  const panelRef = useRef(null);
  const previouslyFocused = useRef(null);

  useEffect(() => {
    if (!open) return;
    previouslyFocused.current = document.activeElement;

    const onKey = (e) => {
      if (e.key === "Escape") {
        e.preventDefault();
        onClose();
        return;
      }
      if (e.key !== "Tab" || !panelRef.current) return;

      const focusables = panelRef.current.querySelectorAll(
        'a[href],button:not([disabled]),input:not([disabled]),select,textarea,[tabindex]:not([tabindex="-1"])'
      );
      if (!focusables.length) return;
      const first = focusables[0];
      const last = focusables[focusables.length - 1];
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    };

    document.addEventListener("keydown", onKey);
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden"; // stop the page scrolling behind
    panelRef.current?.focus();

    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = prevOverflow;
      previouslyFocused.current?.focus?.();
    };
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-sheet flex items-end justify-center bg-ink/40 animate-fade-in backdrop-blur-[2px]"
      onClick={onClose}
    >
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-label={title}
        tabIndex={-1}
        onClick={(e) => e.stopPropagation()}
        className="flex max-h-[92dvh] w-full max-w-lg flex-col rounded-t-sheet bg-paper shadow-sheet animate-sheet-up outline-none"
      >
        <div className="shrink-0 px-5 pb-3 pt-3">
          {/* Grab handle: signals the sheet is draggable-feeling and separates
              it from the page behind. */}
          <div className="mx-auto mb-3 h-1 w-9 rounded-full bg-line" />
          <div className="flex items-center justify-between gap-3">
            <h2 className="text-title">{title}</h2>
            <button
              onClick={onClose}
              aria-label="Close"
              className="grid h-9 w-9 place-items-center rounded-full bg-sunken text-muted transition-colors hover:text-ink"
            >
              <X size={17} weight="bold" />
            </button>
          </div>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto px-5">{children}</div>

        {footer && (
          <div className="shrink-0 border-t border-line bg-paper px-5 pb-safe pt-3">{footer}</div>
        )}
      </div>
    </div>
  );
}

/* -------------------------------------------------------------- Empty state */

export function EmptyState({ icon: Icon, title, body, action }) {
  return (
    <div className="flex flex-col items-center px-6 py-14 text-center">
      {Icon && (
        <div className="mb-4 grid h-14 w-14 place-items-center rounded-full bg-sunken text-faint">
          <Icon size={24} weight="duotone" />
        </div>
      )}
      <p className="text-[15px] font-semibold">{title}</p>
      {body && <p className="mt-1.5 max-w-[34ch] text-sm leading-relaxed text-muted">{body}</p>}
      {action && <div className="mt-5">{action}</div>}
    </div>
  );
}

/* ----------------------------------------------------------------- Skeleton */

/** Matches the shape of the content it stands in for, never a spinner. */
export function DishSkeleton() {
  return (
    <div className="flex gap-3.5 rounded-card bg-raised p-3.5 shadow-card">
      <div className="skeleton h-[72px] w-[72px] shrink-0 rounded-card" />
      <div className="flex-1 space-y-2 py-1">
        <div className="skeleton h-4 w-2/5" />
        <div className="skeleton h-3 w-4/5" />
        <div className="skeleton h-3 w-1/3" />
      </div>
    </div>
  );
}

/* -------------------------------------------------------------- Inline note */

const NOTE_TONES = {
  warn: "bg-warn-soft text-warn",
  danger: "bg-danger-soft text-danger",
  good: "bg-good-soft text-good",
  accent: "bg-accent-soft text-accent",
  neutral: "bg-sunken text-muted",
};

/** Inline message. Replaces window.alert() and floating toasts for form errors. */
export function Note({ tone = "neutral", icon: Icon, children, className }) {
  return (
    <p
      className={cx(
        "flex items-start gap-2 rounded-control px-3 py-2 text-[13px] leading-snug",
        NOTE_TONES[tone],
        className
      )}
    >
      {Icon && <Icon size={15} weight="fill" className="mt-px shrink-0" />}
      <span>{children}</span>
    </p>
  );
}
