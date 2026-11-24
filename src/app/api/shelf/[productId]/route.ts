import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { localNow, safeTimezone } from "@/lib/dates";

async function ownItem(userId: string, productId: string) {
  return prisma.shelfItem.findUnique({ where: { userId_productId: { userId, productId } } });
}

/** Mark a shelf product as run out (its routine steps pause), or back in use. */
export async function PATCH(req: Request, { params }: { params: Promise<{ productId: string }> }) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "You need to be signed in." }, { status: 401 });
  }

  const body = await req.json().catch(() => null);
  if (typeof body?.ranOut !== "boolean") {
    return NextResponse.json({ error: "Say whether it has run out." }, { status: 400 });
  }

  const { productId } = await params;
  const item = await ownItem(session.user.id, productId);
  if (!item) {
    return NextResponse.json({ error: "That product isn't on your shelf." }, { status: 404 });
  }

  await prisma.shelfItem.update({
    where: { id: item.id },
    data: body.ranOut ? { status: "RAN_OUT", ranOutAt: new Date() } : { status: "ACTIVE", ranOutAt: null },
  });

  if (body.ranOut) {
    // Today's list may already have counted this product's steps as due. A
    // step that is paused mid-day must not show up later as a missed one, so
    // its untouched log for today goes. (Ticked steps stay: they were done.)
    const user = await prisma.user.findUnique({ where: { id: session.user.id }, select: { timezone: true } });
    const { date } = localNow(safeTimezone(user?.timezone) ?? "UTC");
    await prisma.stepLog.deleteMany({
      where: { userId: session.user.id, date, doneAt: null, step: { productId } },
    });
  }

  return NextResponse.json({ ranOut: body.ranOut });
}

/** Take a product off the shelf. Only for products that aren't in a routine. */
export async function DELETE(_req: Request, { params }: { params: Promise<{ productId: string }> }) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "You need to be signed in." }, { status: 401 });
  }

  const { productId } = await params;
  const item = await ownItem(session.user.id, productId);
  if (!item) {
    return NextResponse.json({ error: "That product isn't on your shelf." }, { status: 404 });
  }

  const inRoutine = await prisma.routineStep.findFirst({
    where: {
      productId,
      active: true,
      routine: { userId: session.user.id, status: { in: ["DRAFT", "ACTIVE", "PAUSED"] } },
    },
    select: { id: true },
  });
  if (inRoutine) {
    return NextResponse.json(
      { error: "This product is part of your routine, so it can't come off the shelf yet." },
      { status: 409 }
    );
  }

  await prisma.shelfItem.delete({ where: { id: item.id } });
  return NextResponse.json({ ok: true });
}
