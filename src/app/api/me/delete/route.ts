import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { deleteAccount } from "@/lib/accountData";

/**
 * Permanently deletes the signed-in person's account and data. Cannot be
 * undone, so it asks for the word DELETE and, for accounts with a password,
 * the password (a stolen open session alone can't wipe an account).
 */
export async function POST(req: Request) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "You need to be signed in." }, { status: 401 });
  }
  const userId = session.user.id;

  const body = await req.json().catch(() => null);
  if (typeof body?.confirm !== "string" || body.confirm.trim().toUpperCase() !== "DELETE") {
    return NextResponse.json({ error: "Type DELETE to confirm." }, { status: 400 });
  }

  const user = await prisma.user.findUnique({ where: { id: userId }, select: { passwordHash: true } });
  if (!user) return NextResponse.json({ ok: true });

  // Accounts that sign in with a password must prove it. Google-only accounts have none.
  if (user.passwordHash) {
    const password = typeof body?.password === "string" ? body.password : "";
    if (!password || !(await bcrypt.compare(password, user.passwordHash))) {
      return NextResponse.json({ error: "That password isn't right." }, { status: 403 });
    }
  }

  await deleteAccount(userId);
  return NextResponse.json({ ok: true });
}
