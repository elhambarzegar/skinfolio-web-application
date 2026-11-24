import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { confidenceBucket } from "@/lib/productLookup/confidence";
import { RULE_SOURCES, stripRuleNumbers } from "@/lib/routine/policy";
import type { Prisma, ProductStep, TimeOfDay } from "@prisma/client";

type Tx = Prisma.TransactionClient;

const CATEGORIES: ProductStep[] = ["CLEANSE", "TREAT", "MOISTURIZE", "PROTECT", "OTHER"];

type Item = {
  productId: string;
  category: ProductStep;
  rationale: string;
  ruleCitation: number | null;
  /** A suggested gap this product takes over (found by the fit check). */
  fillsStepId: string | null;
  placements: { timeOfDay: TimeOfDay; position: number; frequencyPerWeek: number; timeCostMinutes: number | null }[];
};

/** Reads one entry the page sends back from the fit check; anything malformed is dropped. */
function parseItem(raw: unknown): Item | null {
  if (!raw || typeof raw !== "object") return null;
  const r = raw as Record<string, unknown>;
  if (typeof r.productId !== "string") return null;

  const placements = (Array.isArray(r.placements) ? r.placements : []).flatMap((p) => {
    if (!p || typeof p !== "object") return [];
    const o = p as Record<string, unknown>;
    if (o.timeOfDay !== "AM" && o.timeOfDay !== "PM") return [];
    const position = Number(o.position);
    const freq = Number(o.frequencyPerWeek);
    if (!Number.isInteger(position) || position < 1 || !Number.isInteger(freq) || freq < 1 || freq > 7) return [];
    const minutes = o.timeCostMinutes == null ? null : Number(o.timeCostMinutes);
    return [
      {
        timeOfDay: o.timeOfDay as TimeOfDay,
        position,
        frequencyPerWeek: freq,
        timeCostMinutes: minutes !== null && Number.isInteger(minutes) && minutes >= 0 && minutes <= 30 ? minutes : null,
      },
    ];
  });

  const citation = typeof r.ruleCitation === "number" && r.ruleCitation in RULE_SOURCES ? r.ruleCitation : null;

  return {
    productId: r.productId,
    category: CATEGORIES.find((c) => c === r.category) ?? "OTHER",
    rationale: typeof r.rationale === "string" ? stripRuleNumbers(r.rationale).slice(0, 800) : "",
    ruleCitation: citation,
    fillsStepId: typeof r.fillsStepId === "string" ? r.fillsStepId : null,
    placements,
  };
}

/**
 * Puts a product into a period of the routine at the given position. The
 * period's steps are renumbered 1, 2, 3… afterwards, so there are never gaps
 * or two steps with the same number.
 */
