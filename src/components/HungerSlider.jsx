"use client";

import { HUNGER_LABELS, HUNGER_KCAL } from "@/lib/menu";

/**
 * Hunger, 1 to 5.
 *
 * A native range input, styled. Two earlier attempts (five tap-target bars,
 * then an equaliser) both read as a row of input fields rather than as a
 * scale - wide blocks look like fields whatever their height. A track with a
 * thumb is the control people already know, and going native means drag,
 * keyboard, and screen-reader support come for free.
 */
export default function HungerSlider({ value, onChange, label }) {
  const pct = ((value - 1) / 4) * 100;

  return (
    <div className="rounded-card bg-raised p-4 shadow-card">
      <div className="flex items-baseline justify-between gap-3">
        <label htmlFor="hunger" className="text-sm font-medium">
          {label}
        </label>
        <span className="tnum text-[12.5px] text-muted">
          {HUNGER_LABELS[value - 1]} &middot; ~{HUNGER_KCAL[value]} kcal
        </span>
      </div>

      <input
        id="hunger"
        type="range"
        min="1"
        max="5"
        step="1"
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        aria-valuetext={HUNGER_LABELS[value - 1]}
        className="hunger-range mt-3.5 w-full"
        // The filled portion of the track is painted with a gradient stop at
        // the thumb, so fill and thumb stay locked together at any value.
        style={{
          background: `linear-gradient(to right, rgb(var(--accent)) 0%, rgb(var(--accent)) ${pct}%, rgb(var(--line)) ${pct}%, rgb(var(--line)) 100%)`,
        }}
      />

      <div className="mt-2 flex justify-between text-[11px] text-faint">
        <span>{HUNGER_LABELS[0]}</span>
        <span>{HUNGER_LABELS[4]}</span>
      </div>
    </div>
  );
}
