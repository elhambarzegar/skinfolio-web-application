import Anthropic from "@anthropic-ai/sdk";
import { z } from "zod";
import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod";

const MODEL = "claude-opus-5";

const ScanResult = z.object({
  found: z.boolean(),
  ingredientsInci: z.string().nullable(),
  reason: z.string(),
});

export type PhotoScanResult =
  | { ok: true; ingredientsInci: string }
  | { ok: false; reason: string };

/**
 * Reads an ingredient list off a photographed product label. Returns ok:
 * false (with a plain-language reason) rather than a low-quality guess when
 * the photo doesn't clearly show one — same "don't fabricate" rule as the
 * web-search fallback.
 */
export async function scanIngredientsFromPhoto(
  imageBase64: string,
  mediaType: "image/jpeg" | "image/png" | "image/webp"
): Promise<PhotoScanResult> {
  const client = new Anthropic();

  let response;
  try {
    response = await client.messages.parse({
      model: MODEL,
      max_tokens: 2000,
      system: `You read skincare product ingredient labels from photos. The photo may be blurry, at an angle, or only partially show the label — judge honestly whether you can actually read a genuine ingredient list, don't guess or reconstruct one from partial text.

Respond via the structured output: "found" true only if you can read a real, complete-looking ingredient list. "ingredientsInci" is the list exactly as printed (comma-separated, preserve the original wording/capitalization of each ingredient), or null if not found. "reason" is one short sentence — either confirming what you read, or explaining why you couldn't (too blurry, wrong side of the package, cut off, not an ingredient label at all).`,
      output_config: { format: zodOutputFormat(ScanResult) },
      messages: [
        {
          role: "user",
          content: [
            { type: "image", source: { type: "base64", media_type: mediaType, data: imageBase64 } },
            { type: "text", text: "Read the ingredient list from this photo." },
          ],
        },
      ],
    });
  } catch (err) {
    console.error("[photoScan] request failed:", err);
    return { ok: false, reason: "Couldn't reach the extraction service. Try again." };
  }

  const parsed = response.parsed_output;
  if (!parsed) {
    return { ok: false, reason: "Couldn't read a response — try again." };
  }
  if (!parsed.found || !parsed.ingredientsInci) {
    return { ok: false, reason: parsed.reason || "Couldn't read an ingredient list in that photo." };
  }

  return { ok: true, ingredientsInci: parsed.ingredientsInci };
}
