import { describe, expect, it } from "vitest";
import { pickSource, type SourceLike } from "./shelf";

const src = (id: string, origin: string): SourceLike => ({
  id,
  origin,
  ingredientsInci: "Aqua, Glycerin",
  confidenceScore: 80,
  fetchedAt: new Date("2026-01-01"),
  sourceUrl: null,
});

describe("pickSource", () => {
  it("uses the person's own photo over the library", () => {
    const r = pickSource(src("lib", "RETAILER"), src("mine", "USER_PHOTO"));
    expect(r.source?.id).toBe("mine");
    expect(r.fromPhoto).toBe(true);
  });

  it("falls back to the library when there is no photo", () => {
    const r = pickSource(src("lib", "RETAILER"), null);
    expect(r.source?.id).toBe("lib");
    expect(r.fromPhoto).toBe(false);
  });

  it("has nothing when there is neither", () => {
    expect(pickSource(null, null)).toEqual({ source: null, fromPhoto: false });
  });

  it("uses the photo even when the library has nothing", () => {
    expect(pickSource(null, src("mine", "USER_PHOTO")).fromPhoto).toBe(true);
  });
});
