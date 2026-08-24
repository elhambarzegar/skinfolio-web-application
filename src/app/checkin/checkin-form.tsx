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
  const [adherence, setAdherence] = useState<"DONE" | "SKIPPED">("DONE");
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
        body: JSON.stringify({ timeOfDay, adherence, symptomsText }),
      });
      const data = await res.json();

      if (!res.ok) {
        setError(data.error ?? "Something went wrong.");
        setSubmitting(false);
        return;
      }

      if (data.severity === "normal") {
        router.push("/dashboard");
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
      <div className="flex-1 flex items-center justify-center px-6 py-16">
        <div
          className={`max-w-md w-full border rounded-[10px] p-5 ${
            emergency ? "border-danger/50 bg-danger/10" : "border-warn/50 bg-warn/10"
          }`}
        >
          <p className="text-[16px] font-bold text-ink">
            {emergency ? "This may need urgent care" : "This is worth getting checked"}
          </p>
          <p className="mt-2 text-[14px] text-ink-2 leading-relaxed">{result.reasoning}</p>
          <p className="mt-3 text-[14px] text-ink font-semibold">
            {emergency
              ? "Seek emergency medical care now if symptoms are severe."
              : "Consider seeing a dermatologist about this before continuing the routine."}
          </p>
          <p className="mt-3 text-[12px] text-ink-3">
            We&rsquo;ve paused your routine and saved this check-in — nothing else happens
            automatically.
          </p>
          <Link
            href="/dashboard"
            className="mt-4 inline-block text-[14px] font-bold bg-accent text-accent-ink px-5 py-2 rounded-[6px]"
          >
            Back to dashboard
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 flex flex-col">
      <header className="px-6 sm:px-10 py-5 border-b border-line">
        <Link href="/dashboard" className="text-[15px] font-bold tracking-tight text-ink">
          Skinfolio
        </Link>
      </header>

      <main className="flex-1 flex items-center justify-center px-6 py-16">
        <form onSubmit={handleSubmit} className="w-full max-w-sm">
          <h1 className="text-[24px] font-bold text-ink">Daily check-in</h1>
          {routinePaused && (
            <p className="mt-1 text-[13px] text-warn">
              Your routine is currently paused from an earlier check-in.
            </p>
          )}

          <div className="mt-6">
            <span className="text-[13px] font-semibold text-ink-2">Time of day</span>
            <div className="mt-1.5 flex gap-2">
              {(["AM", "PM"] as const).map((t) => (
                <button
                  key={t}
                  type="button"
                  onClick={() => setTimeOfDay(t)}
                  className={`text-[14px] font-semibold px-4 py-2 rounded-[6px] border ${
                    timeOfDay === t
                      ? "bg-accent text-accent-ink border-accent"
                      : "bg-bg-raise text-ink-2 border-line hover:border-accent"
                  }`}
                >
                  {t === "AM" ? "Morning" : "Evening"}
                </button>
              ))}
            </div>
          </div>

          <div className="mt-5">
            <span className="text-[13px] font-semibold text-ink-2">Did you do your routine?</span>
            <div className="mt-1.5 flex gap-2">
              {(["DONE", "SKIPPED"] as const).map((a) => (
                <button
                  key={a}
                  type="button"
                  onClick={() => setAdherence(a)}
                  className={`text-[14px] font-semibold px-4 py-2 rounded-[6px] border ${
                    adherence === a
                      ? "bg-accent text-accent-ink border-accent"
                      : "bg-bg-raise text-ink-2 border-line hover:border-accent"
                  }`}
                >
                  {a === "DONE" ? "Done" : "Skipped"}
                </button>
              ))}
            </div>
          </div>

          <div className="mt-5">
            <span className="text-[13px] font-semibold text-ink-2">
              How does your skin feel? (optional)
            </span>
            <textarea
              value={symptomsText}
              onChange={(e) => setSymptomsText(e.target.value)}
              rows={4}
              placeholder="e.g. No issues, skin feels normal. Or describe anything unusual."
              className="mt-1.5 w-full border border-line rounded-[6px] px-3 py-2.5 text-[14px] text-ink bg-bg-raise outline-none focus:border-accent resize-none"
            />
          </div>

          {error && (
            <p className="mt-4 text-[13px] text-danger border border-danger/40 bg-danger/10 rounded-[6px] px-3 py-2">
              {error}
            </p>
          )}

          <button
            type="submit"
            disabled={submitting}
            className="mt-6 text-[15px] font-bold bg-accent text-accent-ink px-6 py-2.5 rounded-[6px] hover:opacity-90 disabled:opacity-50"
          >
            {submitting ? "Saving…" : "Save check-in"}
          </button>
        </form>
      </main>
    </div>
  );
}
