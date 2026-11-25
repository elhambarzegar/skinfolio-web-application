import Anthropic from "@anthropic-ai/sdk";
import { z } from "zod";
import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod";
import { prisma } from "@/lib/prisma";
import { confidenceBucket } from "@/lib/productLookup/confidence";
import { pickSource } from "@/lib/shelf";
import { tidyText } from "@/lib/text";
import { EXPERIENCE_LABEL, PRIORITY_LABEL, COMPLEXITY_LABEL } from "@/lib/intakeProfile";
import { INGREDIENT_RULES, INTAKE_SAFETY_TRIGGERS, RULE_SOURCES } from "./policy";

const MODEL = "claude-opus-5";
const RULE_NUMBERS = Object.keys(RULE_SOURCES).map(Number);
const CATEGORIES = ["CLEANSE", "TREAT", "MOISTURIZE", "PROTECT"] as const;

/**
 * Plain-language reason a request to the routine agent failed. A rejected
 * key or empty account is a problem on our side that retrying can't fix, so
 * say that instead of "try again".
 */
export function agentErrorMessage(err: unknown): string {
  const status = err instanceof Anthropic.APIError ? err.status : undefined;
  const text = err instanceof Error ? err.message : "";
  if (status === 401 || status === 403) {
    return "The routine agent can't run right now because its access key isn't working. That's a problem on our side, not yours. Retrying won't help until it's fixed.";
  }
  if (status === 400 && /credit balance/i.test(text)) {
    return "The routine agent is out of credit right now. That's a problem on our side, not yours. Retrying won't help until it's topped up.";
  }
  return "Couldn't reach the routine agent. Try again in a moment.";
}

