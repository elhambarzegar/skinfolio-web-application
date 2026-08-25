import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";

const LIMIT = 8;
// Cap on rows scanned for dedup — fine at hundreds of brands; if the
// catalog grows past this a real Brand table with a normalized unique
// name is the next step, not a bigger scan.
const SCAN_CAP = 500;

export async function GET(req: Request) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "You need to be logged in." }, { status: 401 });
  }

  const q = new URL(req.url).searchParams.get("q")?.trim() ?? "";
  if (q.length < 2) {
    return NextResponse.json({ brands: [] });
  }

  const matches = await prisma.product.findMany({
    where: { brand: { contains: q, mode: "insensitive" } },
    select: { brand: true },
    take: SCAN_CAP,
    orderBy: { brand: "asc" },
  });

  // Products entered by hand over time can drift into near-duplicate
  // casing ("CeraVe" vs "Cerave") — collapse those into one canonical
  // name per brand instead of showing users the raw variants.
  const seen = new Map<string, string>();
  for (const { brand } of matches) {
    const key = brand.toLowerCase();
    if (!seen.has(key)) seen.set(key, brand);
  }

  const brands = Array.from(seen.values())
    .sort((a, b) => a.localeCompare(b))
    .slice(0, LIMIT);

  return NextResponse.json({ brands });
}
