import { redirect } from "next/navigation";
import Link from "next/link";
import { auth } from "@/auth";
import { OnboardingForm } from "./onboarding-form";

export default async function OnboardingPage() {
  const session = await auth();

  if (!session?.user) {
    redirect("/login");
  }

  return (
    <div className="flex-1 flex flex-col">
      <header className="px-6 sm:px-10 py-5 border-b border-line">
        <Link href="/" className="text-[15px] font-bold tracking-tight text-ink">
          Skinfolio
        </Link>
      </header>
      <main className="flex-1 flex items-center justify-center px-6 py-16">
        <OnboardingForm />
      </main>
    </div>
  );
}
