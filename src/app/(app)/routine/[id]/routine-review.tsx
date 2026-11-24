"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { CATEGORY_LABEL } from "@/lib/productCategory";
import { freqPhrase } from "@/lib/schedule";
import { ProTipsList } from "@/components/pro-tips-list";
import type { ProTipView } from "@/components/pro-tip-card";
import { AddProductModal } from "@/components/add-product-modal";

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

const CONFIDENCE_BADGE: Record<"high" | "medium" | "low", { cls: string; text: string }> = {
  high: { cls: "b-ok", text: "✓ High confidence" },
  medium: { cls: "b-time", text: "Medium confidence" },
  low: { cls: "b-out", text: "Low confidence" },
};

const PROPOSAL_BADGE: Record<RoutineStepView["proposal"], { cls: string; text: string } | null> = {
  KEEP: null,
  ADD: { cls: "b-new", text: "Suggested addition" },
  REMOVE: { cls: "b-out", text: "Suggested removal" },
  CHANGE: { cls: "b-new", text: "Suggested change" },
};

const BUDGET_LABEL: Record<RoutineStepView["budgetAdjustment"], string> = {
  NONE: "",
  FREQUENCY_REDUCED: "Used less often to save money",
  DROPPED_FOR_BUDGET: "Left out to save money",
};

const STATUS_LABEL: Record<string, string> = {
  ACTIVE: "In use",
  PAUSED: "Paused",
  DRAFT: "Waiting for your OK",
};

function needsDecision(step: RoutineStepView): boolean {
  // A described gap ("ADD") has no owned product to have low-confidence
  // ingredient data about — that ack flow doesn't apply to it.
  if (!step.product) return false;
  const isLow = !step.confidence || step.confidence.bucket === "low";
  return isLow && step.ackLowConfidence == null;
}

