/**
 * Reference policy the routine agent reasons over — carried over from the
 * Skinfolio capstone's policies/ingredient-rules.md and
 * policies/safety-triggers.md (Section 1 only; Section 2 is for check-ins,
 * a later build phase). Each rule is sourced; see the original files for
 * full citations. This is a reference document, not medical advice.
 */

export const INGREDIENT_RULES = `
Rule 1 — Sunscreen goes last in a daytime routine. Sunscreen (SPF) should be the final product applied in a morning routine — after treatments and moisturizer, before makeup. (AAD)

Rule 2 — Retinoids are a nighttime ingredient. Retinoids (retinol, tretinoin, adapalene, and related vitamin-A derivatives) should be applied only at night, because they increase the skin's sensitivity to sunlight. (AAD)

Rule 3 — Retinoid use requires daytime sun protection. Any routine containing a retinoid must be paired with daily daytime sun protection. (AAD)

Rule 4 — AHA use requires sun protection during and after use. Products containing alpha hydroxy acids (glycolic acid, lactic acid, etc.) must be paired with sunscreen while in use and for about a week after discontinuing. (FDA)

Rule 5 — Safe AHA concentration and pH thresholds. An AHA product is considered safe for consumer use only when AHA concentration does not exceed 10% and the finished product's pH is 3.5 or higher. (FDA / CIR)

Rule 6 — Retinoids are avoided in pregnancy; specific actives are the recommended substitutes. Topical retinoids are generally avoided during pregnancy; benzoyl peroxide, azelaic acid, salicylic acid, and glycolic acid are the suggested OTC substitutes. (ACOG via MotherToBaby)

Rule 7 — Hydroquinone is restricted, not an open-market OTC ingredient. Skin-lightening products containing hydroquinone are not approved for OTC sale in the US. Handmade, non-English, or unlabeled products should be avoided as they may contain undisclosed hydroquinone or mercury. (FDA)

Rule 8 — Fragrance is a leading allergen and warrants patch testing. Any new fragranced product should be patch-tested before full-face use. (FDA)

Rule 9 — Limit the number of active anti-aging ingredients layered at once. Stacking more than one active ingredient raises irritation risk; new actives should be introduced one at a time. (AAD)

Rule 10 — L-ascorbic acid (pure vitamin C) requires specific formulation conditions to remain stable. It oxidizes readily on exposure to light, air, and water; stays effective longest in low-pH, opaque/airtight, water-minimal formulations. (Journal of Skin and Stem Cell)

Step order for a routine: Cleanse → Treat (serums/actives) → Moisturize → Protect (AM sunscreen). Retinoids and other actives go in the Treat step, PM only.
`.trim();

export const INTAKE_SAFETY_TRIGGERS = `
These apply to free-text describing an existing skin concern, collected before making any product recommendation. Intake is text-only, so these triggers are intentionally broad — a keyword/pattern match is enough to flag. When in doubt, escalate rather than interpret.

Rule 1 — Any mention of a mole, spot, freckle, birthmark, or beauty mark in connection with a concern is a red flag. Route to "see a dermatologist for an in-person exam" instead of a product recommendation. (AAD, ABCDEs of melanoma)

Rule 2 — "Sudden"/"suddenly"/"overnight" describing any skin change (new growth, rapid color change, rapid spread) is a red flag. (AAD)

Rule 3 — Bleeding, oozing, or a new lump from a skin lesion is a red flag. (American Cancer Society)

Rule 4 — Pain, tenderness, or "hurts" specifically attached to a mole, lesion, or rash (not general body pain) is a red flag. (American Cancer Society; AAD)

Rule 5 — A sore, wound, or spot that "won't heal" or has persisted for weeks without healing is a red flag. (American Cancer Society)

Rule 6 — Fever, chills, or feeling generally unwell alongside a rash or reaction is a red flag. (AAD)

Rule 7 — Blistering, peeling, or open/raw skin is a red flag. (AAD)

Rule 8 — A rash or reaction involving the eyes, mouth, lips, or genital skin is a red flag. (AAD)

Rule 9 — A rash described as covering "most of my body," "everywhere," or spreading rapidly is a red flag. (AAD)

Rule 10 — Mentions of pus, yellow/golden crusting, or an area that is warm + swollen + painful at once is a red flag for possible infection. (AAD)

Rule 11 — EMERGENCY, supersedes all other rules: "trouble breathing," "can't swallow," "throat feels tight," or swelling of the lips/face/tongue/throat. Route to "seek emergency medical care / call emergency services now," not a routine dermatologist referral. (AAD; Mayo Clinic, Anaphylaxis)

A red-flag or emergency match means: do not generate a routine. Refuse and route the person to the appropriate care instead.
`.trim();
