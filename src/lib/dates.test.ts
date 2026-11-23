import { describe, expect, it } from "vitest";
import { defaultPeriod, localNow, longDate, safeTimezone } from "./dates";

describe("localNow", () => {
  it("uses the user's own calendar day, not the server's", () => {
    // 07:59 UTC on Mon 23 Nov 2026 is still Sunday night in Vancouver (UTC-8).
    const instant = new Date("2026-11-23T07:59:00Z");
    expect(localNow("America/Vancouver", instant)).toEqual({ date: "2026-11-22", weekday: 7, hour: 23 });
    expect(localNow("UTC", instant)).toEqual({ date: "2026-11-23", weekday: 1, hour: 7 });
  });

  it("rolls forward for zones ahead of UTC", () => {
    // 12:00 UTC Sunday is already Monday 01:00 in Auckland (UTC+13 in November).
    const instant = new Date("2026-11-22T12:00:00Z");
    expect(localNow("Pacific/Auckland", instant)).toEqual({ date: "2026-11-23", weekday: 1, hour: 1 });
  });

  it("reports midnight as hour 0, never 24", () => {
    const instant = new Date("2026-11-23T08:00:00Z"); // 00:00 Monday in Vancouver
    expect(localNow("America/Vancouver", instant).hour).toBe(0);
  });
});

describe("safeTimezone", () => {
  it("accepts real zones", () => {
    expect(safeTimezone("America/Vancouver")).toBe("America/Vancouver");
    expect(safeTimezone("UTC")).toBe("UTC");
  });
  it("rejects junk instead of throwing", () => {
    expect(safeTimezone("Not/AZone")).toBeNull();
    expect(safeTimezone("")).toBeNull();
    expect(safeTimezone(42)).toBeNull();
    expect(safeTimezone("x".repeat(200))).toBeNull();
  });
});

describe("longDate", () => {
  it("formats in the user's zone", () => {
    const instant = new Date("2026-11-23T07:59:00Z");
    expect(longDate("America/Vancouver", instant)).toBe("Sunday, November 22");
    expect(longDate("UTC", instant)).toBe("Monday, November 23");
  });
});

describe("defaultPeriod", () => {
  it("is morning until 3pm, evening after", () => {
    expect(defaultPeriod(0)).toBe("AM");
    expect(defaultPeriod(14)).toBe("AM");
    expect(defaultPeriod(15)).toBe("PM");
    expect(defaultPeriod(23)).toBe("PM");
  });
});
