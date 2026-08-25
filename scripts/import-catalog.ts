/**
 * One-off catalog import: takes a JSON array of products (produced from a
 * spreadsheet export — see scratch notes) and writes them as real
 * ProductSource-backed catalog entries, using the same confidence-scoring
 * logic the live product-lookup agent uses. Run with:
 *
 *   npx tsx scripts/import-catalog.ts <path-to-json> [--origin=RETAILER] [--published=YYYY-MM-DD]
 *
 * Input row shape: { step, brand, name, priceCad?, size?, description?, ingredientsInci, sourceUrl? }
 */
import { readFileSync } from "node:fs";
import { PrismaClient } from "@prisma/client";
import { scoreConfidence } from "../src/lib/productLookup/confidence";

const prisma = new PrismaClient();

type InputRow = {
  step: "CLEANSE" | "TREAT" | "MOISTURIZE" | "PROTECT" | "OTHER";
  brand: string;
  name: string;
  priceCad?: number | null;
  size?: string | null;
  description?: string | null;
  ingredientsInci?: string | null;
  sourceUrl?: string | null;
};

async function main() {
  const [jsonPath, ...flags] = process.argv.slice(2);
  if (!jsonPath) {
    console.error("Usage: npx tsx scripts/import-catalog.ts <path-to-json> [--origin=RETAILER] [--published=YYYY-MM-DD]");
    process.exit(1);
  }

  const originFlag = flags.find((f) => f.startsWith("--origin="))?.split("=")[1] ?? "RETAILER";
  const publishedFlag = flags.find((f) => f.startsWith("--published="))?.split("=")[1];
  const publishedAt = publishedFlag ? new Date(publishedFlag) : new Date();

  const rows: InputRow[] = JSON.parse(readFileSync(jsonPath, "utf-8"));
  console.log(`Importing ${rows.length} products (origin=${originFlag}, published=${publishedAt.toISOString().slice(0, 10)})...`);

  let created = 0;
  let updated = 0;
  let sourced = 0;

  for (const row of rows) {
    if (!row.brand || !row.name) continue;

    const existing = await prisma.product.findFirst({
      where: {
        brand: { equals: row.brand, mode: "insensitive" },
        name: { equals: row.name, mode: "insensitive" },
      },
    });

    const product = existing
      ? await prisma.product.update({
          where: { id: existing.id },
          data: {
            step: row.step,
            priceCad: row.priceCad ?? existing.priceCad,
            size: row.size ?? existing.size,
            description: row.description ?? existing.description,
          },
        })
      : await prisma.product.create({
          data: {
            step: row.step,
            brand: row.brand,
            name: row.name,
            priceCad: row.priceCad ?? null,
            size: row.size ?? null,
            description: row.description ?? null,
          },
        });

    existing ? updated++ : created++;

    if (!row.ingredientsInci) continue;

    const breakdown = scoreConfidence({
      authority: originFlag === "BRAND_SITE" ? "brand_site" : originFlag === "OPEN_BEAUTY_FACTS" ? "structured_db" : "retailer",
      extraction: "structured",
      publishedAt,
      precision: "EXACT",
    });

    await prisma.$transaction(async (tx) => {
      const newSource = await tx.productSource.create({
        data: {
          productId: product.id,
          origin: originFlag as "RETAILER" | "BRAND_SITE" | "OPEN_BEAUTY_FACTS" | "WEB_SEARCH",
          sourceUrl: row.sourceUrl ?? null,
          ingredientsInci: row.ingredientsInci!,
          rawExtract: row.ingredientsInci!,
          publishedAt,
          publishedAtPrecision: "EXACT",
          confidenceScore: breakdown.total,
          confidenceBreakdown: breakdown,
          status: "PENDING",
        },
      });

      if (product.currentSourceId) {
        await tx.productSource.update({
          where: { id: product.currentSourceId },
          data: { status: "SUPERSEDED", supersededById: newSource.id },
        });
      }

      await tx.product.update({
        where: { id: product.id },
        data: { currentSourceId: newSource.id },
      });
    });

    sourced++;
  }

  console.log(`Done. Created ${created}, updated ${updated}, sourced ${sourced} products.`);
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
