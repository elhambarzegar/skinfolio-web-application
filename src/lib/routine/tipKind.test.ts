import { describe, expect, it } from "vitest";
import { tipKind } from "./tipKind";

describe("tipKind", () => {
  it("treats an addition as something to shop for", () => {
    expect(tipKind({ actionType: "ADD" }, { alternativeFrequency: null, suggestedDescription: "mineral SPF 30+" })).toBe("shop");
  });

  it("treats a swap to a different kind of product as a swap", () => {
    expect(tipKind({ actionType: "CHANGE" }, { alternativeFrequency: null, suggestedDescription: "a gentler cleanser" })).toBe("swap");
  });

  it("lets a frequency change be accepted, even with a swap suggestion beside it", () => {
    expect(tipKind({ actionType: "CHANGE" }, { alternativeFrequency: 3, suggestedDescription: "a gentler retinol" })).toBe("decide");
    expect(tipKind({ actionType: "CHANGE" }, { alternativeFrequency: 3, suggestedDescription: null })).toBe("decide");
  });

  it("lets a removal be accepted or rejected", () => {
    expect(tipKind({ actionType: "REMOVE" }, { alternativeFrequency: null, suggestedDescription: null })).toBe("decide");
  });
});
