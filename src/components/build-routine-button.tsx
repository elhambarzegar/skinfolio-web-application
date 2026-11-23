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
      <div className={`callout ${refusal.severity === "emergency" ? "c-blush" : "c-sun"}`}>
        <p className="text-[21px] font-bold">
          {refusal.severity === "emergency" ? "This needs urgent care" : "This needs a dermatologist"}
        </p>
        <p>{refusal.concern}</p>
        <p className="font-bold">{refusal.routing}</p>
        <p className="note" style={{ color: "var(--ink)" }}>
          We didn&rsquo;t build a routine. This isn&rsquo;t something a product recommendation should weigh in on.
        </p>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="flex flex-col gap-3" aria-live="polite">
        {LOADING_STEPS.slice(0, revealedCount).map((step) => (
          <div key={step} className="flex items-center gap-3 text-[19px]">
            <span className="flex h-[30px] w-[30px] flex-none items-center justify-center rounded-full border-2 border-ink bg-mint-deep text-[16px] font-bold">
              ✓
            </span>
            {step}…
          </div>
        ))}
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-3">
      <button type="button" onClick={handleClick} className="btn btn-block">
        {label}
      </button>
      {error && (
        <p role="alert" className="callout c-blush font-bold">
          {error}
        </p>
      )}
    </div>
  );
}
