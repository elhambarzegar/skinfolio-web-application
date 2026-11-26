import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { generateRoutine } from "@/lib/routine/generate";
import { overLimit } from "@/lib/limits";

/** Building and checking can take a minute or two; the host must not cut the request short. */
export const maxDuration = 300;


export async function POST() {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "You need to be logged in." }, { status: 401 });
  }

  const limited = await overLimit("routineBuilds", session.user.id);
  if (limited) return NextResponse.json({ error: limited }, { status: 429 });

  const result = await generateRoutine(session.user.id);

  if (result.ok) {
    return NextResponse.json({ id: result.routineId });
  }

  switch (result.reason) {
    case "no_intake":
      return NextResponse.json(
        { error: "Complete your intake before building a routine." },
        { status: 400 }
      );
    case "refused":
      return NextResponse.json(
        {
          refused: true,
          severity: result.severity,
          concern: result.concern,
          routing: result.routing,
        },
        { status: 200 }
      );
    case "agent_error":
      return NextResponse.json({ error: result.message }, { status: 502 });
  }
}
