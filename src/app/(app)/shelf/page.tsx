import Link from "next/link";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { confidenceBucket } from "@/lib/productLookup/confidence";
import { OwnedProductsList } from "@/components/owned-products-list";
import { AddProductButton } from "@/components/add-product-button";

export default async function ShelfPage() {
  const session = await auth();
  const userId = session!.user.id;

  const [intake, routine] = await Promise.all([
    prisma.intakeResponse.findFirst({
      where: { userId },
      orderBy: { createdAt: "desc" },
      include: { ownedProducts: { include: { currentSource: true } } },
    }),
    prisma.routine.findFirst({
      where: { userId, status: { in: ["ACTIVE", "PAUSED"] } },
      select: { id: true },
    }),
  ]);

  if (!intake) {
    return (
      <div className="flex flex-col gap-5">
        <h1 className="page-title">My shelf</h1>
        <div className="callout c-sky">
          <h2>Nothing on your shelf yet</h2>
          <p>Tell us what you already use and it will show up here.</p>
          <Link href="/onboarding" className="btn">
            Start
          </Link>
        </div>
      </div>
    );
  }

  const count = intake.ownedProducts.length;

  return (
    <div className="flex flex-col gap-5">
      <div>
        <h1 className="page-title">My shelf</h1>
        <p className="sub">
          {count} product{count === 1 ? "" : "s"}. Not all are used every day.
        </p>
      </div>

      <div className="card">
        <OwnedProductsList
          products={intake.ownedProducts.map((p) => ({
            id: p.id,
            brand: p.brand,
            name: p.name,
            bucket: p.currentSource ? confidenceBucket(p.currentSource.confidenceScore) : null,
            origin: p.currentSource?.origin ?? null,
            fetchedAt: p.currentSource?.fetchedAt.toISOString() ?? null,
          }))}
        />
      </div>

      {routine && <AddProductButton />}
    </div>
  );
}
