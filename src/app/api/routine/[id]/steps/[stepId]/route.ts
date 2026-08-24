import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";

async function getOwnedStep(routineId: string, stepId: string, userId: string) {
  const step = await prisma.routineStep.findUnique({
    where: { id: stepId },
    include: { routine: true },
  });
  if (!step || step.routineId !== routineId || step.routine.userId !== userId) {
    return null;
  }
  return step;
}

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string; stepId: string }> }
) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "You need to be logged in." }, { status: 401 });
  }

  const { id, stepId } = await params;
  const step = await getOwnedStep(id, stepId, session.user.id);
  if (!step) {
    return NextResponse.json({ error: "Step not found." }, { status: 404 });
  }
  if (step.routine.status !== "DRAFT") {
    return NextResponse.json(
      { error: "This routine has already been accepted and can't be edited here." },
      { status: 400 }
    );
  }

  const body = await req.json().catch(() => null);
  const action = body?.action;

  if (action === "remove") {
    await prisma.routineStep.delete({ where: { id: step.id } });
    return NextResponse.json({ ok: true });
  }

  if (action === "acknowledge") {
    const include = body?.include === true;
    if (!include) {
      await prisma.routineStep.delete({ where: { id: step.id } });
      return NextResponse.json({ ok: true, removed: true });
    }
    await prisma.routineStep.update({
      where: { id: step.id },
      data: { ackLowConfidence: true, decidedAt: new Date() },
    });
    return NextResponse.json({ ok: true });
  }

  return NextResponse.json({ error: "Unknown action." }, { status: 400 });
}
