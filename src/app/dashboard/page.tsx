import { redirect } from "next/navigation";
import Link from "next/link";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { confidenceBucket } from "@/lib/productLookup/confidence";
import { SignOutButton } from "./sign-out-button";
import { BuildRoutineButton } from "./build-routine-button";

const BUCKET_STYLE: Record<"high" | "medium" | "low", string> = {
  high: "bg-ok/10 text-ok",
  medium: "bg-warn/10 text-warn",
  low: "bg-danger/10 text-danger",
};

const BUCKET_LABEL: Record<"high" | "medium" | "low", string> = {
  high: "High confidence",
  medium: "Medium confidence",
  low: "Low confidence — unverified",
};

const ORIGIN_LABEL: Record<string, string> = {
  OPEN_BEAUTY_FACTS: "Open Beauty Facts",
  BRAND_SITE: "brand site",
  RETAILER: "retailer listing",
  WEB_SEARCH: "web search",
};

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

  const activeRoutine = intake
    ? await prisma.routine.findFirst({
        where: { userId: session.user.id, status: "ACTIVE" },
        include: { steps: true },
      })
    : null;

  const draftRoutine =
    intake && !activeRoutine
      ? await prisma.routine.findFirst({
          where: { userId: session.user.id, status: "DRAFT" },
          orderBy: { createdAt: "desc" },
        })
      : null;

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

            <div className="mt-6">
              {activeRoutine ? (
                <div className="bg-bg-raise border border-line rounded-[10px] p-4 flex items-center justify-between gap-4">
                  <div>
                    <p className="text-[14px] font-bold text-ink">Your routine is active</p>
                    <p className="mt-0.5 text-[13px] text-ink-2">
                      {activeRoutine.steps.length} step
                      {activeRoutine.steps.length === 1 ? "" : "s"} — AM and PM.
                    </p>
                  </div>
                  <Link
                    href={`/routine/${activeRoutine.id}`}
                    className="text-[13px] font-semibold text-accent whitespace-nowrap"
                  >
                    View routine
                  </Link>
                </div>
              ) : draftRoutine ? (
                <div className="bg-warn/10 border border-warn/40 rounded-[10px] p-4 flex items-center justify-between gap-4">
                  <p className="text-[14px] font-semibold text-ink">
                    Your routine is ready to review.
                  </p>
                  <Link
                    href={`/routine/${draftRoutine.id}`}
                    className="text-[13px] font-bold bg-accent text-accent-ink px-4 py-2 rounded-[6px] whitespace-nowrap"
                  >
                    Review it
                  </Link>
                </div>
              ) : (
                <BuildRoutineButton />
              )}
            </div>

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

              <section>
                <h2 className="text-[12px] font-bold tracking-[0.08em] uppercase text-ink-3">
                  Products you already use
                </h2>
                {intake.ownedProducts.length === 0 ? (
                  <p className="mt-2 text-[14px] text-ink-3">None listed.</p>
                ) : (
                  <ul className="mt-2 flex flex-col gap-2">
                    {intake.ownedProducts.map((p) => {
                      const source = p.currentSource;
                      const bucket = source ? confidenceBucket(source.confidenceScore) : null;
                      return (
                        <li
                          key={p.id}
                          className="flex items-center justify-between gap-3 py-1.5"
                        >
                          <span className="text-[14px] text-ink">
                            {p.brand} — {p.name}
                          </span>
                          {bucket && source ? (
                            <span
                              className={`text-[12px] font-semibold px-2.5 py-1 rounded-full whitespace-nowrap ${BUCKET_STYLE[bucket]}`}
                              title={`${ORIGIN_LABEL[source.origin] ?? source.origin}, checked ${source.fetchedAt.toLocaleDateString()}`}
                            >
                              {BUCKET_LABEL[bucket]}
                            </span>
                          ) : (
                            <span className="text-[12px] font-semibold px-2.5 py-1 rounded-full whitespace-nowrap bg-chip text-ink-3">
                              No ingredient data yet
                            </span>
                          )}
                        </li>
                      );
                    })}
                  </ul>
                )}
              </section>
            </div>
          </div>
        </main>
      )}
    </div>
  );
}
