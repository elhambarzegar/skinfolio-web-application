import { describe, expect, it } from "vitest";
import { tidyText } from "./text";

describe("tidyText", () => {
  it("leaves short text alone", () => {
    expect(tidyText("Use it at night.", 100)).toBe("Use it at night.");
  });
  it("keeps whole sentences up to the limit and drops the rest", () => {
    const text = "Retinol belongs at night. It makes skin sensitive to sun. Keep wearing sunscreen every morning.";
    expect(tidyText(text, 60)).toBe("Retinol belongs at night. It makes skin sensitive to sun.");
  });
  it("always keeps the first sentence, even when it is long", () => {
    const first = "This is one fairly long sentence that is over the limit by itself.";
    expect(tidyText(`${first} Second one.`, 20)).toBe(first);
  });
  it("does not split on e.g. or on decimals", () => {
    expect(tidyText("Use a pea-sized amount, e.g. once at night. Then stop.", 40)).toBe("Use a pea-sized amount, e.g. once at night.");
    expect(tidyText("Use SPF 30. Reapply.", 12)).toBe("Use SPF 30.");
  });
  it("removes rule numbers and extra spaces", () => {
    expect(tidyText("Sunscreen goes last (Rule 1).   Always.", 100)).toBe("Sunscreen goes last. Always.");
  });
  it("copes with nothing", () => {
    expect(tidyText("", 50)).toBe("");
  });
});
