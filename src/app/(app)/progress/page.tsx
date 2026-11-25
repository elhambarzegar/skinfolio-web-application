import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { loadProgress } from "@/lib/progressData";
import { safeTimezone } from "@/lib/dates";
import { ProgressReport } from "@/components/progress-report";

export default async function ProgressPage({ searchParams }: { searchParams: Promise<{ m?: string }> }) {
  const session = await auth();
  const userId = session!.user.id;
  const { m } = await searchParams;

  const [data, checkIns, user] = await Promise.all([
    loadProgress(userId, m),
    prisma.checkIn.findMany({
      where: { userId },
      orderBy: { createdAt: "desc" },
      take: 14,
      include: { escalation: true },
    }),
    prisma.user.findUnique({ where: { id: userId }, select: { timezone: true } }),
  ]);
  const timeZone = safeTimezone(user?.timezone) ?? "UTC";

  return (
    <div className="flex flex-col gap-5">
      <div>
        <h1 className="page-title">My progress</h1>
        <p className="sub">How well you&rsquo;re following your routine.</p>
      </div>

      {data.state === "none" ? (
        <div className="callout c-sky">
          <h2>Your reports start when your routine does</h2>
          <p>Once you approve your routine, each day you tick off steps will show up here.</p>
        </div>
      ) : (
        <ProgressReport data={data} />
      )}

      <details className="acc">
        <summary>Skin check-ins ({checkIns.length})</summary>
        <div className="acc-body">
          {checkIns.length === 0 ? (
            <p className="note">No skin check-ins yet.</p>
          ) : (
            checkIns.map((c) => (
              <div key={c.id} className="acc-row">
                <div className="flex items-start justify-between gap-3">
                  <b>
                    {new Intl.DateTimeFormat("en-US", { month: "long", day: "numeric", timeZone }).format(c.createdAt)} ·{" "}
                    {c.timeOfDay === "AM" ? "Morning" : "Evening"}
                  </b>
                  {c.escalation && <span className="badge b-out">Flagged</span>}
                </div>
                {c.symptomsText && <p className="text-ink-2">{c.symptomsText}</p>}
              </div>
            ))
          )}
        </div>
      </details>
    </div>
  );
}
