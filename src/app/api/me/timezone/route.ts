import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { safeTimezone } from "@/lib/dates";

/** The browser reports its timezone so "today" is the user's own day. */
export async function POST(req: Request) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "You need to be signed in." }, { status: 401 });
  }

  const body = await req.json().catch(() => null);
  const timezone = safeTimezone(body?.timezone);
  if (!timezone) {
    return NextResponse.json({ error: "That isn't a valid timezone." }, { status: 400 });
  }

  const user = await prisma.user.findUnique({ where: { id: session.user.id }, select: { timezone: true } });
  if (user?.timezone === timezone) {
    return NextResponse.json({ changed: false });
  }

  await prisma.user.update({ where: { id: session.user.id }, data: { timezone } });
  return NextResponse.json({ changed: true });
}
