/** What a re-done intake changed, worked out from plain lists. */

export function diffShelf(onShelf: string[], listed: string[]): { added: string[]; removed: string[] } {
  const have = new Set(onShelf);
  const want = new Set(listed);
  return {
    added: [...want].filter((id) => !have.has(id)),
    removed: [...have].filter((id) => !want.has(id)),
  };
}

const sameSet = (a: string[], b: string[]) => a.length === b.length && a.every((x) => b.includes(x));

export type IntakeSnapshot = {
  concerns: string[];
  experienceLevel: string | null;
  priority: string | null;
  complexityPreference: string | null;
};

/** Did the person change their concerns or their profile answers? */
export function detailsChanged(before: IntakeSnapshot | null, after: IntakeSnapshot): { concerns: boolean; profile: boolean } {
  if (!before) return { concerns: false, profile: false };
  return {
    concerns: !sameSet(before.concerns, after.concerns),
    profile:
      before.experienceLevel !== after.experienceLevel ||
      before.priority !== after.priority ||
      before.complexityPreference !== after.complexityPreference,
  };
}

const list = (names: string[]) => (names.length <= 3 ? names.join(", ") : `${names.slice(0, 3).join(", ")} and ${names.length - 3} more`);

/** One sentence, shown to the person and used by the routine check: what they just changed. Null when nothing changed. */
export function describeIntakeChange(c: { addedNames: string[]; removedNames: string[]; concerns: boolean; profile: boolean }): string | null {
  const parts: string[] = [];
  if (c.addedNames.length) parts.push(`added ${list(c.addedNames)}`);
  if (c.removedNames.length) parts.push(`removed ${list(c.removedNames)}`);
  if (c.concerns) parts.push("changed your skin concerns");
  if (c.profile) parts.push("changed your answers about experience or preferences");
  if (parts.length === 0) return null;
  const joined = parts.length === 1 ? parts[0] : `${parts.slice(0, -1).join(", ")} and ${parts[parts.length - 1]}`;
  return `You redid your details and ${joined}.`;
}
