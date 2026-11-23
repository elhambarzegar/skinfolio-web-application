"use client";

import { useState } from "react";
import type { TodayStep } from "@/lib/today";

type Period = "AM" | "PM";

const RING_CIRCUMFERENCE = 2 * Math.PI * 44;

export function TodayChecklist({
  steps,
  defaultPeriod,
  dateLabel,
  firstName,
}: {
  steps: TodayStep[];
  defaultPeriod: Period;
  dateLabel: string;
  firstName: string | null;
}) {
  const [period, setPeriod] = useState<Period>(defaultPeriod);
  const [done, setDone] = useState<Record<string, boolean>>(() =>
    Object.fromEntries(steps.map((s) => [s.id, s.done]))
  );
  const [error, setError] = useState<string | null>(null);

  const forPeriod = (p: Period) => steps.filter((s) => s.period === p);
  const statsFor = (p: Period) => {
    const list = forPeriod(p);
    const finished = list.filter((s) => done[s.id]);
    const minutesLeft = list.filter((s) => !done[s.id]).reduce((sum, s) => sum + s.minutes, 0);
    return { total: list.length, finished: finished.length, minutesLeft };
  };

  async function toggle(id: string) {
    const next = !done[id];
    setError(null);
    setDone((prev) => ({ ...prev, [id]: next }));

    try {
      const res = await fetch(`/api/today/steps/${id}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ done: next }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => null);
        throw new Error(data?.error ?? "That didn't save. Try again.");
      }
    } catch (err) {
      setDone((prev) => ({ ...prev, [id]: !next }));
      setError(err instanceof Error ? err.message : "Couldn't reach the server. Check your connection and try again.");
    }
  }

  const current = statsFor(period);
  const list = forPeriod(period);
  const allDone = current.total > 0 && current.finished === current.total;
  const fraction = current.total ? current.finished / current.total : 0;

  const message =
    current.total === 0
      ? `Nothing is due this ${period === "AM" ? "morning" : "evening"}.`
      : allDone
        ? period === "AM"
          ? "All done for this morning. Lovely."
          : "All done for tonight. Sleep well."
        : `About ${current.minutesLeft} min left`;

  return (
    <div className="flex flex-col gap-5">
      <div>
        <p className="eyebrow">{dateLabel}</p>
        <h1 className="page-title">
          {period === "AM" ? "Good morning" : "Good evening"}
          {firstName ? `, ${firstName}` : ""}
        </h1>
      </div>

      <div className="ring-card">
        <div className="progress-ring">
          <svg viewBox="0 0 104 104" aria-hidden="true">
            <circle className="bg" cx="52" cy="52" r="44" />
            {/* Skipped at zero: a zero-length arc with round ends still paints a dot. */}
            {fraction > 0 && (
              <circle
                className="arc"
                cx="52"
                cy="52"
                r="44"
                strokeDasharray={`${RING_CIRCUMFERENCE * fraction} ${RING_CIRCUMFERENCE}`}
              />
            )}
          </svg>
          <div className="ring-num">
            {current.total === 0 ? (
              <span>Rest</span>
            ) : (
              <>
                <span>
                  {current.finished} of {current.total}
                </span>
                <small>done</small>
              </>
            )}
          </div>
        </div>
        <p className="text-[21px] font-bold leading-snug" aria-live="polite">
          {message}
        </p>
      </div>

      <div className="seg" role="group" aria-label="Part of the day">
        {(["AM", "PM"] as const).map((p) => {
          const s = statsFor(p);
          return (
            <button key={p} type="button" aria-pressed={period === p} onClick={() => setPeriod(p)}>
              {p === "AM" ? "Morning" : "Evening"}
              <span className="count">
                {s.finished}/{s.total}
              </span>
            </button>
          );
        })}
      </div>

      {error && (
        <p role="alert" className="callout c-blush text-[18px] font-bold">
          {error}
        </p>
      )}

      {list.length > 0 && (
        <div className="steps">
          {list.map((step, i) => {
            const isDone = !!done[step.id];
            return (
              <article key={step.id} className={`step${isDone ? " is-done" : ""}`}>
                <div className="step-top">
                  <span className="step-num">{i + 1}</span>
                  <div className="min-w-0">
                    <h3>{step.name}</h3>
                    <p className="brand">{step.brand}</p>
                  </div>
                </div>
                <div className="badges">
                  <span className="badge b-cat">{step.category}</span>
                  {step.days && <span className="badge b-freq">{step.days}</span>}
                  <span className="badge b-time">{step.minutes} min</span>
                </div>
                <button
                  type="button"
                  className={`btn btn-block ${isDone ? "btn-ok" : ""}`}
                  aria-pressed={isDone}
                  onClick={() => toggle(step.id)}
                >
                  {isDone ? "Done. Tap to undo" : "Mark done"}
                </button>
              </article>
            );
          })}
        </div>
      )}
    </div>
  );
}
