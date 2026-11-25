import { prisma } from "@/lib/prisma";
import { findConsensus, normalizeIngredients, similarity, SAME_LIST } from "@/lib/ingredients";
import { scoreConfidence } from "@/lib/productLookup/confidence";
import { proposeRoutineChange } from "@/lib/routine/proposeChange";

export type ConsensusResult =
  | { promoted: false }
  | { promoted: true; people: number; hadList: boolean };

/**
 * The shared library learns from people's own label photos: once at least
 * three different people's latest photos of a product agree on what's in it,
 * that list becomes the library's list for everyone. The list it replaces is
 * kept (marked superseded), never deleted.
 *
 * Each person counts once, by their most recent photo, so changing your mind
 * (a new photo) replaces your earlier report rather than adding to it.
 * Nobody can see who reported what.
 */
export async function checkCommunityConsensus(productId: string): Promise<ConsensusResult> {
  return prisma.$transaction(async (tx) => {
    // One check per product at a time, so two photos arriving together can't both publish.
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${productId}))`;

    const photos = await tx.productSource.findMany({
      where: { productId, origin: "USER_PHOTO", reporterId: { not: null } },
      orderBy: { fetchedAt: "desc" },
      select: { id: true, reporterId: true, ingredientsInci: true },
    });
    const latestPerPerson = new Map<string, (typeof photos)[number]>();
    for (const p of photos) if (!latestPerPerson.has(p.reporterId!)) latestPerPerson.set(p.reporterId!, p);

    const consensus = findConsensus(
      [...latestPerPerson.values()].map((p) => ({ reporterId: p.reporterId!, ingredients: normalizeIngredients(p.ingredientsInci), ref: p }))
    );
    if (!consensus) return { promoted: false } as const;

    const product = await tx.product.findUnique({ where: { id: productId }, include: { currentSource: true } });
    if (!product) return { promoted: false } as const;

    // The library already says this (including when an earlier agreement said it).
    const current = product.currentSource;
    if (current && similarity(normalizeIngredients(current.ingredientsInci), consensus.chosen.ingredients) >= SAME_LIST) {
      return { promoted: false } as const;
    }

    const now = new Date();
    const breakdown = scoreConfidence({ authority: "community", extraction: "photo_ocr", publishedAt: now, precision: "EXACT" });
    const created = await tx.productSource.create({
      data: {
        productId,
        origin: "COMMUNITY",
        sourceUrl: null,
        ingredientsInci: consensus.chosen.ref.ingredientsInci,
        // Only how many agreed and which photos, never who.
        rawExtract: JSON.stringify({ people: consensus.people, photoSourceIds: consensus.members.map((m) => m.ref.id) }),
        publishedAt: now,
        publishedAtPrecision: "EXACT",
        confidenceScore: breakdown.total,
        confidenceBreakdown: breakdown,
        status: "PENDING",
      },
    });
    if (current) {
      await tx.productSource.update({ where: { id: current.id }, data: { status: "SUPERSEDED", supersededById: created.id } });
    }
    await tx.product.update({ where: { id: productId }, data: { currentSourceId: created.id } });

    return { promoted: true, people: consensus.people, hadList: !!current } as const;
  });
}

const MAX_RECHECKS = 25;

/**
 * The library's list for a product just changed. Everyone with it in their
 * routine who relies on the library's list (not their own photo) gets their
 * routine looked at again; if something needs to change it waits for their OK.
 */
export async function recheckAfterLibraryChange(productId: string, hadList: boolean): Promise<number> {
  const product = await prisma.product.findUnique({ where: { id: productId }, select: { brand: true, name: true } });
  if (!product) return 0;

  const steps = await prisma.routineStep.findMany({
    where: { productId, active: true, routine: { status: { in: ["ACTIVE", "PAUSED"] } } },
    select: { routine: { select: { userId: true } } },
  });
  const userIds = [...new Set(steps.map((s) => s.routine.userId))];

  // People with their own photo of it already use their own list.
  const own = await prisma.shelfItem.findMany({
    where: { productId, userId: { in: userIds }, photoSourceId: { not: null } },
    select: { userId: true },
  });
  const ownSet = new Set(own.map((o) => o.userId));
  const targets = userIds.filter((id) => !ownSet.has(id)).slice(0, MAX_RECHECKS);

  const trigger = hadList
    ? `Several people photographed their ${product.name} (${product.brand}) and agree on what's in it. That differs from the list we had.`
    : `Several people photographed their ${product.name} (${product.brand}) and agree on what's in it, so we now know its ingredients.`;

  let started = 0;
  for (const userId of targets) {
    try {
      await proposeRoutineChange({ userId, kind: "RECHECK", trigger, subjectProductIds: [productId] });
      started += 1;
    } catch (err) {
      console.error("[community] re-check failed for one person:", err);
    }
  }
  return started;
}

/**
 * Everything that follows a new label photo, run in the background: look at
 * the person's own routine again, then see whether the shared library has
 * learned something new (and if so, look at everyone else's).
 */
export async function afterLabelPhoto(userId: string, productId: string): Promise<void> {
  try {
    const inRoutine = await prisma.routineStep.findFirst({
      where: { productId, active: true, routine: { userId, status: { in: ["ACTIVE", "PAUSED"] } } },
      select: { id: true },
    });
    if (inRoutine) {
      const product = await prisma.product.findUnique({ where: { id: productId }, select: { brand: true, name: true } });
      const result = await proposeRoutineChange({
        userId,
        kind: "RECHECK",
        trigger: `You added a photo of your ${product?.name ?? "product"} (${product?.brand ?? ""}), so we now know exactly what is in it.`,
        subjectProductIds: [productId],
      });
      if (!result.ok) console.error("[photo] routine re-check did not complete:", result);
    }
  } catch (err) {
    console.error("[photo] routine re-check failed:", err);
  }

  try {
    const consensus = await checkCommunityConsensus(productId);
    if (consensus.promoted) {
      const n = await recheckAfterLibraryChange(productId, consensus.hadList);
      console.info(`[community] ${consensus.people} people agree on product ${productId}; library updated; ${n} routine(s) re-checked`);
    }
  } catch (err) {
    console.error("[community] consensus check failed:", err);
  }
}
