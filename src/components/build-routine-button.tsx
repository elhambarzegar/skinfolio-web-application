"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { TypedSteps } from "@/components/typed-steps";

const LOADING_STEPS = [
  "Reading your products",
  "Looking for duplicate ingredients",
  "Checking ingredient interactions",
  "Finding gaps",
  "Building a routine that fits your goal",
];

export function BuildRoutineButton({ label = "Build my routine" }: { label?: string }) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [refusal, setRefusal] = useState<{
    severity: "red_flag" | "emergency";
    concern: string;
    routing: string;
  } | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function handleClick() {
    setLoading(true);
    setError(null);
    setRefusal(null);

    try {
      const res = await fetch("/api/routine", { method: "POST" });
      const data = await res.json();

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

      router.push(`/routine/${data.id}`);
      router.refresh();
    } catch {
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
    return <TypedSteps lines={LOADING_STEPS} label="Building your routine. This can take a minute or two." />;
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
