import Anthropic from "@anthropic-ai/sdk";
import { z } from "zod";
import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod";
import { prisma } from "@/lib/prisma";
import { confidenceBucket } from "@/lib/productLookup/confidence";
import { INGREDIENT_RULES, RULE_SOURCES, stripRuleNumbers } from "./policy";
import { agentErrorMessage } from "./generate";

const MODEL = "claude-opus-5";
const RULE_NUMBERS = Object.keys(RULE_SOURCES).map(Number);
const CATEGORIES = ["CLEANSE", "TREAT", "MOISTURIZE", "PROTECT", "OTHER"] as const;

export type Category = (typeof CATEGORIES)[number];

const CompareOutput = z.object({
  products: z.array(
    z.object({
      productId: z.string(),
      compatibility: z.string(),
      concern: z.enum(["none", "caution", "conflict"]),
      ruleCitation: z.number().int().nullable(),
      category: z.enum(CATEGORIES),
      placements: z.array(
        z.object({
          timeOfDay: z.enum(["AM", "PM"]),
          position: z.number().int().min(1),
          frequencyPerWeek: z.number().int().min(1).max(7),
          timeCostMinutes: z.number().int().min(0).max(30).nullable(),
        })
      ),
    })
  ),
});

/** Where a product would go in the routine if the person adds it. */
export type Placement = {
  timeOfDay: "AM" | "PM";
  /** 1-based: the product becomes this step of that period and later steps move down. */
  position: number;
  frequencyPerWeek: number;
  timeCostMinutes: number | null;
};

export type IngredientStatus = "verified" | "unverified" | "none";

export type ProductCompatibility = {
  productId: string;
  brand: string;
  name: string;
  compatibility: string;
  concern: "none" | "caution" | "conflict";
  ruleCitation: number | null;
  ruleLabel: string | null;
  ruleUrl: string | null;
  category: Category;
  /** Did we find a trustworthy ingredient list to base this check on? */
  ingredients: IngredientStatus;
  placements: Placement[];
  /** Set when the product would take over one of the routine's suggested gaps instead of adding a new step. */
  fillsStepId: string | null;
};

export type CompareResult =
  | { ok: true; results: ProductCompatibility[] }
  | { ok: false; reason: "no_routine" }
  | { ok: false; reason: "agent_error"; message: string };

export type CompareOptions = {
  /** Compare against this routine (e.g. one still being reviewed) instead of the one in use. */
  routineId?: string;
  /** The product is meant to fill this suggested gap, so it takes that slot. */
  fillStepId?: string;
};

const SYSTEM_PROMPT = `You assess how well a candidate skincare product would fit into someone's existing routine, and where it would go. Ground every claim in the actual ingredients given — never guess. If a product has no ingredient data, or the data is marked low-confidence, say so plainly in "compatibility" and judge only from what you can honestly tell, flagging the uncertainty instead of inventing ingredients.

INGREDIENT RULES POLICY (numbered 1-10):
${INGREDIENT_RULES}

Cite a rule by number in "ruleCitation" when one applies, or null. Never write a rule number, or the word "Rule", inside any sentence you write: write the reason in plain words. The app shows the real source separately.

For EACH candidate product:

"compatibility" — 1-3 short plain-language sentences: does it duplicate something already in the routine, conflict with an active ingredient's timing or interaction rules, fill a real gap, or just fit fine alongside what's there? If multiple candidates are being added together, also consider how they'd interact with each other.

"concern" — "none" (fits fine or fills a gap), "caution" (works but needs care — e.g. patch test, specific timing, introduce slowly), or "conflict" (a real problem — e.g. duplicates an active, contraindicated combination).

"category" — what the product is: CLEANSE, TREAT (serums, actives, exfoliants, retinoids, masks), MOISTURIZE, PROTECT (sunscreen) or OTHER.

"placements" — where it should go if the person adds it, one entry for each part of the day it belongs in (a cleanser or moisturizer is often both AM and PM; a retinoid is PM only; sunscreen is AM only and always last). The existing steps are listed numbered within each period. "position" is the step number the new product should take in that period; the steps from that number on move down by one. Keep the order Cleanse → Treat → Moisturize → Protect. "frequencyPerWeek" is 7 for daily; strong actives start lower. "timeCostMinutes" is about 1 (2 for sunscreen). Return an EMPTY list when concern is "conflict", or when the product isn't something that belongs in a routine.

If the routine marks an unfilled gap that a candidate suits (the same kind of product), give the placement that matches that gap's step: the app puts the product into that gap rather than adding a second step. Only when a note below says a candidate is being added to fill a specific gap, judge it in that role and return an EMPTY placements list.`;

function ingredientStatus(source: { confidenceScore: number } | null): IngredientStatus {
  if (!source) return "none";
  return confidenceBucket(source.confidenceScore) === "low" ? "unverified" : "verified";
}