const StepOutput = z.object({
  // A real owned product's id for KEEP/REMOVE/CHANGE. For "ADD", any
  // short token you choose (e.g. "new-sunscreen") — used only to match
  // this step to its Pro Tip below, never stored as a real product.
  productId: z.string(),
  timeOfDay: z.enum(["AM", "PM"]),
  order: z.number().int().min(1),
  rationale: z.string(),
  frequencyPerWeek: z.number().int().min(1).max(7),
  timeCostMinutes: z.number().int().min(0).max(30).nullable(),
  ownership: z.enum(["OWNED", "NEW"]),
  proposal: z.enum(["KEEP", "REMOVE", "ADD", "CHANGE"]),
  ruleCitation: z.number().int().nullable(),
  suggestedCategory: z.enum(CATEGORIES).nullable(),
  suggestedDescription: z.string().nullable(),
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

If no red flag applies, build the routine using the ingredient rules policy below. Cite rules ONLY by number (e.g. 3) — never write out a URL or source name yourself, the app resolves the real citation from the number. Use null when no specific rule applies. Never write a rule number, or the word "Rule", inside any sentence you write (overview, rationale, tip summaries): the number goes only in the citation fields, and the app shows the real source separately. Write the reason itself in plain words instead.

INGREDIENT RULES POLICY (numbered 1-10):
${INGREDIENT_RULES}

## Length and tone (strict)

Write only what helps the person decide or act. Short, plain, direct sentences. No filler, no background lessons, no benefits nobody asked about, no repeating what the lists already show. Never explain what an ingredient is. Respect every word limit below.

## Never name a specific brand or product to buy

You only ever work with products the person already owns. When something new would help — filling a gap, or replacing something owned with a better fit — describe what to look for in plain, shoppable terms (ingredient/type, and anything that matters like "fragrance-free" or "SPF 30+ mineral"). Never invent or name an actual brand or product — the app turns your description into shopping-site search links so the person picks the specific item themselves. This applies everywhere below.

## Output shape

"overview" — ONE or TWO sentences, at most 30 words, plain language, no headers: whether their products are enough or what's missing, and the main thing the routine does for their skin (grounded only in the actual ingredients). Nothing else; step-by-step detail belongs in steps and proTips. "overviewRuleCitations" lists any rule numbers the overview's claims lean on.

"steps" — every step in the routine, AM and PM, ordered Cleanse → Treat → Moisturize → Protect (Protect/sunscreen is AM only and always last; retinoids/actives in Treat are PM only). For EACH step:
- productId: the real owned product's id, EXCEPT for a proposal "ADD" step, where there's no owned product yet — invent a short local token instead (e.g. "new-sunscreen"), used only to match this step to its Pro Tip.
- ownership: "OWNED" for an owned product, "NEW" for an "ADD" step.
- proposal: "KEEP" (settled, no action needed), "REMOVE" (this owned product should come out — redundant or conflicting with another), "ADD" (a real gap needs filling — set suggestedCategory and suggestedDescription, never a productId that refers to a real catalog item), "CHANGE" (an owned product would work better as a different frequency, and/or swapped for a different kind of product — set alternativeFrequency and/or suggestedDescription; never name what to swap to, describe it).
- rationale: ONE sentence, at most 15 words: why this step is here or used this often. Don't restate what the product is, and don't give background.
- frequencyPerWeek: 7 for daily use. Strong actives (retinoids, exfoliating acids) commonly start lower for someone new to them — use judgment, give the reason in the rationale, and only cite a rule number if the frequency claim is actually one of the 10 rules (most frequency judgment calls aren't — use null).
- timeCostMinutes: a realistic rough estimate per application (typically 1 for cleanser/treatment/moisturizer, 2 for sunscreen).
- budgetAdjustment: "NONE" unless the person's priority is minimizing spend or buying fewer/better products and you're deliberately reducing frequency ("FREQUENCY_REDUCED", reason in at most 10 words in budgetAdjustmentReason) or leaving a step out for cost reasons despite it being useful ("DROPPED_FOR_BUDGET", explain why). Never invent a numeric budget or time cap that wasn't given to you.

"proTips" — real proposed changes only, nothing else. Exactly one entry for every step whose proposal is ADD, REMOVE, or CHANGE, matched by stepProductId + stepTimeOfDay to a step above — never more than one tip per step, and never give a step conflicting signals (e.g. don't describe the same step as both worth removing and worth changing). Do NOT create a tip for a step whose proposal is KEEP — an unchanged step doesn't need a decision, so it gets no tip at all. Each "summary" is exactly one plain sentence of at most 20 words that a person can decide on in a few seconds, describing what to look for, never a brand or product name.

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
  });

  if (!intake) return { ok: false, reason: "no_intake" };

  // What is on the shelf and still in use. A product they've run out of
  // can't be part of a new routine.
  const shelf = await prisma.shelfItem.findMany({
    where: { userId, status: "ACTIVE" },
    orderBy: { addedAt: "asc" },
    include: { product: { include: { currentSource: true } }, photoSource: true },
  });

  if (shelf.length === 0) {
    const routine = await prisma.$transaction(async (tx) => {
      await tx.routine.updateMany({ where: { userId, status: "DRAFT" }, data: { status: "ARCHIVED" } });
      return tx.routine.create({
        data: {
          userId,
          status: "DRAFT",
          rationale:
            "There's nothing on your shelf that you're still using, so there's nothing to build a routine from. Add what you use on your shelf.",
        },
      });
    });
    return { ok: true, routineId: routine.id };
  }

  const ownedRows: OwnedProductRow[] = shelf.map(({ product: p, photoSource }) => ({
    id: p.id,
    brand: p.brand,
    name: p.name,
    step: p.step,
    ingredientNote: buildIngredientNote(pickSource(p.currentSource, photoSource).source),
  }));

  const ownedIds = new Set(ownedRows.map((p) => p.id));

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

  const describeStep = (s: { product: { brand: string; name: string } | null; suggestedDescription: string | null; rationale: string }) =>
    s.product ? `${s.product.brand} — ${s.product.name}: ${s.rationale}` : `[suggested: ${s.suggestedDescription ?? "unspecified"}]: ${s.rationale}`;

  const previousRoutineBlock =
    previousRoutine && previousRoutine.steps.length > 0
      ? `\n\nPrevious routine (built ${previousRoutine.createdAt.toISOString().slice(0, 10)}):
${previousRoutine.steps.map((s) => `- ${s.timeOfDay} ${s.order}. ${describeStep(s)}`).join("\n")}
Previous overview: ${previousRoutine.rationale}`
      : "";

  const formatRow = (p: OwnedProductRow) =>
    `- id: ${p.id} | ${p.brand} — ${p.name} | category: ${p.step} | ingredients: ${p.ingredientNote}`;

  const userContent = `Concerns: ${intake.concerns.join(", ")}

About your skin: ${intake.questionnaire}

${profileLines.length > 0 ? profileLines.join("\n") + "\n\n" : ""}Products owned:
${ownedRows.map(formatRow).join("\n")}${previousRoutineBlock}`;

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
    return { ok: false, reason: "agent_error", message: agentErrorMessage(err) };
  }

  if (!parsed) {
    return { ok: false, reason: "agent_error", message: "The agent's response didn't match the expected format. Try again." };
  }

  if (parsed.type === "refused") {
    return { ok: false, reason: "refused", severity: parsed.severity, concern: parsed.concern, routing: parsed.routing };
  }

  const validRule = (n: number | null) => (n !== null && RULE_NUMBERS.includes(n) ? n : null);

  const validSteps = parsed.steps
    .map((s) => {
      const actuallyOwned = ownedIds.has(s.productId);
      // Only an "ADD" step can lack a real owned product behind it.
      if (s.proposal !== "ADD" && !actuallyOwned) return null;
      if (s.proposal === "ADD" && (!s.suggestedCategory || !s.suggestedDescription)) return null;

      const isDescriptiveChange = s.proposal === "CHANGE" && !!s.suggestedDescription;

      return {
        matchKey: s.productId,
        dbProductId: s.proposal === "ADD" ? null : s.productId,
        timeOfDay: s.timeOfDay,
        order: s.order,
        rationale: tidyText(s.rationale, 110),
        frequencyPerWeek: s.frequencyPerWeek,
        timeCostMinutes: s.timeCostMinutes,
        ownership: (actuallyOwned ? "OWNED" : "NEW") as "OWNED" | "NEW",
        proposal: s.proposal,
        ruleCitation: validRule(s.ruleCitation),
        suggestedCategory: s.proposal === "ADD" ? s.suggestedCategory : null,
        suggestedDescription: s.proposal === "ADD" || isDescriptiveChange ? s.suggestedDescription : null,
        alternativeFrequency: s.proposal === "CHANGE" ? s.alternativeFrequency : null,
        budgetAdjustment: s.budgetAdjustment,
        budgetAdjustmentReason: s.budgetAdjustment !== "NONE" && s.budgetAdjustmentReason ? tidyText(s.budgetAdjustmentReason, 80) : null,
      };
    })
    .filter((s): s is NonNullable<typeof s> => s !== null);

  const stepKey = (matchKey: string, timeOfDay: string) => `${matchKey}::${timeOfDay}`;
  const stepByKey = new Map(validSteps.map((s) => [stepKey(s.matchKey, s.timeOfDay), s]));

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
      summary: tidyText(survivors.map((t) => t.summary).join(" "), 130),
      actionType: step.proposal as "ADD" | "REMOVE" | "CHANGE",
      ruleCitation: survivors.find((t) => t.ruleCitation !== null)?.ruleCitation ?? null,
      matchKey: step.matchKey,
      timeOfDay: step.timeOfDay,
    };
  });

  const overviewRuleCitations = parsed.overviewRuleCitations.map(validRule).filter((n): n is number => n !== null);

  const routine = await prisma.$transaction(async (tx) => {
    await tx.routine.updateMany({ where: { userId, status: "DRAFT" }, data: { status: "ARCHIVED" } });

    const created = await tx.routine.create({
      data: {
        userId,
        status: "DRAFT",
        rationale: tidyText(parsed.overview, 200),
        overviewSources: overviewRuleCitations,
      },
    });

    const stepIdByKey = new Map<string, string>();
    for (const step of validSteps) {
      const row = await tx.routineStep.create({
        data: {
          routineId: created.id,
          productId: step.dbProductId,
          timeOfDay: step.timeOfDay,
          order: step.order,
          rationale: step.rationale,
          frequencyPerWeek: step.frequencyPerWeek,
          timeCostMinutes: step.timeCostMinutes,
          ownership: step.ownership,
          proposal: step.proposal,
          proposalReason: step.proposal !== "KEEP" ? step.rationale : null,
          ruleCitation: step.ruleCitation,
          suggestedCategory: step.suggestedCategory,
          suggestedDescription: step.suggestedDescription,
          alternativeFrequency: step.alternativeFrequency,
          budgetAdjustment: step.budgetAdjustment,
          budgetAdjustmentReason: step.budgetAdjustmentReason,
        },
      });
      stepIdByKey.set(stepKey(step.matchKey, step.timeOfDay), row.id);
    }

    for (const tip of validProTips) {
      const stepId = stepIdByKey.get(stepKey(tip.matchKey, tip.timeOfDay));
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
