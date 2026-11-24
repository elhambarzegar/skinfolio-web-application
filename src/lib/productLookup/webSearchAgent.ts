import Anthropic from "@anthropic-ai/sdk";
import { cleanProductName } from "./cleanName";

const MODEL = "claude-opus-5";
/** Room for the model's own thinking plus the search results it reasons over, then the answer. */
const MAX_TOKENS = 8000;
const MAX_SEARCHES = 6;
/** A long search can pause mid-turn; each pause is picked up where it left off, up to this many times. */
const MAX_CONTINUATIONS = 3;
const CATEGORIES = ["CLEANSE", "TREAT", "MOISTURIZE", "PROTECT", "OTHER"] as const;

export type AgentSourceType = "brand_site" | "retailer" | "other";
export type AgentDatePrecision = "exact" | "month" | "year" | "unknown";
export type AgentCategory = (typeof CATEGORIES)[number];

export type WebSearchAgentMatch = {
  ingredientsInci: string;
  sourceUrl: string | null;
  sourceType: AgentSourceType;
  publishedAt: Date | null;
  publishedAtPrecision: AgentDatePrecision;
  /** What the product is for, when the agent could tell. */
  category: AgentCategory | null;
};

type AgentJsonResponse = {
  found: boolean;
  ingredients_inci: string | null;
  source_url: string | null;
  source_type: AgentSourceType | null;
  published_date: string | null;
  published_date_precision: AgentDatePrecision | null;
  category: string | null;
};

type Attempt =
  | { kind: "match"; match: WebSearchAgentMatch }
  /** The agent searched properly and says no reliable ingredient list exists. Retrying won't change that. */
  | { kind: "not_found" }
  /** Something went wrong (cut off, unreadable answer, network). Worth one more try. */
  | { kind: "failed" };

function extractJson(text: string): string {
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (fenced) return fenced[1].trim();
  const start = text.indexOf("{");
  const end = text.lastIndexOf("}");
  if (start === -1 || end === -1 || end < start) return text;
  return text.slice(start, end + 1);
}

function buildPrompt(brand: string, name: string): string {
  const searchName = cleanProductName(name) || name;
  return `Find the full ingredient list (INCI) for this skincare product.

Brand: ${brand}
Product name: ${searchName}

Pack size does not matter: the ingredient list is the same for every size of the same product, so ignore any size in the name.

Search for the brand's official product page first. If it doesn't list ingredients, use any reputable retailer's page for this exact product (Sephora, Ulta, Target, Walmart, Amazon, Boots, Superdrug, Dermstore, a drugstore chain, or the brand's page for another country). Only use a page that lists genuine, labeled ingredients for this specific product, not a similar product, and not a review that paraphrases ingredients. Try a few differently-worded searches before giving up: shorter names, the brand plus the product type, the name plus the word "ingredients".

Respond with ONLY a JSON object, no markdown fences, no other text:
{
  "found": boolean,
  "ingredients_inci": string or null,
  "source_url": string or null,
  "source_type": "brand_site" | "retailer" | "other" or null,
  "published_date": string (ISO 8601 date) or null,
  "published_date_precision": "exact" | "month" | "year" | "unknown",
  "category": "CLEANSE" | "TREAT" | "MOISTURIZE" | "PROTECT" | "OTHER"
}

"category" is what the product is for: CLEANSE (cleanser, face wash), TREAT (serum, active, exfoliant, retinoid, mask), MOISTURIZE (moisturizer, cream, lotion, oil, balm), PROTECT (sunscreen), or OTHER. Give it even when "found" is false, if you can tell from the name.

If you cannot find a reliable, clearly-labeled ingredient list, set "found": false and leave the ingredient fields null.`;
}

async function attempt(client: Anthropic, brand: string, name: string): Promise<Attempt> {
  const label = `${brand} — ${name}`;
  let messages: Anthropic.MessageParam[] = [{ role: "user", content: buildPrompt(brand, name) }];

  let response: Anthropic.Message | undefined;
  try {
    for (let turn = 0; turn <= MAX_CONTINUATIONS; turn++) {
      response = await client.messages.create({
        model: MODEL,
        max_tokens: MAX_TOKENS,
        tools: [{ type: "web_search_20260209", name: "web_search", max_uses: MAX_SEARCHES }],
        messages,
      });
      if (response.stop_reason !== "pause_turn") break;
      messages = [...messages, { role: "assistant", content: response.content as Anthropic.ContentBlockParam[] }];
    }
  } catch (err) {
    console.error(`[productLookup] web search request failed for "${label}":`, err);
    return { kind: "failed" };
  }

  if (!response) return { kind: "failed" };

  if (response.stop_reason === "refusal") {
    console.error(`[productLookup] web search refused for "${label}"`);
    return { kind: "failed" };
  }
  if (response.stop_reason === "max_tokens" || response.stop_reason === "pause_turn") {
    console.error(`[productLookup] web search for "${label}" was cut off (${response.stop_reason})`);
    return { kind: "failed" };
  }

  const textBlocks = response.content.filter((b) => b.type === "text");
  const lastText = textBlocks[textBlocks.length - 1];
  if (!lastText) {
    console.error(`[productLookup] web search for "${label}" ended without an answer`);
    return { kind: "failed" };
  }

  let parsed: AgentJsonResponse;
  try {
    parsed = JSON.parse(extractJson(lastText.text));
  } catch {
    console.error(`[productLookup] web search for "${label}" returned unreadable JSON: ${lastText.text.slice(0, 200)}`);
    return { kind: "failed" };
  }

  if (!parsed.found || !parsed.ingredients_inci) {
    console.warn(`[productLookup] no reliable ingredient list found online for "${label}"`);
    return { kind: "not_found" };
  }

  const precision: AgentDatePrecision = parsed.published_date_precision ?? "unknown";
  const publishedAt = parsed.published_date && precision !== "unknown" ? new Date(parsed.published_date) : null;
  const category = CATEGORIES.find((c) => c === parsed.category) ?? null;

  return {
    kind: "match",
    match: {
      ingredientsInci: parsed.ingredients_inci,
      sourceUrl: parsed.source_url,
      sourceType: parsed.source_type ?? "other",
      publishedAt: publishedAt && !isNaN(publishedAt.getTime()) ? publishedAt : null,
      publishedAtPrecision: precision,
      category,
    },
  };
}

/**
 * Falls back to Claude's hosted web search when Open Beauty Facts has no
 * match. Returns null when nothing reliable was found (or after a failed
 * retry) — the caller treats that as "no data yet": the product stays
 * without a ProductSource rather than getting a fabricated one. Every
 * failure is logged with its reason so "why didn't it find it?" is answerable.
 */
export async function searchViaWebAgent(brand: string, name: string): Promise<WebSearchAgentMatch | null> {
  if (!process.env.ANTHROPIC_API_KEY) return null;

  const client = new Anthropic();

  let result = await attempt(client, brand, name);
  // A search that ran properly and found nothing is a real answer. Anything
  // else (cut off, garbled, network blip) deserves one more go.
  if (result.kind === "failed") result = await attempt(client, brand, name);

  return result.kind === "match" ? result.match : null;
}