export async function compareProductsToRoutine(
  userId: string,
  productIds: string[],
  options: CompareOptions = {}
): Promise<CompareResult> {
  const stepInclude = {
    steps: {
      where: { active: true },
      include: { product: { include: { currentSource: true } } },
      orderBy: [{ timeOfDay: "asc" as const }, { order: "asc" as const }],
    },
  };

  const routine = options.routineId
    ? await prisma.routine.findFirst({
        where: { id: options.routineId, userId, status: { not: "ARCHIVED" } },
        include: stepInclude,
      })
    : await prisma.routine.findFirst({
        where: { userId, status: { in: ["ACTIVE", "PAUSED"] } },
        orderBy: { createdAt: "desc" },
        include: stepInclude,
      });

  if (!routine) return { ok: false, reason: "no_routine" };

  const candidates = await prisma.product.findMany({
    where: { id: { in: productIds } },
    include: { currentSource: true },
  });

  const ingredientNote = (source: { confidenceScore: number; ingredientsInci: string } | null) => {
    if (!source) return "[no ingredient data available]";
    if (confidenceBucket(source.confidenceScore) === "low") return `[low-confidence ingredient data] ${source.ingredientsInci}`;
    return source.ingredientsInci;
  };

  // Numbered 1, 2, 3 within each period (the stored order can have gaps), so
  // the position the agent answers with means the same thing here as when it
  // is applied.
  const stepsByPeriod = {
    AM: routine.steps.filter((s) => s.timeOfDay === "AM"),
    PM: routine.steps.filter((s) => s.timeOfDay === "PM"),
  };
  const routineBlock = (["AM", "PM"] as const)
    .flatMap((period) =>
      stepsByPeriod[period].map((s, i) =>
        s.product
          ? `- ${period} step ${i + 1}: ${s.product.brand} — ${s.product.name} (${s.product.step}, ${s.frequencyPerWeek}x/week): ${ingredientNote(s.product.currentSource)}`
          : `- ${period} step ${i + 1}: [unfilled gap — suggested: ${s.suggestedDescription ?? "unspecified"}]`
      )
    )
    .join("\n");

  const candidateBlock = candidates
    .map((c) => `- id: ${c.id} | ${c.brand} — ${c.name} | ingredients: ${ingredientNote(c.currentSource)}`)
    .join("\n");

  const fillStep = options.fillStepId ? routine.steps.find((s) => s.id === options.fillStepId) : null;
  const fillNote = fillStep
    ? `\n\nThis product is being added to fill the unfilled gap at ${fillStep.timeOfDay} step ${stepsByPeriod[fillStep.timeOfDay].indexOf(fillStep) + 1} (suggested: ${fillStep.suggestedDescription ?? "unspecified"}). Return an empty placements list.`
    : "";

  const userContent = `Current routine:
${routineBlock || "(no active steps)"}

Candidate product(s) being considered for addition:
${candidateBlock}${fillNote}`;

  const client = new Anthropic();

  let parsed;
  try {
    const response = await client.messages.parse({
      model: MODEL,
      max_tokens: 3000,
      system: SYSTEM_PROMPT,
      output_config: { effort: "high", format: zodOutputFormat(CompareOutput) },
      messages: [{ role: "user", content: userContent }],
    });
    parsed = response.parsed_output;
  } catch (err) {
    console.error("[compareProducts] request failed:", err);
    return { ok: false, reason: "agent_error", message: agentErrorMessage(err) };
  }

  if (!parsed) {
    return { ok: false, reason: "agent_error", message: "The agent's response didn't match the expected format. Try again." };
  }

  const candidateById = new Map(candidates.map((c) => [c.id, c]));
  const takenGaps = new Set<string>();
  const results: ProductCompatibility[] = parsed.products
    .filter((p) => candidateById.has(p.productId))
    .map((p) => {
      const c = candidateById.get(p.productId)!;
      const citation = p.ruleCitation !== null && RULE_NUMBERS.includes(p.ruleCitation) ? p.ruleCitation : null;
      const rule = citation !== null ? RULE_SOURCES[citation] : null;

      // A product that suits one of the routine's open suggestions ("look for
      // a mineral sunscreen") takes that slot rather than adding a second step.
      const gap =
        fillStep || p.concern === "conflict" || p.placements.length === 0
          ? null
          : (routine.steps.find(
              (s) => !s.product && s.proposal === "ADD" && s.suggestedCategory === p.category && !takenGaps.has(s.id)
            ) ?? null);
      if (gap) takenGaps.add(gap.id);

      // One placement per period, with the position kept inside what exists
      // (a new step can land anywhere from first to just after the last).
      const seen = new Set<string>();
      const placements: Placement[] = fillStep
        ? []
        : gap
          ? [
              {
                timeOfDay: gap.timeOfDay,
                position: stepsByPeriod[gap.timeOfDay].indexOf(gap) + 1,
                frequencyPerWeek: gap.frequencyPerWeek,
                timeCostMinutes: gap.timeCostMinutes,
              },
            ]
          : p.placements
              .filter((pl) => (seen.has(pl.timeOfDay) ? false : (seen.add(pl.timeOfDay), true)))
              .map((pl) => ({
                ...pl,
                position: Math.min(pl.position, stepsByPeriod[pl.timeOfDay].length + 1),
              }));

      return {
        productId: p.productId,
        brand: c.brand,
        name: c.name,
        compatibility: stripRuleNumbers(p.compatibility),
        concern: p.concern,
        ruleCitation: citation,
        ruleLabel: rule ? rule.label : null,
        ruleUrl: rule?.url ?? null,
        category: p.category,
        ingredients: ingredientStatus(c.currentSource),
        placements,
        fillsStepId: gap?.id ?? null,
      };
    });

  return { ok: true, results };
}
