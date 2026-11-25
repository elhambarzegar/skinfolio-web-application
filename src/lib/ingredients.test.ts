import { describe, expect, it } from "vitest";
import { findConsensus, normalizeIngredients, similarity, type Report } from "./ingredients";

const LIST = "Aqua/Water/Eau, Glycerin, Niacinamide, Squalane, Cetearyl Alcohol, Bisabolol, Tocopherol, Xanthan Gum, Phenoxyethanol, Parfum";

describe("normalizeIngredients", () => {
  it("ignores case, the INGREDIENTS heading, and the final full stop", () => {
    expect(normalizeIngredients("INGREDIENTS: WATER, GLYCERIN, NIACINAMIDE.")).toEqual(["water", "glycerin", "niacinamide"]);
  });
  it("treats Aqua, Water and Eau as one", () => {
    expect(normalizeIngredients("Aqua (Water/Eau), Glycerin")).toEqual(["water", "glycerin"]);
    expect(normalizeIngredients("Aqua/Water/Eau, Glycerin")).toEqual(["water", "glycerin"]);
    expect(normalizeIngredients("Water, Glycerin")).toEqual(["water", "glycerin"]);
  });
  it("treats Parfum and Fragrance as one", () => {
    expect(normalizeIngredients("Glycerin, Parfum/Fragrance")).toEqual(["glycerin", "fragrance"]);
  });
  it("drops strengths, stars and daggers", () => {
    expect(normalizeIngredients("Zinc Oxide 20%, Niacinamide*, Squalane†")).toEqual(["zinc oxide", "niacinamide", "squalane"]);
  });
  it("reads active and inactive ingredient sections as one list", () => {
    expect(normalizeIngredients("Active Ingredient: Zinc Oxide 20%. Inactive Ingredients: Water, Glycerin")).toEqual(["zinc oxide", "water", "glycerin"]);
  });
  it("splits on semicolons and new lines, and keeps each ingredient once", () => {
    expect(normalizeIngredients("water; glycerin\nGlycerin\nsqualane")).toEqual(["water", "glycerin", "squalane"]);
  });
  it("copes with nothing", () => {
    expect(normalizeIngredients("")).toEqual([]);
  });
});

describe("similarity", () => {
  it("is 1 for the same ingredients in any order", () => {
    expect(similarity(["a", "b", "c"], ["c", "a", "b"])).toBe(1);
  });
  it("drops with each difference", () => {
    expect(similarity(["a", "b", "c", "d"], ["a", "b", "c"])).toBeCloseTo(0.75);
    expect(similarity(["a"], ["b"])).toBe(0);
  });
  it("is 0 when either list is empty", () => {
    expect(similarity([], ["a"])).toBe(0);
  });
});

const report = (reporterId: string, text: string): Report<string> => ({ reporterId, ingredients: normalizeIngredients(text), ref: reporterId });

describe("findConsensus", () => {
  it("needs three different people", () => {
    expect(findConsensus([report("a", LIST), report("b", LIST)])).toBeNull();
    expect(findConsensus([report("a", LIST), report("b", LIST), report("c", LIST)])?.people).toBe(3);
  });
  it("counts one person once, however many photos", () => {
    expect(findConsensus([report("a", LIST), report("a", LIST), report("b", LIST)])).toBeNull();
  });
  it("lets harmless differences still agree: wording of water, case, punctuation", () => {
    const c = findConsensus([
      report("a", LIST),
      report("b", "INGREDIENTS: WATER, GLYCERIN, NIACINAMIDE, SQUALANE, CETEARYL ALCOHOL, BISABOLOL, TOCOPHEROL, XANTHAN GUM, PHENOXYETHANOL, FRAGRANCE."),
      report("c", "water; glycerin; niacinamide; squalane; cetearyl alcohol; bisabolol; tocopherol; xanthan gum; phenoxyethanol; parfum"),
    ]);
    expect(c?.people).toBe(3);
  });
  it("tolerates one ingredient the camera skipped, and publishes the fuller list", () => {
    const twenty = Array.from({ length: 25 }, (_, i) => `ingredient${i}`).join(", ");
    const skipped = Array.from({ length: 24 }, (_, i) => `ingredient${i}`).join(", ");
    const c = findConsensus([report("a", twenty), report("b", twenty), report("c", skipped)]);
    expect(c?.people).toBe(3);
    expect(c?.chosen.ingredients).toHaveLength(25);
  });
  it("does not count a genuinely different list", () => {
    const other = "Water, Zinc Oxide, Titanium Dioxide, Dimethicone, Alcohol";
    expect(findConsensus([report("a", LIST), report("b", LIST), report("c", other)])).toBeNull();
  });
  it("finds the group that agrees even when others disagree", () => {
    const other = "Water, Zinc Oxide, Titanium Dioxide, Dimethicone, Alcohol";
    const c = findConsensus([report("a", LIST), report("x", other), report("b", LIST), report("y", other), report("c", LIST)]);
    expect(c?.members.map((m) => m.reporterId).sort()).toEqual(["a", "b", "c"]);
  });
  it("chooses the larger group when two lists each have enough people", () => {
    const other = "Water, Zinc Oxide, Titanium Dioxide, Dimethicone, Alcohol";
    const reports = ["a", "b", "c", "d"].map((id) => report(id, LIST)).concat(["x", "y", "z"].map((id) => report(id, other)));
    expect(findConsensus(reports)?.people).toBe(4);
  });
});
