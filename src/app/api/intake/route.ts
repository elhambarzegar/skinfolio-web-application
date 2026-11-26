import { NextResponse, after } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { lookupMissingSources } from "@/lib/productLookup";
import { resolveOwnedProducts, type OwnedProductInput } from "@/lib/productLookup/resolveOwnedProducts";
import { addToShelf } from "@/lib/shelf";
import { renumberRoutine } from "@/lib/routine/steps";
import { proposeRoutineChange } from "@/lib/routine/proposeChange";
import { overLimit } from "@/lib/limits";
import { describeIntakeChange, detailsChanged, diffShelf } from "@/lib/intakeSync";
import { EXPERIENCE_OPTIONS, PRIORITY_OPTIONS, COMPLEXITY_OPTIONS } from "@/lib/intakeProfile";

const EXPERIENCE_LEVELS = EXPERIENCE_OPTIONS.map((o) => o.value);
const PRIORITIES = PRIORITY_OPTIONS.map((o) => o.value);
const COMPLEXITY_PREFERENCES = COMPLEXITY_OPTIONS.map((o) => o.value);

/** Looking up new products and the background routine check can take a minute or two. */
export const maxDuration = 300;

export async function POST(req: Request) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "You need to be logged in." }, { status: 401 });
  }

  const body = await req.json().catch(() => null);
  const concerns = Array.isArray(body?.concerns)
    ? body.concerns.filter((c: unknown) => typeof c === "string" && c.trim())
    : [];
  const questionnaire = typeof body?.questionnaire === "string" ? body.questionnaire.trim() : "";
  const experienceLevel = EXPERIENCE_LEVELS.includes(body?.experienceLevel) ? body.experienceLevel : null;
  const priority = PRIORITIES.includes(body?.priority) ? body.priority : null;
  const complexityPreference = COMPLEXITY_PREFERENCES.includes(body?.complexityPreference)
    ? body.complexityPreference
    : null;
  const safetyAcknowledged = body?.safetyAcknowledged === true;
  const ownedProducts: OwnedProductInput[] = Array.isArray(body?.ownedProducts)
    ? body.ownedProducts
        .filter(
          (p: unknown): p is OwnedProductInput =>
            !!p &&
            typeof p === "object" &&
            typeof (p as OwnedProductInput).brand === "string" &&
            typeof (p as OwnedProductInput).name === "string" &&
            (p as OwnedProductInput).brand.trim() !== "" &&
            (p as OwnedProductInput).name.trim() !== ""
        )
        .map((p: OwnedProductInput) => ({
          brand: p.brand.trim(),
          name: p.name.trim(),
          productId: typeof p.productId === "string" ? p.productId : null,
        }))
    : [];

  if (concerns.length === 0) {
    return NextResponse.json({ error: "Pick at least one concern." }, { status: 400 });
  }
  if (questionnaire.length < 10) {
    return NextResponse.json(
      { error: "Tell us a bit more about your skin (at least 10 characters)." },
      { status: 400 }
    );
  }
  if (!experienceLevel || !priority || !complexityPreference) {
    return NextResponse.json({ error: "Answer the profile questions before continuing." }, { status: 400 });
  }
  if (!safetyAcknowledged) {
    return NextResponse.json({ error: "You need to acknowledge the safety agreement to continue." }, { status: 400 });
  }

  const userId = session.user.id;

  // What they had before, to tell what this save changes.
  const [previous, shelfBefore] = await Promise.all([
    prisma.intakeResponse.findFirst({
      where: { userId },
      orderBy: { createdAt: "desc" },
      select: { concerns: true, experienceLevel: true, priority: true, complexityPreference: true },
    }),
    prisma.shelfItem.findMany({ where: { userId }, include: { product: { select: { brand: true, name: true } } } }),
  ]);

  const outcome = await prisma.$transaction(async (tx) => {
    const resolved = await resolveOwnedProducts(tx, ownedProducts);
    const productIds = [...new Set(resolved.productIds)];

    const intake = await tx.intakeResponse.create({
      data: {
        userId,
        concerns,
        questionnaire,
        experienceLevel,
        priority,
        complexityPreference,
        safetyAcknowledged,
        ownedProducts: { connect: productIds.map((id) => ({ id })) },
      },
    });

    // The list they gave is their shelf. Products already there are left exactly as they are
    // (a product marked as run out stays that way); new ones are added; ones left out come off.
    await addToShelf(tx, userId, productIds, { reactivate: false });
    const { added, removed } = diffShelf(shelfBefore.map((i) => i.productId), productIds);

    const routines = await tx.routine.findMany({
      where: { userId, status: { in: ["DRAFT", "ACTIVE", "PAUSED"] } },
      select: { id: true, status: true },
    });
    const hasLiveRoutine = routines.some((r) => r.status !== "DRAFT");

    // Saying you no longer have a product is the decision: its steps leave every routine,
    // and changes that were worked out with it in the picture no longer fit.
    let stepsRemoved = 0;
    if (removed.length > 0) {
      await tx.shelfItem.deleteMany({ where: { userId, productId: { in: removed } } });
      const res = await tx.routineStep.updateMany({
        where: { productId: { in: removed }, active: true, routineId: { in: routines.map((r) => r.id) } },
        data: { active: false },
      });
      stepsRemoved = res.count;
      for (const r of routines) await renumberRoutine(tx, r.id);
      await tx.routineChange.updateMany({ where: { userId, status: "PENDING" }, data: { status: "STALE" } });
    }

    const details = detailsChanged(previous, { concerns, experienceLevel, priority, complexityPreference });
    const changed = added.length > 0 || removed.length > 0 || details.concerns || details.profile;

    // A routine still being reviewed, with nothing in use yet, was built from the old details.
    // Rebuilding is the right way forward, so it is set aside.
    let draftSetAside = false;
    if (changed && !hasLiveRoutine && routines.some((r) => r.status === "DRAFT")) {
      await tx.routine.updateMany({ where: { userId, status: "DRAFT" }, data: { status: "ARCHIVED" } });
      draftSetAside = true;
    }

    return { intakeId: intake.id, productIds, added, removed, stepsRemoved, details, changed, hasLiveRoutine, draftSetAside };
  });

  // Best-effort: look up ingredient data for products we don't have it for yet (including ones
  // an earlier lookup missed). A lookup failure leaves the product without a source, which is the
  // honest "no data yet" state, not a reason to fail the save.
  await lookupMissingSources(outcome.productIds);

  const nameOf = (id: string, fallback: string) => shelfBefore.find((i) => i.productId === id)?.product.name ?? fallback;
  const removedNames = outcome.removed.map((id) => nameOf(id, "a product"));
  const addedProducts = outcome.added.length
    ? await prisma.product.findMany({ where: { id: { in: outcome.added } }, select: { id: true, name: true } })
    : [];
  const addedNames = addedProducts.map((p) => p.name);

  // Every change checks the routine: with the new details, look at the routine in use again in the
  // background. If something should change it waits for their approval on Today.
  const trigger = describeIntakeChange({ addedNames, removedNames, concerns: outcome.details.concerns, profile: outcome.details.profile });
  const checking = outcome.hasLiveRoutine && !!trigger;
  if (checking && trigger) {
    after(async () => {
      try {
        // Same fair-use limit as other routine checks; over it, the check is skipped quietly.
        if (await overLimit("changeProposals", userId)) return;
        const result = await proposeRoutineChange({ userId, kind: "RECHECK", trigger, subjectProductIds: outcome.added });
        if (!result.ok) console.error("[intake] routine re-check did not complete:", result);
      } catch (err) {
        console.error("[intake] routine re-check failed:", err);
      }
    });
  }

  return NextResponse.json({
    id: outcome.intakeId,
    updated: shelfBefore.length > 0 || !!previous,
    addedNames,
    removedNames,
    routineStepsRemoved: outcome.stepsRemoved,
    draftSetAside: outcome.draftSetAside,
    checking,
  });
}
