import { describe, expect, it } from "vitest";
import { describeIntakeChange, detailsChanged, diffShelf } from "./intakeSync";

describe("diffShelf", () => {
  it("finds what was added and what was left out", () => {
    expect(diffShelf(["a", "b", "c"], ["b", "c", "d"])).toEqual({ added: ["d"], removed: ["a"] });
  });
  it("sees no change when the lists match, in any order", () => {
    expect(diffShelf(["a", "b"], ["b", "a"])).toEqual({ added: [], removed: [] });
  });
  it("treats an emptied list as removing everything", () => {
    expect(diffShelf(["a", "b"], [])).toEqual({ added: [], removed: ["a", "b"] });
  });
  it("ignores a product listed twice", () => {
    expect(diffShelf([], ["a", "a"])).toEqual({ added: ["a"], removed: [] });
  });
});

const base = { concerns: ["Dullness", "Dryness"], experienceLevel: "A", priority: "B", complexityPreference: "C" };

describe("detailsChanged", () => {
  it("is false the first time, and when nothing differs", () => {
    expect(detailsChanged(null, base)).toEqual({ concerns: false, profile: false });
    expect(detailsChanged(base, { ...base, concerns: ["Dryness", "Dullness"] })).toEqual({ concerns: false, profile: false });
  });
  it("sees changed concerns and changed profile separately", () => {
    expect(detailsChanged(base, { ...base, concerns: ["Dullness"] }).concerns).toBe(true);
    expect(detailsChanged(base, { ...base, priority: "Z" }).profile).toBe(true);
  });
});

describe("describeIntakeChange", () => {
  it("says nothing when nothing changed", () => {
    expect(describeIntakeChange({ addedNames: [], removedNames: [], concerns: false, profile: false })).toBeNull();
  });
  it("lists what changed in one sentence", () => {
    expect(describeIntakeChange({ addedNames: ["Cream"], removedNames: ["Serum"], concerns: false, profile: false })).toBe(
      "You redid your details and added Cream and removed Serum."
    );
  });
  it("joins several kinds of change with commas and a final 'and'", () => {
    expect(describeIntakeChange({ addedNames: ["Cream"], removedNames: ["Serum"], concerns: true, profile: false })).toBe(
      "You redid your details and added Cream, removed Serum and changed your skin concerns."
    );
  });
  it("shortens a long list", () => {
    const t = describeIntakeChange({ addedNames: ["a", "b", "c", "d", "e"], removedNames: [], concerns: false, profile: false });
    expect(t).toBe("You redid your details and added a, b, c and 2 more.");
  });
});
