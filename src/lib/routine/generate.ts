import Anthropic from "@anthropic-ai/sdk";
import { z } from "zod";
import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod";
import { prisma } from "@/lib/prisma";
import { confidenceBucket } from "@/lib/productLookup/confidence";
import { EXPERIENCE_LABEL, PRIORITY_LABEL, COMPLEXITY_LABEL } from "@/lib/intakeProfile";
import { INGREDIENT_RULES, INTAKE_SAFETY_TRIGGERS, RULE_SOURCES } from "./policy";

const MODEL = "claude-opus-5";
const RULE_NUMBERS = Object.keys(RULE_SOURCES).map(Number);
const CANDIDATES_PER_CATEGORY = 5;

const StepOutput = z.object({
  productId: z.string(),
  timeOfDay: z.enum(["AM", "PM"]),
  order: z.number().int().min(1),
  rationale: z.string(),
  frequencyPerWeek: z.number().int().min(1).max(7),
  timeCostMinutes: z.number().int().min(0).max(30).nullable(),
  ownership: z.enum(["OWNED", "NEW"]),
  proposal: z.enum(["KEEP", "REMOVE", "ADD", "CHANGE"]),
  ruleCitation: z.number().int().nullable(),
  alternativeProductId: z.string().nullable(),
  alternativeFrequency: z.number().int().min(1).max(7).nullable(),
  budgetAdjustment: z.enum(["NONE", "FREQUENCY_REDUCED", "DROPPED_FOR_BUDGET"]),
  budgetAdjustmentReason: z.string().nullable(),
});

const ProTipOutput = z.object({
  summary: z.string(),
  actionType: z.enum(["ADD", "REMOVE", "CHANGE"]),
  ruleCitation: z.number().int().nullable(),
  stepProductId: z.string(),
  stepTimeOfDay: z.enum(["AM", "PM"]),
});

const RoutineGenerationOutput = z.discriminatedUnion("type", [
  z.object({
    type: z.literal("refused"),
    severity: z.enum(["red_flag", "emergency"]),
    concern: z.string(),
    routing: z.string(),
  }),
  z.object({
    type: z.literal("routine"),
    overview: z.string(),
    overviewRuleCitations: z.array(z.number().int()),
    steps: z.array(StepOutput),
    proTips: z.array(ProTipOutput),
  }),
]);

export type RoutineGenerationResult =
  | { ok: true; routineId: string }
  | { ok: false; reason: "no_intake" }
  | { ok: false; reason: "refused"; severity: "red_flag" | "emergency"; concern: string; routing: string }
  | { ok: false; reason: "agent_error"; message: string };

