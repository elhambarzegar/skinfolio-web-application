import { notFound, redirect } from "next/navigation";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { confidenceBucket } from "@/lib/productLookup/confidence";
import { productViewsFor } from "@/lib/shelf";
import { RULE_SOURCES, stripRuleNumbers } from "@/lib/routine/policy";
import { RoutineReview, type RoutineStepView } from "./routine-review";
import type { ProTipView } from "@/components/pro-tip-card";

function resolveRule(n: number | null): { label: string; url: string } | null {
  if (n === null) return null;
  const source = RULE_SOURCES[n];
  // Just the source's own name: a number from our internal list means nothing to a reader.
  return source ? { label: source.label, url: source.url } : null;
}

export default async function RoutinePage({ params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user) {
    redirect("/login");
  }

  const { id } = await params;
  const routine = await prisma.routine.findUnique({
    where: { id },
    include: {
      steps: {
        where: { active: true },
        include: { product: { include: { currentSource: true } } },
        orderBy: [{ timeOfDay: "asc" }, { order: "asc" }],
      },
      proTips: {
        // id as a tiebreaker: tips are created together, so their order must not shuffle between loads.
        orderBy: [{ createdAt: "asc" }, { id: "asc" }],
        include: { primaryStep: { select: { suggestedDescription: true, alternativeFrequency: true } } },
      },
    },
  });

  if (!routine || routine.userId !== session.user.id) {
    notFound();
  }

  const views = await productViewsFor(
    session.user.id,
    routine.steps.flatMap((s) => (s.productId ? [s.productId] : []))
  );

  const steps: RoutineStepView[] = routine.steps.map((step) => {
    const view = step.product ? views.get(step.product.id) : undefined;
    const source = view?.source ?? null;
    const bucket = source ? confidenceBucket(source.confidenceScore) : null;
    const rule = resolveRule(step.ruleCitation);
    return {
      id: step.id,
      timeOfDay: step.timeOfDay,
      order: step.order,
      rationale: stripRuleNumbers(step.rationale),
      ackLowConfidence: step.ackLowConfidence,
      product: step.product ? { id: step.product.id, brand: step.product.brand, name: step.product.name, step: step.product.step } : null,
      confidence: bucket
        ? { bucket, score: source!.confidenceScore, origin: source!.origin, fetchedAt: source!.fetchedAt.toISOString() }
        : null,
      ranOut: view?.shelfStatus === "RAN_OUT",
      frequencyPerWeek: step.frequencyPerWeek,
      timeCostMinutes: step.timeCostMinutes,
      ownership: step.ownership,
      proposal: step.proposal,
      proposalReason: step.proposalReason,
      ruleLabel: rule?.label ?? null,
      ruleUrl: rule?.url ?? null,
      suggestedCategory: step.suggestedCategory,
      suggestedDescription: step.suggestedDescription,
      alternativeFrequency: step.alternativeFrequency,
      budgetAdjustment: step.budgetAdjustment,
      budgetAdjustmentReason: step.budgetAdjustmentReason,
    };
  });

  // "KEEP" tips predate this rule (Pro Tips now only ever propose a real
  // change) — filter any leftover ones out rather than surface them here.
  const proTips: ProTipView[] = routine.proTips
    .filter((tip) => tip.actionType !== "KEEP")
    .map((tip) => {
      const rule = resolveRule(tip.ruleCitation);
      return {
        id: tip.id,
        routineId: routine.id,
        stepId: tip.primaryStepId,
        summary: stripRuleNumbers(tip.summary),
        actionType: tip.actionType,
        status: tip.status,
        ruleLabel: rule?.label ?? null,
        ruleUrl: rule?.url ?? null,
        shopQuery: tip.primaryStep.suggestedDescription,
        alternativeFrequency: tip.primaryStep.alternativeFrequency,
      };
    });

  // Several rules can share one source page; list each page once.
  const overviewSourceLinks = routine.overviewSources
    .map((n) => resolveRule(n))
    .filter((r): r is { label: string; url: string } => r !== null)
    .filter((r, i, all) => all.findIndex((o) => o.url === r.url) === i);

  return (
    <RoutineReview
      routineId={routine.id}
      status={routine.status}
      rationale={stripRuleNumbers(routine.rationale)}
      overviewSourceLinks={overviewSourceLinks}
      steps={steps}
      proTips={proTips}
    />
  );
}
