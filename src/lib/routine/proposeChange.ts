import Anthropic from "@anthropic-ai/sdk";
import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod";
import type { ChangeKind } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { confidenceBucket } from "@/lib/productLookup/confidence";
import { productViewsFor, type ProductView } from "@/lib/shelf";
import { EXPERIENCE_LABEL, PRIORITY_LABEL, COMPLEXITY_LABEL } from "@/lib/intakeProfile";
import { INGREDIENT_RULES } from "./policy";
import { tidyText } from "@/lib/text";
import { agentErrorMessage } from "./generate";
import {
  ChangeProposalOutput,
  cleanOps,
  describeOps,
  endPosition,
  type ChangeOp,
  type Period,
  type ProductCtx,
  type StepCtx,
} from "./changes";

const MODEL = "claude-opus-5";

export type ProposeInput = {
  userId: string;
  kind: ChangeKind;
  /** What set this off, in the person's terms: "You added a photo of …". */
  trigger: string;
  /** The product(s) the change is about. They must be on the person's shelf. */
  subjectProductIds: string[];
  /** SWAP: the product that ran out; every step that uses it is replaced. */
  replacesProductId?: string;
  /** Prescribed: the prescriber's directions, in the person's words. */
  directions?: string | null;
  /** Prescribed with no ingredient list: when and how often they use it. */
  usage?: { periods: Period[]; frequencyPerWeek: number };
  /** Work on this routine (for example one still being reviewed) instead of the one in use. */
  routineId?: string;
  /** The product is meant for this suggested gap (a Pro Tip's "look for …"), and takes its place. */
  fillStepId?: string;
};

export type ProposeResult =
  | { ok: true; changeId: string | null }
  | { ok: false; reason: "no_routine" }
  | { ok: false; reason: "not_possible"; message: string }
  | { ok: false; reason: "agent_error"; message: string };

