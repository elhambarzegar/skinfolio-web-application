import Link from "next/link";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { EXPERIENCE_LABEL, PRIORITY_LABEL, COMPLEXITY_LABEL } from "@/lib/intakeProfile";
import { SignOutButton } from "@/components/sign-out-button";
import { AccountActions } from "@/components/account-actions";
import { LegalLinks } from "@/components/legal-page";
import { BRAND } from "@/lib/brand";

export default async function MePage() {
  const session = await auth();

  const [intake, account] = await Promise.all([
    prisma.intakeResponse.findFirst({ where: { userId: session!.user.id }, orderBy: { createdAt: "desc" } }),
    prisma.user.findUnique({ where: { id: session!.user.id }, select: { passwordHash: true } }),
  ]);

  return (
    <div className="flex flex-col gap-5">
      <h1 className="page-title">Me</h1>

      <div className="card flex flex-col gap-1">
        {session!.user.name && <b className="text-[22px]">{session!.user.name}</b>}
        <p className="text-ink-2">{session!.user.email}</p>
      </div>

      <details className="acc">
        <summary>My skin profile</summary>
        <div className="acc-body">
          {intake ? (
            <>
              <div className="badges">
                {intake.concerns.map((c) => (
                  <span key={c} className="badge b-cat">
                    {c}
                  </span>
                ))}
              </div>
              <p>{intake.questionnaire}</p>
              <ul className="flex flex-col gap-1 text-ink-2">
                {intake.experienceLevel && <li>{EXPERIENCE_LABEL[intake.experienceLevel]}</li>}
                {intake.priority && <li>{PRIORITY_LABEL[intake.priority]}</li>}
                {intake.complexityPreference && <li>{COMPLEXITY_LABEL[intake.complexityPreference]}</li>}
              </ul>
              <Link href="/onboarding" className="btn btn-2 btn-block">
                Redo my intake
              </Link>
            </>
          ) : (
            <Link href="/onboarding" className="btn btn-block">
              Start my intake
            </Link>
          )}
        </div>
      </details>

      <details className="acc">
        <summary>Safety agreement</summary>
        <div className="acc-body">
          <p>
            It helps you make sense of what you own, tells you which products you need and which you don&rsquo;t, and explains
            how ingredients work together.
          </p>
          <p>
            {BRAND.name} isn&rsquo;t owned by, paid by or connected to any skincare brand or store, and never promotes a brand
            or a product.
          </p>
          <p>It does not diagnose skin conditions, prescribe treatments, or replace a dermatologist.</p>
          <p>
            If you report pain, bleeding, rapidly changing spots, or other concerning symptoms, we&rsquo;ll recommend seeing a
            dermatologist.
          </p>
        </div>
      </details>

      <details className="acc">
        <summary>My data and account</summary>
        <div className="acc-body">
          <AccountActions hasPassword={!!account?.passwordHash} />
        </div>
      </details>

      <SignOutButton />
      <LegalLinks className="text-center" />
    </div>
  );
}
