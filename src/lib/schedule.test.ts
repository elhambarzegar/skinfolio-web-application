import { describe, expect, it } from "vitest";
import { daysLabel, isScheduledOn, nextScheduledWeekday, scheduledWeekdays } from "./schedule";

describe("scheduledWeekdays", () => {
  it("gives exactly N distinct days for N times a week", () => {
    for (let n = 1; n <= 7; n++) {
      const days = scheduledWeekdays(n);
      expect(days).toHaveLength(n);
      expect(new Set(days).size).toBe(n);
      expect(days.every((d) => d >= 1 && d <= 7)).toBe(true);
    }
  });

  it("spreads days so no gap (wrapping the week) is wider than needed", () => {
    for (let n = 1; n <= 7; n++) {
      const days = [...scheduledWeekdays(n)];
      const gaps = days.map((d, i) => (i === days.length - 1 ? days[0] + 7 - d : days[i + 1] - d));
      // The widest unavoidable gap for n days in 7 is ceil(7/n).
      expect(Math.max(...gaps)).toBeLessThanOrEqual(Math.ceil(7 / n));
    }
  });

  it("three times a week is Monday, Wednesday, Friday", () => {
    expect(scheduledWeekdays(3)).toEqual([1, 3, 5]);
  });

  it("clamps nonsense to a valid schedule instead of crashing", () => {
    expect(scheduledWeekdays(0)).toHaveLength(1);
    expect(scheduledWeekdays(12)).toHaveLength(7);
    expect(scheduledWeekdays(NaN)).toHaveLength(7);
  });
});

describe("isScheduledOn", () => {
  it("daily is due every day", () => {
    for (let d = 1; d <= 7; d++) expect(isScheduledOn(7, d)).toBe(true);
  });
  it("3x/week is due Monday but not Tuesday", () => {
    expect(isScheduledOn(3, 1)).toBe(true);
    expect(isScheduledOn(3, 2)).toBe(false);
  });
});

describe("nextScheduledWeekday", () => {
  it("finds the next due day", () => {
    expect(nextScheduledWeekday(3, 1)).toBe(3);
    expect(nextScheduledWeekday(3, 3)).toBe(5);
  });
  it("wraps from the end of the week to the start", () => {
    expect(nextScheduledWeekday(3, 5)).toBe(1);
    expect(nextScheduledWeekday(1, 1)).toBe(1);
  });
  it("daily is always tomorrow", () => {
    expect(nextScheduledWeekday(7, 7)).toBe(1);
    expect(nextScheduledWeekday(7, 2)).toBe(3);
  });
});

describe("daysLabel", () => {
  it("is null for daily, so nothing is called out", () => {
    expect(daysLabel(7)).toBeNull();
  });
  it("names the days otherwise", () => {
    expect(daysLabel(3)).toBe("Mon · Wed · Fri");
    expect(daysLabel(2)).toBe("Mon · Thu");
  });
});
