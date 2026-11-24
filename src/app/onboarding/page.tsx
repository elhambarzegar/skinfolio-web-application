import { redirect } from "next/navigation";
import Link from "next/link";
import { auth } from "@/auth";
import { BRAND } from "@/lib/brand";
import { OnboardingForm } from "./onboarding-form";

export default async function OnboardingPage() {
  const session = await auth();

  if (!session?.user) {
    redirect("/login");
  }

  return (
    <main className="flex flex-1 justify-center px-5 py-10">
      <div className="w-full max-w-[560px]">
        <Link href="/" className="eyebrow">
          {BRAND.name}
        </Link>
        <OnboardingForm />
      </div>
    </main>
  );
}
