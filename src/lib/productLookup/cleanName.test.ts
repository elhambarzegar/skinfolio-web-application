import { describe, expect, it } from "vitest";
import { cleanProductName } from "./cleanName";

describe("cleanProductName", () => {
  it("drops a trailing pack size and the comma before it", () => {
    expect(cleanProductName("Foaming Face Wash with Niacinamide & Hyaluronic Acid, 473mL")).toBe(
      "Foaming Face Wash with Niacinamide & Hyaluronic Acid"
    );
  });

  it("drops sizes written in several ways", () => {
    expect(cleanProductName("Moisturizing Cream 16 oz")).toBe("Moisturizing Cream");
    expect(cleanProductName("Hydrating Cleanser 1.7 fl oz")).toBe("Hydrating Cleanser");
    expect(cleanProductName("Night Serum 30 ml")).toBe("Night Serum");
    expect(cleanProductName("Lip Balm 4,5g")).toBe("Lip Balm");
  });

  it("drops a size in the middle without gluing words together", () => {
    expect(cleanProductName("Daily Lotion 355mL Fragrance Free")).toBe("Daily Lotion Fragrance Free");
  });

  it("leaves numbers that are part of the product name alone", () => {
    expect(cleanProductName("Future Screen SPF 50+ Mineral Sunscreen")).toBe("Future Screen SPF 50+ Mineral Sunscreen");
    expect(cleanProductName("Vitamin C 15% Serum")).toBe("Vitamin C 15% Serum");
    expect(cleanProductName("Total effects 7 in 1")).toBe("Total effects 7 in 1");
  });

  it("does not touch words that merely end in a unit letter", () => {
    expect(cleanProductName("Gentle Cream")).toBe("Gentle Cream");
    expect(cleanProductName("Overnight Repair Barrier Cream")).toBe("Overnight Repair Barrier Cream");
  });
});
