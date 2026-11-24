import type { RoutineChange } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { insertStep, renumberRoutine } from "./steps";
import { cleanOps, type ChangeOp, type ChangeView, type DiffLine, type StepCtx } from "./changes";

export function toChangeView(row: RoutineChange): ChangeView {
  return {
    id: row.id,
    kind: row.kind,
    status: row.status,
    trigger: row.trigger,
    summary: row.summary,
    consequences: Array.isArray(row.consequences) ? (row.consequences as string[]) : [],
    risk: row.risk === "caution" || row.risk === "conflict" ? row.risk : "none",
    diff: Array.isArray(row.diff) ? (row.diff as DiffLine[]) : [],
  };
}

/** Changes waiting for the person's approval, newest first. */
export async function pendingChanges(userId: string): Promise<ChangeView[]> {
  const rows = await prisma.routineChange.findMany({
    where: { userId, status: "PENDING", routine: { status: { in: ["ACTIVE", "PAUSED"] } } },
    orderBy: { createdAt: "desc" },
  });
  return rows.map(toChangeView);
}

export type ApplyResult = { ok: true } | { ok: false; status: number; error: string };

/**
 * Applies exactly what was saved with the change, after the person approved
 * it. If the routine has moved on since it was suggested (a step gone, a
 * product already added), nothing is applied and the person is told.
 */
export async function applyChange(userId: string, changeId: string): Promise<ApplyResult> {
  const change = await prisma.routineChange.findUnique({ where: { id: changeId } });
  if (!change || change.userId !== userId) return { ok: false, status: 404, error: "That change wasn't found." };
  if (change.status !== "PENDING") {
    return { ok: false, status: 409, error: change.status === "APPLIED" ? "This change has already been made." : "This change is no longer waiting." };
  }

  const routine = await prisma.routine.findFirst({
    where: { id: change.routineId, userId, status: { in: ["ACTIVE", "PAUSED"] } },
    include: { steps: { where: { active: true } } },
  });

  const stale = async () => {
    await prisma.routineChange.update({ where: { id: change.id }, data: { status: "STALE", decidedAt: new Date() } });
    return { ok: false, status: 409, error: "Your routine has changed since this was suggested, so it no longer fits. Nothing was changed." } as const;
  };
  if (!routine) return stale();

  const stored = change.ops as ChangeOp[];
  const stepCtx: StepCtx[] = routine.steps.map((s) => ({
    id: s.id,
    productId: s.productId,
    timeOfDay: s.timeOfDay,
    order: s.order,
    frequencyPerWeek: s.frequencyPerWeek,
  }));

  // Everything must still be valid as it is now. The products an "add" or
  // "swap" brings in must still be on the shelf and not run out.
  const wanted = stored.flatMap((o) => (o.op === "add" || o.op === "swap" ? [o.productId] : []));
  const shelf = await prisma.shelfItem.findMany({ where: { userId, productId: { in: wanted }, status: "ACTIVE" }, select: { productId: true } });
  const stillValid = cleanOps(stored, stepCtx, new Set(shelf.map((s) => s.productId)));
  if (stillValid.length !== stored.length) return stale();

  await prisma.$transaction(async (tx) => {
    // The person approved this change, caveats included, so any
    // "we're not sure about these ingredients" question is answered.
    const approved = { ackLowConfidence: true, decidedAt: new Date() };

    // Positions the person was shown count the routine as it was before the
    // change, so new steps go in first and removals close the gaps afterwards.
    for (const op of stillValid) {
      if (op.op === "frequency") {
        await tx.routineStep.update({ where: { id: op.stepId }, data: { frequencyPerWeek: op.frequencyPerWeek } });
      } else if (op.op === "swap") {
        await tx.routineStep.update({
          where: { id: op.stepId },
          data: {
            productId: op.productId,
            ownership: "OWNED",
            proposal: "KEEP",
            proposalReason: null,
            rationale: op.rationale,
            ...(op.frequencyPerWeek ? { frequencyPerWeek: op.frequencyPerWeek } : {}),
            ...approved,
          },
        });
      }
    }

    for (const op of stillValid) {
      if (op.op !== "add") continue;
      await insertStep(
        tx,
        routine.id,
        {
          productId: op.productId,
          timeOfDay: op.timeOfDay,
          rationale: op.rationale,
          frequencyPerWeek: op.frequencyPerWeek,
          timeCostMinutes: op.timeCostMinutes,
          ownership: "OWNED",
          proposal: "KEEP",
          ...approved,
        },
        op.position
      );
    }

    for (const op of stillValid) {
      if (op.op === "remove") await tx.routineStep.update({ where: { id: op.stepId }, data: { active: false } });
    }
    await renumberRoutine(tx, routine.id);

    await tx.routineChange.update({ where: { id: change.id }, data: { status: "APPLIED", decidedAt: new Date() } });
    // Anything else still waiting was worked out against the old routine.
    await tx.routineChange.updateMany({
      where: { userId, routineId: routine.id, status: "PENDING", id: { not: change.id } },
      data: { status: "STALE" },
    });
  });

  return { ok: true };
}

export async function dismissChange(userId: string, changeId: string): Promise<ApplyResult> {
  const change = await prisma.routineChange.findUnique({ where: { id: changeId } });
  if (!change || change.userId !== userId) return { ok: false, status: 404, error: "That change wasn't found." };
  if (change.status !== "PENDING") return { ok: true };
  await prisma.routineChange.update({ where: { id: change.id }, data: { status: "DISMISSED", decidedAt: new Date() } });
  return { ok: true };
}
