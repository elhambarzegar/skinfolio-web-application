export type AuthorityTier = "brand_site" | "structured_db" | "retailer" | "other";
export type ExtractionTier = "structured" | "labeled" | "inferred";
export type DatePrecisionTier = "EXACT" | "MONTH" | "YEAR" | "UNKNOWN";

const AUTHORITY_POINTS: Record<AuthorityTier, number> = {
  brand_site: 40,
  structured_db: 30,
  retailer: 25,
  other: 10,
};

const EXTRACTION_POINTS: Record<ExtractionTier, number> = {
  structured: 25,
  labeled: 18,
  inferred: 8,
};

export function recencyPoints(publishedAt: Date | null, precision: DatePrecisionTier): number {
  if (!publishedAt || precision === "UNKNOWN") return 5;
  const monthsSince =
    (Date.now() - publishedAt.getTime()) / (1000 * 60 * 60 * 24 * 30);
  if (monthsSince < 12) return 35;
  if (monthsSince < 36) return 20;
  return 5;
}

export type ConfidenceBreakdown = {
  authority: { tier: AuthorityTier; points: number };
  recency: { publishedAt: string | null; precision: DatePrecisionTier; points: number };
  extraction: { tier: ExtractionTier; points: number };
  total: number;
};

export function scoreConfidence(input: {
  authority: AuthorityTier;
  extraction: ExtractionTier;
  publishedAt: Date | null;
  precision: DatePrecisionTier;
}): ConfidenceBreakdown {
  const authorityPoints = AUTHORITY_POINTS[input.authority];
  const extractionPoints = EXTRACTION_POINTS[input.extraction];
  const recency = recencyPoints(input.publishedAt, input.precision);

  return {
    authority: { tier: input.authority, points: authorityPoints },
    recency: {
      publishedAt: input.publishedAt ? input.publishedAt.toISOString() : null,
      precision: input.precision,
      points: recency,
    },
    extraction: { tier: input.extraction, points: extractionPoints },
    total: authorityPoints + recency + extractionPoints,
  };
}

export function confidenceBucket(score: number): "high" | "medium" | "low" {
  if (score >= 80) return "high";
  if (score >= 50) return "medium";
  return "low";
}
