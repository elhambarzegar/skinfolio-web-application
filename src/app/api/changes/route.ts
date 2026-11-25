import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { proposeRoutineChange, type ProposeInput } from "@/lib/routine/proposeChange";
import { toChangeView } from "@/lib/routine/applyChange";

const KINDS = ["USE_PRODUCT", "PRESCRIBED", "SWAP"] as const;

/** Works out a change and saves it for the person to read. Nothing is changed yet. */
export async function POST(req: Request) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "You need to be signed in." }, { status: 401 });
  }
  const userId = session.user.id;

  const body = await req.json().catch(() => null);
  const kind = KINDS.find((k) => k === body?.kind);
  const productId = typeof body?.productId === "string" ? body.productId : null;
  if (!kind || !productId) {
    return NextResponse.json({ error: "Missing details for this change." }, { status: 400 });
  }
  const replacesProductId = typeof body?.replacesProductId === "string" ? body.replacesProductId : undefined;
  if (kind === "SWAP" && !replacesProductId) {
    return NextResponse.json({ error: "Say which product you ran out of." }, { status: 400 });
  }

  const routineId = typeof body?.routineId === "string" ? body.routineId : undefined;
  const fillStepId = typeof body?.fillStepId === "string" ? body.fillStepId : undefined;
  const fillStep = fillStepId
    ? await prisma.routineStep.findFirst({
        where: { id: fillStepId, active: true, productId: null, routine: { userId } },
        select: { suggestedDescription: true },
      })
    : null;
  if (fillStepId && !fillStep) {
    return NextResponse.json({ error: "That suggestion has already been handled." }, { status: 400 });
  }

  const ids = [productId, ...(replacesProductId ? [replacesProductId] : [])];
  const products = await prisma.product.findMany({ where: { id: { in: ids } }, select: { id: true, brand: true, name: true } });
  const label = (id: string) => {
    const p = products.find((x) => x.id === id);
    return p ? `${p.name} (${p.brand})` : "a product";
  };

  const trigger =
    kind === "USE_PRODUCT" && fillStep
      ? `You chose ${label(productId)} for the suggestion "${fillStep.suggestedDescription ?? "a product to add"}".`
      : kind === "USE_PRODUCT"
        ? `You chose to use ${label(productId)} in your routine.`
      : kind === "PRESCRIBED"
        ? `You added ${label(productId)}, which was prescribed to you.`
        : `You ran out of ${label(replacesProductId!)} and picked ${label(productId)} instead.`;

  const periods = Array.isArray(body?.usage?.periods)
    ? (body.usage.periods as unknown[]).filter((p): p is "AM" | "PM" => p === "AM" || p === "PM")
    : [];
  const freq = Number(body?.usage?.frequencyPerWeek);

  const input: ProposeInput = {
    userId,
    kind,
    trigger,
    subjectProductIds: [productId],
    replacesProductId,
    routineId,
    fillStepId,
    directions: typeof body?.directions === "string" ? body.directions.slice(0, 600) : null,
    usage: periods.length > 0 ? { periods, frequencyPerWeek: Number.isInteger(freq) && freq >= 1 && freq <= 7 ? freq : 7 } : undefined,
  };

  const result = await proposeRoutineChange(input);

  if (!result.ok) {
    if (result.reason === "no_routine") {
      return NextResponse.json({ error: "Build and approve a routine first." }, { status: 400 });
    }
    if (result.reason === "not_possible") return NextResponse.json({ error: result.message }, { status: 400 });
    return NextResponse.json({ error: result.message }, { status: 502 });
  }
  if (!result.changeId) return NextResponse.json({ error: "Nothing to change." }, { status: 400 });

  const row = await prisma.routineChange.findUniqueOrThrow({ where: { id: result.changeId } });
  return NextResponse.json({ change: toChangeView(row) });
}
