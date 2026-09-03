import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { generateRoutine } from "@/lib/routine/generate";

export async function POST(req: Request) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "You need to be logged in." }, { status: 401 });
  }

  const body = await req.json().catch(() => null);
  const productIds: string[] = Array.isArray(body?.productIds)
    ? body.productIds.filter((id: unknown): id is string => typeof id === "string")
    : [];

  if (productIds.length === 0) {
    return NextResponse.json({ error: "No products to add." }, { status: 400 });
  }

  const intake = await prisma.intakeResponse.findFirst({
    where: { userId: session.user.id },
    orderBy: { createdAt: "desc" },
  });

  if (!intake) {
    return NextResponse.json({ error: "Complete your intake first." }, { status: 400 });
  }

  const validProducts = await prisma.product.findMany({
    where: { id: { in: productIds } },
    select: { id: true },
  });

  await prisma.intakeResponse.update({
    where: { id: intake.id },
    data: { ownedProducts: { connect: validProducts.map((p) => ({ id: p.id })) } },
  });

  const result = await generateRoutine(session.user.id);

  if (result.ok) {
    return NextResponse.json({ id: result.routineId });
  }

  switch (result.reason) {
    case "no_intake":
      return NextResponse.json({ error: "Complete your intake before building a routine." }, { status: 400 });
    case "refused":
      return NextResponse.json(
        { refused: true, severity: result.severity, concern: result.concern, routing: result.routing },
        { status: 200 }
      );
    case "agent_error":
      return NextResponse.json({ error: result.message }, { status: 502 });
  }
}
