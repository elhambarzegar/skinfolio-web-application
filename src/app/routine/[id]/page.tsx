import { notFound, redirect } from "next/navigation";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { confidenceBucket } from "@/lib/productLookup/confidence";
import { RULE_SOURCES } from "@/lib/routine/policy";
import { RoutineReview, type RoutineStepView } from "./routine-review";
import type { ProTipView } from "@/components/pro-tip-card";

function resolveRule(n: number | null): { label: string; url: string } | null {
  if (n === null) return null;
  const source = RULE_SOURCES[n];
  return source ? { label: `Rule ${n} — ${source.label}`, url: source.url } : null;
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
        include: {
          product: { include: { currentSource: true } },
          alternativeProduct: true,
        },
        orderBy: [{ timeOfDay: "asc" }, { order: "asc" }],
      },
      proTips: { orderBy: { createdAt: "asc" } },
    },
  });

  if (!routine || routine.userId !== session.user.id) {
    notFound();
  }

  const steps: RoutineStepView[] = routine.steps.map((step) => {
    const source = step.product.currentSource;
    const bucket = source ? confidenceBucket(source.confidenceScore) : null;
    const rule = resolveRule(step.ruleCitation);
    return {
      id: step.id,
      timeOfDay: step.timeOfDay,
      order: step.order,
      rationale: step.rationale,
      ackLowConfidence: step.ackLowConfidence,
      product: { id: step.product.id, brand: step.product.brand, name: step.product.name, step: step.product.step },
      confidence: bucket
        ? { bucket, score: source!.confidenceScore, origin: source!.origin, fetchedAt: source!.fetchedAt.toISOString() }
        : null,
      frequencyPerWeek: step.frequencyPerWeek,
      timeCostMinutes: step.timeCostMinutes,
      ownership: step.ownership,
      proposal: step.proposal,
      proposalReason: step.proposalReason,
      ruleLabel: rule?.label ?? null,
      ruleUrl: rule?.url ?? null,
      alternativeProduct: step.alternativeProduct
        ? { id: step.alternativeProduct.id, brand: step.alternativeProduct.brand, name: step.alternativeProduct.name }
        : null,
      alternativeFrequency: step.alternativeFrequency,
      budgetAdjustment: step.budgetAdjustment,
      budgetAdjustmentReason: step.budgetAdjustmentReason,
    };
  });

  const proTips: ProTipView[] = routine.proTips.map((tip) => {
    const rule = resolveRule(tip.ruleCitation);
    return {
      id: tip.id,
      routineId: routine.id,
      stepId: tip.primaryStepId,
      summary: tip.summary,
      actionType: tip.actionType,
      status: tip.status,
      ruleLabel: rule?.label ?? null,
      ruleUrl: rule?.url ?? null,
    };
  });

  const overviewSourceLinks = routine.overviewSources
    .map((n) => resolveRule(n))
    .filter((r): r is { label: string; url: string } => r !== null);

  return (
    <RoutineReview
      routineId={routine.id}
      status={routine.status}
      rationale={routine.rationale}
      overviewSourceLinks={overviewSourceLinks}
      steps={steps}
      proTips={proTips}
    />
  );
}
