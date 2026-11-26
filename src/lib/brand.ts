/**
 * The product's name lives here and only here, so renaming the app is a
 * one-line change. Everything the user sees (nav, page titles, sign-in)
 * reads from this.
 */
export const BRAND = {
  name: "Sagedew",
  tagline: "A wise guide to fresh skin.",
} as const;

/**
 * Facts the Privacy Policy and Terms state. Fill these in before launch: the
 * mailbox must exist, and "operator" should become the legal name and country
 * of whoever runs the service.
 */
export const LEGAL = {
  operator: "the founder of Sagedew",
  contactEmail: "privacy@sagedew.com",
  /** Shown as "Last updated". Change it whenever either document changes. */
  updated: "26 November 2026",
} as const;
