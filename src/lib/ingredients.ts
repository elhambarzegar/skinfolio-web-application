/**
 * Comparing ingredient lists from different people's label photos. Two
 * photos of the same bottle are rarely letter-for-letter identical (case,
 * punctuation, "Aqua" or "Water", an ingredient the camera skipped), so lists
 * are reduced to their ingredient names and compared as sets.
 */

const WATER = /^(aqua|water|eau)([\s/]+(aqua|water|eau))*$/;
const FRAGRANCE = /^(parfum|fragrance|perfume)([\s/]+(parfum|fragrance|perfume))*$/;

/** A list as clean, comparable ingredient names, in the order printed, each once. */
export function normalizeIngredients(text: string): string[] {
  const parts = text
    .toLowerCase()
    // "Active ingredient: …  Inactive ingredients: …" are just more of the same list.
    .replace(/\b(in)?active\s+ingredients?\s*:/g, ",")
    .replace(/^\s*ingredients?\s*:/, "")
    .split(/[,;\n•·]+/);

  const seen = new Set<string>();
  const out: string[] = [];
  for (const raw of parts) {
    let p = raw
      .replace(/\([^)]*\)/g, " ") // alternative names in brackets
      .replace(/\d+(?:[.,]\d+)?\s?%/g, " ") // strengths
      .replace(/[*†‡]/g, " ")
      .replace(/[.\s]+$/g, "")
      .replace(/\s{2,}/g, " ")
      .trim();
    if (WATER.test(p)) p = "water";
    else if (FRAGRANCE.test(p)) p = "fragrance";
    if (p.length < 2 || seen.has(p)) continue;
    seen.add(p);
    out.push(p);
  }
  return out;
}

/** 0 to 1: how much of two lists' ingredients is shared (the same ingredients, in any order, is 1). */
export function similarity(a: string[], b: string[]): number {
  if (a.length === 0 || b.length === 0) return 0;
  const setB = new Set(b);
  let shared = 0;
  for (const x of new Set(a)) if (setB.has(x)) shared += 1;
  const union = new Set([...a, ...b]).size;
  return shared / union;
}

export type Report<T> = { reporterId: string; ingredients: string[]; ref: T };

export type Consensus<T> = {
  /** Everyone whose list agrees. */
  members: Report<T>[];
  /** The member whose list is closest to all the others: the one to publish. */
  chosen: Report<T>;
  people: number;
};

/** Reports within this similarity count as the same list. About one skipped ingredient on a 25-item list. */
export const SAME_LIST = 0.95;
/** How many different people must agree before the shared library changes. */
export const PEOPLE_NEEDED = 3;

/**
 * The largest group of at least `minPeople` different people whose lists
 * agree, or null. One person counts once, however many photos they took.
 */
export function findConsensus<T>(
  reports: Report<T>[],
  { minPeople = PEOPLE_NEEDED, threshold = SAME_LIST }: { minPeople?: number; threshold?: number } = {}
): Consensus<T> | null {
  let best: { members: Report<T>[]; people: number; score: number } | null = null;

  for (const pivot of reports) {
    const members = reports.filter((r) => r === pivot || similarity(pivot.ingredients, r.ingredients) >= threshold);
    const people = new Set(members.map((m) => m.reporterId)).size;
    if (people < minPeople) continue;
    const score = members.reduce((sum, m) => sum + similarity(pivot.ingredients, m.ingredients), 0);
    if (!best || people > best.people || (people === best.people && score > best.score)) best = { members, people, score };
  }
  if (!best) return null;

  // Publish the list closest to all the others (a skipped ingredient in one
  // photo shouldn't be the version that wins); on a tie, the fuller one.
  let chosen = best.members[0];
  let chosenScore = -1;
  for (const m of best.members) {
    const score = best.members.reduce((sum, o) => sum + similarity(m.ingredients, o.ingredients), 0);
    if (score > chosenScore || (score === chosenScore && m.ingredients.length > chosen.ingredients.length)) {
      chosen = m;
      chosenScore = score;
    }
  }
  return { members: best.members, chosen, people: best.people };
}
