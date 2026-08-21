type OBFProduct = {
  product_name?: string;
  brands?: string;
  ingredients_text?: string;
  last_modified_t?: number;
  url?: string;
};

type OBFSearchResponse = {
  products?: OBFProduct[];
};

export type OpenBeautyFactsMatch = {
  ingredientsInci: string;
  sourceUrl: string | null;
  lastModified: Date | null;
};

/**
 * Text search only (no barcode) — Open Beauty Facts is crowdsourced, so a
 * result only counts as a match when the brand actually appears in the
 * result's own brands field. A same-name-different-brand hit is worse than
 * no match, since it would silently attach the wrong ingredient list.
 */
export async function searchOpenBeautyFacts(
  brand: string,
  name: string
): Promise<OpenBeautyFactsMatch | null> {
  const searchTerms = encodeURIComponent(`${brand} ${name}`);
  const url =
    `https://world.openbeautyfacts.org/cgi/search.pl` +
    `?search_terms=${searchTerms}&search_simple=1&action=process&json=1` +
    `&page_size=5&fields=product_name,brands,ingredients_text,last_modified_t,url`;

  const res = await fetch(url, {
    headers: { "User-Agent": "Skinfolio/1.0 (skincare routine app)" },
    signal: AbortSignal.timeout(8000),
  });

  if (!res.ok) return null;

  const data: OBFSearchResponse = await res.json();
  const products = data.products ?? [];

  const brandLower = brand.trim().toLowerCase();
  const match = products.find(
    (p) =>
      p.ingredients_text &&
      p.ingredients_text.trim().length > 0 &&
      p.brands &&
      p.brands.toLowerCase().includes(brandLower)
  );

  if (!match || !match.ingredients_text) return null;

  return {
    ingredientsInci: match.ingredients_text.trim(),
    sourceUrl: match.url ?? null,
    lastModified: match.last_modified_t ? new Date(match.last_modified_t * 1000) : null,
  };
}
