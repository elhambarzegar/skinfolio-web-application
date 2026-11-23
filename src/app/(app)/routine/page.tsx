import Link from "next/link";
import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { BuildRoutineButton } from "@/components/build-routine-button";

/**
 * The Routine space opens on whichever routine matters most: the one in use,
 * otherwise the one waiting for review.
 */
export default async function RoutineIndexPage() {
  const session = await auth();
  const userId = session!.user.id;

  const current = await prisma.routine.findFirst({
    where: { userId, status: { in: ["ACTIVE", "PAUSED"] } },
    orderBy: { createdAt: "desc" },
    select: { id: true },
  });
  if (current) redirect(`/routine/${current.id}`);

  const draft = await prisma.routine.findFirst({
    where: { userId, status: "DRAFT" },
    orderBy: { createdAt: "desc" },
    select: { id: true },
  });
  if (draft) redirect(`/routine/${draft.id}`);

  const intake = await prisma.intakeResponse.findFirst({ where: { userId }, select: { id: true } });

  return (
    <div className="flex flex-col gap-5">
      <h1 className="page-title">My routine</h1>
      {intake ? (
        <div className="callout c-sky">
          <h2>No routine yet</h2>
          <p>We&rsquo;ll build a morning and evening routine from what&rsquo;s on your shelf.</p>
          <BuildRoutineButton />
        </div>
      ) : (
        <div className="callout c-sky">
          <h2>Let&rsquo;s set up your routine</h2>
          <p>A few quick questions about your skin and what you already own.</p>
          <Link href="/onboarding" className="btn">
            Start
          </Link>
        </div>
      )}
    </div>
  );
}
