import Link from "next/link";
import type { Metadata } from "next";
import { BRAND } from "@/lib/brand";
import { LegalLinks } from "@/components/legal-page";

export const metadata: Metadata = { title: `Account deleted · ${BRAND.name}` };

export default function GoodbyePage() {
  return (
    <main className="flex flex-1 flex-col items-center justify-center gap-6 px-5 py-16 text-center">
      <p className="eyebrow">{BRAND.name}</p>
      <h1 className="page-title max-w-[18ch]">Your account is deleted</h1>
      <p className="sub max-w-[30rem]">
        Your skin details, shelf, routines, progress and check-ins have been permanently removed. Thank you for trying{" "}
        {BRAND.name}.
      </p>
      <Link href="/" className="btn">
        Back to the start
      </Link>
      <LegalLinks />
    </main>
  );
}
