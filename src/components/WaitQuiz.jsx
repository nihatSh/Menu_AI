"use client";

import { useState } from "react";
import { Check, X, Confetti } from "@phosphor-icons/react";
import { Button, cx } from "./ui";

/** Shown while the food is cooking. Purely for fun - no discount, no reward. */
export default function WaitQuiz({ questions, strings }) {
  const [index, setIndex] = useState(0);
  const [picked, setPicked] = useState(null);
  const [score, setScore] = useState(0);

  if (!questions?.length) return null;

  const done = index >= questions.length;
  const q = questions[index];

  function choose(i) {
    if (picked !== null) return;
    setPicked(i);
    if (i === q.correct) setScore((s) => s + 1);
  }

  function next() {
    setPicked(null);
    setIndex((i) => i + 1);
  }

  return (
    <section className="rounded-card bg-raised p-4 shadow-card">
      <div className="flex items-baseline justify-between gap-3">
        <h3 className="text-[13px] font-semibold">{strings.quizTitle}</h3>
        {!done && (
          <span className="tnum text-[11.5px] text-faint">
            {index + 1}/{questions.length}
          </span>
        )}
      </div>

      {done ? (
        <p className="mt-2.5 flex items-center gap-2 text-sm text-muted">
          <Confetti size={17} weight="duotone" className="text-accent" />
          <span className="tnum">
            {strings.quizDone} &middot; {score}/{questions.length}
          </span>
        </p>
      ) : (
        <>
          <p className="mt-2 text-[14px] leading-snug">{q.q}</p>

          <div className="mt-2.5 space-y-1.5">
            {q.a.map((option, i) => {
              const isCorrect = picked !== null && i === q.correct;
              const isWrongPick = picked === i && i !== q.correct;
              return (
                <button
                  key={option}
                  onClick={() => choose(i)}
                  disabled={picked !== null}
                  className={cx(
                    "flex w-full items-center gap-2 rounded-control px-3 py-2.5 text-left text-[13.5px]",
                    "transition-colors duration-200 ease-out",
                    isCorrect
                      ? "bg-good-soft text-good"
                      : isWrongPick
                      ? "bg-danger-soft text-danger"
                      : "bg-sunken text-ink hover:bg-line disabled:opacity-60"
                  )}
                >
                  {isCorrect && <Check size={14} weight="bold" className="shrink-0" />}
                  {isWrongPick && <X size={14} weight="bold" className="shrink-0" />}
                  {option}
                </button>
              );
            })}
          </div>

          {picked !== null && (
            <div className="mt-3 flex items-center justify-between gap-3">
              <span
                className={cx(
                  "text-[12.5px] font-medium",
                  picked === q.correct ? "text-good" : "text-muted"
                )}
              >
                {picked === q.correct ? strings.correct : strings.wrong}
              </span>
              <Button variant="soft" size="sm" pill onClick={next}>
                {strings.quizNext}
              </Button>
            </div>
          )}
        </>
      )}
    </section>
  );
}
