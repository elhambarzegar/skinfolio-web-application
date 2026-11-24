import { prisma } from "@/lib/prisma";
import { defaultPeriod, localNow, longDate, safeTimezone } from "./dates";
import { CATEGORY_LABEL } from "./productCategory";
import { daysLabel, isScheduledOn, nextScheduledWeekday, WEEKDAY_LONG } from "./schedule";

export type TodayStep = {
  id: string;
  period: "AM" | "PM";
  name: string;
  brand: string;
  category: string;
  minutes: number;
  /** "Mon · Wed · Fri" for a less-than-daily product, otherwise null. */
  days: string | null;
  done: boolean;
};

export type NotTodayStep = {
  id: string;
  period: "AM" | "PM";
  name: string;
  brand: string;
  nextDay: string;
  days: string | null;
};

/** A step whose product has run out: paused, not counted as missed. */
export type RanOutStep = {
  id: string;
  period: "AM" | "PM";
  name: string;
  brand: string;
};

export type TodayData = {
  state: "no_intake" | "no_routine" | "paused" | "active";
  firstName: string | null;
  dateLabel: string;
  defaultPeriod: "AM" | "PM";
  routineId: string | null;
  /** A routine waiting for the user's review (new, or an update). */
  draftRoutineId: string | null;
  pausedReason: string | null;
  steps: TodayStep[];
  notToday: NotTodayStep[];
  ranOut: RanOutStep[];
  pendingTipCount: number;
};

/**
 * Everything the Today screen needs, in the user's own timezone. Opening it
 * also records "what was due today" (one StepLog row per scheduled step) so
 * reports can later tell a missed step from a day with nothing due.
 */
export async function loadToday(userId: string): Promise<TodayData> {
  const user = await prisma.user.findUnique({ where: { id: userId }, select: { name: true, timezone: true } });
  const tz = safeTimezone(user?.timezone) ?? "UTC";
  const now = localNow(tz);

  const empty: TodayData = {
    state: "no_routine",
    firstName: user?.name?.trim().split(/\s+/)[0] ?? null,
    dateLabel: longDate(tz),
    defaultPeriod: defaultPeriod(now.hour),
    routineId: null,
    draftRoutineId: null,
    pausedReason: null,
    steps: [],
    notToday: [],
    ranOut: [],
    pendingTipCount: 0,
  };

  const [intake, draft] = await Promise.all([
    prisma.intakeResponse.findFirst({ where: { userId }, select: { id: true } }),
    prisma.routine.findFirst({
      where: { userId, status: "DRAFT" },
      orderBy: { createdAt: "desc" },
      select: { id: true },
    }),
  ]);
  empty.draftRoutineId = draft?.id ?? null;

  if (!intake) return { ...empty, state: "no_intake" };

  const routine = await prisma.routine.findFirst({
    where: { userId, status: { in: ["ACTIVE", "PAUSED"] } },
    orderBy: { createdAt: "desc" },
    include: {
      // ADD steps are described gaps with no product yet — nothing to tick off.
      steps: {
        where: { active: true, productId: { not: null }, proposal: { not: "ADD" } },
        include: { product: true },
        orderBy: [{ timeOfDay: "asc" }, { order: "asc" }],
      },
    },
  });

  if (!routine) return empty;

  const pendingTipCount = await prisma.proTip.count({
    where: { routineId: routine.id, status: "PENDING", actionType: { not: "KEEP" } },
  });

  if (routine.status === "PAUSED") {
    const flag = await prisma.escalationFlag.findFirst({
      where: { resolved: false, checkIn: { routineId: routine.id } },
      orderBy: { createdAt: "desc" },
      select: { reason: true },
    });
    return { ...empty, state: "paused", routineId: routine.id, pausedReason: flag?.reason ?? null, pendingTipCount };
  }

  // A product that has run out pauses its step: nothing to tick, and it
  // isn't logged as due, so it can't show up later as a missed day.
  const ranOutItems = await prisma.shelfItem.findMany({
    where: { userId, status: "RAN_OUT", productId: { in: routine.steps.flatMap((s) => (s.productId ? [s.productId] : [])) } },
    select: { productId: true },
  });
  const ranOutIds = new Set(ranOutItems.map((i) => i.productId));

  const allWithProduct = routine.steps.flatMap((s) => (s.product ? [{ step: s, product: s.product }] : []));
  const withProduct = allWithProduct.filter(({ product }) => !ranOutIds.has(product.id));
  const ranOut: RanOutStep[] = allWithProduct
    .filter(({ product }) => ranOutIds.has(product.id))
    .map(({ step, product }) => ({ id: step.id, period: step.timeOfDay, name: product.name, brand: product.brand }));
  const due = withProduct.filter(({ step }) => isScheduledOn(step.frequencyPerWeek, now.weekday));

  if (due.length > 0) {
    await prisma.stepLog.createMany({
      data: due.map(({ step }) => ({ userId, routineId: routine.id, stepId: step.id, date: now.date })),
      skipDuplicates: true,
    });
  }

  const logs = due.length
    ? await prisma.stepLog.findMany({
        where: { date: now.date, stepId: { in: due.map(({ step }) => step.id) } },
        select: { stepId: true, doneAt: true },
      })
    : [];
  const doneIds = new Set(logs.filter((l) => l.doneAt).map((l) => l.stepId));

  const steps: TodayStep[] = due.map(({ step, product }) => ({
    id: step.id,
    period: step.timeOfDay,
    name: product.name,
    brand: product.brand,
    category: CATEGORY_LABEL[product.step] ?? "Other",
    minutes: step.timeCostMinutes ?? 1,
    days: daysLabel(step.frequencyPerWeek),
    done: doneIds.has(step.id),
  }));

  const notToday: NotTodayStep[] = withProduct
    .filter(({ step }) => !isScheduledOn(step.frequencyPerWeek, now.weekday))
    .map(({ step, product }) => ({
      id: step.id,
      period: step.timeOfDay,
      name: product.name,
      brand: product.brand,
      nextDay: WEEKDAY_LONG[nextScheduledWeekday(step.frequencyPerWeek, now.weekday) - 1],
      days: daysLabel(step.frequencyPerWeek),
    }));

  return { ...empty, state: "active", routineId: routine.id, steps, notToday, ranOut, pendingTipCount };
}
