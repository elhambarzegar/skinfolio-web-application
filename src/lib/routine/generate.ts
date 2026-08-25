import Anthropic from "@anthropic-ai/sdk";
import { z } from "zod";
import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod";
import { prisma } from "@/lib/prisma";
import { confidenceBucket } from "@/lib/productLookup/confidence";
import { EXPERIENCE_LABEL, PRIORITY_LABEL, COMPLEXITY_LABEL } from "@/lib/intakeProfile";
import { INGREDIENT_RULES, INTAKE_SAFETY_TRIGGERS } from "./policy";

const MODEL = "claude-opus-5";

const RoutineStepOutput = z.object({
  productId: z.string(),
  timeOfDay: z.enum(["AM", "PM"]),
  order: z.number().int().min(1),
  rationale: z.string(),
});

const ExcludedProductOutput = z.object({
  productId: z.string(),
  reason: z.string(),
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
    steps: z.array(RoutineStepOutput),
    excluded: z.array(ExcludedProductOutput),
    overallRationale: z.string(),
    gaps: z.array(z.string()),
  }),
]);

export type RoutineGenerationResult =
  | { ok: true; routineId: string }
  | { ok: false; reason: "no_intake" }
  | { ok: false; reason: "refused"; severity: "red_flag" | "emergency"; concern: string; routing: string }
  | { ok: false; reason: "agent_error"; message: string };

const SYSTEM_PROMPT = `You are Skinfolio's routine-building assistant. Given a person's skin concerns, their own description of their skin, and the skincare products they currently own, build one ordered AM/PM routine using ONLY the products they already own — never invent or suggest a product they don't have.

Before anything else, check their own words (the "About your skin" text) against the safety triggers policy below. If it matches a red-flag or emergency pattern, refuse to generate a routine — return the "refused" branch with the matching concern and appropriate routing. This check overrides everything else, including if you could technically still build a routine.

SAFETY TRIGGERS POLICY (intake red flags):
${INTAKE_SAFETY_TRIGGERS}

If no red flag applies, build the routine using the ingredient rules policy below:

INGREDIENT RULES POLICY:
${INGREDIENT_RULES}

Rules for building the routine:
- Order: Cleanse → Treat → Moisturize → Protect. Sunscreen (Protect) is AM only, always last. Retinoids/actives in Treat are PM only.
- If two owned products serve the same step and would duplicate or conflict, include only the better fit and list the other in "excluded" with a plain-language reason.
- Some products are marked "[no ingredient data available]" or "[low-confidence ingredient data]" — you may still place them in the routine by their step, but say so plainly in that step's rationale. Never claim to have checked ingredients you don't have.
- Note real gaps in "gaps" (e.g. no sunscreen owned despite a daytime routine, no moisturizer). Do not invent a product to fill a gap — just name it.
- "overallRationale" should be readable by a person in under a minute — plain language, no jargon.
- Every rationale should name the specific rule or reason behind that step's placement, not just restate what the product is.

Use the person's stated profile (experience level, priority, and complexity preference, given below) to shape tone and emphasis, not to change the safety rules:
- Low experience ("I don't really have a skincare routine" / "inconsistently") → keep rationale simple, avoid jargon, explain basics briefly.
- High experience ("I already know skincare fairly well") → you can be more technical and concise.
- Priority "Use what I already own" → lean toward keeping owned products even if not ideal, note in gaps rather than excluding.
- Priority "Get the best possible results" → be more willing to exclude a mediocre owned product in favor of leaving a clear gap noted, rather than including it just because they own it.
- Priority "Spend as little as possible" or "Buy one better product instead of several" → phrase gaps in a way that respects that (e.g. "one option" rather than a shopping list — you still never name or invent a specific product to buy).
- Complexity "I prefer the simplest routine possible" → if an owned product is optional/marginal for their concerns, consider excluding it and saying why, rather than adding steps.
- Complexity "I enjoy skincare" or "okay with a few extra steps" → include more owned products if they genuinely fit, don't over-simplify.`;

export async function generateRoutine(userId: string): Promise<RoutineGenerationResult> {
  const intake = await prisma.intakeResponse.findFirst({
    where: { userId },
    orderBy: { createdAt: "desc" },
    include: { ownedProducts: { include: { currentSource: true } } },
  });

  if (!intake) return { ok: false, reason: "no_intake" };

  if (intake.ownedProducts.length === 0) {
    // Nothing to build a routine from — treat as a gap-only routine rather
    // than calling the agent over an empty product list.
    const routine = await prisma.$transaction(async (tx) => {
      await tx.routine.updateMany({
        where: { userId, status: "DRAFT" },
        data: { status: "ARCHIVED" },
      });
      return tx.routine.create({
        data: {
          userId,
          status: "DRAFT",
          rationale:
            "You haven't listed any products yet, so there's nothing to build a routine from. Add what you use in the intake form, or note that in a future update we can suggest a starting routine from scratch.",
        },
      });
    });
    return { ok: true, routineId: routine.id };
  }

  const productLines = intake.ownedProducts.map((p) => {
    const source = p.currentSource;
    let ingredientNote: string;
    if (!source) {
      ingredientNote = "[no ingredient data available]";
    } else if (confidenceBucket(source.confidenceScore) === "low") {
      ingredientNote = `[low-confidence ingredient data] ${source.ingredientsInci}`;
    } else {
      ingredientNote = source.ingredientsInci;
    }
    return `- id: ${p.id} | ${p.brand} — ${p.name} | catalog step: ${p.step} | ingredients: ${ingredientNote}`;
  });

  const profileLines = [
    intake.experienceLevel && `Experience: ${EXPERIENCE_LABEL[intake.experienceLevel]}`,
    intake.priority && `Priority: ${PRIORITY_LABEL[intake.priority]}`,
    intake.complexityPreference && `Complexity preference: ${COMPLEXITY_LABEL[intake.complexityPreference]}`,
  ].filter(Boolean);

  const userContent = `Concerns: ${intake.concerns.join(", ")}

About your skin: ${intake.questionnaire}

${profileLines.length > 0 ? profileLines.join("\n") + "\n\n" : ""}Products owned:
${productLines.join("\n")}`;

  const client = new Anthropic();

  let parsed;
  try {
    const response = await client.messages.parse({
      model: MODEL,
      max_tokens: 4000,
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

  const ownedProductIds = new Set(intake.ownedProducts.map((p) => p.id));
  const validSteps = parsed.steps.filter((s) => ownedProductIds.has(s.productId));
  const validExcluded = parsed.excluded.filter((e) => ownedProductIds.has(e.productId));

  const routine = await prisma.$transaction(async (tx) => {
    await tx.routine.updateMany({
      where: { userId, status: "DRAFT" },
      data: { status: "ARCHIVED" },
    });

    const created = await tx.routine.create({
      data: {
        userId,
        status: "DRAFT",
        rationale:
          parsed.overallRationale +
          (parsed.gaps.length > 0 ? `\n\nGaps: ${parsed.gaps.join("; ")}` : "") +
          (validExcluded.length > 0
            ? `\n\nNot included: ${validExcluded.map((e) => e.reason).join("; ")}`
            : ""),
      },
    });

    for (const step of validSteps) {
      await tx.routineStep.create({
        data: {
          routineId: created.id,
          productId: step.productId,
          timeOfDay: step.timeOfDay,
          order: step.order,
          rationale: step.rationale,
        },
      });
    }

    return created;
  });

  return { ok: true, routineId: routine.id };
}
