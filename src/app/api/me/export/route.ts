import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { exportAccountData } from "@/lib/accountData";

/** "Download my data": everything held about the signed-in person, as a file. */
export async function GET() {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "You need to be signed in." }, { status: 401 });
  }
  const data = await exportAccountData(session.user.id);
  return new NextResponse(JSON.stringify(data, null, 2), {
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Content-Disposition": 'attachment; filename="sagedew-my-data.json"',
      "Cache-Control": "no-store",
    },
  });
}
