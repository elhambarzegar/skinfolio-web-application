import { z } from "zod";

/**
 * A change to the routine in use is a short list of exact operations. The AI
 * only ever proposes them; they are checked here against what really exists
 * before anyone sees them, and applied only after the person approves.
 */

export type Period = "AM" | "PM";

export type ChangeOp =
  | { op: "add"; productId: string; timeOfDay: Period; position: number; frequencyPerWeek: number; timeCostMinutes: number | null; rationale: string }
  | { op: "remove"; stepId: string; reason: string }
  | { op: "frequency"; stepId: string; frequencyPerWeek: number; reason: string }
  /** frequencyPerWeek: how often the new product is used, or null to keep the step's. */
  | { op: "swap"; stepId: string; productId: string; frequencyPerWeek: number | null; rationale: string };

export type DiffLine = { kind: "add" | "remove" | "change"; text: string };

/** What the person sees when a change is waiting for them. */
export type ChangeView = {
  id: string;
  kind: "USE_PRODUCT" | "PRESCRIBED" | "SWAP" | "RECHECK";
  status: "PENDING" | "APPLIED" | "DISMISSED" | "STALE";
  trigger: string;
  summary: string;
  consequences: string[];
  risk: "none" | "caution" | "conflict";
  diff: DiffLine[];
};

/** The shape the AI is asked to answer in. */
export const ChangeProposalOutput = z.object({
  summary: z.string(),
  consequences: z.array(z.string()),
  risk: z.enum(["none", "caution", "conflict"]),
  ops: z.array(
    z.discriminatedUnion("op", [
      z.object({
        op: z.literal("add"),
        productId: z.string(),
        timeOfDay: z.enum(["AM", "PM"]),
        position: z.number().int().min(1),
        frequencyPerWeek: z.number().int().min(1).max(7),
        timeCostMinutes: z.number().int().min(0).max(30).nullable(),
        rationale: z.string(),
      }),
      z.object({ op: z.literal("remove"), stepId: z.string(), reason: z.string() }),
      z.object({ op: z.literal("frequency"), stepId: z.string(), frequencyPerWeek: z.number().int().min(1).max(7), reason: z.string() }),
      z.object({
        op: z.literal("swap"),
        stepId: z.string(),
        productId: z.string(),
        frequencyPerWeek: z.number().int().min(1).max(7).nullable(),
        rationale: z.string(),
      }),
    ])
  ),
});

export type StepCtx = {
  id: string;
  /** Null for a described gap with no product yet. */
  productId: string | null;
  timeOfDay: Period;
  order: number;
  frequencyPerWeek: number;
};

export type ProductCtx = { id: string; brand: string; name: string };

const MAX_OPS = 8;

/**
 * Keeps only operations that make sense for the routine as it is right now:
 * real steps, products from the person's own shelf, sensible numbers, no
 * product twice in one part of the day, and at most one change per step.
 */
export function cleanOps(
  raw: ChangeOp[],
  steps: StepCtx[],
  /** Products the change may bring in: the shelf. */
  allowedProductIds: Set<string>
): ChangeOp[] {
  const stepById = new Map(steps.map((s) => [s.id, s]));
  const touchedSteps = new Set<string>();
  const added = new Set<string>();
  const out: ChangeOp[] = [];

  for (const op of raw) {
    if (out.length >= MAX_OPS) break;

    if (op.op === "add") {
      if (!allowedProductIds.has(op.productId)) continue;
      const key = `${op.productId}:${op.timeOfDay}`;
      const alreadyThere = steps.some((s) => s.productId === op.productId && s.timeOfDay === op.timeOfDay);
      if (alreadyThere || added.has(key)) continue;
      added.add(key);
      out.push({ ...op, position: Math.max(1, Math.round(op.position)) });
      continue;
    }

    const step = stepById.get(op.stepId);
    if (!step || touchedSteps.has(op.stepId)) continue;

    if (op.op === "remove") {
      if (!step.productId) continue;
      touchedSteps.add(op.stepId);
      out.push(op);
    } else if (op.op === "frequency") {
      if (!step.productId || op.frequencyPerWeek === step.frequencyPerWeek) continue;
      touchedSteps.add(op.stepId);
      out.push(op);
    } else if (op.op === "swap") {
      if (!allowedProductIds.has(op.productId) || op.productId === step.productId) continue;
      touchedSteps.add(op.stepId);
      out.push(op);
    }
  }
  return out;
}

/** "every day", "3 days a week" */
export function freqWords(n: number): string {
  if (n >= 7) return "every day";
  if (n === 1) return "once a week";
  return `${n} days a week`;
}

const periodWord = (p: Period) => (p === "AM" ? "morning" : "evening");

/** The operations as plain lines, e.g. "Add X to your morning routine, step 3, every day". */
export function describeOps(ops: ChangeOp[], steps: StepCtx[], products: Map<string, ProductCtx>): DiffLine[] {
  const name = (id: string | null) => {
    const p = id ? products.get(id) : null;
    return p ? `${p.name} (${p.brand})` : "this product";
  };
  const stepNumber = (s: StepCtx) =>
    steps.filter((x) => x.timeOfDay === s.timeOfDay).sort((a, b) => a.order - b.order).findIndex((x) => x.id === s.id) + 1;
  const stepById = new Map(steps.map((s) => [s.id, s]));

  return ops.flatMap((op): DiffLine[] => {
    if (op.op === "add") {
      return [{ kind: "add", text: `Add ${name(op.productId)} to your ${periodWord(op.timeOfDay)} routine, step ${op.position}, ${freqWords(op.frequencyPerWeek)}.` }];
    }
    const step = stepById.get(op.stepId);
    if (!step) return [];
    if (op.op === "remove") {
      return [{ kind: "remove", text: `Take ${name(step.productId)} out of your ${periodWord(step.timeOfDay)} routine.` }];
    }
    if (op.op === "frequency") {
      return [
        {
          kind: "change",
          text: `Use ${name(step.productId)} (${periodWord(step.timeOfDay)}) ${freqWords(op.frequencyPerWeek)} instead of ${freqWords(step.frequencyPerWeek)}.`,
        },
      ];
    }
    const how = op.frequencyPerWeek && op.frequencyPerWeek !== step.frequencyPerWeek ? `, ${freqWords(op.frequencyPerWeek)}` : "";
    // A gap has no product yet: this fills it.
    if (!step.productId) {
      return [
        {
          kind: "add",
          text: `Use ${name(op.productId)} for the step we suggested in your ${periodWord(step.timeOfDay)} routine, step ${stepNumber(step)}${how}.`,
        },
      ];
    }
    return [
      {
        kind: "change",
        text: `Use ${name(op.productId)} instead of ${name(step.productId)} in your ${periodWord(step.timeOfDay)} routine, step ${stepNumber(step)}${how}.`,
      },
    ];
  });
}

/**
 * Where a product with no known ingredients goes when the person tells us
 * when they use it: just before sunscreen if the part of the day ends with
 * it, otherwise at the end. `lastProtectIndex` is the 0-based position of the
 * period's last sunscreen step, or -1.
 */
export function endPosition(stepsInPeriod: number, lastProtectIndex: number): number {
  return lastProtectIndex >= 0 ? lastProtectIndex + 1 : stepsInPeriod + 1;
}
