import { prisma } from "@/lib/prisma";

/**
 * A fair-use limit per account per 24 hours on the things that cost real
 * money (each one calls the AI). Generous for a person using the app, but a
 * single account can't run up the bill. Counted from rows the app already
 * keeps, so there is nothing extra to store.
 */
export const DAILY_LIMITS = {
  routineBuilds: { max: 6, what: "routine builds" },
  changeProposals: { max: 30, what: "routine checks" },
  labelPhotos: { max: 20, what: "label photos" },
  newProducts: { max: 40, what: "new products" },
  checkIns: { max: 20, what: "skin check-ins" },
} as const;

export type LimitKind = keyof typeof DAILY_LIMITS;

const DAY_MS = 24 * 60 * 60 * 1000;

async function countSince(kind: LimitKind, userId: string, since: Date): Promise<number> {
  switch (kind) {
    case "routineBuilds":
      return prisma.routine.count({ where: { userId, createdAt: { gte: since } } });
    case "changeProposals":
      return prisma.routineChange.count({ where: { userId, createdAt: { gte: since } } });
    case "labelPhotos":
      return prisma.productSource.count({ where: { reporterId: userId, origin: "USER_PHOTO", fetchedAt: { gte: since } } });
    case "newProducts":
      return prisma.shelfItem.count({ where: { userId, addedAt: { gte: since } } });
    case "checkIns":
      return prisma.checkIn.count({ where: { userId, createdAt: { gte: since } } });
  }
}

/** A plain-language message when the account is over its limit, otherwise null. */
export async function overLimit(kind: LimitKind, userId: string, now: Date = new Date()): Promise<string | null> {
  const { max, what } = DAILY_LIMITS[kind];
  const used = await countSince(kind, userId, new Date(now.getTime() - DAY_MS));
  return used >= max ? `You've reached today's limit of ${max} ${what}. It frees up again within 24 hours.` : null;
}