export function RoutineReview({
  routineId,
  status,
  rationale,
  overviewSourceLinks,
  steps,
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
  const [, startRefresh] = useTransition();
  const [period, setPeriod] = useState<"AM" | "PM">(steps.some((s) => s.timeOfDay === "AM") ? "AM" : "PM");
  const [busyStepId, setBusyStepId] = useState<string | null>(null);
  const [accepting, setAccepting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [addingFor, setAddingFor] = useState<ProTipView | null>(null);
  // Open at first if anything needs deciding, then stays however the person leaves it.
  const [tipsOpen, setTipsOpen] = useState(() => proTips.some((t) => t.status === "PENDING"));

  const pendingDecisions = useMemo(() => steps.filter(needsDecision), [steps]);
  const pendingTips = proTips.filter((t) => t.status === "PENDING").length;

  // The page always shows what the server has, so there's nothing to keep in
  // step by hand: after any change, ask for the fresh data.
  const refresh = () => startRefresh(() => router.refresh());

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
      refresh();
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

  const shown = steps.filter((s) => s.timeOfDay === period).sort((a, b) => a.order - b.order);
  const count = (p: "AM" | "PM") => steps.filter((s) => s.timeOfDay === p).length;

  return (
    <div className="flex flex-col gap-5">
      <div>
        <p className="eyebrow">{STATUS_LABEL[status] ?? status}</p>
        <h1 className="page-title">Your routine</h1>
      </div>

      {status === "DRAFT" && (
        <div className="callout c-sun">
          <h2>Look it over, then approve it</h2>
          <p>Nothing starts until you approve it.</p>
        </div>
      )}

      {/* Part 1 — brief overview */}
      <div className="card flex flex-col gap-3">
        <p className="eyebrow">In short</p>
        <p className="whitespace-pre-line text-[20px] leading-relaxed">{rationale}</p>
        {overviewSourceLinks.length > 0 && (
          <p className="note">
            Based on:{" "}
            {overviewSourceLinks.map((s, i) => (
              <span key={s.url}>
                <a href={s.url} target="_blank" rel="noopener noreferrer" className="underline underline-offset-4">
                  {s.label}
                </a>
                {i < overviewSourceLinks.length - 1 ? "; " : ""}
              </span>
            ))}
          </p>
        )}
      </div>

      {/* Part 2 — Pro Tips */}
      {proTips.length > 0 && (
        <details className="acc" open={tipsOpen} onToggle={(e) => setTipsOpen(e.currentTarget.open)}>
          <summary>
            <span>
              Pro Tips
              {pendingTips > 0 && <span className="count ml-2 font-normal text-ink-2">{pendingTips} to decide</span>}
            </span>
          </summary>
          <div className="acc-body">
            <p className="note">
              Each one is optional. You can approve your routine without answering all of them.
            </p>
            <ProTipsList tips={proTips} onAddProduct={setAddingFor} onTipResolved={() => refresh()} />
          </div>
        </details>
      )}

      {/* Part 3 — the routine itself */}
      {steps.length === 0 ? (
        <p className="sub">No steps yet. Add products to your shelf and build again.</p>
      ) : (
        <>
          <div className="seg" role="group" aria-label="Part of the day">
            {(["AM", "PM"] as const).map((p) => (
              <button key={p} type="button" aria-pressed={period === p} onClick={() => setPeriod(p)}>
                {p === "AM" ? "Morning" : "Evening"}
                <span className="count">{count(p)}</span>
              </button>
            ))}
          </div>

          {shown.length === 0 ? (
            <p className="sub">Nothing in your {period === "AM" ? "morning" : "evening"} routine.</p>
          ) : (
            <div className="steps">
              {shown.map((step, index) => {
                const proposal = PROPOSAL_BADGE[step.proposal];
                const confidence = step.confidence ? CONFIDENCE_BADGE[step.confidence.bucket] : null;
                const category = step.product?.step ?? step.suggestedCategory ?? "";
                return (
                  <div key={step.id} className="step">
                    <div className="step-top">
                      <span className="step-num">{index + 1}</span>
                      <div className="flex min-w-0 flex-1 flex-col gap-1">
                        {step.product ? (
                          <>
                            <h3>{step.product.name}</h3>
                            <p className="brand">{step.product.brand}</p>
                          </>
                        ) : (
                          <>
                            <h3>A product to add</h3>
                            {step.suggestedDescription && <p className="brand">Look for: {step.suggestedDescription}</p>}
                          </>
                        )}
                      </div>
                    </div>

                    <div className="badges">
                      {category && <span className="badge b-cat">{CATEGORY_LABEL[category] ?? category}</span>}
                      <span className="badge b-freq">{freqPhrase(step.frequencyPerWeek)}</span>
                      {step.timeCostMinutes != null && <span className="badge b-time">~{step.timeCostMinutes} min</span>}
                      {proposal && <span className={`badge ${proposal.cls}`}>{proposal.text}</span>}
                      {confidence && <span className={`badge ${confidence.cls}`}>{confidence.text}</span>}
                    </div>

                    <details className="why">
                      <summary>Why this step</summary>
                      <div className="why-body">
                        <p className="text-[19px] leading-relaxed">{step.rationale}</p>
                        {step.proposal === "CHANGE" && (step.suggestedDescription || step.alternativeFrequency) && (
                          <p className="text-[19px] font-bold">
                            Suggested:{" "}
                            {step.suggestedDescription ? `look for ${step.suggestedDescription}` : null}
                            {step.suggestedDescription && step.alternativeFrequency ? ", " : ""}
                            {step.alternativeFrequency ? freqPhrase(step.alternativeFrequency) : null}
                          </p>
                        )}
                        {step.budgetAdjustment !== "NONE" && (
                          <p className="note">
                            {BUDGET_LABEL[step.budgetAdjustment]}
                            {step.budgetAdjustmentReason ? `: ${step.budgetAdjustmentReason}` : ""}
                          </p>
                        )}
                        {step.ruleLabel && (
                          <p className="note">
                            Source:{" "}
                            <a
                              href={step.ruleUrl ?? undefined}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="underline underline-offset-4"
                            >
                              {step.ruleLabel}
                            </a>
                          </p>
                        )}
                      </div>
                    </details>

                    {status === "DRAFT" && needsDecision(step) && (
                      <div className="callout c-sun">
                        <p className="text-[19px]">
                          We&rsquo;re not confident about this product&rsquo;s ingredients yet. Include it in your routine
                          anyway, or leave it out? Your call either way.
                        </p>
                        <div className="flex flex-col gap-2 sm:flex-row">
                          <button
                            type="button"
                            disabled={busyStepId === step.id}
                            onClick={() => patchStep(step.id, { action: "acknowledge", include: true })}
                            className="btn btn-sm flex-1"
                          >
                            Include anyway
                          </button>
                          <button
                            type="button"
                            disabled={busyStepId === step.id}
                            onClick={() => patchStep(step.id, { action: "acknowledge", include: false })}
                            className="btn btn-2 btn-sm flex-1"
                          >
                            Leave out
                          </button>
                        </div>
                      </div>
                    )}

                    {status === "DRAFT" && (
                      <button
                        type="button"
                        disabled={busyStepId === step.id}
                        onClick={() => patchStep(step.id, { action: "remove" })}
                        className="link-btn self-start text-danger"
                      >
                        Remove from routine
                      </button>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </>
      )}

      {error && (
        <p role="alert" className="callout c-blush font-bold">
          {error}
        </p>
      )}

      {status === "DRAFT" && steps.length > 0 && (
        <div className="flex flex-col gap-2">
          <button
            type="button"
            onClick={handleAccept}
            disabled={accepting || pendingDecisions.length > 0}
            className="btn btn-ok btn-block"
          >
            {accepting ? "Saving…" : "Approve this routine"}
          </button>
          {pendingDecisions.length > 0 && (
            <p className="note">
              Decide on {pendingDecisions.length} flagged {pendingDecisions.length === 1 ? "product" : "products"} first.
            </p>
          )}
        </div>
      )}

      {addingFor && (
        <AddProductModal
          routineId={routineId}
          fill={{ stepId: addingFor.stepId, description: addingFor.shopQuery ?? addingFor.summary }}
          onClose={() => setAddingFor(null)}
        />
      )}
    </div>
  );
}
