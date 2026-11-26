import { beforeEach, describe, expect, it, vi } from "vitest";

const counts = vi.hoisted(() => ({ routine: 0, change: 0, source: 0, shelf: 0, checkIn: 0, lastSince: null as Date | null }));

vi.mock("@/lib/prisma", () => ({
  prisma: {
    routine: { count: vi.fn(async ({ where }) => ((counts.lastSince = where.createdAt.gte), counts.routine)) },
    routineChange: { count: vi.fn(async () => counts.change) },
    productSource: { count: vi.fn(async () => counts.source) },
    shelfItem: { count: vi.fn(async () => counts.shelf) },
    checkIn: { count: vi.fn(async () => counts.checkIn) },
  },
}));

import { DAILY_LIMITS, overLimit } from "./limits";

beforeEach(() => Object.assign(counts, { routine: 0, change: 0, source: 0, shelf: 0, checkIn: 0, lastSince: null }));

describe("overLimit", () => {
  it("lets an account under its limit through", async () => {
    counts.routine = DAILY_LIMITS.routineBuilds.max - 1;
    expect(await overLimit("routineBuilds", "u1")).toBeNull();
  });
  it("stops an account at its limit, in plain words", async () => {
    counts.routine = DAILY_LIMITS.routineBuilds.max;
    expect(await overLimit("routineBuilds", "u1")).toBe("You've reached today's limit of 6 routine builds. It frees up again within 24 hours.");
  });
  it("counts the last 24 hours only", async () => {
    const now = new Date("2026-11-26T12:00:00Z");
    await overLimit("routineBuilds", "u1", now);
    expect(counts.lastSince?.toISOString()).toBe("2026-11-25T12:00:00.000Z");
  });
  it("limits each kind separately", async () => {
    counts.change = DAILY_LIMITS.changeProposals.max;
    expect(await overLimit("changeProposals", "u1")).toContain("routine checks");
    expect(await overLimit("labelPhotos", "u1")).toBeNull();
    counts.shelf = DAILY_LIMITS.newProducts.max;
    expect(await overLimit("newProducts", "u1")).toContain("new products");
    counts.checkIn = DAILY_LIMITS.checkIns.max;
    expect(await overLimit("checkIns", "u1")).toContain("skin check-ins");
  });
});
