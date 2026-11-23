import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { defaultPeriod, localNow, safeTimezone } from "@/lib/dates";
import { CheckInForm } from "./checkin-form";

export default async function CheckInPage() {
  const session = await auth();
  const userId = session!.user.id;

  const [routine, user] = await Promise.all([
    prisma.routine.findFirst({
      where: { userId, status: { in: ["ACTIVE", "PAUSED"] } },
      orderBy: { createdAt: "desc" },
    }),
    prisma.user.findUnique({ where: { id: userId }, select: { timezone: true } }),
  ]);

  if (!routine) {
    redirect("/today");
  }

  const { hour } = localNow(safeTimezone(user?.timezone) ?? "UTC");

  return <CheckInForm suggestedTimeOfDay={defaultPeriod(hour)} routinePaused={routine.status === "PAUSED"} />;
}
