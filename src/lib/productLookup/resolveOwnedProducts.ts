import type { Prisma } from "@prisma/client";

export type OwnedProductInput = { brand: string; name: string; productId: string | null };

/**
 * Resolves a list of {brand, name, productId?} entries (from the shared
 * brand/product search UI) to real Product rows — a client-supplied
 * productId is trusted once confirmed real; anything else is matched by
 * exact case-insensitive brand+name, or created fresh. Returns the full
 * resolved id list plus which ones were newly created (so the caller can
 * kick off ingredient lookup for just those).
 */
export async function resolveOwnedProducts(
  tx: Prisma.TransactionClient,
  inputs: OwnedProductInput[]
): Promise<{ productIds: string[]; newProductIds: string[] }> {
  const productIds: string[] = [];
  const newProductIds: string[] = [];

  for (const { brand, name, productId } of inputs) {
    const matchedById = productId ? await tx.product.findUnique({ where: { id: productId } }) : null;
    if (matchedById) {
      productIds.push(matchedById.id);
      continue;
    }

    const existing = await tx.product.findFirst({
      where: {
        brand: { equals: brand, mode: "insensitive" },
        name: { equals: name, mode: "insensitive" },
      },
    });

    const product = existing ?? (await tx.product.create({ data: { brand, name, step: "OTHER" } }));
    if (!existing) newProductIds.push(product.id);
    productIds.push(product.id);
  }

  return { productIds, newProductIds };
}
