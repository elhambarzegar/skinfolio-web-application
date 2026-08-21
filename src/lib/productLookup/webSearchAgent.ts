import Anthropic from "@anthropic-ai/sdk";

const MODEL = "claude-opus-5";

export type AgentSourceType = "brand_site" | "retailer" | "other";
export type AgentDatePrecision = "exact" | "month" | "year" | "unknown";

export type WebSearchAgentMatch = {
  ingredientsInci: string;
  sourceUrl: string | null;
  sourceType: AgentSourceType;
  publishedAt: Date | null;
  publishedAtPrecision: AgentDatePrecision;
};

type AgentJsonResponse = {
  found: boolean;
  ingredients_inci: string | null;
  source_url: string | null;
  source_type: AgentSourceType | null;
  published_date: string | null;
  published_date_precision: AgentDatePrecision | null;
};

function extractJson(text: string): string {
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (fenced) return fenced[1].trim();
  const start = text.indexOf("{");
  const end = text.lastIndexOf("}");
  if (start === -1 || end === -1 || end < start) return text;
  return text.slice(start, end + 1);
}

/**
 * Falls back to Claude's hosted web search when Open Beauty Facts has no
 * match. Returns null on any failure (no key, refusal, parse failure,
 * network error) — the caller treats that identically to "not found": the
 * product stays without a ProductSource rather than getting a fabricated one.
 */
export async function searchViaWebAgent(
  brand: string,
  name: string
): Promise<WebSearchAgentMatch | null> {
  if (!process.env.ANTHROPIC_API_KEY) return null;

  const client = new Anthropic();

  let response;
  try {
    response = await client.messages.create({
      model: MODEL,
      max_tokens: 2000,
      tools: [{ type: "web_search_20260209", name: "web_search", max_uses: 3 }],
      messages: [
        {
          role: "user",
          content: `Find the full ingredient list (INCI) for this skincare product.

Brand: ${brand}
Product name: ${name}

Search for the brand's official product page first, then a major retailer listing (e.g. Sephora, Ulta, Target) if the brand site doesn't have it. Only use a page that lists genuine, labeled ingredients for this specific product — not a similar product, not a review that paraphrases ingredients.

Respond with ONLY a JSON object, no markdown fences, no other text:
{
  "found": boolean,
  "ingredients_inci": string or null,
  "source_url": string or null,
  "source_type": "brand_site" | "retailer" | "other" or null,
  "published_date": string (ISO 8601 date) or null,
  "published_date_precision": "exact" | "month" | "year" | "unknown"
}

If you cannot find a reliable, clearly-labeled ingredient list, set "found": false and leave the other fields null.`,
        },
      ],
    });
  } catch (err) {
    console.error("[productLookup] web search agent request failed:", err);
    return null;
  }

  if (response.stop_reason === "refusal") return null;

  const textBlocks = response.content.filter((b) => b.type === "text");
  const lastText = textBlocks[textBlocks.length - 1];
  if (!lastText) return null;

  let parsed: AgentJsonResponse;
  try {
    parsed = JSON.parse(extractJson(lastText.text));
  } catch {
    console.error("[productLookup] web search agent returned unparseable JSON");
    return null;
  }

  if (!parsed.found || !parsed.ingredients_inci) return null;

  const precision: AgentDatePrecision = parsed.published_date_precision ?? "unknown";
  const publishedAt =
    parsed.published_date && precision !== "unknown" ? new Date(parsed.published_date) : null;

  return {
    ingredientsInci: parsed.ingredients_inci,
    sourceUrl: parsed.source_url,
    sourceType: parsed.source_type ?? "other",
    publishedAt: publishedAt && !isNaN(publishedAt.getTime()) ? publishedAt : null,
    publishedAtPrecision: precision,
  };
}
