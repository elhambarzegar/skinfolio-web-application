import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";

/** Throw away a routine that was never approved. The routine in use is untouched. */
export async function POST(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "You need to be signed in." }, { status: 401 });
  }
  const { id } = await params;
  const routine = await prisma.routine.findUnique({ where: { id } });
  if (!routine || routine.userId !== session.user.id) {
    return NextResponse.json({ error: "Routine not found." }, { status: 404 });
  }
  if (routine.status !== "DRAFT") {
    return NextResponse.json({ error: "Only a routine that hasn't been approved can be discarded." }, { status: 409 });
  }
  await prisma.routine.update({ where: { id }, data: { status: "ARCHIVED" } });
  return NextResponse.json({ ok: true });
}
