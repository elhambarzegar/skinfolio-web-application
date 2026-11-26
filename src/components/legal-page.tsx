import Link from "next/link";
import type { ReactNode } from "react";
import { BRAND, LEGAL } from "@/lib/brand";

/** "Privacy Policy · Terms", used wherever a person might want to read them. */
export function LegalLinks({ className = "" }: { className?: string }) {
  return (
    <p className={`note ${className}`}>
      <Link href="/privacy" className="underline underline-offset-4">
        Privacy Policy
      </Link>
      {" · "}
      <Link href="/terms" className="underline underline-offset-4">
        Terms of Use
      </Link>
    </p>
  );
}

export function LegalPage({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div className="flex flex-1 flex-col">
      <header className="flex items-center justify-between gap-3 px-5 py-4 sm:px-10">
        <Link href="/" className="font-heading text-[28px] font-bold leading-none">
          {BRAND.name}
        </Link>
        <Link href="/login" className="btn btn-2 btn-sm">
          Sign in
        </Link>
      </header>
      <main className="mx-auto flex w-full max-w-[680px] flex-1 flex-col gap-7 px-5 pb-16 pt-6">
        <div>
          <h1 className="page-title">{title}</h1>
          <p className="note mt-2">Last updated {LEGAL.updated}</p>
        </div>
        {children}
      </main>
      <footer className="px-5 py-8 text-center">
        <LegalLinks />
      </footer>
    </div>
  );
}

export function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="flex flex-col gap-3 text-[19px] leading-relaxed">
      <h2 className="font-heading text-[26px] font-bold leading-tight">{title}</h2>
      {children}
    </section>
  );
}

export function Bullets({ items }: { items: ReactNode[] }) {
  return (
    <ul className="flex list-outside list-disc flex-col gap-2 pl-6">
      {items.map((it, i) => (
        <li key={i}>{it}</li>
      ))}
    </ul>
  );
}