const SYSTEM_PROMPT = `You are Skinfolio's routine-building assistant. Given a person's skin concerns, their own description of their skin, and the skincare products they currently own, build one ordered AM/PM routine.

Before anything else, check their own words (the "About your skin" text) against the safety triggers policy below. If it matches a red-flag or emergency pattern, refuse to generate a routine — return the "refused" branch with the matching concern and appropriate routing. This check overrides everything else.

SAFETY TRIGGERS POLICY (intake red flags):
${INTAKE_SAFETY_TRIGGERS}

If no red flag applies, build the routine using the ingredient rules policy below. Cite rules ONLY by number (e.g. 3) — never write out a URL or source name yourself, the app resolves the real citation from the number. Use null when no specific rule applies (rendered to the user as "none").

INGREDIENT RULES POLICY (numbered 1-10):
${INGREDIENT_RULES}

## Output shape

"overview" — 2-4 short sentences, plain language, no headers. Cover: whether their owned products are enough to form a real routine or there are real gaps/overlaps, and — grounded only in the actual ingredients present — what the routine is actually doing for their skin long-term (e.g. barrier support, anti-aging via retinoid/peptide, brightening via vitamin C/niacinamide, hydration). Do not repeat step-by-step detail here — that belongs in steps and proTips. "overviewRuleCitations" lists any rule numbers the overview's claims lean on.

"steps" — every step in the routine, AM and PM, ordered Cleanse → Treat → Moisturize → Protect (Protect/sunscreen is AM only and always last; retinoids/actives in Treat are PM only). For EACH step:
- ownership: "OWNED" if productId is one of their owned products, "NEW" if it's a catalog suggestion they don't own yet.
- proposal: "KEEP" (this step is settled, no action needed), "REMOVE" (you think this owned product should come out — e.g. redundant with another, or a conflict), "ADD" (a NEW, not-yet-owned product you're suggesting to fill a real gap — use a real product from the candidates list below, never invent one), "CHANGE" (an owned product that would work better swapped for something else, or just at a different frequency — set alternativeProductId and/or alternativeFrequency to the suggestion).
- frequencyPerWeek: 7 for daily use. Strong actives (retinoids, exfoliating acids) commonly start lower for someone new to them — use judgment, explain in rationale, and only cite a rule number if the frequency claim is actually one of the 10 rules (most frequency judgment calls aren't — use null).
- timeCostMinutes: a realistic rough estimate per application (typically 1 for cleanser/treatment/moisturizer, 2 for sunscreen).
- budgetAdjustment: "NONE" unless the person's priority is minimizing spend or buying fewer/better products and you're deliberately reducing frequency ("FREQUENCY_REDUCED", explain in budgetAdjustmentReason) or leaving a step out for cost reasons despite it being useful ("DROPPED_FOR_BUDGET", explain why). Never invent a numeric budget or time cap that wasn't given to you.

"proTips" — real proposed changes only, nothing else. Exactly one entry for every step whose proposal is ADD, REMOVE, or CHANGE, matched by stepProductId + stepTimeOfDay to a step above — never more than one tip per step, and never give a step conflicting signals (e.g. don't describe the same step as both worth removing and worth changing). Do NOT create a tip for a step whose proposal is KEEP — an unchanged step doesn't need a decision, so it gets no tip at all. Each "summary" is exactly one plain-language sentence a person can decide on in a few seconds.

## Candidates for ADD / CHANGE suggestions

Only ever suggest a NEW (not-owned) product using one of the real catalog candidates provided in the user message below — matched by id. Never invent a product name, brand, or id. If no good candidate exists for a real gap, don't force an ADD — just note the gap in the overview instead.

## Person's stated profile

Use experience level, priority, and complexity preference (given below) to shape proposals, not to change safety rules:
- Low experience → simple rationale, fewer proposals, avoid jargon.
- High experience → more technical, more willing to propose refinements.
- Priority "Use what I already own" → lean KEEP over REMOVE/CHANGE for owned products unless there's a real conflict.
- Priority "Get the best possible results" → more willing to REMOVE a mediocre product or propose CHANGE/ADD toward a better one.
- Priority "Spend as little as possible" / "Buy one better product instead of several" → prefer budgetAdjustment over new ADD proposals; when you do ADD, say in the tip why it's worth the cost.
- Complexity "simplest possible" → prefer REMOVE/fewer steps over ADD.
- Complexity "enjoy skincare" / "okay with extra steps" → more open to ADD proposals that genuinely fit.

If a previous routine is included below, this is a re-check, not a first build — lead the overview with what's actually different since then, or say plainly nothing needed to change.`;

type OwnedProductRow = {
  id: string;
  brand: string;
  name: string;
  step: string;
  ingredientNote: string;
};

function buildIngredientNote(source: { confidenceScore: number; ingredientsInci: string } | null): string {
  if (!source) return "[no ingredient data available]";
  if (confidenceBucket(source.confidenceScore) === "low") return `[low-confidence ingredient data] ${source.ingredientsInci}`;
  return source.ingredientsInci;
}

