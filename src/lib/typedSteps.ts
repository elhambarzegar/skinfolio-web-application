/**
 * Timeline for the "typing" progress lines shown while the routine agent
 * works. Pure maths on elapsed time, so it can be tested without a browser.
 *
 * Each line: letters appear one by one, a short pause, then the dots are
 * typed and erased three times, then the line is ticked and the next starts.
 * The last line never finishes by itself: its dots keep cycling until the
 * real answer arrives, however long that takes.
 */

export const TIMING = {
  charMs: 45,
  pauseMs: 300,
  dotTypeMs: 280, // per dot typed
  dotHoldMs: 350,
  dotEraseMs: 140, // per dot erased
  dotGapMs: 160, // empty beat before the next cycle
  cycles: 3,
} as const;

const CYCLE_MS =
  3 * TIMING.dotTypeMs + TIMING.dotHoldMs + 3 * TIMING.dotEraseMs + TIMING.dotGapMs;

export type TypedFrame = {
  /** Lines already finished (ticked). */
  doneCount: number;
  /** The line being typed, or null once every line is done (never happens for the last line). */
  active: { index: number; chars: number; dots: number } | null;
  /** How long the final line has been waiting, in ms (0 before it starts). */
  waitingMs: number;
};

export function lineDurationMs(text: string): number {
  return text.length * TIMING.charMs + TIMING.pauseMs + TIMING.cycles * CYCLE_MS;
}

/** 0–3 dots visible at a moment within one dot cycle. */
export function dotsAt(cycleMs: number): number {
  const t = ((cycleMs % CYCLE_MS) + CYCLE_MS) % CYCLE_MS;
  const typedEnd = 3 * TIMING.dotTypeMs;
  const holdEnd = typedEnd + TIMING.dotHoldMs;
  if (t < typedEnd) return Math.floor(t / TIMING.dotTypeMs) + 1;
  if (t < holdEnd) return 3;
  const erased = Math.floor((t - holdEnd) / TIMING.dotEraseMs);
  return Math.max(0, 3 - (erased + 1));
}

export function typedFrame(lines: readonly string[], elapsedMs: number): TypedFrame {
  if (lines.length === 0) return { doneCount: 0, active: null, waitingMs: 0 };

  let start = 0;
  for (let i = 0; i < lines.length; i++) {
    const text = lines[i];
    const isLast = i === lines.length - 1;
    const end = start + lineDurationMs(text);

    if (isLast || elapsedMs < end) {
      const local = Math.max(0, elapsedMs - start);
      const typingMs = text.length * TIMING.charMs;
      const chars = Math.min(text.length, Math.floor(local / TIMING.charMs));
      const dotsClock = local - typingMs - TIMING.pauseMs;
      const dots = dotsClock < 0 ? 0 : dotsAt(dotsClock);
      return {
        doneCount: i,
        active: { index: i, chars, dots },
        waitingMs: isLast ? Math.max(0, local) : 0,
      };
    }
    start = end;
  }
  // Unreachable: the last line always returns above.
  return { doneCount: lines.length, active: null, waitingMs: 0 };
}
