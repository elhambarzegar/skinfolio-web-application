import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { resolveProductSource } from "@/lib/productLookup";
import { resolveOwnedProducts, type OwnedProductInput } from "@/lib/productLookup/resolveOwnedProducts";
import { addToShelf } from "@/lib/shelf";
import { EXPERIENCE_OPTIONS, PRIORITY_OPTIONS, COMPLEXITY_OPTIONS } from "@/lib/intakeProfile";

const EXPERIENCE_LEVELS = EXPERIENCE_OPTIONS.map((o) => o.value);
const PRIORITIES = PRIORITY_OPTIONS.map((o) => o.value);
const COMPLEXITY_PREFERENCES = COMPLEXITY_OPTIONS.map((o) => o.value);

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

  let newProductIds: string[] = [];

  const intake = await prisma.$transaction(async (tx) => {
    const resolved = await resolveOwnedProducts(tx, ownedProducts);
    const productIds = resolved.productIds;
    newProductIds = resolved.newProductIds;

    await addToShelf(tx, session.user.id, productIds);

    return tx.intakeResponse.create({
      data: {
        userId: session.user.id,
        concerns,
        questionnaire,
        experienceLevel,
        priority,
        complexityPreference,
        safetyAcknowledged,
        ownedProducts: { connect: productIds.map((id) => ({ id })) },
      },
    });
  });

  // Best-effort: look up ingredient data for any product we haven't seen
  // before. A lookup failure (no match, no API key, network error) leaves
  // the product without a source — that's the honest "no data yet" state,
  // not a reason to fail the intake submission.
  await Promise.allSettled(newProductIds.map((id) => resolveProductSource(id)));

  return NextResponse.json({ id: intake.id });
}
