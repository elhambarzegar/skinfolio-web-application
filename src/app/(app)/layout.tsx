import { redirect } from "next/navigation";
import type { ReactNode } from "react";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { AppNav } from "@/components/app-nav";
import { TimezoneSync } from "@/components/timezone-sync";

/** Everything after sign-in: the five spaces and the signed-in guard. */
export default async function AppLayout({ children }: { children: ReactNode }) {
  const session = await auth();
  if (!session?.user) {
    redirect("/login");
  }

  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { timezone: true },
  });
  // A sign-in left over from an account that no longer exists.
  if (!user) {
    redirect("/login");
  }

  return (
    <div className="flex flex-1 flex-col md:flex-row">
      <AppNav />
      <main className="min-w-0 flex-1 px-4 pb-40 pt-8 md:px-12 md:pb-16 md:pt-12">
        <div className="mx-auto w-full max-w-[680px]">{children}</div>
      </main>
      <TimezoneSync stored={user.timezone} />
    </div>
  );
}
