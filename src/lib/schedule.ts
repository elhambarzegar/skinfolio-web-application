/**
 * Which weekdays a product is used on. Daily products are due every day;
 * less-than-daily ones are spread as evenly as the week allows (three times
 * a week is Mon · Wed · Fri), so two strong nights never fall back to back
 * by accident. Weekdays: 1 = Monday … 7 = Sunday.
 */

const PATTERNS: Record<number, readonly number[]> = {
  1: [1],
  2: [1, 4],
  3: [1, 3, 5],
  4: [1, 2, 4, 6],
  5: [1, 2, 4, 5, 6],
  6: [1, 2, 4, 5, 6, 7],
  7: [1, 2, 3, 4, 5, 6, 7],
};

export const WEEKDAY_SHORT = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"] as const;
export const WEEKDAY_LONG = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"] as const;

function clamp(frequencyPerWeek: number): number {
  if (!Number.isFinite(frequencyPerWeek)) return 7;
  return Math.min(7, Math.max(1, Math.round(frequencyPerWeek)));
}

export function scheduledWeekdays(frequencyPerWeek: number): readonly number[] {
  return PATTERNS[clamp(frequencyPerWeek)];
}

export function isScheduledOn(frequencyPerWeek: number, weekday: number): boolean {
  return scheduledWeekdays(frequencyPerWeek).includes(weekday);
}

/** The next weekday after `weekday` this product is due (wraps the week). */
export function nextScheduledWeekday(frequencyPerWeek: number, weekday: number): number {
  const days = scheduledWeekdays(frequencyPerWeek);
  for (let step = 1; step <= 7; step++) {
    const candidate = ((weekday - 1 + step) % 7) + 1;
    if (days.includes(candidate)) return candidate;
  }
  return weekday;
}

/** "Mon · Wed · Fri", or null for a daily product (nothing to call out). */
export function daysLabel(frequencyPerWeek: number): string | null {
  const days = scheduledWeekdays(frequencyPerWeek);
  if (days.length === 7) return null;
  return days.map((d) => WEEKDAY_SHORT[d - 1]).join(" · ");
}
