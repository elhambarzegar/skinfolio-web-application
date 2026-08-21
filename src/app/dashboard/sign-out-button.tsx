"use client";

import { signOut } from "next-auth/react";

export function SignOutButton() {
  return (
    <button
      onClick={() => signOut({ callbackUrl: "/" })}
      className="text-[13px] font-semibold text-ink-2 hover:text-ink px-3 py-1.5 border border-line rounded-[6px]"
    >
      Sign out
    </button>
  );
}
