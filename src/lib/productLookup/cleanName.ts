// A pack size ("473mL", "16 fl oz", "1.7 oz", "50 g") says nothing about what
// is inside the bottle, and it often makes a search miss: the same product is
// listed under different sizes in different shops.
const PACK_SIZE = /\b\d+(?:[.,]\d+)?\s?(?:fl\.?\s?oz|oz|ml|l|g|kg|mg)\b\.?/gi;

/** The product name without pack sizes or the dangling commas they leave behind. */
export function cleanProductName(name: string): string {
  return name
    .replace(PACK_SIZE, " ")
    .replace(/\s+([,;])/g, "$1")
    .replace(/[\s,;–—-]+$/g, "")
    .replace(/^[\s,;–—-]+/g, "")
    .replace(/\s{2,}/g, " ")
    .trim();
}
