import { describe, expect, it } from "vitest";
import { cleanOps, describeOps, endPosition, freqWords, type ChangeOp, type ProductCtx, type StepCtx } from "./changes";

const steps: StepCtx[] = [
  { id: "s1", productId: "cleanser", timeOfDay: "AM", order: 1, frequencyPerWeek: 7 },
  { id: "s2", productId: "sunscreen", timeOfDay: "AM", order: 2, frequencyPerWeek: 7 },
  { id: "s3", productId: "serum", timeOfDay: "PM", order: 1, frequencyPerWeek: 7 },
  { id: "gap", productId: null, timeOfDay: "PM", order: 2, frequencyPerWeek: 7 },
];
const shelf = new Set(["retinol", "cleanser", "sunscreen", "serum", "newcream"]);

const add = (o: Partial<Extract<ChangeOp, { op: "add" }>> = {}): ChangeOp => ({
  op: "add", productId: "retinol", timeOfDay: "PM", position: 2, frequencyPerWeek: 2, timeCostMinutes: 1, rationale: "x", ...o,
});

describe("cleanOps", () => {
  it("keeps valid operations", () => {
    const ops: ChangeOp[] = [add(), { op: "frequency", stepId: "s3", frequencyPerWeek: 3, reason: "x" }, { op: "remove", stepId: "s1", reason: "x" }];
    expect(cleanOps(ops, steps, shelf)).toHaveLength(3);
  });

  it("drops products that aren't on the shelf", () => {
    expect(cleanOps([add({ productId: "invented" })], steps, shelf)).toEqual([]);
  });

  it("drops a product already in that part of the day, and a repeated add", () => {
    expect(cleanOps([add({ productId: "serum", timeOfDay: "PM" })], steps, shelf)).toEqual([]);
    expect(cleanOps([add(), add({ position: 1 })], steps, shelf)).toHaveLength(1);
  });

  it("allows the same product in the morning and the evening", () => {
    expect(cleanOps([add(), add({ timeOfDay: "AM" })], steps, shelf)).toHaveLength(2);
  });

  it("drops steps that don't exist, gaps with no product, and no-op frequency changes", () => {
    const ops: ChangeOp[] = [
      { op: "remove", stepId: "nope", reason: "x" },
      { op: "remove", stepId: "gap", reason: "x" },
      { op: "frequency", stepId: "s3", frequencyPerWeek: 7, reason: "x" },
    ];
    expect(cleanOps(ops, steps, shelf)).toEqual([]);
  });

  it("allows only one change per step", () => {
    const ops: ChangeOp[] = [
      { op: "frequency", stepId: "s3", frequencyPerWeek: 3, reason: "x" },
      { op: "remove", stepId: "s3", reason: "x" },
    ];
    expect(cleanOps(ops, steps, shelf)).toHaveLength(1);
  });

  it("only swaps in shelf products, and never a product for itself", () => {
    expect(cleanOps([{ op: "swap", stepId: "s1", productId: "invented", frequencyPerWeek: null, rationale: "x" }], steps, shelf)).toEqual([]);
    expect(cleanOps([{ op: "swap", stepId: "s1", productId: "cleanser", frequencyPerWeek: null, rationale: "x" }], steps, shelf)).toEqual([]);
    expect(cleanOps([{ op: "swap", stepId: "s1", productId: "newcream", frequencyPerWeek: null, rationale: "x" }], steps, shelf)).toHaveLength(1);
  });

  it("lets a product fill a suggested gap (a swap on a step with no product)", () => {
    const ops: ChangeOp[] = [{ op: "swap", stepId: "gap", productId: "newcream", frequencyPerWeek: null, rationale: "x" }];
    expect(cleanOps(ops, steps, shelf)).toHaveLength(1);
  });

  it("never removes a gap", () => {
    expect(cleanOps([{ op: "remove", stepId: "gap", reason: "x" }], steps, shelf)).toEqual([]);
  });

  it("stops at eight operations", () => {
    const many = Array.from({ length: 12 }, (_, i): ChangeOp => ({ op: "frequency", stepId: "s3", frequencyPerWeek: 2, reason: String(i) }));
    expect(cleanOps(many, steps, shelf).length).toBeLessThanOrEqual(8);
  });
});

describe("describeOps", () => {
  const products = new Map<string, ProductCtx>([
    ["retinol", { id: "retinol", brand: "Brand", name: "Retinol Serum" }],
    ["serum", { id: "serum", brand: "Other", name: "Hydrating Serum" }],
    ["newcream", { id: "newcream", brand: "New", name: "Cream" }],
  ]);

  it("writes plain lines for each kind of change", () => {
    const lines = describeOps(
      [add(), { op: "frequency", stepId: "s3", frequencyPerWeek: 3, reason: "x" }, { op: "swap", stepId: "s3", productId: "newcream", frequencyPerWeek: 4, rationale: "x" }, { op: "remove", stepId: "s3", reason: "x" }],
      steps,
      products
    );
    expect(lines.map((l) => l.kind)).toEqual(["add", "change", "change", "remove"]);
    expect(lines[0].text).toBe("Add Retinol Serum (Brand) to your evening routine, step 2, 2 days a week.");
    expect(lines[1].text).toBe("Use Hydrating Serum (Other) (evening) 3 days a week instead of every day.");
    expect(lines[2].text).toBe("Use Cream (New) instead of Hydrating Serum (Other) in your evening routine, step 1, 4 days a week.");
  });
});

describe("describeOps for a gap", () => {
  it("says the product fills the step that was suggested", () => {
    const products = new Map<string, ProductCtx>([["newcream", { id: "newcream", brand: "New", name: "Cream" }]]);
    const [line] = describeOps([{ op: "swap", stepId: "gap", productId: "newcream", frequencyPerWeek: null, rationale: "x" }], steps, products);
    expect(line.kind).toBe("add");
    expect(line.text).toBe("Use Cream (New) for the step we suggested in your evening routine, step 2.");
  });
});

describe("freqWords and endPosition", () => {
  it("says frequencies in words", () => {
    expect(freqWords(7)).toBe("every day");
    expect(freqWords(1)).toBe("once a week");
    expect(freqWords(3)).toBe("3 days a week");
  });

  it("goes before the sunscreen, or at the end when there isn't one", () => {
    expect(endPosition(3, 2)).toBe(3);
    expect(endPosition(3, -1)).toBe(4);
  });
});
