import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";

const LIMIT = 8;

export async function GET(req: Request) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "You need to be logged in." }, { status: 401 });
  }

  const q = new URL(req.url).searchParams.get("q")?.trim() ?? "";
  if (q.length < 2) {
    return NextResponse.json({ products: [] });
  }

  // Prefix matches first (feels "smart"), then fill remaining slots with
  // substring matches — cheap to compute without needing a trigram index,
  // fine at the hundreds-of-brands / thousands-of-products scale this is
  // built for.
  const prefixMatches = await prisma.product.findMany({
    where: {
      OR: [
        { brand: { startsWith: q, mode: "insensitive" } },
        { name: { startsWith: q, mode: "insensitive" } },
      ],
    },
    select: { id: true, brand: true, name: true, step: true },
    take: LIMIT,
    orderBy: [{ brand: "asc" }, { name: "asc" }],
  });

  let results = prefixMatches;

  if (results.length < LIMIT) {
    const excludeIds = results.map((p) => p.id);
    const substringMatches = await prisma.product.findMany({
      where: {
        AND: [
          { id: { notIn: excludeIds } },
          {
            OR: [
              { brand: { contains: q, mode: "insensitive" } },
              { name: { contains: q, mode: "insensitive" } },
            ],
          },
        ],
      },
      select: { id: true, brand: true, name: true, step: true },
      take: LIMIT - results.length,
      orderBy: [{ brand: "asc" }, { name: "asc" }],
    });
    results = [...results, ...substringMatches];
  }

  return NextResponse.json({ products: results });
}
