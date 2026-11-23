import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { classifyCheckIn, type PriorCheckIn } from "@/lib/checkin/classify";
import { localNow, safeTimezone } from "@/lib/dates";

/**
 * Adherence comes from what was ticked off on Today, so the check-in doesn't
 * ask the same question twice. Nothing due means nothing was skipped.
 */
async function deriveAdherence(userId: string, routineId: string, timeOfDay: "AM" | "PM"): Promise<"DONE" | "SKIPPED"> {
  const user = await prisma.user.findUnique({ where: { id: userId }, select: { timezone: true } });
  const { date } = localNow(safeTimezone(user?.timezone) ?? "UTC");
  const logs = await prisma.stepLog.findMany({
    where: { userId, routineId, date, step: { timeOfDay } },
    select: { doneAt: true },
  });
  if (logs.length === 0) return "DONE";
  return logs.some((l) => l.doneAt) ? "DONE" : "SKIPPED";
}

function dayNumberFor(routineCreatedAt: Date, now: Date): number {
  const msPerDay = 1000 * 60 * 60 * 24;
  const days = Math.floor(
    (Date.UTC(now.getFullYear(), now.getMonth(), now.getDate()) -
      Date.UTC(routineCreatedAt.getFullYear(), routineCreatedAt.getMonth(), routineCreatedAt.getDate())) /
      msPerDay
  );
  return Math.max(days + 1, 1);
}

export async function POST(req: Request) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "You need to be logged in." }, { status: 401 });
  }

  const body = await req.json().catch(() => null);
  const timeOfDay = body?.timeOfDay === "PM" ? "PM" : body?.timeOfDay === "AM" ? "AM" : null;
  const symptomsText =
    typeof body?.symptomsText === "string" && body.symptomsText.trim().length > 0
      ? body.symptomsText.trim()
      : null;

  if (!timeOfDay) {
    return NextResponse.json({ error: "Say whether this is for the morning or the evening." }, { status: 400 });
  }

  const routine = await prisma.routine.findFirst({
    where: { userId: session.user.id, status: { in: ["ACTIVE", "PAUSED"] } },
    orderBy: { createdAt: "desc" },
  });

  if (!routine) {
    return NextResponse.json({ error: "No active routine to check in on." }, { status: 400 });
  }

  const dayNumber = dayNumberFor(routine.createdAt, new Date());
  const adherence = await deriveAdherence(session.user.id, routine.id, timeOfDay);

  const existing = await prisma.checkIn.findFirst({
    where: { routineId: routine.id, dayNumber, timeOfDay },
  });
  if (existing) {
    return NextResponse.json(
      { error: `You already checked in for ${timeOfDay} today.` },
      { status: 409 }
    );
  }

  const recentCheckIns = await prisma.checkIn.findMany({
    where: { routineId: routine.id },
    orderBy: { createdAt: "desc" },
    take: 3,
    include: { escalation: true },
  });

  const priorContext: PriorCheckIn[] = recentCheckIns.map((c) => ({
    dayNumber: c.dayNumber,
    timeOfDay: c.timeOfDay,
    symptomsText: c.symptomsText,
    wasFlagged: !!c.escalation,
  }));

  const classification = await classifyCheckIn(symptomsText, priorContext);
  const flagged = classification.severity !== "normal";

  const result = await prisma.$transaction(async (tx) => {
    const checkIn = await tx.checkIn.create({
      data: { userId: session.user.id, routineId: routine.id, dayNumber, timeOfDay, adherence, symptomsText },
    });

    if (flagged) {
      await tx.escalationFlag.create({
        data: { checkInId: checkIn.id, reason: classification.reasoning },
      });
      if (routine.status !== "PAUSED") {
        await tx.routine.update({ where: { id: routine.id }, data: { status: "PAUSED" } });
      }
    }

    return checkIn;
  });

  return NextResponse.json({
    id: result.id,
    severity: classification.severity,
    reasoning: classification.reasoning,
  });
}
