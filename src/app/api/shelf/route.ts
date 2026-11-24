import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { addToShelf } from "@/lib/shelf";
import { lookupMissingSources } from "@/lib/productLookup";
import { resolveOwnedProducts } from "@/lib/productLookup/resolveOwnedProducts";
import { productViewsFor } from "@/lib/shelf";

/**
 * Puts one product on the person's shelf without touching the routine (the
 * routine only changes through an approved change). Used when a prescribed
 * product is added, and when a replacement is picked for something that ran out.
 */
export async function POST(req: Request) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "You need to be signed in." }, { status: 401 });
  }
  const userId = session.user.id;

  const body = await req.json().catch(() => null);
  const brand = typeof body?.brand === "string" ? body.brand.trim() : "";
  const name = typeof body?.name === "string" ? body.name.trim() : "";
  if (!brand || !name) {
    return NextResponse.json({ error: "Enter the brand and the product name." }, { status: 400 });
  }
  const productId = typeof body?.productId === "string" ? body.productId : null;
  const prescribed = body?.prescribed === true;
  const directions = typeof body?.directions === "string" && body.directions.trim() ? body.directions.trim().slice(0, 600) : null;

  const { productIds } = await prisma.$transaction((tx) => resolveOwnedProducts(tx, [{ brand, name, productId }]));
  const id = productIds[0];

  await prisma.$transaction(async (tx) => {
    await addToShelf(tx, userId, [id]);
    if (prescribed) {
      await tx.shelfItem.update({
        where: { userId_productId: { userId, productId: id } },
        data: { prescribed: true, directions },
      });
    }
  });

  // A replacement needs its ingredients looked up before it can be checked.
  // A prescribed product waits for the person's own photo instead.
  if (body?.lookup === true) await lookupMissingSources([id]);

  const view = (await productViewsFor(userId, [id])).get(id);
  return NextResponse.json({ productId: id, hasIngredients: !!view?.source });
}
