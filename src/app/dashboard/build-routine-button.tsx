"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";

const LOADING_STEPS = [
  "Reading your products",
  "Looking for duplicate ingredients",
  "Checking ingredient interactions",
  "Finding gaps",
  "Building a routine that fits your goal",
];

const STEP_INTERVAL_MS = 1800;

export function BuildRoutineButton({ label = "Build my routine" }: { label?: string }) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [revealedCount, setRevealedCount] = useState(0);
  const [refusal, setRefusal] = useState<{
    severity: "red_flag" | "emergency";
    concern: string;
    routing: string;
  } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, []);

  async function handleClick() {
    setLoading(true);
    setRevealedCount(1);
    setError(null);
    setRefusal(null);

    intervalRef.current = setInterval(() => {
      setRevealedCount((c) => Math.min(c + 1, LOADING_STEPS.length));
    }, STEP_INTERVAL_MS);

    try {
      const res = await fetch("/api/routine", { method: "POST" });
      const data = await res.json();

      if (intervalRef.current) clearInterval(intervalRef.current);

      if (!res.ok) {
        setError(data.error ?? "Something went wrong.");
        setLoading(false);
        return;
      }

      if (data.refused) {
        setRefusal(data);
        setLoading(false);
        return;
      }

      setRevealedCount(LOADING_STEPS.length);
      router.push(`/routine/${data.id}`);
      router.refresh();
    } catch {
      if (intervalRef.current) clearInterval(intervalRef.current);
      setError("Couldn't reach the server. Check your connection and try again.");
      setLoading(false);
    }
  }

  if (refusal) {
    return (
      <div
        className={`mt-6 border rounded-[10px] px-4 py-3.5 max-w-md ${
          refusal.severity === "emergency"
            ? "border-danger/50 bg-danger/10"
            : "border-warn/50 bg-warn/10"
        }`}
      >
        <p className="text-[14px] font-bold text-ink">
          {refusal.severity === "emergency" ? "This needs urgent care" : "This needs a dermatologist"}
        </p>
        <p className="mt-1 text-[13px] text-ink-2 leading-relaxed">{refusal.concern}</p>
        <p className="mt-2 text-[13px] text-ink font-semibold">{refusal.routing}</p>
        <p className="mt-3 text-[12px] text-ink-3">
          We didn&rsquo;t build a routine — this isn&rsquo;t something a product
          recommendation should weigh in on.
        </p>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="max-w-md">
        <div className="flex flex-col gap-1.5">
          {LOADING_STEPS.slice(0, revealedCount).map((step) => (
            <div key={step} className="text-[13px] flex items-center gap-2 text-ink-2">
              <span className="text-ok">✓</span>
              {step}…
            </div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div>
      <button
        type="button"
        onClick={handleClick}
        className="text-[15px] font-bold bg-accent text-accent-ink px-6 py-2.5 rounded-[6px] hover:opacity-90"
      >
        {label}
      </button>
      {error && (
        <p className="mt-3 text-[13px] text-danger border border-danger/40 bg-danger/10 rounded-[6px] px-3 py-2 max-w-md">
          {error}
        </p>
      )}
    </div>
  );
}
