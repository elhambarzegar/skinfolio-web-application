import { stripRuleNumbers } from "@/lib/routine/policy";

/**
 * Keeps whole sentences up to about `maxChars`, never cutting one in half.
 * The first sentence is always kept, even if it is long, because it carries
 * the point. Rule numbers are removed. The prompts ask the AI to be brief;
 * this makes sure a rambling answer can't reach the screen.
 */
export function tidyText(text: string, maxChars: number): string {
  const clean = stripRuleNumbers(text).replace(/\s+/g, " ").trim();
  if (clean.length <= maxChars) return clean;

  // A sentence ends at . ! or ? followed by a capital letter, digit, quote or bracket
  // ("e.g. a pea" doesn't end one).
  const sentences = clean.split(/(?<=[.!?])\s+(?=[A-Z0-9"“(])/);
  let out = "";
  for (const s of sentences) {
    const next = out ? `${out} ${s}` : s;
    if (out && next.length > maxChars) break;
    out = next;
  }
  return out;
}
