import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { lookupMissingSources } from "@/lib/productLookup";
import { resolveOwnedProducts, type OwnedProductInput } from "@/lib/productLookup/resolveOwnedProducts";
import { compareProductsToRoutine } from "@/lib/routine/compareProducts";

export async function POST(req: Request) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "You need to be logged in." }, { status: 401 });
  }

  const body = await req.json().catch(() => null);
  const products: OwnedProductInput[] = Array.isArray(body?.products)
    ? body.products
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

  if (products.length === 0) {
    return NextResponse.json({ error: "Add at least one product." }, { status: 400 });
  }

  // Optional: check against a routine still being reviewed, and/or fill one
  // of its suggested gaps. Only the person's own routine is ever used.
  const routineId = typeof body?.routineId === "string" ? body.routineId : undefined;
  const fillStepId = typeof body?.fillStepId === "string" ? body.fillStepId : undefined;
  if (routineId) {
    const owned = await prisma.routine.findFirst({
      where: { id: routineId, userId: session.user.id, status: { not: "ARCHIVED" } },
      select: { id: true },
    });
    if (!owned) return NextResponse.json({ error: "Routine not found." }, { status: 404 });
  }

  const { productIds } = await prisma.$transaction((tx) => resolveOwnedProducts(tx, products));

  // Wait for lookups here (unlike intake's fire-and-forget) — the comparison
  // right below needs whatever ingredient data is available. This also
  // retries products whose earlier lookup found nothing.
  await lookupMissingSources(productIds);

  const result = await compareProductsToRoutine(session.user.id, productIds, { routineId, fillStepId });

  if (!result.ok) {
    if (result.reason === "no_routine") {
      return NextResponse.json({ error: "Build a routine first before adding products to it." }, { status: 400 });
    }
    return NextResponse.json({ error: result.message }, { status: 502 });
  }

  return NextResponse.json({ results: result.results });
}
