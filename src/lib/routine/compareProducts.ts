import Anthropic from "@anthropic-ai/sdk";
import { z } from "zod";
import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod";
import { prisma } from "@/lib/prisma";
import { confidenceBucket } from "@/lib/productLookup/confidence";
import { INGREDIENT_RULES, RULE_SOURCES } from "./policy";
import { agentErrorMessage } from "./generate";

const MODEL = "claude-opus-5";
const RULE_NUMBERS = Object.keys(RULE_SOURCES).map(Number);

const CompareOutput = z.object({
  products: z.array(
    z.object({
      productId: z.string(),
      compatibility: z.string(),
      concern: z.enum(["none", "caution", "conflict"]),
      ruleCitation: z.number().int().nullable(),
    })
  ),
});

export type ProductCompatibility = {
  productId: string;
  brand: string;
  name: string;
  compatibility: string;
  concern: "none" | "caution" | "conflict";
  ruleLabel: string | null;
  ruleUrl: string | null;
};

export type CompareResult =
  | { ok: true; results: ProductCompatibility[] }
  | { ok: false; reason: "no_routine" }
  | { ok: false; reason: "agent_error"; message: string };

const SYSTEM_PROMPT = `You assess how well a candidate skincare product would fit into someone's existing routine. Ground every claim in the actual ingredients given — never guess. Cite a rule number from the policy below when relevant, or null.

INGREDIENT RULES POLICY (numbered 1-10):
${INGREDIENT_RULES}

For EACH candidate product, write "compatibility" as 1-3 short plain-language sentences: does it duplicate something already in the routine, conflict with an active ingredient's timing or interaction rules, fill a real gap, or just fit fine alongside what's there? Set "concern": "none" (fits fine or fills a gap), "caution" (works but needs care — e.g. patch test, specific timing, introduce slowly), or "conflict" (a real problem — e.g. duplicates an active, contraindicated combination). If multiple candidates are being added together, also consider how they'd interact with each other, not just with the existing routine.`;

export async function compareProductsToRoutine(userId: string, productIds: string[]): Promise<CompareResult> {
  const routine = await prisma.routine.findFirst({
    where: { userId, status: { in: ["ACTIVE", "PAUSED"] } },
    orderBy: { createdAt: "desc" },
    include: {
      steps: {
        where: { active: true },
        include: { product: { include: { currentSource: true } } },
        orderBy: [{ timeOfDay: "asc" }, { order: "asc" }],
      },
    },
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

  const routineBlock = routine.steps
    .map((s) =>
      s.product
        ? `- ${s.timeOfDay} ${s.order}. ${s.product.brand} — ${s.product.name} (${s.product.step}, ${s.frequencyPerWeek}x/week): ${ingredientNote(s.product.currentSource)}`
        : `- ${s.timeOfDay} ${s.order}. [unfilled gap — suggested: ${s.suggestedDescription ?? "unspecified"}]`
    )
    .join("\n");

  const candidateBlock = candidates
    .map((c) => `- id: ${c.id} | ${c.brand} — ${c.name} | ingredients: ${ingredientNote(c.currentSource)}`)
    .join("\n");

  const userContent = `Current routine:
${routineBlock || "(no active steps)"}

Candidate product(s) being considered for addition:
${candidateBlock}`;

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
  const results: ProductCompatibility[] = parsed.products
    .filter((p) => candidateById.has(p.productId))
    .map((p) => {
      const c = candidateById.get(p.productId)!;
      const rule = p.ruleCitation !== null && RULE_NUMBERS.includes(p.ruleCitation) ? RULE_SOURCES[p.ruleCitation] : null;
      return {
        productId: p.productId,
        brand: c.brand,
        name: c.name,
        compatibility: p.compatibility,
        concern: p.concern,
        ruleLabel: rule ? `Rule ${p.ruleCitation} — ${rule.label}` : null,
        ruleUrl: rule?.url ?? null,
      };
    });

  return { ok: true, results };
}
