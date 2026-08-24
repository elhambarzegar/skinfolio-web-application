"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";

export type RoutineStepView = {
  id: string;
  timeOfDay: "AM" | "PM";
  order: number;
  rationale: string;
  ackLowConfidence: boolean | null;
  product: { id: string; brand: string; name: string };
  confidence: {
    bucket: "high" | "medium" | "low";
    score: number;
    origin: string;
    fetchedAt: string;
  } | null;
};

const BUCKET_STYLE: Record<"high" | "medium" | "low", string> = {
  high: "bg-ok/10 text-ok",
  medium: "bg-warn/10 text-warn",
  low: "bg-danger/10 text-danger",
};

const BUCKET_LABEL: Record<"high" | "medium" | "low", string> = {
  high: "High confidence",
  medium: "Medium confidence",
  low: "Low confidence",
};

function needsDecision(step: RoutineStepView): boolean {
  const isLow = !step.confidence || step.confidence.bucket === "low";
  return isLow && step.ackLowConfidence == null;
}

export function RoutineReview({
  routineId,
  status,
  rationale,
  steps: initialSteps,
}: {
  routineId: string;
  status: string;
  rationale: string;
  steps: RoutineStepView[];
}) {
  const router = useRouter();
  const [steps, setSteps] = useState(initialSteps);
  const [busyStepId, setBusyStepId] = useState<string | null>(null);
  const [accepting, setAccepting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const pendingDecisions = useMemo(() => steps.filter(needsDecision), [steps]);

  async function patchStep(stepId: string, body: Record<string, unknown>) {
    setBusyStepId(stepId);
    setError(null);
    try {
      const res = await fetch(`/api/routine/${routineId}/steps/${stepId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Something went wrong.");
        return;
      }
      if (data.removed || body.action === "remove") {
        setSteps((prev) => prev.filter((s) => s.id !== stepId));
      } else {
        setSteps((prev) =>
          prev.map((s) => (s.id === stepId ? { ...s, ackLowConfidence: true } : s))
        );
      }
      router.refresh();
    } catch {
      setError("Couldn't reach the server. Check your connection and try again.");
    } finally {
      setBusyStepId(null);
    }
  }

  async function handleAccept() {
    setAccepting(true);
    setError(null);
    try {
      const res = await fetch(`/api/routine/${routineId}/accept`, { method: "POST" });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Couldn't accept this routine.");
        setAccepting(false);
        return;
      }
      router.push("/dashboard");
      router.refresh();
    } catch {
      setError("Couldn't reach the server. Check your connection and try again.");
      setAccepting(false);
    }
  }

  const amSteps = steps.filter((s) => s.timeOfDay === "AM").sort((a, b) => a.order - b.order);
  const pmSteps = steps.filter((s) => s.timeOfDay === "PM").sort((a, b) => a.order - b.order);

  return (
    <div className="flex-1 flex flex-col">
      <header className="flex items-center justify-between px-6 sm:px-10 py-5 border-b border-line">
        <Link href="/dashboard" className="text-[15px] font-bold tracking-tight text-ink">
          Skinfolio
        </Link>
        <span className="text-[12px] font-semibold px-2.5 py-1 rounded-full bg-chip text-ink-2 uppercase tracking-wide">
          {status}
        </span>
      </header>

      <main className="flex-1 px-6 sm:px-10 py-12">
        <div className="max-w-2xl mx-auto">
          <h1 className="text-[22px] font-bold text-ink">Your routine</h1>
          <p className="mt-2 text-[14px] text-ink-2 leading-relaxed whitespace-pre-line">
            {rationale}
          </p>

          {steps.length === 0 ? (
            <p className="mt-8 text-[14px] text-ink-3">
              No steps yet — add products in your intake and rebuild.
            </p>
          ) : (
            <div className="mt-8 flex flex-col gap-8">
              {(
                [
                  ["Morning", amSteps],
                  ["Evening", pmSteps],
                ] as const
              ).map(([label, group]) =>
                group.length === 0 ? null : (
                  <section key={label}>
                    <h2 className="text-[12px] font-bold tracking-[0.08em] uppercase text-ink-3">
                      {label}
                    </h2>
                    <div className="mt-3 flex flex-col gap-3">
                      {group.map((step) => (
                        <div
                          key={step.id}
                          className="bg-bg-raise border border-line rounded-[10px] p-4"
                        >
                          <div className="flex items-start justify-between gap-3">
                            <div>
                              <div className="text-[14px] font-bold text-ink">
                                {step.order}. {step.product.brand} — {step.product.name}
                              </div>
                              <p className="mt-1 text-[13px] text-ink-2 leading-relaxed">
                                {step.rationale}
                              </p>
                            </div>
                            {status === "DRAFT" && (
                              <button
                                type="button"
                                disabled={busyStepId === step.id}
                                onClick={() => patchStep(step.id, { action: "remove" })}
                                className="text-[12px] text-ink-3 hover:text-danger whitespace-nowrap disabled:opacity-40"
                              >
                                Remove
                              </button>
                            )}
                          </div>

                          {step.confidence && (
                            <span
                              className={`mt-2 inline-block text-[11px] font-semibold px-2 py-0.5 rounded-full ${BUCKET_STYLE[step.confidence.bucket]}`}
                            >
                              {BUCKET_LABEL[step.confidence.bucket]}
                            </span>
                          )}

                          {status === "DRAFT" && needsDecision(step) && (
                            <div className="mt-3 border border-warn/40 bg-warn/10 rounded-[6px] px-3 py-2.5">
                              <p className="text-[13px] text-ink">
                                We&rsquo;re not confident about this product&rsquo;s
                                ingredients yet. Include it in your routine anyway, or
                                leave it out? Your call either way.
                              </p>
                              <div className="mt-2 flex gap-2">
                                <button
                                  type="button"
                                  disabled={busyStepId === step.id}
                                  onClick={() =>
                                    patchStep(step.id, { action: "acknowledge", include: true })
                                  }
                                  className="text-[12px] font-semibold bg-accent text-accent-ink px-3 py-1.5 rounded-[6px] disabled:opacity-50"
                                >
                                  Include anyway
                                </button>
                                <button
                                  type="button"
                                  disabled={busyStepId === step.id}
                                  onClick={() =>
                                    patchStep(step.id, { action: "acknowledge", include: false })
                                  }
                                  className="text-[12px] font-semibold text-ink-2 hover:text-ink px-3 py-1.5 rounded-[6px] border border-line disabled:opacity-50"
                                >
                                  Leave out
                                </button>
                              </div>
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  </section>
                )
              )}
            </div>
          )}

          {error && (
            <p className="mt-6 text-[13px] text-danger border border-danger/40 bg-danger/10 rounded-[6px] px-3 py-2">
              {error}
            </p>
          )}

          {status === "DRAFT" && steps.length > 0 && (
            <div className="mt-8 flex items-center gap-3">
              <button
                type="button"
                onClick={handleAccept}
                disabled={accepting || pendingDecisions.length > 0}
                className="text-[15px] font-bold bg-accent text-accent-ink px-6 py-2.5 rounded-[6px] hover:opacity-90 disabled:opacity-50"
              >
                {accepting ? "Saving…" : "Accept routine"}
              </button>
              {pendingDecisions.length > 0 && (
                <span className="text-[13px] text-ink-3">
                  Resolve {pendingDecisions.length} flagged{" "}
                  {pendingDecisions.length === 1 ? "product" : "products"} first.
                </span>
              )}
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
