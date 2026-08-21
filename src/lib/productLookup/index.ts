import { prisma } from "@/lib/prisma";
import { searchOpenBeautyFacts } from "./openBeautyFacts";
import { searchViaWebAgent, type AgentDatePrecision } from "./webSearchAgent";
import { scoreConfidence, type AuthorityTier, type DatePrecisionTier } from "./confidence";

function toPrecision(p: AgentDatePrecision): DatePrecisionTier {
  switch (p) {
    case "exact":
      return "EXACT";
    case "month":
      return "MONTH";
    case "year":
      return "YEAR";
    default:
      return "UNKNOWN";
  }
}

type ResolvedSource = {
  origin: "OPEN_BEAUTY_FACTS" | "BRAND_SITE" | "RETAILER" | "WEB_SEARCH";
  sourceUrl: string | null;
  ingredientsInci: string;
  rawExtract: string;
  publishedAt: Date | null;
  publishedAtPrecision: DatePrecisionTier;
  authority: AuthorityTier;
  extraction: "structured" | "labeled";
};

/**
 * Looks up a product's ingredient list: Open Beauty Facts first (free,
 * structured, no key needed), Claude's web-search agent as fallback (needs
 * ANTHROPIC_API_KEY). Writes an append-only ProductSource row either way —
 * or, if neither source found anything, leaves the product without a
 * current source, which is the honest "no data yet" state, not an error.
 */
export async function resolveProductSource(productId: string): Promise<void> {
  const product = await prisma.product.findUnique({ where: { id: productId } });
  if (!product) return;

  let resolved: ResolvedSource | null = null;

  try {
    const obf = await searchOpenBeautyFacts(product.brand, product.name);
    if (obf) {
      resolved = {
        origin: "OPEN_BEAUTY_FACTS",
        sourceUrl: obf.sourceUrl,
        ingredientsInci: obf.ingredientsInci,
        rawExtract: obf.ingredientsInci,
        publishedAt: obf.lastModified,
        publishedAtPrecision: obf.lastModified ? "EXACT" : "UNKNOWN",
        authority: "structured_db",
        extraction: "structured",
      };
    }
  } catch (err) {
    console.error(`[productLookup] Open Beauty Facts lookup failed for ${productId}:`, err);
  }

  if (!resolved) {
    try {
      const agent = await searchViaWebAgent(product.brand, product.name);
      if (agent) {
        const origin =
          agent.sourceType === "brand_site"
            ? "BRAND_SITE"
            : agent.sourceType === "retailer"
              ? "RETAILER"
              : "WEB_SEARCH";
        resolved = {
          origin,
          sourceUrl: agent.sourceUrl,
          ingredientsInci: agent.ingredientsInci,
          rawExtract: JSON.stringify(agent),
          publishedAt: agent.publishedAt,
          publishedAtPrecision: toPrecision(agent.publishedAtPrecision),
          authority: agent.sourceType === "brand_site" ? "brand_site" : agent.sourceType === "retailer" ? "retailer" : "other",
          extraction: "labeled",
        };
      }
    } catch (err) {
      console.error(`[productLookup] web search agent lookup failed for ${productId}:`, err);
    }
  }

  if (!resolved) return;

  const breakdown = scoreConfidence({
    authority: resolved.authority,
    extraction: resolved.extraction,
    publishedAt: resolved.publishedAt,
    precision: resolved.publishedAtPrecision,
  });

  await prisma.$transaction(async (tx) => {
    const newSource = await tx.productSource.create({
      data: {
        productId: product.id,
        origin: resolved.origin,
        sourceUrl: resolved.sourceUrl,
        ingredientsInci: resolved.ingredientsInci,
        rawExtract: resolved.rawExtract,
        publishedAt: resolved.publishedAt,
        publishedAtPrecision: resolved.publishedAtPrecision,
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
}
