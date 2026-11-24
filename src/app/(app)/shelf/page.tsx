import Link from "next/link";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { CATEGORY_LABEL } from "@/lib/productCategory";
import { pickSource } from "@/lib/shelf";
import { freqPhrase } from "@/lib/schedule";
import { AddProductButton } from "@/components/add-product-button";
import { ShelfList, type ShelfProduct } from "@/components/shelf-list";

export default async function ShelfPage() {
  const session = await auth();
  const userId = session!.user.id;

  const [items, routine, intake] = await Promise.all([
    prisma.shelfItem.findMany({
      where: { userId },
      orderBy: { addedAt: "asc" },
      include: { product: { include: { currentSource: true } }, photoSource: true },
    }),
    // Where each product is used comes from the routine in use, not from the shelf.
    prisma.routine.findFirst({
      where: { userId, status: { in: ["ACTIVE", "PAUSED"] } },
      orderBy: { createdAt: "desc" },
      include: {
        steps: {
          where: { active: true, productId: { not: null }, proposal: { not: "ADD" } },
          orderBy: [{ timeOfDay: "asc" }, { order: "asc" }],
        },
      },
    }),
    prisma.intakeResponse.findFirst({ where: { userId }, select: { id: true } }),
  ]);

  if (items.length === 0) {
    return (
      <div className="flex flex-col gap-5">
        <h1 className="page-title">My shelf</h1>
        <div className="callout c-sky">
          <h2>Nothing on your shelf yet</h2>
          <p>Tell us what you already use and it will show up here.</p>
          {intake ? (
            routine && <AddProductButton />
          ) : (
            <Link href="/onboarding" className="btn">
              Start
            </Link>
          )}
        </div>
      </div>
    );
  }

  const products: ShelfProduct[] = items.map((item) => {
    const { source, fromPhoto } = pickSource(item.product.currentSource, item.photoSource);
    const uses = (routine?.steps ?? [])
      .filter((s) => s.productId === item.productId)
      .map((s) => `${s.timeOfDay === "AM" ? "Morning" : "Evening"} · ${freqPhrase(s.frequencyPerWeek)}`);

    return {
      productId: item.productId,
      brand: item.product.brand,
      name: item.product.name,
      category: item.product.step,
      categoryLabel: CATEGORY_LABEL[item.product.step] ?? "Other",
      ranOut: item.status === "RAN_OUT",
      uses,
      ingredients: source
        ? {
            text: source.ingredientsInci,
            fromPhoto,
            origin: source.origin,
            date: source.fetchedAt.toISOString(),
            bucket: source.confidenceScore >= 80 ? "high" : source.confidenceScore >= 50 ? "medium" : "low",
          }
        : null,
    };
  });

  const count = products.length;

  return (
    <div className="flex flex-col gap-5">
      <div>
        <h1 className="page-title">My shelf</h1>
        <p className="sub">
          {count} product{count === 1 ? "" : "s"}. Not all are used every day.
        </p>
      </div>

      <ShelfList products={products} />

      {routine && <AddProductButton />}
    </div>
  );
}
