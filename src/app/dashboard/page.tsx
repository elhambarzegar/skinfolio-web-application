import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { SignOutButton } from "./sign-out-button";

export default async function DashboardPage() {
  const session = await auth();

  if (!session?.user) {
    redirect("/login");
  }

  return (
    <div className="flex-1 flex flex-col">
      <header className="flex items-center justify-between px-6 sm:px-10 py-5 border-b border-line">
        <span className="text-[15px] font-bold tracking-tight text-ink">Skinfolio</span>
        <div className="flex items-center gap-3">
          <span className="text-[13px] text-ink-2">{session.user.email}</span>
          <SignOutButton />
        </div>
      </header>

      <main className="flex-1 flex flex-col items-center justify-center px-6 py-16 text-center">
        <div className="max-w-md">
          <h1 className="text-[22px] font-bold text-ink">
            You&rsquo;re in{session.user.name ? `, ${session.user.name}` : ""}.
          </h1>
          <p className="mt-2 text-[14px] text-ink-2 leading-relaxed">
            There&rsquo;s no routine yet — the intake quiz that builds one is the
            next piece we&rsquo;re adding. This dashboard is real, your account is
            real, and nothing on it is placeholder data.
          </p>
        </div>
      </main>
    </div>
  );
}
