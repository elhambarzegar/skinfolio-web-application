"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";

type Result = { severity: "normal" | "adverse" | "emergency"; reasoning: string } | null;

export function CheckInForm({
  suggestedTimeOfDay,
  routinePaused,
}: {
  suggestedTimeOfDay: "AM" | "PM";
  routinePaused: boolean;
}) {
  const router = useRouter();
  const [timeOfDay, setTimeOfDay] = useState<"AM" | "PM">(suggestedTimeOfDay);
  const [symptomsText, setSymptomsText] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<Result>(null);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setError(null);

    try {
      const res = await fetch("/api/checkin", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ timeOfDay, symptomsText }),
      });
      const data = await res.json();

      if (!res.ok) {
        setError(data.error ?? "Something went wrong.");
        setSubmitting(false);
        return;
      }

      if (data.severity === "normal") {
        router.push("/today");
        router.refresh();
        return;
      }

      setResult({ severity: data.severity, reasoning: data.reasoning });
      setSubmitting(false);
    } catch {
      setError("Couldn't reach the server. Check your connection and try again.");
      setSubmitting(false);
    }
  }

  if (result) {
    const emergency = result.severity === "emergency";
    return (
      <div className="flex flex-col gap-5">
        <h1 className="page-title">{emergency ? "This may need urgent care" : "This is worth getting checked"}</h1>
        <div className={`callout ${emergency ? "c-blush" : "c-sun"}`}>
          <p>{result.reasoning}</p>
          <p className="font-bold">
            {emergency
              ? "Seek emergency medical care now if symptoms are severe."
              : "Consider seeing a dermatologist about this before continuing the routine."}
          </p>
          <p className="note" style={{ color: "var(--ink)" }}>
            We&rsquo;ve paused your routine and saved this check-in. Nothing else happens automatically.
          </p>
        </div>
        <Link href="/today" className="btn btn-block">
          Back to Today
        </Link>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-5">
      <div>
        <h1 className="page-title">How does your skin feel?</h1>
        {routinePaused && <p className="sub">Your routine is paused from an earlier check-in.</p>}
      </div>

      <div className="flex flex-col gap-2">
        <span className="font-bold">Which part of the day?</span>
        <div className="seg" role="group" aria-label="Part of the day">
          {(["AM", "PM"] as const).map((t) => (
            <button key={t} type="button" aria-pressed={timeOfDay === t} onClick={() => setTimeOfDay(t)}>
              {t === "AM" ? "Morning" : "Evening"}
            </button>
          ))}
        </div>
      </div>

      <label className="flex flex-col gap-2">
        <span className="font-bold">Anything to tell us? (optional)</span>
        <textarea
          value={symptomsText}
          onChange={(e) => setSymptomsText(e.target.value)}
          rows={5}
          placeholder="e.g. Feels fine. Or describe anything unusual: redness, itching, stinging."
          className="w-full resize-none rounded-[16px] border-[1.5px] border-[#8F8697] bg-paper px-4 py-3 text-[20px] text-ink outline-none"
        />
      </label>

      {error && (
        <p role="alert" className="callout c-blush font-bold">
          {error}
        </p>
      )}

      <button type="submit" disabled={submitting} className="btn btn-block">
        {submitting ? "Saving…" : "Save"}
      </button>
    </form>
  );
}
