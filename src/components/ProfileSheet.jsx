"use client";

import { useState } from "react";
import { Drop, FirstAid, Info } from "@phosphor-icons/react";
import { ALL_ALLERGENS, DIETS } from "@/data/restaurants";
import { waterTarget } from "@/lib/menu";
import { Button, Chip, Note, Sheet } from "./ui";

function Section({ title, hint, children }) {
  return (
    <section className="py-4">
      <h3 className="text-[13px] font-semibold">{title}</h3>
      {hint && <p className="mt-0.5 text-[11.5px] leading-snug text-faint">{hint}</p>}
      <div className="mt-2.5">{children}</div>
    </section>
  );
}

export default function ProfileSheet({ open, profile, onSave, onClose, strings }) {
  const [draft, setDraft] = useState(profile);

  const toggle = (key, value) =>
    setDraft((d) => ({
      ...d,
      [key]: d[key].includes(value) ? d[key].filter((x) => x !== value) : [...d[key], value],
    }));

  const set = (key, value) => setDraft((d) => ({ ...d, [key]: value }));

  const water = draft.weightKg ? waterTarget(Number(draft.weightKg), false) : null;
  const kcalLeft = Number(draft.kcalTarget)
    ? Math.max(0, draft.kcalTarget - (draft.kcalEaten || 0))
    : null;
  const proteinLeft = Number(draft.proteinTarget)
    ? Math.max(0, draft.proteinTarget - (draft.proteinEaten || 0))
    : null;

  return (
    <Sheet
      open={open}
      onClose={onClose}
      title={strings.profile}
      footer={
        <Button variant="primary" size="lg" pill full onClick={() => onSave(draft)}>
          {strings.save}
        </Button>
      }
    >
      <div className="divide-y divide-line pb-4">
        <div className="pb-4">
          <Note tone="neutral" icon={Info}>
            {strings.profileIntro}
          </Note>
        </div>

        <Section title={strings.yourName}>
          <input
            value={draft.name}
            onChange={(e) => set("name", e.target.value)}
            placeholder="Guest"
            className="w-full rounded-control border border-line bg-raised px-3 py-2.5 text-sm text-ink outline-none transition-colors placeholder:text-faint focus:border-accent"
          />
        </Section>

        <Section title={strings.allergies} hint={strings.allergyHint}>
          <div className="flex flex-wrap gap-2">
            {ALL_ALLERGENS.map((a) => (
              <Chip
                key={a}
                active={draft.allergens.includes(a)}
                onClick={() => toggle("allergens", a)}
              >
                {a}
              </Chip>
            ))}
          </div>
          {draft.allergens.length > 0 && (
            <Note tone="danger" icon={FirstAid} className="mt-2.5">
              {strings.allergyOnTicket}
            </Note>
          )}
        </Section>

        <Section title={strings.diet}>
          <div className="flex flex-wrap gap-2">
            {DIETS.map((d) => (
              <Chip key={d} active={draft.diets.includes(d)} onClick={() => toggle("diets", d)}>
                {d}
              </Chip>
            ))}
          </div>
        </Section>

        <Section title={strings.fasting}>
          <div className="flex flex-wrap gap-2">
            {[
              ["none", strings.none],
              ["ramadan", strings.ramadan],
              ["lent", strings.lent],
            ].map(([value, label]) => (
              <Chip key={value} active={draft.fasting === value} onClick={() => set("fasting", value)}>
                {label}
              </Chip>
            ))}
          </div>
        </Section>

        <Section title={strings.kidsMode} hint={strings.kidsHint}>
          <Chip active={draft.kidsMode} onClick={() => set("kidsMode", !draft.kidsMode)}>
            {draft.kidsMode ? strings.on : strings.off}
          </Chip>
        </Section>

        <Section title={strings.fitness} hint={strings.fitnessHint}>
          <div className="grid grid-cols-3 gap-2">
            {[
              ["weightKg", strings.weight],
              ["kcalTarget", strings.kcalTarget],
              ["proteinTarget", strings.proteinTarget],
            ].map(([key, label]) => (
              <label key={key} className="block">
                <span className="text-[11px] leading-tight text-muted">{label}</span>
                <input
                  type="number"
                  inputMode="numeric"
                  min="0"
                  value={draft[key]}
                  onChange={(e) => set(key, e.target.value)}
                  className="tnum mt-1 w-full rounded-control border border-line bg-raised px-2.5 py-2 text-sm text-ink outline-none transition-colors focus:border-accent"
                />
              </label>
            ))}
          </div>

          {(kcalLeft !== null || proteinLeft !== null) && (
            <div className="mt-3 rounded-control bg-sunken p-3">
              <div className="flex items-baseline justify-between gap-3">
                <span className="text-[11.5px] text-muted">{strings.eatenToday}</span>
                <span className="tnum text-[13px] font-semibold">
                  {draft.kcalEaten || 0} kcal &middot; {draft.proteinEaten || 0}g
                </span>
              </div>
              <div className="mt-1.5 flex items-baseline justify-between gap-3">
                <span className="text-[11.5px] text-muted">{strings.leftToday}</span>
                <span className="tnum text-[13px] font-semibold text-good">
                  {kcalLeft ?? "—"} kcal &middot; {proteinLeft ?? "—"}g
                </span>
              </div>
            </div>
          )}

          {water && (
            <Note tone="accent" icon={Drop} className="mt-2.5">
              {strings.waterNote.replace("{litres}", water.base)} ({water.total} L{" "}
              {strings.onTrainingDay})
            </Note>
          )}
        </Section>
      </div>
    </Sheet>
  );
}