export async function generateRoutine(userId: string): Promise<RoutineGenerationResult> {
  const intake = await prisma.intakeResponse.findFirst({
    where: { userId },
    orderBy: { createdAt: "desc" },
    include: { ownedProducts: { include: { currentSource: true } } },
  });

  if (!intake) return { ok: false, reason: "no_intake" };

  if (intake.ownedProducts.length === 0) {
    const routine = await prisma.$transaction(async (tx) => {
      await tx.routine.updateMany({ where: { userId, status: "DRAFT" }, data: { status: "ARCHIVED" } });
      return tx.routine.create({
        data: {
          userId,
          status: "DRAFT",
          rationale:
            "You haven't listed any products yet, so there's nothing to build a routine from. Add what you use in the intake form.",
        },
      });
    });
    return { ok: true, routineId: routine.id };
  }

  const ownedRows: OwnedProductRow[] = intake.ownedProducts.map((p) => ({
    id: p.id,
    brand: p.brand,
    name: p.name,
    step: p.step,
    ingredientNote: buildIngredientNote(p.currentSource),
  }));

  const ownedIds = new Set(ownedRows.map((p) => p.id));

  // Real catalog candidates the agent may suggest as ADD/CHANGE targets —
  // never let the model invent a product. Only reasonably-verified ones.
  const categories = ["CLEANSE", "TREAT", "MOISTURIZE", "PROTECT"] as const;
  const candidateRows: OwnedProductRow[] = [];
  for (const step of categories) {
    const candidates = await prisma.product.findMany({
      where: {
        step,
        id: { notIn: Array.from(ownedIds) },
        currentSource: { confidenceScore: { gte: 50 } },
      },
      include: { currentSource: true },
      orderBy: { currentSource: { confidenceScore: "desc" } },
      take: CANDIDATES_PER_CATEGORY,
    });
    for (const c of candidates) {
      candidateRows.push({ id: c.id, brand: c.brand, name: c.name, step: c.step, ingredientNote: buildIngredientNote(c.currentSource) });
    }
  }
  const candidateIds = new Set(candidateRows.map((p) => p.id));

  const profileLines = [
    intake.experienceLevel && `Experience: ${EXPERIENCE_LABEL[intake.experienceLevel]}`,
    intake.priority && `Priority: ${PRIORITY_LABEL[intake.priority]}`,
    intake.complexityPreference && `Complexity preference: ${COMPLEXITY_LABEL[intake.complexityPreference]}`,
  ].filter(Boolean);

  const previousRoutine = await prisma.routine.findFirst({
    where: { userId, status: { in: ["ACTIVE", "PAUSED", "ARCHIVED"] } },
    orderBy: { createdAt: "desc" },
    include: {
      steps: {
        where: { active: true },
        include: { product: true },
        orderBy: [{ timeOfDay: "asc" }, { order: "asc" }],
      },
    },
  });

  const previousRoutineBlock =
    previousRoutine && previousRoutine.steps.length > 0
      ? `\n\nPrevious routine (built ${previousRoutine.createdAt.toISOString().slice(0, 10)}):
${previousRoutine.steps.map((s) => `- ${s.timeOfDay} ${s.order}. ${s.product.brand} — ${s.product.name}: ${s.rationale}`).join("\n")}
Previous overview: ${previousRoutine.rationale}`
      : "";

  const formatRow = (p: OwnedProductRow) =>
    `- id: ${p.id} | ${p.brand} — ${p.name} | category: ${p.step} | ingredients: ${p.ingredientNote}`;

  const userContent = `Concerns: ${intake.concerns.join(", ")}

About your skin: ${intake.questionnaire}

${profileLines.length > 0 ? profileLines.join("\n") + "\n\n" : ""}Products owned:
${ownedRows.map(formatRow).join("\n")}

Catalog candidates available for ADD/CHANGE suggestions (NOT owned — only use these ids for a NEW step, never invent one):
${candidateRows.length > 0 ? candidateRows.map(formatRow).join("\n") : "(none available right now)"}${previousRoutineBlock}`;

  const client = new Anthropic();

  let parsed;
  try {
    const response = await client.messages.parse({
      model: MODEL,
      max_tokens: 6000,
      system: SYSTEM_PROMPT,
      output_config: { effort: "high", format: zodOutputFormat(RoutineGenerationOutput) },
      messages: [{ role: "user", content: userContent }],
    });
    parsed = response.parsed_output;
  } catch (err) {
    console.error("[routine] generation request failed:", err);
    return { ok: false, reason: "agent_error", message: "Couldn't reach the routine agent. Try again in a moment." };
  }

  if (!parsed) {
    return { ok: false, reason: "agent_error", message: "The agent's response didn't match the expected format. Try again." };
  }

  if (parsed.type === "refused") {
    return { ok: false, reason: "refused", severity: parsed.severity, concern: parsed.concern, routing: parsed.routing };
  }

  const validProductId = (id: string) => ownedIds.has(id) || candidateIds.has(id);
  const validRule = (n: number | null) => (n !== null && RULE_NUMBERS.includes(n) ? n : null);

  const validSteps = parsed.steps
    .filter((s) => validProductId(s.productId))
    .map((s) => {
      const actuallyOwned = ownedIds.has(s.productId);
      const alt = s.alternativeProductId && validProductId(s.alternativeProductId) ? s.alternativeProductId : null;
      const proposal = s.proposal === "CHANGE" && !alt && s.alternativeFrequency === null ? "KEEP" : s.proposal;
      return {
        ...s,
        ownership: (actuallyOwned ? "OWNED" : "NEW") as "OWNED" | "NEW",
        proposal,
        ruleCitation: validRule(s.ruleCitation),
        alternativeProductId: proposal === "CHANGE" ? alt : null,
        alternativeFrequency: proposal === "CHANGE" ? s.alternativeFrequency : null,
        budgetAdjustment: s.budgetAdjustment,
        budgetAdjustmentReason: s.budgetAdjustment !== "NONE" ? s.budgetAdjustmentReason : null,
      };
    });

  const stepKey = (productId: string, timeOfDay: string) => `${productId}::${timeOfDay}`;
  const stepByKey = new Map(validSteps.map((s) => [stepKey(s.productId, s.timeOfDay), s]));

  // Defensive dedup/merge: at most one Pro Tip per step, and it always
  // agrees with that step's own resolved proposal — never two cards for
  // one step, never a tip contradicting the step it's about.
  const tipsByStep = new Map<string, typeof parsed.proTips>();
  for (const tip of parsed.proTips) {
    const key = stepKey(tip.stepProductId, tip.stepTimeOfDay);
    const step = stepByKey.get(key);
    if (!step || step.proposal === "KEEP") continue;
    const list = tipsByStep.get(key) ?? [];
    list.push(tip);
    tipsByStep.set(key, list);
  }

  const validProTips = Array.from(tipsByStep.keys()).map((key) => {
    const step = stepByKey.get(key)!;
    const tips = tipsByStep.get(key)!;
    const agreeing = tips.filter((t) => t.actionType === step.proposal);
    const survivors = agreeing.length > 0 ? agreeing : [tips[0]];
    return {
      summary: survivors.map((t) => t.summary).join(" "),
      actionType: step.proposal as "ADD" | "REMOVE" | "CHANGE",
      ruleCitation: survivors.find((t) => t.ruleCitation !== null)?.ruleCitation ?? null,
      stepProductId: step.productId,
      stepTimeOfDay: step.timeOfDay,
    };
  });

  const overviewRuleCitations = parsed.overviewRuleCitations.map(validRule).filter((n): n is number => n !== null);

  const routine = await prisma.$transaction(async (tx) => {
    await tx.routine.updateMany({ where: { userId, status: "DRAFT" }, data: { status: "ARCHIVED" } });

    const created = await tx.routine.create({
      data: {
        userId,
        status: "DRAFT",
        rationale: parsed.overview,
        overviewSources: overviewRuleCitations,
      },
    });

    const stepIdByKey = new Map<string, string>();
    for (const step of validSteps) {
      const row = await tx.routineStep.create({
        data: {
          routineId: created.id,
          productId: step.productId,
          timeOfDay: step.timeOfDay,
          order: step.order,
          rationale: step.rationale,
          frequencyPerWeek: step.frequencyPerWeek,
          timeCostMinutes: step.timeCostMinutes,
          ownership: step.ownership,
          proposal: step.proposal,
          proposalReason: step.proposal !== "KEEP" ? step.rationale : null,
          ruleCitation: step.ruleCitation,
          alternativeProductId: step.alternativeProductId,
          alternativeFrequency: step.alternativeFrequency,
          budgetAdjustment: step.budgetAdjustment,
          budgetAdjustmentReason: step.budgetAdjustmentReason,
        },
      });
      stepIdByKey.set(stepKey(step.productId, step.timeOfDay), row.id);
    }

    for (const tip of validProTips) {
      const stepId = stepIdByKey.get(stepKey(tip.stepProductId, tip.stepTimeOfDay));
      if (!stepId) continue;
      await tx.proTip.create({
        data: {
          routineId: created.id,
          summary: tip.summary,
          actionType: tip.actionType,
          ruleCitation: validRule(tip.ruleCitation),
          primaryStepId: stepId,
        },
      });
    }

    return created;
  });

  return { ok: true, routineId: routine.id };
}
