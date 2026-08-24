import Anthropic from "@anthropic-ai/sdk";
import { z } from "zod";
import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod";
import { CHECKIN_SAFETY_TRIGGERS } from "./policy";

const MODEL = "claude-opus-5";

const Classification = z.object({
  severity: z.enum(["normal", "adverse", "emergency"]),
  reasoning: z.string(),
});

export type CheckInClassification = z.infer<typeof Classification>;

export type PriorCheckIn = {
  dayNumber: number;
  timeOfDay: "AM" | "PM";
  symptomsText: string | null;
  wasFlagged: boolean;
};

const SYSTEM_PROMPT = `You classify skincare check-in free text as "normal", "adverse", or "emergency", using the policy below. This is a triage aid, not a diagnosis — when a rule's criteria are met, classify accordingly even if the situation might turn out to be minor; under-flagging is the failure mode to avoid, not over-flagging.

POLICY:
${CHECKIN_SAFETY_TRIGGERS}

Prior check-ins for this same routine are provided for Rule 16 (not improving from a prior check-in). If there is no relevant symptom in the current text, classify as "normal" with a brief reasoning. Keep "reasoning" plain-language and short enough for someone to read in a few seconds.`;

/**
 * Empty/trivial symptom text skips the agent call entirely — there's
 * nothing to assess, and it keeps normal check-ins free and instant.
 */
export async function classifyCheckIn(
  symptomsText: string | null,
  priorCheckIns: PriorCheckIn[]
): Promise<CheckInClassification> {
  if (!symptomsText || symptomsText.trim().length === 0) {
    return { severity: "normal", reasoning: "No symptoms reported." };
  }

  const priorContext =
    priorCheckIns.length > 0
      ? priorCheckIns
          .map(
            (c) =>
              `Day ${c.dayNumber} (${c.timeOfDay}): ${c.symptomsText ?? "no symptoms noted"}${c.wasFlagged ? " [flagged adverse/emergency at the time]" : ""}`
          )
          .join("\n")
      : "None — this is the first check-in for this routine.";

  const client = new Anthropic();

  try {
    const response = await client.messages.parse({
      model: MODEL,
      max_tokens: 1000,
      system: SYSTEM_PROMPT,
      output_config: { format: zodOutputFormat(Classification) },
      messages: [
        {
          role: "user",
          content: `Prior check-ins:\n${priorContext}\n\nToday's check-in text: ${symptomsText}`,
        },
      ],
    });

    if (!response.parsed_output) {
      console.error("[checkin] classification response didn't match schema");
      return { severity: "adverse", reasoning: "Couldn't parse the safety check — flagging out of caution." };
    }

    return response.parsed_output;
  } catch (err) {
    console.error("[checkin] classification request failed:", err);
    return { severity: "adverse", reasoning: "Couldn't run the safety check — flagging out of caution." };
  }
}
