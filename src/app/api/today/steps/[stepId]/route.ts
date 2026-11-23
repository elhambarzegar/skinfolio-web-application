import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { localNow, safeTimezone } from "@/lib/dates";

/** Tick a step done (or undo it) for the user's current local day. */
export async function POST(req: Request, { params }: { params: Promise<{ stepId: string }> }) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "You need to be signed in." }, { status: 401 });
  }

  const body = await req.json().catch(() => null);
  if (typeof body?.done !== "boolean") {
    return NextResponse.json({ error: "Say whether the step is done." }, { status: 400 });
  }

  const { stepId } = await params;
  const step = await prisma.routineStep.findUnique({ where: { id: stepId }, include: { routine: true } });
  if (!step || !step.active || step.routine.userId !== session.user.id) {
    return NextResponse.json({ error: "That step isn't in your routine." }, { status: 404 });
  }
  if (step.routine.status !== "ACTIVE") {
    return NextResponse.json({ error: "Your routine is paused, so steps can't be ticked off right now." }, { status: 409 });
  }

  const user = await prisma.user.findUnique({ where: { id: session.user.id }, select: { timezone: true } });
  const { date } = localNow(safeTimezone(user?.timezone) ?? "UTC");
  const doneAt = body.done ? new Date() : null;

  await prisma.stepLog.upsert({
    where: { stepId_date: { stepId, date } },
    create: { userId: session.user.id, routineId: step.routineId, stepId, date, doneAt },
    update: { doneAt },
  });

  return NextResponse.json({ done: body.done });
}
