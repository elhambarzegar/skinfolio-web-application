import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { applyChange } from "@/lib/routine/applyChange";

/** The person has read the change and pressed "I understand, make this change". */
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "You need to be signed in." }, { status: 401 });
  }
  const body = await req.json().catch(() => null);
  if (body?.understood !== true) {
    return NextResponse.json({ error: "Confirm that you understand before the change is made." }, { status: 400 });
  }
  const { id } = await params;
  const result = await applyChange(session.user.id, id);
  if (!result.ok) return NextResponse.json({ error: result.error }, { status: result.status });
  return NextResponse.json({ ok: true });
}
