import { prisma } from "@/lib/prisma";

/**
 * Everything the app holds about one person, as plain data they can keep
 * (the "Download my data" button). Never includes the password, even scrambled.
 */
export async function exportAccountData(userId: string) {
  const [user, intakes, shelf, routines, changes, stepLogs, checkIns] = await Promise.all([
    prisma.user.findUnique({ where: { id: userId }, select: { email: true, name: true, timezone: true, createdAt: true } }),
    prisma.intakeResponse.findMany({
      where: { userId },
      orderBy: { createdAt: "asc" },
      select: { createdAt: true, concerns: true, questionnaire: true, experienceLevel: true, priority: true, complexityPreference: true },
    }),
    prisma.shelfItem.findMany({
      where: { userId },
      orderBy: { addedAt: "asc" },
      select: {
        addedAt: true,
        status: true,
        prescribed: true,
        directions: true,
        product: { select: { brand: true, name: true } },
        photoSource: { select: { ingredientsInci: true, fetchedAt: true } },
      },
    }),
    prisma.routine.findMany({
      where: { userId },
      orderBy: { createdAt: "asc" },
      select: {
        status: true,
        createdAt: true,
        activatedAt: true,
        rationale: true,
        steps: {
          orderBy: [{ timeOfDay: "asc" }, { order: "asc" }],
          select: { timeOfDay: true, order: true, frequencyPerWeek: true, rationale: true, active: true, product: { select: { brand: true, name: true } } },
        },
        proTips: { select: { actionType: true, summary: true, status: true, createdAt: true } },
      },
    }),
    prisma.routineChange.findMany({
      where: { userId },
      orderBy: { createdAt: "asc" },
      select: { createdAt: true, kind: true, status: true, trigger: true, summary: true, consequences: true, diff: true },
    }),
    prisma.stepLog.findMany({
      where: { userId },
      orderBy: { date: "asc" },
      select: { date: true, doneAt: true, step: { select: { timeOfDay: true, product: { select: { brand: true, name: true } } } } },
    }),
    prisma.checkIn.findMany({
      where: { userId },
      orderBy: { createdAt: "asc" },
      select: { createdAt: true, timeOfDay: true, adherence: true, symptomsText: true, escalation: { select: { reason: true, resolved: true } } },
    }),
  ]);

  return {
    about: "Everything Sagedew holds about you. Your password is never included.",
    exportedAt: new Date().toISOString(),
    account: user,
    skinDetails: intakes,
    shelf: shelf.map((i) => ({
      product: `${i.product.brand} — ${i.product.name}`,
      addedAt: i.addedAt,
      status: i.status,
      prescribed: i.prescribed,
      directions: i.directions,
      ingredientsFromYourPhoto: i.photoSource?.ingredientsInci ?? null,
    })),
    routines: routines.map((r) => ({
      status: r.status,
      createdAt: r.createdAt,
      approvedAt: r.activatedAt,
      summary: r.rationale,
      steps: r.steps.map((s) => ({
        when: s.timeOfDay === "AM" ? "morning" : "evening",
        position: s.order,
        product: s.product ? `${s.product.brand} — ${s.product.name}` : "(a suggested product, not chosen yet)",
        timesPerWeek: s.frequencyPerWeek,
        why: s.rationale,
        stillInRoutine: s.active,
      })),
      proTips: r.proTips,
    })),
    changes,
    dailyTicks: stepLogs.map((l) => ({
      date: l.date,
      product: l.step.product ? `${l.step.product.brand} — ${l.step.product.name}` : null,
      when: l.step.timeOfDay === "AM" ? "morning" : "evening",
      done: !!l.doneAt,
    })),
    skinCheckIns: checkIns,
  };
}

/**
 * Deletes a person and everything that is theirs. Their shelf, routines,
 * ticks, check-ins and proposed changes go with the account. Their label-photo
 * records go too (they only hold ingredient text). What stays is shared
 * product information that was never about them: the product catalogue, and any
 * ingredient list that several people's photos agreed on (it names no one).
 */
export async function deleteAccount(userId: string): Promise<void> {
  // Found first: once the account is gone the link to the person is cleared.
  const photoIds = (
    await prisma.productSource.findMany({ where: { reporterId: userId, origin: "USER_PHOTO" }, select: { id: true } })
  ).map((p) => p.id);

  await prisma.$transaction(async (tx) => {
    if (photoIds.length > 0) {
      // Nothing shared may still point at a record that is about to go.
      await tx.product.updateMany({ where: { currentSourceId: { in: photoIds } }, data: { currentSourceId: null } });
      await tx.productSource.updateMany({ where: { supersededById: { in: photoIds }, id: { notIn: photoIds } }, data: { supersededById: null } });
    }
    await tx.user.delete({ where: { id: userId } });
    if (photoIds.length > 0) await tx.productSource.deleteMany({ where: { id: { in: photoIds } } });
  });
}
