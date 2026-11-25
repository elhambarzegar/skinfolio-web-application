import { prisma } from "@/lib/prisma";
import { localNow, safeTimezone } from "@/lib/dates";
import { scheduledWeekdays } from "@/lib/schedule";
import {
  addDays,
  addMonths,
  daysBetween,
  daysInMonth,
  monthCells,
  monthKey,
  monthLabel,
  monthRows,
  summarize,
  type CalendarCell,
  type DayCount,
  type MonthRow,
  type Summary,
} from "@/lib/progress";

export type DayDetail = { name: string; period: "AM" | "PM"; done: boolean };

export type ProgressData =
  /** The routine has never been approved, so there is nothing to report. */
  | { state: "none" }
  | {
      state: "ready";
      today: string;
      start: string;
      /** "Last 30 days", or "Since you started" in the first month. */
      headlineLabel: string;
      headline: Summary;
      month: {
        key: string;
        label: string;
        prevKey: string | null;
        nextKey: string | null;
        cells: CalendarCell[];
        summary: Summary;
        /** What was due and done on each recorded day of this month. */
        details: Record<string, DayDetail[]>;
      };
      months: MonthRow[];
    };

/** Everything the Progress screen needs, counted from the day the routine was first approved. */
export async function loadProgress(userId: string, monthParam?: string): Promise<ProgressData> {
  const user = await prisma.user.findUnique({ where: { id: userId }, select: { timezone: true } });
  const tz = safeTimezone(user?.timezone) ?? "UTC";
  const today = localNow(tz).date;

  // Reports start the day the person first approved a routine. Routines
  // approved before that was recorded fall back to their first logged day.
  const approval = await prisma.routine.aggregate({
    where: { userId, activatedAt: { not: null } },
    _min: { activatedAt: true },
  });
  let start: string | null = approval._min.activatedAt ? localNow(tz, approval._min.activatedAt).date : null;
  if (!start) {
    const first = await prisma.stepLog.findFirst({ where: { userId }, orderBy: { date: "asc" }, select: { date: true } });
    start = first?.date ?? null;
  }
  if (!start) return { state: "none" };

  const logs = await prisma.stepLog.findMany({
    where: { userId, date: { gte: start } },
    select: { date: true, doneAt: true, step: { select: { timeOfDay: true, product: { select: { name: true } } } } },
  });

  const days = new Map<string, DayCount>();
  const detailsByDate = new Map<string, DayDetail[]>();
  for (const log of logs) {
    const c = days.get(log.date) ?? { due: 0, done: 0 };
    c.due += 1;
    if (log.doneAt) c.done += 1;
    days.set(log.date, c);

    const list = detailsByDate.get(log.date) ?? [];
    list.push({ name: log.step.product?.name ?? "A product", period: log.step.timeOfDay, done: !!log.doneAt });
    detailsByDate.set(log.date, list);
  }

  // Which weekdays the routine in use has anything scheduled on: a day with
  // no record on any other weekday was simply a rest day.
  const routine = await prisma.routine.findFirst({
    where: { userId, status: { in: ["ACTIVE", "PAUSED"] } },
    orderBy: { createdAt: "desc" },
    select: { steps: { where: { active: true, productId: { not: null }, proposal: { not: "ADD" } }, select: { frequencyPerWeek: true } } },
  });
  const scheduled = new Set<number>(routine?.steps.flatMap((s) => [...scheduledWeekdays(s.frequencyPerWeek)]) ?? []);

  const currentMonth = monthKey(today);
  const startMonth = monthKey(start);
  const requested = monthParam && /^\d{4}-(0[1-9]|1[0-2])$/.test(monthParam) ? monthParam : currentMonth;
  const key = requested < startMonth ? startMonth : requested > currentMonth ? currentMonth : requested;

  const cells = monthCells(key, days, { today, start, scheduledWeekdays: scheduled });
  const details: Record<string, DayDetail[]> = {};
  for (const cell of cells) {
    const list = cell && detailsByDate.get(cell.date);
    if (cell && list) details[cell.date] = [...list].sort((a, b) => (a.period === b.period ? a.name.localeCompare(b.name) : a.period === "AM" ? -1 : 1));
  }

  const lastDay = `${key}-${String(daysInMonth(key)).padStart(2, "0")}`;
  const thirtyDays = daysBetween(start, today) >= 30;

  return {
    state: "ready",
    today,
    start,
    headlineLabel: thirtyDays ? "Last 30 days" : "Since you started",
    headline: summarize(days, addDays(today, -30), addDays(today, -1), start, today),
    month: {
      key,
      label: monthLabel(key),
      prevKey: key > startMonth ? addMonths(key, -1) : null,
      nextKey: key < currentMonth ? addMonths(key, 1) : null,
      cells,
      summary: summarize(days, `${key}-01`, lastDay, start, today),
      details,
    },
    months: monthRows(days, start, today),
  };
}
