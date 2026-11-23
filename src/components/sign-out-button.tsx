"use client";

import { signOut } from "next-auth/react";

export function SignOutButton() {
  return (
    <button type="button" onClick={() => signOut({ callbackUrl: "/" })} className="btn btn-2 btn-block">
      Sign out
    </button>
  );
}
