/**
 * "Today" belongs to the user, not the server: the checklist, the weekday a
 * product is due, and the morning/evening default all come from the user's
 * own timezone.
 */

export type LocalNow = {
  /** The user's local calendar day, "YYYY-MM-DD". */
  date: string;
  /** 1 = Monday … 7 = Sunday. */
  weekday: number;
  /** 0–23. */
  hour: number;
};

const WEEKDAY: Record<string, number> = { Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6, Sun: 7 };

/** Returns the zone if it's a real IANA timezone, otherwise null. */
export function safeTimezone(tz: unknown): string | null {
  if (typeof tz !== "string" || tz.length === 0 || tz.length > 64) return null;
  try {
    new Intl.DateTimeFormat("en-US", { timeZone: tz });
    return tz;
  } catch {
    return null;
  }
}

export function localNow(timeZone: string, now: Date = new Date()): LocalNow {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    hourCycle: "h23",
    weekday: "short",
  }).formatToParts(now);
  const get = (type: string) => parts.find((p) => p.type === type)?.value ?? "";

  return {
    date: `${get("year")}-${get("month")}-${get("day")}`,
    weekday: WEEKDAY[get("weekday")] ?? 1,
    hour: Number(get("hour")) % 24,
  };
}

/** "Monday, November 23" in the user's zone. */
export function longDate(timeZone: string, now: Date = new Date()): string {
  return new Intl.DateTimeFormat("en-US", {
    timeZone,
    weekday: "long",
    month: "long",
    day: "numeric",
  }).format(now);
}

/** Morning until 3pm local, evening after. */
export function defaultPeriod(hour: number): "AM" | "PM" {
  return hour < 15 ? "AM" : "PM";
}
