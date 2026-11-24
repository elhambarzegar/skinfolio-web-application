import { describe, expect, it } from "vitest";
import { dotsAt, lineDurationMs, typedFrame, TIMING } from "./typedSteps";

const LINES = ["Reading your products", "Finding gaps", "Building a routine"];

describe("typedFrame", () => {
  it("starts with nothing typed on the first line", () => {
    expect(typedFrame(LINES, 0)).toEqual({ doneCount: 0, active: { index: 0, chars: 0, dots: 0 }, waitingMs: 0 });
  });

  it("types one letter every charMs", () => {
    expect(typedFrame(LINES, TIMING.charMs * 5).active?.chars).toBe(5);
  });

  it("shows no dots until the whole line is typed and the pause is over", () => {
    const typed = LINES[0].length * TIMING.charMs;
    expect(typedFrame(LINES, typed).active).toMatchObject({ chars: LINES[0].length, dots: 0 });
    expect(typedFrame(LINES, typed + TIMING.pauseMs - 1).active?.dots).toBe(0);
    expect(typedFrame(LINES, typed + TIMING.pauseMs + 1).active?.dots).toBe(1);
  });

  it("moves to the next line, ticking the first, after its dots have cycled three times", () => {
    const first = lineDurationMs(LINES[0]);
    expect(typedFrame(LINES, first - 1).doneCount).toBe(0);
    const next = typedFrame(LINES, first + 1);
    expect(next.doneCount).toBe(1);
    expect(next.active?.index).toBe(1);
    expect(next.active?.chars).toBe(0);
  });

  it("keeps the last line alive forever instead of finishing", () => {
    const all = LINES.slice(0, -1).reduce((n, l) => n + lineDurationMs(l), 0);
    for (const extra of [0, 60_000, 10 * 60_000]) {
      const f = typedFrame(LINES, all + extra);
      expect(f.doneCount).toBe(LINES.length - 1);
      expect(f.active?.index).toBe(LINES.length - 1);
    }
    expect(typedFrame(LINES, all + 25_000).waitingMs).toBe(25_000);
  });

  it("does not crash on no lines or negative time", () => {
    expect(typedFrame([], 1000).active).toBeNull();
    expect(typedFrame(LINES, -50).active?.chars).toBe(0);
  });
});

describe("dotsAt", () => {
  it("types up to three dots, holds, then erases back to none", () => {
    const seen: number[] = [];
    for (let t = 0; t < 2000; t += 20) {
      const d = dotsAt(t);
      if (seen[seen.length - 1] !== d) seen.push(d);
    }
    expect(seen.slice(0, 7)).toEqual([1, 2, 3, 2, 1, 0, 1]);
  });

  it("never shows fewer than 0 or more than 3 dots", () => {
    for (let t = -500; t < 20_000; t += 37) {
      const d = dotsAt(t);
      expect(d).toBeGreaterThanOrEqual(0);
      expect(d).toBeLessThanOrEqual(3);
    }
  });
});
