import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { confidenceBucket } from "@/lib/productLookup/confidence";

export async function POST(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "You need to be logged in." }, { status: 401 });
  }

  const { id } = await params;
  const routine = await prisma.routine.findUnique({
    where: { id },
    include: {
      steps: { where: { active: true }, include: { product: { include: { currentSource: true } } } },
    },
  });

  if (!routine || routine.userId !== session.user.id) {
    return NextResponse.json({ error: "Routine not found." }, { status: 404 });
  }

  const unresolved = routine.steps.filter((step) => {
    // A still-pending ADD suggestion isn't committed content yet — its
    // Pro Tip is what needs a decision, not a low-confidence acknowledgment.
    if (step.proposal === "ADD" || !step.product) return false;
    const source = step.product.currentSource;
    const isLowConfidence = !source || confidenceBucket(source.confidenceScore) === "low";
    return isLowConfidence && step.ackLowConfidence == null;
  });

  if (unresolved.length > 0) {
    return NextResponse.json(
      {
        error: "Some steps still need a decision before you can accept this routine.",
        unresolvedStepIds: unresolved.map((s) => s.id),
      },
      { status: 400 }
    );
  }

  await prisma.$transaction(async (tx) => {
    // A paused routine being superseded is just as retired as an active
    // one — otherwise it's left PAUSED forever with no way back to it.
    await tx.routine.updateMany({
      where: { userId: session.user.id, status: { in: ["ACTIVE", "PAUSED"] } },
      data: { status: "ARCHIVED" },
    });
    await tx.routine.update({
      where: { id: routine.id },
      data: { status: "ACTIVE" },
    });
  });

  return NextResponse.json({ ok: true });
}
