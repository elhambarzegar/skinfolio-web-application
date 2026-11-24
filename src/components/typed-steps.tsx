"use client";

import { useEffect, useState } from "react";
import { typedFrame } from "@/lib/typedSteps";

const TICK_MS = 50;
/** After this long on the final line, reassure the person that it is still working. */
const PATIENCE_NOTE_AFTER_MS = 20_000;
/** With reduced motion there is no typing: lines just appear, one every few seconds. */
const REDUCED_STEP_MS = 3500;

/** Splits typed text into words and the spaces after them, remembering where each starts. */
function typedWords(typed: string): { start: number; word: string; space: string }[] {
  const out: { start: number; word: string; space: string }[] = [];
  for (const m of typed.matchAll(/(\S+)(\s*)/g)) out.push({ start: m.index ?? 0, word: m[1], space: m[2] });
  return out;
}

/**
 * Progress lines that type themselves in, one after another, to cover the
 * wait while the agent works. Letters fade in one by one, then the dots are
 * typed and erased three times before the line is ticked and the next begins.
 * The last line keeps going until this component is removed.
 */
export function TypedSteps({ lines, label }: { lines: readonly string[]; label: string }) {
  const [clock, setClock] = useState({ elapsed: 0, reduced: false });

  useEffect(() => {
    const start = Date.now();
    const id = setInterval(() => {
      const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
      setClock({ elapsed: Date.now() - start, reduced });
    }, TICK_MS);
    return () => clearInterval(id);
  }, []);

  let doneCount: number;
  let activeIndex: number;
  let chars: number;
  let dots: number;
  let waitingMs: number;

  if (clock.reduced) {
    activeIndex = Math.min(Math.floor(clock.elapsed / REDUCED_STEP_MS), lines.length - 1);
    doneCount = activeIndex;
    chars = lines[activeIndex]?.length ?? 0;
    dots = 3;
    waitingMs = activeIndex === lines.length - 1 ? clock.elapsed - activeIndex * REDUCED_STEP_MS : 0;
  } else {
    const frame = typedFrame(lines, clock.elapsed);
    doneCount = frame.doneCount;
    activeIndex = frame.active?.index ?? lines.length - 1;
    chars = frame.active?.chars ?? 0;
    dots = frame.active?.dots ?? 0;
    waitingMs = frame.waitingMs;
  }

  const visible = lines.slice(0, activeIndex + 1);

  return (
    <div>
      {/* Screen readers get one calm sentence instead of every letter being announced. */}
      <p role="status" className="sr-only">
        {label}
      </p>

      <div aria-hidden="true" className="flex flex-col gap-4">
        {visible.map((text, i) => {
          const done = i < doneCount;
          return (
            <div key={text} className="flex items-start gap-3 text-[20px] leading-snug">
              <span
                className={`mt-px flex h-[30px] w-[30px] flex-none items-center justify-center rounded-full text-[16px] font-bold ${
                  done ? "bg-mint-deep" : "border-[1.5px] border-edge bg-paper"
                }`}
              >
                {done ? "✓" : ""}
              </span>
              <span>
                {done ? (
                  text
                ) : (
                  <>
                    {typedWords(text.slice(0, chars)).map((w) => (
                      // Words stay whole when the line wraps (the line can only break at
                      // the space after one); each letter still fades in on its own.
                      <span key={w.start}>
                        <span className="whitespace-nowrap">
                          {w.word.split("").map((c, k) => (
                            <span key={k} className="tchar">
                              {c}
                            </span>
                          ))}
                        </span>
                        {w.space.split("").map((c, k) => (
                          <span key={`s${k}`} className="tchar">
                            {c}
                          </span>
                        ))}
                      </span>
                    ))}
                    {/* Always three dot slots, so the line never jumps as dots come and go. */}
                    {[0, 1, 2].map((d) => (
                      <span key={d} style={{ opacity: chars === text.length && d < dots ? 1 : 0 }}>
                        .
                      </span>
                    ))}
                  </>
                )}
              </span>
            </div>
          );
        })}

        {waitingMs > PATIENCE_NOTE_AFTER_MS && (
          <p className="sub tchar ml-[42px]">Still working. A careful routine can take a minute or two.</p>
        )}
      </div>
    </div>
  );
}
