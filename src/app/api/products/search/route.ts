import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";

const LIMIT = 8;

export async function GET(req: Request) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "You need to be logged in." }, { status: 401 });
  }

  const url = new URL(req.url);
  const brand = url.searchParams.get("brand")?.trim() ?? "";
  const q = url.searchParams.get("q")?.trim() ?? "";

  if (!brand) {
    return NextResponse.json({ error: "A brand is required to search products." }, { status: 400 });
  }

  const nameFilter = q ? { name: { contains: q, mode: "insensitive" as const } } : {};

  // Prefix matches on the name first, then fill remaining slots with
  // substring matches — scoped to one brand, so even a short query is a
  // useful filter.
  const prefixMatches = q
    ? await prisma.product.findMany({
        where: {
          brand: { equals: brand, mode: "insensitive" },
          name: { startsWith: q, mode: "insensitive" },
        },
        select: { id: true, brand: true, name: true, step: true },
        take: LIMIT,
        orderBy: { name: "asc" },
      })
    : [];

  let results = prefixMatches;

  if (results.length < LIMIT) {
    const excludeIds = results.map((p) => p.id);
    const rest = await prisma.product.findMany({
      where: {
        AND: [
          { id: { notIn: excludeIds } },
          { brand: { equals: brand, mode: "insensitive" } },
          nameFilter,
        ],
      },
      select: { id: true, brand: true, name: true, step: true },
      take: LIMIT - results.length,
      orderBy: { name: "asc" },
    });
    results = [...results, ...rest];
  }

  return NextResponse.json({ products: results });
}
