import { notFound, redirect } from "next/navigation";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { confidenceBucket } from "@/lib/productLookup/confidence";
import { RoutineReview, type RoutineStepView } from "./routine-review";

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
        include: { product: { include: { currentSource: true } } },
        orderBy: [{ timeOfDay: "asc" }, { order: "asc" }],
      },
    },
  });

  if (!routine || routine.userId !== session.user.id) {
    notFound();
  }

  const steps: RoutineStepView[] = routine.steps.map((step) => {
    const source = step.product.currentSource;
    const bucket = source ? confidenceBucket(source.confidenceScore) : null;
    return {
      id: step.id,
      timeOfDay: step.timeOfDay,
      order: step.order,
      rationale: step.rationale,
      ackLowConfidence: step.ackLowConfidence,
      product: { id: step.product.id, brand: step.product.brand, name: step.product.name },
      confidence: bucket
        ? {
            bucket,
            score: source!.confidenceScore,
            origin: source!.origin,
            fetchedAt: source!.fetchedAt.toISOString(),
          }
        : null,
    };
  });

  return (
    <RoutineReview
      routineId={routine.id}
      status={routine.status}
      rationale={routine.rationale}
      steps={steps}
    />
  );
}
