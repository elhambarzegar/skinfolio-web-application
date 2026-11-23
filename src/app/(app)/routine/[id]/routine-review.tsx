"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { CATEGORY_LABEL } from "@/lib/productCategory";
import { ProTipsList } from "@/components/pro-tips-list";
import type { ProTipView } from "@/components/pro-tip-card";

export type RoutineStepView = {
  id: string;
  timeOfDay: "AM" | "PM";
  order: number;
  rationale: string;
  ackLowConfidence: boolean | null;
  // Null only for an "ADD" proposal — a described gap, nothing owned yet.
  product: { id: string; brand: string; name: string; step: string } | null;
  confidence: { bucket: "high" | "medium" | "low"; score: number; origin: string; fetchedAt: string } | null;
  frequencyPerWeek: number;
  timeCostMinutes: number | null;
  ownership: "OWNED" | "NEW";
  proposal: "KEEP" | "REMOVE" | "ADD" | "CHANGE";
  proposalReason: string | null;
  ruleLabel: string | null;
  ruleUrl: string | null;
  // Brand-agnostic — the app never names a specific product to buy.
  suggestedCategory: string | null;
  suggestedDescription: string | null;
  alternativeFrequency: number | null;
  budgetAdjustment: "NONE" | "FREQUENCY_REDUCED" | "DROPPED_FOR_BUDGET";
  budgetAdjustmentReason: string | null;
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

const PROPOSAL_STYLE: Record<RoutineStepView["proposal"], string> = {
  KEEP: "bg-chip text-ink-2",
  ADD: "bg-ok/10 text-ok",
  REMOVE: "bg-danger/10 text-danger",
  CHANGE: "bg-warn/10 text-warn",
};

const PROPOSAL_LABEL: Record<RoutineStepView["proposal"], string> = {
  KEEP: "Keep",
  ADD: "Suggested addition",
  REMOVE: "Suggested removal",
  CHANGE: "Suggested change",
};

const BUDGET_LABEL: Record<RoutineStepView["budgetAdjustment"], string> = {
  NONE: "",
  FREQUENCY_REDUCED: "Frequency reduced for budget",
  DROPPED_FOR_BUDGET: "Dropped for budget",
};

function needsDecision(step: RoutineStepView): boolean {
  // A described gap ("ADD") has no owned product to have low-confidence
  // ingredient data about — that ack flow doesn't apply to it.
  if (!step.product) return false;
  const isLow = !step.confidence || step.confidence.bucket === "low";
  return isLow && step.ackLowConfidence == null;
}

function freqLabel(n: number): string {
  return n >= 7 ? "Daily" : `${n}x/week`;
}

export function RoutineReview({
  routineId,
  status,
  rationale,
  overviewSourceLinks,
  steps: initialSteps,
  proTips,
}: {
  routineId: string;
  status: string;
  rationale: string;
  overviewSourceLinks: { label: string; url: string }[];
  steps: RoutineStepView[];
  proTips: ProTipView[];
}) {
  const router = useRouter();
  const [steps, setSteps] = useState(initialSteps);
  const [busyStepId, setBusyStepId] = useState<string | null>(null);
  const [accepting, setAccepting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const pendingDecisions = useMemo(() => steps.filter(needsDecision), [steps]);

  // Mirrors the server's resolution logic in api/routine/[id]/protips/[tipId]/respond
  // so the routine card updates immediately instead of waiting on a reload.
  // Nothing here ever names a specific product — there's nothing concrete
  // to swap in, so a CHANGE tip only ever settles frequency, never product.
  function handleTipResolved(tip: ProTipView, status: "ACCEPTED" | "REJECTED") {
    setSteps((prev) =>
      prev.flatMap((s) => {
        if (s.id !== tip.stepId) return [s];
        switch (tip.actionType) {
          case "ADD":
            // Nothing to keep without a real product either way.
            return [];
          case "REMOVE":
            return status === "ACCEPTED" ? [] : [{ ...s, proposal: "KEEP" as const }];
          case "CHANGE": {
            const applyFrequency = status === "ACCEPTED" && s.alternativeFrequency;
            return [
              {
                ...s,
                proposal: "KEEP" as const,
                frequencyPerWeek: applyFrequency ? s.alternativeFrequency! : s.frequencyPerWeek,
                alternativeFrequency: null,
                suggestedDescription: null,
              },
            ];
          }
          case "KEEP":
            return [s];
        }
      })
    );
    router.refresh();
  }

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
        setSteps((prev) => prev.map((s) => (s.id === stepId ? { ...s, ackLowConfidence: true } : s)));
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
      router.push("/today");
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
      <main className="flex-1">
        <div>
          <div className="mb-4">
            <span
              className={`badge ${status === "ACTIVE" ? "b-ok" : status === "PAUSED" ? "b-out" : "b-new"}`}
            >
              {status === "ACTIVE" ? "In use" : status === "PAUSED" ? "Paused" : "Waiting for your OK"}
            </span>
          </div>
          {/* Part 1 — brief overview */}
          <h1 className="text-[22px] font-bold text-ink">Your routine</h1>
          <p className="mt-2 text-[14px] text-ink-2 leading-relaxed whitespace-pre-line">{rationale}</p>
          {overviewSourceLinks.length > 0 && (
            <p className="mt-2 text-[12px] text-ink-3">
              Sources:{" "}
              {overviewSourceLinks.map((s, i) => (
                // Index key: order is stable, and two different rules can
                // legitimately cite the same URL (e.g. rules 2 and 3 both
                // source the AAD retinoid page), so the url isn't unique.
                <span key={i}>
                  <a href={s.url} target="_blank" rel="noopener noreferrer" className="text-accent hover:underline">
                    {s.label}
                  </a>
                  {i < overviewSourceLinks.length - 1 ? ", " : ""}
                </span>
              ))}
            </p>
          )}

          {/* Part 2 — Pro Tips */}
          {proTips.length > 0 && (
            <div className="mt-8">
              <h2 className="text-[12px] font-bold tracking-[0.08em] uppercase text-ink-3">Pro Tips</h2>
              <p className="mt-1 text-[12px] text-ink-3">
                Accept or reject each one — the routine below updates as you go. You can finalize the
                routine anytime without responding to all of them.
              </p>
              <div className="mt-3">
                <ProTipsList tips={proTips} onTipResolved={handleTipResolved} />
              </div>
            </div>
          )}

          {/* Part 3 — the routine card */}
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
                    <h2 className="text-[12px] font-bold tracking-[0.08em] uppercase text-ink-3">{label}</h2>
                    <div className="mt-3 flex flex-col gap-3">
                      {group.map((step) => (
                        <div key={step.id} className="bg-bg-raise border border-line rounded-[10px] p-4">
                          <div className="flex items-start justify-between gap-3">
                            <div>
                              <div className="text-[14px] font-bold text-ink">
                                {step.order}.{" "}
                                {step.product ? (
                                  `${step.product.brand} — ${step.product.name}`
                                ) : (
                                  <span className="text-ink-2 font-semibold italic">Suggested addition — not yet added</span>
                                )}
                              </div>
                              <div className="mt-1 flex flex-wrap items-center gap-1.5">
                                <span className="text-[11px] font-semibold px-2 py-0.5 rounded-full bg-chip text-ink-2">
                                  {CATEGORY_LABEL[step.product?.step ?? step.suggestedCategory ?? ""] ?? step.product?.step ?? step.suggestedCategory}
                                </span>
                                <span className="text-[11px] font-semibold px-2 py-0.5 rounded-full bg-chip text-ink-2">
                                  {freqLabel(step.frequencyPerWeek)}
                                </span>
                                {step.timeCostMinutes != null && (
                                  <span className="text-[11px] font-semibold px-2 py-0.5 rounded-full bg-chip text-ink-2">
                                    ~{step.timeCostMinutes} min
                                  </span>
                                )}
                                <span className="text-[11px] font-semibold px-2 py-0.5 rounded-full bg-chip text-ink-2">
                                  {step.ownership === "OWNED" ? "Owned" : "New suggestion"}
                                </span>
                                <span
                                  className={`text-[11px] font-semibold px-2 py-0.5 rounded-full ${PROPOSAL_STYLE[step.proposal]}`}
                                >
                                  {PROPOSAL_LABEL[step.proposal]}
                                </span>
                              </div>
                              <p className="mt-2 text-[13px] text-ink-2 leading-relaxed">{step.rationale}</p>

                              {step.proposal === "ADD" && step.suggestedDescription && (
                                <p className="mt-1.5 text-[12px] text-ok">
                                  Look for: {step.suggestedDescription}
                                </p>
                              )}

                              {step.proposal === "CHANGE" && (step.suggestedDescription || step.alternativeFrequency) && (
                                <p className="mt-1.5 text-[12px] text-warn">
                                  Suggested:{" "}
                                  {step.suggestedDescription ? `look for ${step.suggestedDescription}` : null}
                                  {step.suggestedDescription && step.alternativeFrequency ? ", " : ""}
                                  {step.alternativeFrequency ? freqLabel(step.alternativeFrequency) : null}
                                </p>
                              )}

                              <p className="mt-1.5 text-[11px] text-ink-3">
                                Rule cited: {step.ruleLabel ? (
                                  <a
                                    href={step.ruleUrl ?? undefined}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="text-accent hover:underline"
                                  >
                                    {step.ruleLabel}
                                  </a>
                                ) : (
                                  "none"
                                )}
                              </p>

                              {step.budgetAdjustment !== "NONE" && (
                                <p className="mt-1 text-[11px] text-ink-3">
                                  {BUDGET_LABEL[step.budgetAdjustment]}
                                  {step.budgetAdjustmentReason ? ` — ${step.budgetAdjustmentReason}` : ""}
                                </p>
                              )}
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
                                We&rsquo;re not confident about this product&rsquo;s ingredients yet.
                                Include it in your routine anyway, or leave it out? Your call either way.
                              </p>
                              <div className="mt-2 flex gap-2">
                                <button
                                  type="button"
                                  disabled={busyStepId === step.id}
                                  onClick={() => patchStep(step.id, { action: "acknowledge", include: true })}
                                  className="text-[12px] font-semibold bg-accent text-accent-ink px-3 py-1.5 rounded-[6px] disabled:opacity-50"
                                >
                                  Include anyway
                                </button>
                                <button
                                  type="button"
                                  disabled={busyStepId === step.id}
                                  onClick={() => patchStep(step.id, { action: "acknowledge", include: false })}
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
                  Resolve {pendingDecisions.length} flagged {pendingDecisions.length === 1 ? "product" : "products"}{" "}
                  first.
                </span>
              )}
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
