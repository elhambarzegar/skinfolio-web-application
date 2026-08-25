export const EXPERIENCE_OPTIONS = [
  { value: "NO_ROUTINE", label: "I don't really have a skincare routine." },
  { value: "INCONSISTENT", label: "I use a few products but inconsistently." },
  { value: "HAS_ROUTINE_UNSURE", label: "I have a routine but I'm not sure it's right." },
  { value: "KNOWLEDGEABLE", label: "I already know skincare fairly well." },
] as const;

export const PRIORITY_OPTIONS = [
  { value: "USE_OWNED", label: "Use what I already own." },
  { value: "ONE_BETTER_PRODUCT", label: "Buy one better product instead of several." },
  { value: "BEST_RESULTS", label: "Get the best possible results." },
  { value: "MINIMIZE_SPEND", label: "Spend as little as possible." },
] as const;

export const COMPLEXITY_OPTIONS = [
  { value: "SIMPLEST", label: "I prefer the simplest routine possible." },
  { value: "FEW_EXTRA_OK", label: "I'm okay with a few extra steps if they help." },
  { value: "ENJOYS_SKINCARE", label: "I enjoy skincare." },
] as const;

export type ExperienceLevel = (typeof EXPERIENCE_OPTIONS)[number]["value"];
export type Priority = (typeof PRIORITY_OPTIONS)[number]["value"];
export type ComplexityPreference = (typeof COMPLEXITY_OPTIONS)[number]["value"];

function toLabelMap<T extends string>(options: readonly { value: T; label: string }[]): Record<T, string> {
  return Object.fromEntries(options.map((o) => [o.value, o.label])) as Record<T, string>;
}

export const EXPERIENCE_LABEL = toLabelMap(EXPERIENCE_OPTIONS);
export const PRIORITY_LABEL = toLabelMap(PRIORITY_OPTIONS);
export const COMPLEXITY_LABEL = toLabelMap(COMPLEXITY_OPTIONS);
