import { redirect } from "next/navigation";
import Link from "next/link";
import { auth } from "@/auth";
import { BRAND } from "@/lib/brand";
import { prisma } from "@/lib/prisma";
import { OnboardingForm, type OnboardingInitial } from "./onboarding-form";

export default async function OnboardingPage() {
  const session = await auth();

  if (!session?.user) {
    redirect("/login");
  }

  // Redoing the intake starts from what they gave last time, and from their shelf.
  const [intake, shelf] = await Promise.all([
    prisma.intakeResponse.findFirst({ where: { userId: session.user.id }, orderBy: { createdAt: "desc" } }),
    prisma.shelfItem.findMany({ where: { userId: session.user.id }, orderBy: { addedAt: "asc" }, include: { product: true } }),
  ]);
  const initial: OnboardingInitial | null = intake
    ? {
        concerns: intake.concerns,
        questionnaire: intake.questionnaire,
        experienceLevel: intake.experienceLevel,
        priority: intake.priority,
        complexityPreference: intake.complexityPreference,
        safetyAcknowledged: intake.safetyAcknowledged,
        products: shelf.map((i) => ({ brand: i.product.brand, name: i.product.name, productId: i.productId })),
      }
    : null;

  return (
    <main className="flex flex-1 justify-center px-5 py-10">
      <div className="w-full max-w-[560px]">
        <Link href="/" className="eyebrow">
          {BRAND.name}
        </Link>
        <OnboardingForm initial={initial} />
      </div>
    </main>
  );
}
