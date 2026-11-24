/**
 * What a Pro Tip asks the person to do, which decides what the card offers.
 *
 *  - "shop":   go and get a product. Accepting means nothing until a real
 *              product exists, so the only real actions are "I have one,
 *              add it" or skip.
 *  - "advice": a swap to a different kind of product with nothing to apply
 *              right now. Shop links and a dismiss, nothing to accept.
 *  - "decide": something the app can actually do (remove a product, change
 *              how often it's used). Accept or reject.
 */
export type TipKind = "shop" | "advice" | "decide";

export function tipKind(
  tip: { actionType: "ADD" | "REMOVE" | "CHANGE" | "KEEP" | string },
  step: { alternativeFrequency: number | null; suggestedDescription: string | null }
): TipKind {
  if (tip.actionType === "ADD") return "shop";
  if (tip.actionType === "CHANGE" && !step.alternativeFrequency && !!step.suggestedDescription) return "advice";
  return "decide";
}
