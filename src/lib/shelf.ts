import type { ShelfStatus } from "@prisma/client";
import { prisma } from "@/lib/prisma";

/** The parts of an ingredient source that the app reads. */
export type SourceLike = {
  id: string;
  origin: string;
  ingredientsInci: string;
  confidenceScore: number;
  fetchedAt: Date;
  sourceUrl: string | null;
};

export type EffectiveSource = {
  source: SourceLike | null;
  /** True when the ingredient list is the person's own label photo. */
  fromPhoto: boolean;
};

/**
 * Which ingredient list applies to this person for a product: their own
 * label photo if they took one, otherwise whatever the shared app library
 * holds. Their photo never changes what anyone else sees.
 */
export function pickSource(librarySource: SourceLike | null, photoSource: SourceLike | null): EffectiveSource {
  if (photoSource) return { source: photoSource, fromPhoto: true };
  return { source: librarySource, fromPhoto: false };
}

export type ProductView = EffectiveSource & {
  /** Null when the product isn't on this person's shelf (e.g. one being checked before adding). */
  shelfStatus: ShelfStatus | null;
};

/** The ingredient source and shelf state to use for each of these products, for this person. */
export async function productViewsFor(userId: string, productIds: string[]): Promise<Map<string, ProductView>> {
  const ids = [...new Set(productIds)];
  const [products, items] = await Promise.all([
    prisma.product.findMany({ where: { id: { in: ids } }, include: { currentSource: true } }),
    prisma.shelfItem.findMany({ where: { userId, productId: { in: ids } }, include: { photoSource: true } }),
  ]);
  const itemByProduct = new Map(items.map((i) => [i.productId, i]));

  return new Map(
    products.map((p) => {
      const item = itemByProduct.get(p.id);
      return [p.id, { ...pickSource(p.currentSource, item?.photoSource ?? null), shelfStatus: item?.status ?? null }];
    })
  );
}

/**
 * Puts products on the person's shelf. Ones already there are left as they
 * are, except that by default a product they'd run out of is back in use
 * (they've just added it again). Pass `reactivate: false` to leave existing
 * items completely alone, e.g. when a redone intake merely lists what's there.
 */
export async function addToShelf(
  tx: Pick<typeof prisma, "shelfItem">,
  userId: string,
  productIds: string[],
  options: { reactivate?: boolean } = {}
): Promise<void> {
  const reactivate = options.reactivate ?? true;
  for (const productId of new Set(productIds)) {
    await tx.shelfItem.upsert({
      where: { userId_productId: { userId, productId } },
      create: { userId, productId },
      update: reactivate ? { status: "ACTIVE", ranOutAt: null } : {},
    });
  }
}
