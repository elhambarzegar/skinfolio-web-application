import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";

export default async function ProgressPage() {
  const session = await auth();

  const checkIns = await prisma.checkIn.findMany({
    where: { userId: session!.user.id },
    orderBy: { createdAt: "desc" },
    take: 14,
    include: { escalation: true },
  });

  return (
    <div className="flex flex-col gap-5">
      <h1 className="page-title">My progress</h1>

      <div className="callout c-sky">
        <h2>Month and year reports are coming</h2>
        <p>Soon you&rsquo;ll see how many steps you finished each day. Until then, here are your recent skin check-ins.</p>
      </div>

      {checkIns.length === 0 ? (
        <p className="sub">No skin check-ins yet.</p>
      ) : (
        <div className="flex flex-col gap-3">
          {checkIns.map((c) => (
            <div key={c.id} className="card flex flex-col gap-2">
              <div className="flex items-start justify-between gap-3">
                <b className="text-[20px]">
                  {new Intl.DateTimeFormat("en-US", { month: "long", day: "numeric" }).format(c.createdAt)} ·{" "}
                  {c.timeOfDay === "AM" ? "Morning" : "Evening"}
                </b>
                {c.escalation && <span className="badge b-out">Flagged</span>}
              </div>
              {c.symptomsText && <p className="text-ink-2">{c.symptomsText}</p>}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
