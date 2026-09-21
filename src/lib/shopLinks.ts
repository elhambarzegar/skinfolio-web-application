/**
 * Search links for a described (not brand-named) product suggestion — the
 * app never picks a specific product for the user, it describes what to
 * look for and sends them to shop for it themselves.
 */
export function buildShopLinks(query: string): { amazon: string; sephora: string } {
  const q = encodeURIComponent(query.trim());
  return {
    amazon: `https://www.amazon.com/s?k=${q}`,
    sephora: `https://www.sephora.com/search?keyword=${q}`,
  };
}
