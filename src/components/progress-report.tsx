"use client";

import { useState } from "react";
import Link from "next/link";
import { dayLabel, monthLabel, type CalendarCell, type DayState, type Summary } from "@/lib/progress";
import type { ProgressData } from "@/lib/progressData";

type Ready = Extract<ProgressData, { state: "ready" }>;

const RING_CIRCUMFERENCE = 2 * Math.PI * 44;
const WEEKDAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

/** The short text inside a calendar day, so the state never rests on colour alone. */
function mark(cell: NonNullable<CalendarCell>): string {
  switch (cell.state) {
    case "all":
      return "✓";
    case "some":
    case "none":
      return `${cell.done}/${cell.due}`;
    case "today":
      // Before today's list exists there's nothing to count yet.
      return cell.due > 0 ? `${cell.done}/${cell.due}` : "•";
    case "norecord":
      return "–";
    case "rest":
      return "Rest";
    default:
      return "";
  }
}

const STATE_WORDS: Record<DayState, string> = {
  all: "everything done",
  some: "some done",
  none: "none done",
  today: "today, still going",
  norecord: "no record",
  rest: "rest day",
  before: "",
  future: "",
};

function summaryLine(s: Summary): string {
  if (s.due === 0) return "Nothing recorded yet.";
  return `${s.done} of ${s.due} steps done. Everything done on ${s.perfectDays} of ${s.recordedDays} days.`;
}

function Ring({ percent }: { percent: number | null }) {
  const fraction = percent === null ? 0 : percent / 100;
  return (
    <div className="progress-ring">
      <svg viewBox="0 0 104 104" aria-hidden="true">
        <circle className="bg" cx="52" cy="52" r="44" />
        {/* Skipped at zero: a zero-length arc with round ends still paints a dot. */}
        {fraction > 0 && (
          <circle className="arc" cx="52" cy="52" r="44" strokeDasharray={`${RING_CIRCUMFERENCE * fraction} ${RING_CIRCUMFERENCE}`} />
        )}
      </svg>
      <div className="ring-num">
        <span>{percent === null ? "–" : `${percent}%`}</span>
      </div>
    </div>
  );
}

function MonthView({ month }: { month: Ready["month"] }) {
  const [selected, setSelected] = useState<string | null>(null);
  const chosen = month.cells.find((c) => c && c.date === selected) ?? null;
  const detail = chosen ? month.details[chosen.date] : undefined;

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between gap-2">
        {month.prevKey ? (
          <Link href={`/progress?m=${month.prevKey}`} className="btn btn-2 btn-sm shrink-0 whitespace-nowrap px-3" aria-label={`Previous month, ${monthLabel(month.prevKey)}`}>
            ‹ Back
          </Link>
        ) : (
          <span className="btn btn-2 btn-sm shrink-0 whitespace-nowrap px-3" aria-disabled="true" style={{ opacity: 0.4 }}>
            ‹ Back
          </span>
        )}
        <h2 className="text-center text-[21px] font-bold whitespace-nowrap" aria-live="polite">
          {month.label}
        </h2>
        {month.nextKey ? (
          <Link href={`/progress?m=${month.nextKey}`} className="btn btn-2 btn-sm shrink-0 whitespace-nowrap px-3" aria-label={`Next month, ${monthLabel(month.nextKey)}`}>
            Next ›
          </Link>
        ) : (
          <span className="btn btn-2 btn-sm shrink-0 whitespace-nowrap px-3" aria-disabled="true" style={{ opacity: 0.4 }}>
            Next ›
          </span>
        )}
      </div>

      <p className="text-[19px]">{summaryLine(month.summary)}</p>

      <div className="cal" role="group" aria-label={`Days of ${month.label}`}>
        {WEEKDAYS.map((w) => (
          <div key={w} className="cal-head" aria-hidden="true">
            {w}
          </div>
        ))}
        {month.cells.map((cell, i) => {
          if (!cell) return <div key={`b${i}`} />;
          const selectable = cell.state !== "before" && cell.state !== "future";
          const cls = `cal-cell${cell.state === "today" ? " is-today" : ""}`;
          const inner = (
            <>
              <span>{cell.day}</span>
              <small>{mark(cell)}</small>
            </>
          );
          return selectable ? (
            <button
              key={cell.date}
              type="button"
              className={cls}
              data-state={cell.state}
              aria-pressed={selected === cell.date}
              aria-label={`${dayLabel(cell.date)}: ${STATE_WORDS[cell.state]}${cell.due ? `, ${cell.done} of ${cell.due} steps` : ""}`}
              onClick={() => setSelected(selected === cell.date ? null : cell.date)}
            >
              {inner}
            </button>
          ) : (
            <div key={cell.date} className={cls} data-state={cell.state} aria-hidden="true">
              {inner}
            </div>
          );
        })}
      </div>

      <div className="cal-key" aria-label="What the marks mean">
        <span>✓ everything done</span>
        <span>2/3 some done</span>
        <span>0/3 none done</span>
        <span>– no record</span>
        <span>Rest: nothing due</span>
      </div>

      {chosen && (
        <div className="card flex flex-col gap-3" aria-live="polite">
          <h3 className="text-[21px] font-bold">{chosen.state === "today" ? "Today so far" : dayLabel(chosen.date)}</h3>
          {detail && detail.length > 0 ? (
            (["AM", "PM"] as const).map((p) => {
              const list = detail.filter((d) => d.period === p);
              if (list.length === 0) return null;
              return (
                <div key={p} className="flex flex-col gap-1">
                  <p className="eyebrow">{p === "AM" ? "Morning" : "Evening"}</p>
                  {list.map((d, i) => (
                    <p key={i} className="text-[19px]">
                      <b>{d.done ? "✓ Done" : chosen.state === "today" ? "Still to do" : "✗ Not done"}</b> · {d.name}
                    </p>
                  ))}
                </div>
              );
            })
          ) : chosen.state === "rest" ? (
            <p className="text-[19px]">Nothing was due this day.</p>
          ) : (
            <p className="text-[19px]">
              Nothing was recorded for this day. The app wasn&rsquo;t opened, so we can&rsquo;t say what was done. It isn&rsquo;t counted
              either way.
            </p>
          )}
        </div>
      )}
    </div>
  );
}

