import { describe, expect, it } from "vitest";
import { stripRuleNumbers } from "./policy";

describe("stripRuleNumbers", () => {
  it("removes a bracketed rule number at the end of a clause", () => {
    expect(stripRuleNumbers("Sunscreen is always the final step of a morning routine (Rule 1). It also helps.")).toBe(
      "Sunscreen is always the final step of a morning routine. It also helps."
    );
  });

  it("removes several rule numbers in one bracket", () => {
    expect(stripRuleNumbers("Retinoids belong at night (Rules 2 and 3), so keep them there.")).toBe(
      "Retinoids belong at night, so keep them there."
    );
    expect(stripRuleNumbers("Use sun protection daily (rule 2, 3).")).toBe("Use sun protection daily.");
  });

  it("removes a bracket in the middle of a sentence without leaving a double space", () => {
    expect(stripRuleNumbers("Stacking actives (Rule 9) raises irritation risk.")).toBe("Stacking actives raises irritation risk.");
  });

  it("leaves text without rule numbers alone", () => {
    expect(stripRuleNumbers("Fragrance is a common allergen, so patch test first.")).toBe(
      "Fragrance is a common allergen, so patch test first."
    );
  });

  it("does not touch other brackets", () => {
    expect(stripRuleNumbers("Apply 2 pumps (about a pea-sized amount).")).toBe("Apply 2 pumps (about a pea-sized amount).");
  });
});
