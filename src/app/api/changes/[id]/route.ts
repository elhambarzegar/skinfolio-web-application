import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { toChangeView } from "@/lib/routine/applyChange";

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "You need to be signed in." }, { status: 401 });
  }
  const { id } = await params;
  const row = await prisma.routineChange.findUnique({ where: { id } });
  if (!row || row.userId !== session.user.id) {
    return NextResponse.json({ error: "That change wasn't found." }, { status: 404 });
  }
  return NextResponse.json({ change: toChangeView(row) });
}
