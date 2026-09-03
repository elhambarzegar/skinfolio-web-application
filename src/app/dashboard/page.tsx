import { redirect } from "next/navigation";
import Link from "next/link";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { confidenceBucket } from "@/lib/productLookup/confidence";
import { EXPERIENCE_LABEL, PRIORITY_LABEL, COMPLEXITY_LABEL } from "@/lib/intakeProfile";
import { RULE_SOURCES } from "@/lib/routine/policy";
import { SignOutButton } from "./sign-out-button";
import { BuildRoutineButton } from "./build-routine-button";
import { OwnedProductsList } from "./owned-products-list";
import { AddProductButton } from "./add-product-button";
import { ProTipsList } from "@/components/pro-tips-list";


export default async function DashboardPage() {
  const session = await auth();

  if (!session?.user) {
    redirect("/login");
  }

  const intake = await prisma.intakeResponse.findFirst({
    where: { userId: session.user.id },
    orderBy: { createdAt: "desc" },
    include: { ownedProducts: { include: { currentSource: true } } },
  });

  const currentRoutine = intake
    ? await prisma.routine.findFirst({
        where: { userId: session.user.id, status: { in: ["ACTIVE", "PAUSED"] } },
        orderBy: { createdAt: "desc" },
        include: {
          steps: { where: { active: true } },
          proTips: { where: { status: "PENDING", actionType: { not: "KEEP" } }, orderBy: { createdAt: "asc" } },
        },
      })
    : null;

  const pendingTips = currentRoutine
    ? currentRoutine.proTips.map((tip) => {
        const rule = tip.ruleCitation !== null ? RULE_SOURCES[tip.ruleCitation] : null;
        return {
          id: tip.id,
          routineId: currentRoutine.id,
          stepId: tip.primaryStepId,
          summary: tip.summary,
          actionType: tip.actionType,
          status: tip.status,
          ruleLabel: rule ? `Rule ${tip.ruleCitation} — ${rule.label}` : null,
          ruleUrl: rule?.url ?? null,
        };
      })
    : [];

  const draftRoutine = intake
    ? await prisma.routine.findFirst({
        where: { userId: session.user.id, status: "DRAFT" },
        orderBy: { createdAt: "desc" },
      })
    : null;

  const checkIns = currentRoutine
    ? await prisma.checkIn.findMany({
        where: { routineId: currentRoutine.id },
        orderBy: { createdAt: "desc" },
        take: 10,
        include: { escalation: true },
      })
    : [];

  const latestUnresolvedEscalation = checkIns.find((c) => c.escalation && !c.escalation.resolved)?.escalation;

  return (
    <div className="flex-1 flex flex-col">
      <header className="flex items-center justify-between px-6 sm:px-10 py-5 border-b border-line">
        <span className="text-[15px] font-bold tracking-tight text-ink">Skinfolio</span>
        <div className="flex items-center gap-3">
          <span className="text-[13px] text-ink-2">{session.user.email}</span>
          <SignOutButton />
        </div>
      </header>

      {!intake ? (
        <main className="flex-1 flex flex-col items-center justify-center px-6 py-16 text-center">
          <div className="max-w-md">
            <h1 className="text-[22px] font-bold text-ink">
              You&rsquo;re in{session.user.name ? `, ${session.user.name}` : ""}.
            </h1>
            <p className="mt-2 text-[14px] text-ink-2 leading-relaxed">
              There&rsquo;s no routine yet — start with a quick intake so we know
              what you&rsquo;re working with.
            </p>
            <Link
              href="/onboarding"
              className="mt-6 inline-block text-[15px] font-bold bg-accent text-accent-ink px-6 py-2.5 rounded-[6px] hover:opacity-90"
            >
              Start intake
            </Link>
          </div>
        </main>
      ) : (
        <main className="flex-1 px-6 sm:px-10 py-12">
          <div className="max-w-2xl mx-auto">
            <div className="flex items-center justify-between">
              <h1 className="text-[22px] font-bold text-ink">Your intake</h1>
              <Link
                href="/onboarding"
                className="text-[13px] font-semibold text-accent"
              >
                Redo intake
              </Link>
            </div>
            <p className="mt-1 text-[14px] text-ink-2">
              Saved {intake.createdAt.toLocaleDateString()}.
            </p>

            <div className="mt-6 flex flex-col gap-3">
              {draftRoutine && (
                <div className="bg-warn/10 border border-warn/40 rounded-[10px] p-4 flex items-center justify-between gap-4">
                  <p className="text-[14px] font-semibold text-ink">
                    {currentRoutine
                      ? "An updated routine is ready to review."
                      : "Your routine is ready to review."}
                  </p>
                  <Link
                    href={`/routine/${draftRoutine.id}`}
                    className="text-[13px] font-bold bg-accent text-accent-ink px-4 py-2 rounded-[6px] whitespace-nowrap"
                  >
                    Review it
                  </Link>
                </div>
              )}

              {currentRoutine?.status === "PAUSED" ? (
                <div className="bg-danger/10 border border-danger/40 rounded-[10px] p-4">
                  <p className="text-[14px] font-bold text-ink">Your routine is paused</p>
                  {latestUnresolvedEscalation && (
                    <p className="mt-1 text-[13px] text-ink-2 leading-relaxed">
                      {latestUnresolvedEscalation.reason}
                    </p>
                  )}
                  <div className="mt-3 flex items-center gap-4">
                    <Link
                      href={`/routine/${currentRoutine.id}`}
                      className="text-[13px] font-semibold text-accent"
                    >
                      View routine
                    </Link>
                    <Link href="/checkin" className="text-[13px] font-semibold text-accent">
                      Log another check-in
                    </Link>
                    <AddProductButton />
                  </div>
                </div>
              ) : currentRoutine ? (
                <div className="bg-bg-raise border border-line rounded-[10px] p-4 flex items-center justify-between gap-4">
                  <div>
                    <p className="text-[14px] font-bold text-ink">Your routine is active</p>
                    <p className="mt-0.5 text-[13px] text-ink-2">
                      {currentRoutine.steps.length} step
                      {currentRoutine.steps.length === 1 ? "" : "s"} — AM and PM.
                    </p>
                  </div>
                  <div className="flex items-center gap-4">
                    <Link
                      href="/checkin"
                      className="text-[13px] font-bold bg-accent text-accent-ink px-4 py-2 rounded-[6px] whitespace-nowrap"
                    >
                      Log check-in
                    </Link>
                    <Link
                      href={`/routine/${currentRoutine.id}`}
                      className="text-[13px] font-semibold text-accent whitespace-nowrap"
                    >
                      View routine
                    </Link>
                    <AddProductButton />
                  </div>
                </div>
              ) : null}

              {currentRoutine && !draftRoutine && (
                <div>
                  <p className="text-[12px] text-ink-3 mb-1.5">
                    Updated a product&rsquo;s ingredients, or just want a second look?
                  </p>
                  <BuildRoutineButton label="Re-check my routine" />
                </div>
              )}

              {!currentRoutine && !draftRoutine && <BuildRoutineButton />}
            </div>

            {pendingTips.length > 0 && (
              <div className="mt-6">
                <h2 className="text-[12px] font-bold tracking-[0.08em] uppercase text-ink-3">
                  Pro Tips awaiting your decision
                </h2>
                <p className="mt-1 text-[12px] text-ink-3">
                  These stay here until you accept or reject them.
                </p>
                <div className="mt-2">
                  <ProTipsList tips={pendingTips} hideResolved />
                </div>
              </div>
            )}

            {checkIns.length > 0 && (
              <div className="mt-6">
                <h2 className="text-[12px] font-bold tracking-[0.08em] uppercase text-ink-3">
                  Recent check-ins
                </h2>
                <ul className="mt-2 flex flex-col gap-1.5">
                  {checkIns.map((c) => (
                    <li
                      key={c.id}
                      className="flex items-center justify-between gap-3 py-1.5 border-b border-line last:border-b-0"
                    >
                      <div className="min-w-0">
                        <span className="text-[13px] text-ink">
                          Day {c.dayNumber} · {c.timeOfDay === "AM" ? "Morning" : "Evening"} ·{" "}
                          {c.adherence === "DONE" ? "Done" : "Skipped"}
                        </span>
                        {c.symptomsText && (
                          <p className="text-[12px] text-ink-3 truncate">{c.symptomsText}</p>
                        )}
                      </div>
                      {c.escalation && (
                        <span
                          className={`text-[11px] font-semibold px-2 py-0.5 rounded-full whitespace-nowrap ${
                            c.escalation.resolved ? "bg-chip text-ink-3" : "bg-danger/10 text-danger"
                          }`}
                        >
                          Flagged
                        </span>
                      )}
                    </li>
                  ))}
                </ul>
              </div>
            )}

            <div className="mt-8 flex flex-col gap-6">
              <section>
                <h2 className="text-[12px] font-bold tracking-[0.08em] uppercase text-ink-3">
                  Concerns
                </h2>
                <div className="mt-2 flex flex-wrap gap-2">
                  {intake.concerns.map((c) => (
                    <span
                      key={c}
                      className="text-[13px] font-semibold px-3 py-1 rounded-full bg-chip text-ink-2"
                    >
                      {c}
                    </span>
                  ))}
                </div>
              </section>

              <section>
                <h2 className="text-[12px] font-bold tracking-[0.08em] uppercase text-ink-3">
                  About your skin
                </h2>
                <p className="mt-2 text-[14px] text-ink leading-relaxed">
                  {intake.questionnaire}
                </p>
              </section>

              {(intake.experienceLevel || intake.priority || intake.complexityPreference) && (
                <section>
                  <h2 className="text-[12px] font-bold tracking-[0.08em] uppercase text-ink-3">
                    Your profile
                  </h2>
                  <ul className="mt-2 flex flex-col gap-1 text-[14px] text-ink">
                    {intake.experienceLevel && <li>{EXPERIENCE_LABEL[intake.experienceLevel]}</li>}
                    {intake.priority && <li>{PRIORITY_LABEL[intake.priority]}</li>}
                    {intake.complexityPreference && <li>{COMPLEXITY_LABEL[intake.complexityPreference]}</li>}
                  </ul>
                </section>
              )}

              <section>
                <h2 className="text-[12px] font-bold tracking-[0.08em] uppercase text-ink-3">
                  Products you already use
                </h2>
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
              </section>
            </div>
          </div>
        </main>
      )}
    </div>
  );
}