const SYSTEM_PROMPT = `You adjust one person's existing skincare routine when something changes. You are given their routine as it is now, the other products on their shelf, what changed, and the ingredients you know. Propose the exact changes, and tell the person plainly what those changes mean for them.

Ground every claim in the ingredients given and never guess. If a product's ingredients are missing or marked low-confidence, say so in your consequences and let that limit what you claim.

INGREDIENT RULES POLICY:
${INGREDIENT_RULES}

Never write a rule number, or the word "Rule", in anything you write. Write the reason in plain words.

## Length and tone (strict)

Write only what helps the person decide or act. Short, plain, direct sentences for a reader over 40 who is not an expert. No filler, no background lessons, no reassurance, no benefits (they already chose this), no repeating what the list of changes already shows. Never explain what an ingredient is. Respect every limit below.

## What you return

"summary": one sentence of at most 20 words saying what you propose.
"consequences": ONLY what affects the person's decision: a real risk, a trade-off, something they must do (like a patch test), or something that is no longer covered. At most 3 items, each one sentence of at most 20 words. If risk is "caution": exactly ONE item, the single main reason. If "conflict": at most 2 items. If "none": an empty list, unless there is one thing they must know. Never add benefits or general advice.
"risk": "none", "caution" (works but needs care) or "conflict" (a real problem the person should understand before agreeing).
"ops": the exact operations, in order. Each refers to real ids from the lists below:
- {"op":"add", productId, timeOfDay, position, frequencyPerWeek, timeCostMinutes, rationale}: bring a shelf product into the routine. "position" is the step number it takes in that period; the steps from that number on move down by one. Numbering is as listed below. Keep the order Cleanse, Treat, Moisturize, Protect (sunscreen is morning only and always last). frequencyPerWeek is 7 for daily; strong actives start lower. timeCostMinutes is about 1 (2 for sunscreen).
- {"op":"remove", stepId, reason}: take a product out of the routine.
- {"op":"frequency", stepId, frequencyPerWeek, reason}: change how often a product is used.
- {"op":"swap", stepId, productId, frequencyPerWeek, rationale}: a different product takes over a step's place. frequencyPerWeek is how often the new product should be used there (null to keep the step's current frequency).
"rationale" and "reason" are one short phrase or sentence of at most 12 words each.

## Rules for the operations

- Use only products on the person's shelf. NEVER invent or name a product to buy. If something is missing, say what kind of product in a consequence.
- Make the smallest change that makes the routine work. Prefer changing how often something is used, or where it goes, over removing it. Remove a product only when it exactly duplicates another or is a real conflict.
- A step marked "[unfilled gap: …]" is a suggestion with no product yet. If a product from the shelf suits a gap (it's the kind of thing the gap describes), use a "swap" op on that gap's stepId to put the product there, instead of an "add" op that would leave the empty gap behind. Never remove a gap.
- Steps marked RAN OUT are paused until the person restocks. Don't build on them.
- Do not touch a step that doesn't need to change.
- Only operations are carried out. Anything your summary or consequences say will change (how often something is used, where it goes, something being removed) MUST appear as an operation, and every operation must be explained in your text. Never promise a change you did not include as an operation.

## What kind of change this is

USE_PRODUCT: the person chose to use a shelf product that isn't in their routine. Respect their choice and don't refuse. Add it where it belongs. Be honest in the consequences, especially if it clashes with something; if it does, adjust the other steps as little as possible to reduce the risk and set the risk accordingly.

PRESCRIBED: a doctor or other professional prescribed this product. Do not question whether they should use it and never suggest stopping it. If directions are given, they decide when and how often. Build the routine around it: change, reduce or remove other products that clash with it. If the routine needs support alongside it (for example daily sunscreen with a retinoid) and a suitable product is on the shelf but not in the routine, add it; if there isn't one, say what kind is needed in a consequence. Remind them their prescriber's directions come first.

SWAP: a new product takes the place of one that ran out. Use a "swap" op for each step of the product that ran out (the step ids are given). Check the new product against the rest of the routine and make any needed adjustments.

RECHECK: something changed. It may be about a product already in the routine (for example the person photographed their own bottle, so its real ingredients are now known where they weren't before). Look at the whole routine again with that new information, exactly as you would if you were deciding where this product belongs from scratch: overlapping actives (two retinoids, a retinoid with exfoliating acids, several actives in one night), timing rules, and sun protection. Propose the changes that are needed and nothing else. If the product that changed is prescribed, never change how it is used: adjust the OTHER products around it. It can also be that the person redid their details (products they own, skin concerns): then look at the shelf products that are not in the routine and add the ones that belong (an "add" op, or a "swap" op onto a suggested gap they fit), and weigh the concerns. Products they said they no longer have are already gone from the routine; don't mention them. If, after really checking, the routine still works as it is, return an empty ops list, an empty consequences list and the summary "Nothing needs to change."

## Their profile

Use it to shape how many changes you propose, not to change safety rules: lower experience means fewer, simpler changes; "use what I own" means lean on existing products; "simplest possible" means avoid adding steps.`;

type StepRow = {
  id: string;
  timeOfDay: Period;
  order: number;
  frequencyPerWeek: number;
  productId: string | null;
  suggestedDescription: string | null;
  product: { id: string; brand: string; name: string; step: string } | null;
};

function ingredientNote(view: ProductView | undefined): string {
  const source = view?.source;
  if (!source) return "[no ingredient data available]";
  if (confidenceBucket(source.confidenceScore) === "low") return `[low-confidence ingredient data] ${source.ingredientsInci}`;
  return source.ingredientsInci;
}

/** How many "what you should know" lines a proposal may have, by how risky it is. */
const MAX_CONSEQUENCES = { none: 1, caution: 1, conflict: 2 } as const;

