/**
 * Adherence reports, worked out from the daily list of what was due and what
 * was ticked. Everything here is plain maths on "YYYY-MM-DD" strings (the
 * person's own calendar days), so it never depends on the server's time zone.
 *
 * What counts:
 *  - Only days from the day the routine was first approved.
 *  - Only finished days: today is shown but doesn't count until it is over.
 *  - Only days the app has a record of. A day nobody opened the app has no
 *    list of what was due, so it is shown as "no record" and left out of the
 *    percentages rather than guessed at.
 */

export type DayCount = { due: number; done: number };

export type DayState =
  /** Every step that was due was done. */
  | "all"
  /** Some, not all. */
  | "some"
  /** Steps were due and none were done. */
  | "none"
  /** Today, not finished yet. */
  | "today"
  /** The routine had nothing due that weekday. */
  | "rest"
  /** The app wasn't opened, so nothing was recorded. */
  | "norecord"
  | "before"
  | "future";

export type Summary = {
  due: number;
  done: number;
  /** Whole percent, or null when nothing was due. */
  percent: number | null;
  /** Days with a record of steps being due. */
  recordedDays: number;
  /** Of those, days when everything was done. */
  perfectDays: number;
};

const pad = (n: number) => String(n).padStart(2, "0");

function toUtc(date: string): Date {
  const [y, m, d] = date.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d));
}

function fromUtc(d: Date): string {
  return `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())}`;
}

export function addDays(date: string, n: number): string {
  const d = toUtc(date);
  d.setUTCDate(d.getUTCDate() + n);
  return fromUtc(d);
}

/** 1 = Monday … 7 = Sunday. */
export function weekdayOf(date: string): number {
  return ((toUtc(date).getUTCDay() + 6) % 7) + 1;
}

/** Whole days from `a` to `b` (positive when b is later). */
export function daysBetween(a: string, b: string): number {
  return Math.round((toUtc(b).getTime() - toUtc(a).getTime()) / 86_400_000);
}

export function monthKey(date: string): string {
  return date.slice(0, 7);
}

export function addMonths(key: string, n: number): string {
  const [y, m] = key.split("-").map(Number);
  const d = new Date(Date.UTC(y, m - 1 + n, 1));
  return `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}`;
}

export function daysInMonth(key: string): number {
  const [y, m] = key.split("-").map(Number);
  return new Date(Date.UTC(y, m, 0)).getUTCDate();
}

const MONTH_NAMES = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];

export function monthLabel(key: string, short = false): string {
  const [y, m] = key.split("-").map(Number);
  const name = MONTH_NAMES[m - 1];
  return `${short ? name.slice(0, 3) : name} ${y}`;
}

export function percentOf(done: number, due: number): number | null {
  return due > 0 ? Math.round((done / due) * 100) : null;
}

export function dayState(input: {
  date: string;
  today: string;
  start: string;
  count: DayCount | undefined;
  /** Weekdays (1–7) on which the current routine has anything scheduled. */
  scheduledWeekdays: ReadonlySet<number>;
}): DayState {
  const { date, today, start, count } = input;
  if (date > today) return "future";
  if (date < start) return "before";
  if (date === today) return "today";
  if (count && count.due > 0) {
    if (count.done >= count.due) return "all";
    return count.done > 0 ? "some" : "none";
  }
  // No record. If the routine has nothing on that weekday it was a rest day.
  if (input.scheduledWeekdays.size > 0 && !input.scheduledWeekdays.has(weekdayOf(date))) return "rest";
  return "norecord";
}

/** Totals over finished days from `from` to `to` (both included), clipped to the start and to before today. */
export function summarize(days: ReadonlyMap<string, DayCount>, from: string, to: string, start: string, today: string): Summary {
  const first = from < start ? start : from;
  const lastFinished = addDays(today, -1);
  const last = to > lastFinished ? lastFinished : to;

  let due = 0;
  let done = 0;
  let recordedDays = 0;
  let perfectDays = 0;
  for (let d = first; d <= last; d = addDays(d, 1)) {
    const c = days.get(d);
    if (!c || c.due === 0) continue;
    due += c.due;
    done += c.done;
    recordedDays += 1;
    if (c.done >= c.due) perfectDays += 1;
  }
  return { due, done, percent: percentOf(done, due), recordedDays, perfectDays };
}

export type CalendarCell = { date: string; day: number; state: DayState; due: number; done: number } | null;

/** A month as a Monday-first grid: blanks before the 1st, then each day. */
export function monthCells(
  key: string,
  days: ReadonlyMap<string, DayCount>,
  ctx: { today: string; start: string; scheduledWeekdays: ReadonlySet<number> }
): CalendarCell[] {
  const cells: CalendarCell[] = [];
  const lead = weekdayOf(`${key}-01`) - 1;
  for (let i = 0; i < lead; i++) cells.push(null);
  for (let day = 1; day <= daysInMonth(key); day++) {
    const date = `${key}-${pad(day)}`;
    const count = days.get(date);
    cells.push({
      date,
      day,
      state: dayState({ date, count, ...ctx }),
      due: count?.due ?? 0,
      done: count?.done ?? 0,
    });
  }
  return cells;
}

export type MonthRow = { key: string; label: string; summary: Summary; inProgress: boolean };

/** One row per month from the start month through this one, oldest first, at most `limit` (the latest ones). */
export function monthRows(days: ReadonlyMap<string, DayCount>, start: string, today: string, limit = 12): MonthRow[] {
  const rows: MonthRow[] = [];
  const last = monthKey(today);
  for (let key = monthKey(start); key <= last; key = addMonths(key, 1)) {
    rows.push({
      key,
      label: monthLabel(key, true),
      summary: summarize(days, `${key}-01`, `${key}-${pad(daysInMonth(key))}`, start, today),
      inProgress: key === last,
    });
  }
  return rows.slice(-limit);
}

const WEEKDAY_NAMES = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];

/** "Tuesday, November 18" */
export function dayLabel(date: string): string {
  const [, m, d] = date.split("-").map(Number);
  return `${WEEKDAY_NAMES[weekdayOf(date) - 1]}, ${MONTH_NAMES[m - 1]} ${d}`;
}