async function insertStep(
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

/**
 * Applies a fit check that the person has just seen and approved. There is no
 * second AI call and no new draft to approve: "Add to routine" is the
 * approval, and the routine changes in place (today's ticks are kept).
 */
export async function POST(req: Request) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "You need to be logged in." }, { status: 401 });
  }
  const userId = session.user.id;

  const body = await req.json().catch(() => null);
  const items: Item[] = (Array.isArray(body?.items) ? body.items : []).map(parseItem).filter((i: Item | null): i is Item => i !== null);
  if (items.length === 0) {
    return NextResponse.json({ error: "No products to add." }, { status: 400 });
  }

  const intake = await prisma.intakeResponse.findFirst({ where: { userId }, orderBy: { createdAt: "desc" } });
  if (!intake) {
    return NextResponse.json({ error: "Complete your intake first." }, { status: 400 });
  }

  const routineId = typeof body?.routineId === "string" ? body.routineId : undefined;
  const fillStepId = typeof body?.fillStepId === "string" ? body.fillStepId : undefined;

  const routine = routineId
    ? await prisma.routine.findFirst({ where: { id: routineId, userId, status: { not: "ARCHIVED" } } })
    : await prisma.routine.findFirst({
        where: { userId, status: { in: ["ACTIVE", "PAUSED"] } },
        orderBy: { createdAt: "desc" },
      });
  if (!routine) {
    return NextResponse.json({ error: "Build a routine first before adding products to it." }, { status: 400 });
  }

  const products = await prisma.product.findMany({
    where: { id: { in: items.map((i) => i.productId) } },
    include: { currentSource: true },
  });
  const productById = new Map(products.map((p) => [p.id, p]));

  // Which suggested gaps get filled, and by which product: either the one the
  // person picked a product for (from a Pro Tip), or one the fit check found
  // this product to suit. Each must really be an open gap in this routine.
  const gapByProduct = new Map<string, { id: string; suggestedCategory: ProductStep | null }>();
  const wanted = fillStepId && items.length === 1 ? [[items[0].productId, fillStepId] as const] : items.flatMap((i) => (i.fillsStepId ? [[i.productId, i.fillsStepId] as const] : []));
  for (const [productId, stepId] of wanted) {
    const step = await prisma.routineStep.findFirst({
      where: { id: stepId, routineId: routine.id, active: true, productId: null, proposal: "ADD" },
      select: { id: true, suggestedCategory: true },
    });
    if (!step) {
      if (fillStepId) return NextResponse.json({ error: "That suggestion has already been handled." }, { status: 400 });
      continue;
    }
    if (![...gapByProduct.values()].some((g) => g.id === step.id)) gapByProduct.set(productId, step);
  }
  if (fillStepId && items.length !== 1) {
    return NextResponse.json({ error: "A suggestion is filled by one product." }, { status: 400 });
  }

  let added = 0;

  await prisma.$transaction(async (tx) => {
    // The shelf: whatever the person adds is now something they own.
    await tx.intakeResponse.update({
      where: { id: intake.id },
      data: { ownedProducts: { connect: products.map((p) => ({ id: p.id })) } },
    });

    for (const item of items) {
      const product = productById.get(item.productId);
      if (!product) continue;

      // The person saw the warning and chose to add it: that is their decision on record.
      const lowConfidence = !product.currentSource || confidenceBucket(product.currentSource.confidenceScore) === "low";
      const decision = lowConfidence ? { ackLowConfidence: true, decidedAt: new Date() } : {};

      if (product.step === "OTHER" && item.category !== "OTHER") {
        await tx.product.update({ where: { id: product.id }, data: { step: item.category } });
      }

      const gap = gapByProduct.get(product.id);
      if (gap) {
        await tx.routineStep.update({
          where: { id: gap.id },
          data: {
            productId: product.id,
            ownership: "OWNED",
            proposal: "KEEP",
            proposalReason: null,
            suggestedCategory: null,
            suggestedDescription: null,
            ...decision,
          },
        });
        await tx.proTip.updateMany({
          where: { primaryStepId: gap.id, status: "PENDING", actionType: "ADD" },
          data: { status: "ACCEPTED", respondedAt: new Date() },
        });
        added += 1;
        continue;
      }

      for (const pl of item.placements) {
        // Already there for this part of the day: leave it be.
        const already = await tx.routineStep.findFirst({
          where: { routineId: routine.id, productId: product.id, timeOfDay: pl.timeOfDay, active: true },
          select: { id: true },
        });
        if (already) continue;

        await insertStep(
          tx,
          routine.id,
          {
            productId: product.id,
            timeOfDay: pl.timeOfDay,
            rationale: item.rationale || "Added after a fit check.",
            frequencyPerWeek: pl.frequencyPerWeek,
            timeCostMinutes: pl.timeCostMinutes,
            ownership: "OWNED",
            proposal: "KEEP",
            ruleCitation: item.ruleCitation,
            ...decision,
          },
          pl.position
        );
        added += 1;
      }
    }
  });

  return NextResponse.json({ ok: true, routineId: routine.id, added });
}
