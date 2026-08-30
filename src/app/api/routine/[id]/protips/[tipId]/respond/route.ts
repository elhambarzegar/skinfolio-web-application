import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import type { Prisma } from "@prisma/client";

type Tx = Prisma.TransactionClient;

async function applyResolution(
  tx: Tx,
  tip: { actionType: string; primaryStepId: string },
  decision: "accept" | "reject",
  userId: string
) {
  const step = await tx.routineStep.findUnique({ where: { id: tip.primaryStepId } });
  if (!step) return;

  if (decision === "accept") {
    switch (tip.actionType) {
      case "ADD":
        await tx.routineStep.update({ where: { id: step.id }, data: { proposal: "KEEP" } });
        break;
      case "REMOVE":
        await tx.routineStep.update({ where: { id: step.id }, data: { active: false } });
        break;
      case "CHANGE": {
        if (step.alternativeProductId) {
          const intake = await tx.intakeResponse.findFirst({
            where: { userId },
            orderBy: { createdAt: "desc" },
            include: { ownedProducts: { select: { id: true } } },
          });
          const isOwned = intake?.ownedProducts.some((p) => p.id === step.alternativeProductId) ?? false;
          await tx.routineStep.update({
            where: { id: step.id },
            data: {
              productId: step.alternativeProductId,
              ownership: isOwned ? "OWNED" : "NEW",
              frequencyPerWeek: step.alternativeFrequency ?? step.frequencyPerWeek,
              proposal: "KEEP",
              alternativeProductId: null,
              alternativeFrequency: null,
            },
          });
        } else if (step.alternativeFrequency) {
          await tx.routineStep.update({
            where: { id: step.id },
            data: { frequencyPerWeek: step.alternativeFrequency, proposal: "KEEP", alternativeFrequency: null },
          });
        } else {
          await tx.routineStep.update({ where: { id: step.id }, data: { proposal: "KEEP" } });
        }
        break;
      }
      case "KEEP":
        break;
    }
  } else {
    switch (tip.actionType) {
      case "ADD":
        await tx.routineStep.update({ where: { id: step.id }, data: { active: false } });
        break;
      case "REMOVE":
      case "CHANGE":
        await tx.routineStep.update({
          where: { id: step.id },
          data: { proposal: "KEEP", alternativeProductId: null, alternativeFrequency: null },
        });
        break;
      case "KEEP":
        break;
    }
  }
}

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string; tipId: string }> }
) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "You need to be logged in." }, { status: 401 });
  }

  const { id, tipId } = await params;
  const body = await req.json().catch(() => null);
  const decision = body?.action === "accept" ? "accept" : body?.action === "reject" ? "reject" : null;
  if (!decision) {
    return NextResponse.json({ error: "Missing or invalid action." }, { status: 400 });
  }

  const tip = await prisma.proTip.findUnique({
    where: { id: tipId },
    include: { routine: true },
  });

  if (!tip || tip.routineId !== id || tip.routine.userId !== session.user.id) {
    return NextResponse.json({ error: "Pro tip not found." }, { status: 404 });
  }
  if (tip.status !== "PENDING") {
    return NextResponse.json({ error: "This tip has already been responded to." }, { status: 400 });
  }

  await prisma.$transaction(async (tx) => {
    await applyResolution(tx, tip, decision, session.user.id);
    await tx.proTip.update({
      where: { id: tip.id },
      data: { status: decision === "accept" ? "ACCEPTED" : "REJECTED", respondedAt: new Date() },
    });
  });

  return NextResponse.json({ ok: true });
}
