import type { Prisma, TimeOfDay } from "@prisma/client";

type Tx = Prisma.TransactionClient;

/**
 * Puts a step into a period of the routine at the given position. The
 * period's steps are renumbered 1, 2, 3… afterwards, so there are never gaps
 * or two steps with the same number.
 */
export async function insertStep(
  tx: Tx,
  routineId: string,
  data: Omit<Prisma.RoutineStepUncheckedCreateInput, "routineId" | "order">,
  position: number
) {
  const existing = await tx.routineStep.findMany({
    where: { routineId, timeOfDay: data.timeOfDay, active: true },
    orderBy: { order: "asc" },
    select: { id: true },
  });
  const at = Math.min(Math.max(position, 1), existing.length + 1);
  const created = await tx.routineStep.create({ data: { ...data, routineId, order: at } });

  const ordered = [...existing.slice(0, at - 1).map((s) => s.id), created.id, ...existing.slice(at - 1).map((s) => s.id)];
  for (let i = 0; i < ordered.length; i++) {
    await tx.routineStep.update({ where: { id: ordered[i] }, data: { order: i + 1 } });
  }
}

/** Closes any gaps left by removed steps: each period counts 1, 2, 3… again. */
export async function renumberRoutine(tx: Tx, routineId: string) {
  for (const timeOfDay of ["AM", "PM"] as TimeOfDay[]) {
    const steps = await tx.routineStep.findMany({
      where: { routineId, timeOfDay, active: true },
      orderBy: { order: "asc" },
      select: { id: true, order: true },
    });
    for (let i = 0; i < steps.length; i++) {
      if (steps[i].order !== i + 1) await tx.routineStep.update({ where: { id: steps[i].id }, data: { order: i + 1 } });
    }
  }
}
