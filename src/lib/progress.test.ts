import { describe, expect, it } from "vitest";
import { addDays, addMonths, dayLabel, daysBetween, dayState, daysInMonth, monthCells, monthLabel, monthRows, percentOf, summarize, weekdayOf, type DayCount } from "./progress";

const days = (entries: Record<string, [number, number]>): Map<string, DayCount> =>
  new Map(Object.entries(entries).map(([d, [done, due]]) => [d, { done, due }]));

const everyDay = new Set([1, 2, 3, 4, 5, 6, 7]);

describe("date arithmetic", () => {
  it("adds days across month and year ends", () => {
    expect(addDays("2026-11-30", 1)).toBe("2026-12-01");
    expect(addDays("2026-01-01", -1)).toBe("2025-12-31");
    expect(addDays("2028-02-28", 1)).toBe("2028-02-29");
  });
  it("counts the days between two dates", () => {
    expect(daysBetween("2026-11-01", "2026-11-24")).toBe(23);
    expect(daysBetween("2026-12-30", "2027-01-02")).toBe(3);
    expect(daysBetween("2026-11-24", "2026-11-24")).toBe(0);
  });
  it("finds the weekday (Monday is 1)", () => {
    expect(weekdayOf("2026-11-23")).toBe(1);
    expect(weekdayOf("2026-11-29")).toBe(7);
  });
  it("moves between months", () => {
    expect(addMonths("2026-12", 1)).toBe("2027-01");
    expect(addMonths("2026-01", -1)).toBe("2025-12");
    expect(daysInMonth("2028-02")).toBe(29);
    expect(monthLabel("2026-11")).toBe("November 2026");
    expect(monthLabel("2026-11", true)).toBe("Nov 2026");
  });
});

describe("dayLabel", () => {
  it("writes the weekday and date in words", () => {
    expect(dayLabel("2026-11-24")).toBe("Tuesday, November 24");
    expect(dayLabel("2026-01-01")).toBe("Thursday, January 1");
  });
});

describe("percentOf", () => {
  it("rounds, and has nothing to say when nothing was due", () => {
    expect(percentOf(2, 3)).toBe(67);
    expect(percentOf(0, 0)).toBeNull();
  });
});

describe("dayState", () => {
  const base = { today: "2026-11-24", start: "2026-11-10", scheduledWeekdays: everyDay };

  it("is all, some or none for a recorded finished day", () => {
    expect(dayState({ ...base, date: "2026-11-20", count: { due: 4, done: 4 } })).toBe("all");
    expect(dayState({ ...base, date: "2026-11-20", count: { due: 4, done: 2 } })).toBe("some");
    expect(dayState({ ...base, date: "2026-11-20", count: { due: 4, done: 0 } })).toBe("none");
  });
  it("shows today as still going, whatever was ticked", () => {
    expect(dayState({ ...base, date: "2026-11-24", count: { due: 4, done: 0 } })).toBe("today");
  });
  it("doesn't judge days before the start or in the future", () => {
    expect(dayState({ ...base, date: "2026-11-05", count: { due: 4, done: 0 } })).toBe("before");
    expect(dayState({ ...base, date: "2026-11-30", count: undefined })).toBe("future");
  });
  it("says 'no record' for a day the app wasn't opened", () => {
    expect(dayState({ ...base, date: "2026-11-15", count: undefined })).toBe("norecord");
  });
  it("calls a day with nothing scheduled that weekday a rest day", () => {
    // 2026-11-15 is a Sunday; the routine has nothing on Sundays.
    expect(dayState({ ...base, scheduledWeekdays: new Set([1, 2, 3, 4, 5, 6]), date: "2026-11-15", count: undefined })).toBe("rest");
  });
});

describe("summarize", () => {
  const d = days({ "2026-11-10": [3, 3], "2026-11-11": [1, 3], "2026-11-12": [0, 3], "2026-11-13": [3, 3] });

  it("totals steps and days over a range", () => {
    const s = summarize(d, "2026-11-10", "2026-11-13", "2026-11-10", "2026-11-20");
    expect(s).toEqual({ due: 12, done: 7, percent: 58, recordedDays: 4, perfectDays: 2 });
  });
  it("never counts days before the routine was approved", () => {
    const s = summarize(d, "2026-11-01", "2026-11-13", "2026-11-12", "2026-11-20");
    expect(s.due).toBe(6);
    expect(s.done).toBe(3);
  });
  it("doesn't count today until it is over", () => {
    const s = summarize(d, "2026-11-10", "2026-11-13", "2026-11-10", "2026-11-13");
    expect(s.due).toBe(9);
    expect(s.perfectDays).toBe(1);
  });
  it("leaves days with no record out instead of counting them as missed", () => {
    const s = summarize(days({ "2026-11-10": [3, 3] }), "2026-11-10", "2026-11-15", "2026-11-10", "2026-11-20");
    expect(s).toEqual({ due: 3, done: 3, percent: 100, recordedDays: 1, perfectDays: 1 });
  });
  it("has no percentage when nothing was due", () => {
    expect(summarize(new Map(), "2026-11-10", "2026-11-13", "2026-11-10", "2026-11-20").percent).toBeNull();
  });
});

describe("monthCells", () => {
  const ctx = { today: "2026-11-24", start: "2026-11-02", scheduledWeekdays: everyDay };

  it("starts on the right weekday and has every day of the month", () => {
    const cells = monthCells("2026-11", new Map(), ctx);
    // 1 November 2026 is a Sunday: six blanks, then the 1st.
    expect(cells.slice(0, 6).every((c) => c === null)).toBe(true);
    expect(cells[6]?.day).toBe(1);
    expect(cells.filter(Boolean)).toHaveLength(30);
  });
  it("marks each day by what happened", () => {
    const cells = monthCells("2026-11", days({ "2026-11-03": [2, 2], "2026-11-04": [1, 2] }), ctx).filter(Boolean);
    const get = (n: number) => cells.find((c) => c!.day === n)!;
    expect(get(1).state).toBe("before");
    expect(get(3).state).toBe("all");
    expect(get(4).state).toBe("some");
    expect(get(24).state).toBe("today");
    expect(get(25).state).toBe("future");
  });
});

describe("monthRows", () => {
  it("lists months from the start through this one, with this one marked", () => {
    const rows = monthRows(days({ "2026-10-30": [2, 2], "2026-11-02": [1, 2] }), "2026-10-29", "2026-11-24");
    expect(rows.map((r) => r.key)).toEqual(["2026-10", "2026-11"]);
    expect(rows[0].summary.percent).toBe(100);
    expect(rows[1].summary.percent).toBe(50);
    expect(rows[1].inProgress).toBe(true);
    expect(rows[0].inProgress).toBe(false);
  });
  it("keeps only the latest twelve months", () => {
    const rows = monthRows(new Map(), "2024-01-05", "2026-11-24", 12);
    expect(rows).toHaveLength(12);
    expect(rows.at(-1)?.key).toBe("2026-11");
    expect(rows[0].key).toBe("2025-12");
  });
});
