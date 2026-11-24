import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { dismissChange } from "@/lib/routine/applyChange";

export async function POST(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "You need to be signed in." }, { status: 401 });
  }
  const { id } = await params;
  const result = await dismissChange(session.user.id, id);
  if (!result.ok) return NextResponse.json({ error: result.error }, { status: result.status });
  return NextResponse.json({ ok: true });
}
