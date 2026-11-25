import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { tipKind } from "@/lib/routine/tipKind";
import type { Prisma } from "@prisma/client";

type Tx = Prisma.TransactionClient;

/**
 * The app never names a specific replacement/addition — every ADD and
 * CHANGE tip is a description plus shop-search links. A tip that is only
 * "go and buy something" can't be accepted: accepting means nothing until a
 * real product exists. Those tips are settled by adding the product (see
 * the change flow), and here they can only be skipped. Tips that
 * change something real (remove a product, change how often it's used) are
 * accepted or rejected as before. See tipKind.
 */
async function applyResolution(tx: Tx, tip: { actionType: string; primaryStepId: string }, decision: "accept" | "reject") {
  const step = await tx.routineStep.findUnique({ where: { id: tip.primaryStepId } });
  if (!step) return;

  switch (tip.actionType) {
    case "ADD":
      // Nothing to keep without a real product either way.
      await tx.routineStep.update({ where: { id: step.id }, data: { active: false } });
      break;
    case "REMOVE":
      if (decision === "accept") {
        await tx.routineStep.update({ where: { id: step.id }, data: { active: false } });
      } else {
        await tx.routineStep.update({ where: { id: step.id }, data: { proposal: "KEEP" } });
      }
      break;
    case "CHANGE": {
      const applyFrequency = decision === "accept" && step.alternativeFrequency;
      await tx.routineStep.update({
        where: { id: step.id },
        data: {
          proposal: "KEEP",
          frequencyPerWeek: applyFrequency ? step.alternativeFrequency! : step.frequencyPerWeek,
          alternativeFrequency: null,
          suggestedDescription: null,
        },
      });
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

  if (decision === "accept") {
    const step = await prisma.routineStep.findUnique({ where: { id: tip.primaryStepId } });
    const kind = step ? tipKind(tip, step) : "decide";
    if (kind !== "decide") {
      return NextResponse.json(
        {
          error:
            kind === "shop"
              ? "Add the product you chose to accept this. Until then you can skip it."
              : "Choose the product you'll swap in to accept this. Until then you can keep what you have.",
        },
        { status: 400 }
      );
    }
  }

  await prisma.$transaction(async (tx) => {
    await applyResolution(tx, tip, decision);
    await tx.proTip.update({
      where: { id: tip.id },
      data: { status: decision === "accept" ? "ACCEPTED" : "REJECTED", respondedAt: new Date() },
    });
  });

  return NextResponse.json({ ok: true });
}
