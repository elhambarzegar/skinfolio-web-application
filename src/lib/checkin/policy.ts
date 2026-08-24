/**
 * Section 2 of the capstone's policies/safety-triggers.md — the check-in
 * adverse-vs-normal criteria. Section 1 (intake red flags) lives in
 * src/lib/routine/policy.ts and is used at routine-generation time instead.
 */

export const CHECKIN_SAFETY_TRIGGERS = `
These apply to free-text collected after someone has started using a product, distinguishing an expected, self-limited reaction from one that needs escalation.

Rule 12 — Normal: mild, application-site-confined irritation in the first weeks of a new active. Dryness, flaking, mild scaling, mild burning, and mild redness confined to the application area, in the first two to four weeks of a new topical retinoid, are expected tolerability and should NOT be classified as adverse on their own. (Journal of Cosmetic Dermatology, 2024)

Rule 13 — Normal itching: mild, confined to the application site, immediate-onset, and improving. All of: mild, stays within the applied area, began at or shortly after application, improving over successive check-ins. (AAFP)

Rule 14 — Adverse itching: spreading beyond the application site. Itching that spreads beyond where the product was applied is adverse — a marker of an allergic rather than irritant reaction. (AAFP; AAD)

Rule 15 — Adverse itching: accompanied by hives, welts, blistering, or swelling, regardless of how mild the itching itself feels. (AAD; Mayo Clinic)

Rule 16 — Adverse: not improving by the next check-in. A symptom that is still present, unchanged, or worse at a subsequent check-in is adverse, even if it was normal/mild at the prior check-in. This is why prior check-ins for the same routine are included as context below — compare against them.

Rule 17 — Adverse: infection-pattern symptoms at the application site. Pus, yellow/golden crusting, or an area that is simultaneously warm, swollen, and painful — possible secondary infection. (AAD)

Rule 18 — Adverse: fever accompanying any product-related skin reaction. (AAD)

Rule 19 — EMERGENCY, supersedes all other rules: trouble breathing or swallowing, or swelling of the lips, face, tongue, or throat, at any check-in. Route to "seek emergency medical care now." (Mayo Clinic, Anaphylaxis)

Rule 20 — EMERGENCY, supersedes all other rules: blisters where skin "rubs off easily" + sores in the mouth or eyes + feeling seriously unwell, especially 1-3 weeks after starting a new product (possible severe cutaneous adverse reaction). (Merck Manual, SJS/TEN)

Emergency outranks adverse, which outranks normal. "Purging" (temporary breakout increase after starting a retinoid) has no authoritative source confirming it as a real phenomenon — treat any reported new/worsening breakout using the general criteria above, not as an assumed non-issue.
`.trim();
