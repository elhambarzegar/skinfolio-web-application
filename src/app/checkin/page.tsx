import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { CheckInForm } from "./checkin-form";

export default async function CheckInPage() {
  const session = await auth();
  if (!session?.user) {
    redirect("/login");
  }

  const routine = await prisma.routine.findFirst({
    where: { userId: session.user.id, status: { in: ["ACTIVE", "PAUSED"] } },
    orderBy: { createdAt: "desc" },
  });

  if (!routine) {
    redirect("/dashboard");
  }

  const suggestedTimeOfDay = new Date().getHours() < 15 ? "AM" : "PM";

  return <CheckInForm suggestedTimeOfDay={suggestedTimeOfDay} routinePaused={routine.status === "PAUSED"} />;
}
