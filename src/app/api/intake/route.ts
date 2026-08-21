import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { resolveProductSource } from "@/lib/productLookup";

type OwnedProductInput = { brand: string; name: string };

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
        .map((p: OwnedProductInput) => ({ brand: p.brand.trim(), name: p.name.trim() }))
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

  const newProductIds: string[] = [];

  const intake = await prisma.$transaction(async (tx) => {
    const productIds: string[] = [];

    for (const { brand, name } of ownedProducts) {
      const existing = await tx.product.findFirst({
        where: {
          brand: { equals: brand, mode: "insensitive" },
          name: { equals: name, mode: "insensitive" },
        },
      });

      const product =
        existing ??
        (await tx.product.create({
          data: { brand, name, step: "OTHER" },
        }));

      if (!existing) newProductIds.push(product.id);
      productIds.push(product.id);
    }

    return tx.intakeResponse.create({
      data: {
        userId: session.user.id,
        concerns,
        questionnaire,
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