function YearView({ months }: { months: Ready["months"] }) {
  return (
    <div className="flex flex-col gap-4">
      <p className="sub">The last {months.length === 1 ? "month" : `${months.length} months`}, from the day you approved your routine.</p>
      <div className="flex flex-col gap-4">
        {[...months].reverse().map((m) => (
          <div key={m.key} className="bar-row">
            <div className="flex items-baseline justify-between gap-3">
              <b className="text-[20px]">
                {m.label}
                {m.inProgress && <span className="font-normal text-ink-2"> · so far</span>}
              </b>
              <span className="text-[19px] font-bold">{m.summary.percent === null ? "No record" : `${m.summary.percent}%`}</span>
            </div>
            <div
              className="bar-track"
              role="img"
              aria-label={m.summary.percent === null ? `${m.label}: nothing recorded` : `${m.label}: ${m.summary.percent} percent of steps done`}
            >
              <div className="bar-fill" style={{ width: `${m.summary.percent ?? 0}%` }} />
            </div>
            <p className="note">{m.summary.due === 0 ? "Nothing was recorded." : `${m.summary.done} of ${m.summary.due} steps. Everything done on ${m.summary.perfectDays} of ${m.summary.recordedDays} days.`}</p>
          </div>
        ))}
      </div>
    </div>
  );
}

/** How well the routine is being followed: a headline, a month calendar, and a bar per month. */
export function ProgressReport({ data }: { data: Ready }) {
  const [view, setView] = useState<"month" | "year">("month");
  const h = data.headline;

  return (
    <div className="flex flex-col gap-5">
      <div className="ring-card">
        <Ring percent={h.percent} />
        <div className="flex flex-col gap-1">
          <p className="eyebrow">{data.headlineLabel}</p>
          {h.due > 0 ? (
            <>
              <p className="text-[21px] font-bold leading-snug">{h.done} of {h.due} steps done</p>
              <p className="note" style={{ color: "var(--ink)" }}>
                Everything done on {h.perfectDays} of {h.recordedDays} days.
              </p>
            </>
          ) : (
            <p className="text-[21px] font-bold leading-snug">Nothing to report yet. Your first full day counts tomorrow.</p>
          )}
        </div>
      </div>
      <p className="note">Each day counts once it is over. Days the app wasn&rsquo;t opened have no record and aren&rsquo;t counted either way.</p>

      <div className="seg" role="group" aria-label="Report period">
        {(["month", "year"] as const).map((v) => (
          <button key={v} type="button" aria-pressed={view === v} onClick={() => setView(v)}>
            {v === "month" ? "Month" : "Year"}
          </button>
        ))}
      </div>

      {view === "month" ? <MonthView key={data.month.key} month={data.month} /> : <YearView months={data.months} />}
    </div>
  );
}