export async function proposeRoutineChange(input: ProposeInput): Promise<ProposeResult> {
  const { userId, kind } = input;

  const stepsInclude = {
    steps: {
      where: { active: true },
      include: { product: true },
      orderBy: [{ timeOfDay: "asc" as const }, { order: "asc" as const }],
    },
  };
  const routine = input.routineId
    ? await prisma.routine.findFirst({ where: { id: input.routineId, userId, status: { not: "ARCHIVED" } }, include: stepsInclude })
    : await prisma.routine.findFirst({
        where: { userId, status: { in: ["ACTIVE", "PAUSED"] } },
        orderBy: { createdAt: "desc" },
        include: stepsInclude,
      });
  if (!routine) return { ok: false, reason: "no_routine" };

  const shelf = await prisma.shelfItem.findMany({ where: { userId }, include: { product: true } });
  const shelfById = new Map(shelf.map((i) => [i.productId, i]));

  for (const id of input.subjectProductIds) {
    if (!shelfById.has(id)) return { ok: false, reason: "not_possible", message: "That product isn't on your shelf." };
  }

  const steps: StepRow[] = routine.steps.map((s) => ({
    id: s.id,
    timeOfDay: s.timeOfDay,
    order: s.order,
    frequencyPerWeek: s.frequencyPerWeek,
    productId: s.productId,
    suggestedDescription: s.suggestedDescription,
    product: s.product,
  }));
  const stepCtx: StepCtx[] = steps.map(({ id, productId, timeOfDay, order, frequencyPerWeek }) => ({ id, productId, timeOfDay, order, frequencyPerWeek }));

  const views = await productViewsFor(userId, [
    ...steps.flatMap((s) => (s.productId ? [s.productId] : [])),
    ...shelf.map((i) => i.productId),
  ]);

  const productCtx = new Map<string, ProductCtx>(shelf.map((i) => [i.productId, { id: i.productId, brand: i.product.brand, name: i.product.name }]));
  for (const s of steps) if (s.product) productCtx.set(s.product.id, { id: s.product.id, brand: s.product.brand, name: s.product.name });

  // Products the change may bring in: what's on the shelf and not run out.
  const allowed = new Set(shelf.filter((i) => i.status === "ACTIVE").map((i) => i.productId));
  input.subjectProductIds.forEach((id) => allowed.add(id));

  const replacedSteps = input.replacesProductId ? steps.filter((s) => s.productId === input.replacesProductId) : [];
  if (kind === "SWAP" && replacedSteps.length === 0) {
    return { ok: false, reason: "not_possible", message: "That product isn't in your routine." };
  }

  const subject = input.subjectProductIds[0];

  const fillStep = input.fillStepId ? steps.find((s) => s.id === input.fillStepId && !s.productId) : undefined;
  if (input.fillStepId && !fillStep) {
    return { ok: false, reason: "not_possible", message: "That suggestion has already been handled." };
  }

  // ── A prescribed product with no ingredient list can't be checked. It goes
  // in exactly as the person entered it, and we say so.
  if (kind === "PRESCRIBED" && subject && !views.get(subject)?.source) {
    const periods = input.usage?.periods ?? [];
    const frequencyPerWeek = input.usage?.frequencyPerWeek ?? 7;
    if (periods.length === 0) {
      return { ok: false, reason: "not_possible", message: "Tell us when you use it, morning, evening or both." };
    }
    const ops: ChangeOp[] = periods.map((timeOfDay) => {
      const inPeriod = steps.filter((s) => s.timeOfDay === timeOfDay);
      const lastProtect = inPeriod.map((s) => s.product?.step).lastIndexOf("PROTECT");
      return {
        op: "add",
        productId: subject,
        timeOfDay,
        position: endPosition(inPeriod.length, lastProtect),
        frequencyPerWeek,
        timeCostMinutes: 1,
        rationale: "Prescribed. Added exactly as you entered it.",
      };
    });
    const clean = cleanOps(ops, stepCtx, allowed);
    if (clean.length === 0) return { ok: false, reason: "not_possible", message: "That product is already in your routine." };

    const name = productCtx.get(subject)?.name ?? "this product";
    return save(input, routine.id, {
      summary: `Add ${name} to your routine exactly as you entered it.`,
      consequences: ["We can't check it: we don't know what's in it. Your prescriber's directions come first."],
      risk: "caution",
      ops: clean,
      stepCtx,
      productCtx,
    });
  }

  // ── Everything else: ask the agent.
  const intake = await prisma.intakeResponse.findFirst({ where: { userId }, orderBy: { createdAt: "desc" } });

  const numbered = (period: Period) => steps.filter((s) => s.timeOfDay === period);
  const routineBlock = (["AM", "PM"] as const)
    .flatMap((period) =>
      numbered(period).map((s, i) => {
        if (!s.product) return `- stepId: ${s.id} | ${period} step ${i + 1} | [unfilled gap: ${s.suggestedDescription ?? "unspecified"}]`;
        const view = views.get(s.product.id);
        const ranOut = view?.shelfStatus === "RAN_OUT" ? " [RAN OUT]" : "";
        return `- stepId: ${s.id} | ${period} step ${i + 1} | ${s.product.brand} — ${s.product.name} (${s.product.step}, ${s.frequencyPerWeek}x/week)${ranOut} | ingredients: ${ingredientNote(view)}`;
      })
    )
    .join("\n");

  const inRoutine = new Set(steps.flatMap((s) => (s.productId ? [s.productId] : [])));
  const shelfBlock = shelf
    .filter((i) => !inRoutine.has(i.productId) && i.status === "ACTIVE")
    .map(
      (i) =>
        `- productId: ${i.productId} | ${i.product.brand} — ${i.product.name} (${i.product.step})${i.prescribed ? " [prescribed]" : ""} | ingredients: ${ingredientNote(views.get(i.productId))}`
    )
    .join("\n");

  const subjectBlock = (input.subjectProductIds.length === 0 ? ["none"] : input.subjectProductIds)
    .map((id) => {
      if (id === "none") return "- (none in particular: the person's details changed)";
      const item = shelfById.get(id)!;
      return `- productId: ${id} | ${item.product.brand} — ${item.product.name} (${item.product.step})${item.prescribed ? " [prescribed]" : ""} | ingredients: ${ingredientNote(views.get(id))}`;
    })
    .join("\n");

  const profile = [
    intake?.concerns?.length ? `Concerns: ${intake.concerns.join(", ")}` : null,
    intake?.experienceLevel ? `Experience: ${EXPERIENCE_LABEL[intake.experienceLevel]}` : null,
    intake?.priority ? `Priority: ${PRIORITY_LABEL[intake.priority]}` : null,
    intake?.complexityPreference ? `Complexity preference: ${COMPLEXITY_LABEL[intake.complexityPreference]}` : null,
  ]
    .filter(Boolean)
    .join("\n");

  const replacedBlock = replacedSteps.length
    ? `\n\nThe product that ran out is used in these steps (swap each one): ${replacedSteps.map((s) => s.id).join(", ")}`
    : "";
  const fillBlock = fillStep
    ? `\n\nThe person is filling this unfilled gap with the product: stepId ${fillStep.id}. Use a "swap" op on that stepId so the product takes the gap's place.`
    : "";
  const directions = input.directions?.trim()
    ? `\n\nTheir prescriber's directions, in the person's words: "${input.directions.trim().slice(0, 600)}"`
    : "";

  const userContent = `Kind of change: ${kind}
What happened: ${input.trigger}

The product(s) this is about:
${subjectBlock}${replacedBlock}${fillBlock}${directions}

${profile ? profile + "\n\n" : ""}Current routine:
${routineBlock || "(no steps)"}

Other products on their shelf, not in the routine (the only ones you may add):
${shelfBlock || "(none)"}`;

  const client = new Anthropic();
  let parsed;
  try {
    const response = await client.messages.parse({
      model: MODEL,
      max_tokens: 4000,
      system: SYSTEM_PROMPT,
      output_config: { effort: "high", format: zodOutputFormat(ChangeProposalOutput) },
      messages: [{ role: "user", content: userContent }],
    });
    parsed = response.parsed_output;
  } catch (err) {
    console.error("[proposeChange] request failed:", err);
    return { ok: false, reason: "agent_error", message: agentErrorMessage(err) };
  }
  if (!parsed) {
    return { ok: false, reason: "agent_error", message: "The agent's answer didn't match the expected format. Try again." };
  }

  // The agent may only touch what really exists.
  let ops = cleanOps(parsed.ops as ChangeOp[], stepCtx, allowed);

  // A swap must replace every step of the product that ran out, whatever else the agent said.
  if (kind === "SWAP" && subject) {
    for (const s of replacedSteps) {
      if (!ops.some((o) => o.op === "swap" && o.stepId === s.id)) {
        ops = ops.filter((o) => !("stepId" in o && o.stepId === s.id));
        ops.push({ op: "swap", stepId: s.id, productId: subject, frequencyPerWeek: null, rationale: "Takes the place of the product you ran out of." });
      }
    }
  }

  // Filling a gap must put the product into that gap, whatever else the agent said.
  if (fillStep && subject && !ops.some((o) => o.op === "swap" && o.stepId === fillStep.id)) {
    ops = ops.filter((o) => !("stepId" in o && o.stepId === fillStep.id) && !(o.op === "add" && o.productId === subject));
    ops.unshift({ op: "swap", stepId: fillStep.id, productId: subject, frequencyPerWeek: null, rationale: "Fills the step we suggested." });
  }

  if (kind === "RECHECK" && ops.length === 0) {
    // Logged so "why didn't it flag anything?" can be answered.
    console.info(`[proposeChange] re-check found nothing to change. Agent said: "${parsed.summary}" | ${parsed.consequences.join(" | ")} | proposed ${parsed.ops.length} op(s), kept 0`);
    return { ok: true, changeId: null };
  }

  // Using, prescribing or swapping a product must actually bring it in.
  if (kind !== "RECHECK" && subject && !ops.some((o) => (o.op === "add" || o.op === "swap") && o.productId === subject)) {
    return { ok: false, reason: "agent_error", message: "We couldn't work out where this product goes. Try again." };
  }

  return save(input, routine.id, {
    summary: tidyText(parsed.summary, 130),
    consequences: parsed.consequences
      .map((c) => tidyText(c, 130))
      .filter(Boolean)
      .slice(0, MAX_CONSEQUENCES[parsed.risk]),
    risk: parsed.risk,
    ops: ops.map((o) => ({
      ...o,
      ...("rationale" in o ? { rationale: tidyText(o.rationale, 90) } : {}),
      ...("reason" in o ? { reason: tidyText(o.reason, 90) } : {}),
    })) as ChangeOp[],
    stepCtx,
    productCtx,
  });
}

async function save(
  input: ProposeInput,
  routineId: string,
  r: {
    summary: string;
    consequences: string[];
    risk: "none" | "caution" | "conflict";
    ops: ChangeOp[];
    stepCtx: StepCtx[];
    productCtx: Map<string, ProductCtx>;
  }
): Promise<ProposeResult> {
  const diff = describeOps(r.ops, r.stepCtx, r.productCtx);

  const change = await prisma.$transaction(async (tx) => {
    // A newer automatic check replaces an older one that is still waiting.
    if (input.kind === "RECHECK") {
      await tx.routineChange.updateMany({
        where: { userId: input.userId, routineId, kind: "RECHECK", status: "PENDING" },
        data: { status: "STALE" },
      });
    }
    return tx.routineChange.create({
      data: {
        userId: input.userId,
        routineId,
        kind: input.kind,
        trigger: input.trigger,
        summary: r.summary,
        consequences: r.consequences,
        risk: r.risk,
        ops: r.ops,
        diff,
      },
    });
  });

  return { ok: true, changeId: change.id };
}
