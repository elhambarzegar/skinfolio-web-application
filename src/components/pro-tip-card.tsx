"use client";

import { useState } from "react";
import { buildShopLinks } from "@/lib/shopLinks";
import { freqPhrase } from "@/lib/schedule";
import { tipKind } from "@/lib/routine/tipKind";

export type ProTipView = {
  id: string;
  routineId: string;
  stepId: string;
  summary: string;
  actionType: "ADD" | "REMOVE" | "CHANGE" | "KEEP";
  status: "PENDING" | "ACCEPTED" | "REJECTED";
  ruleLabel: string | null;
  ruleUrl: string | null;
  // Short, brand-agnostic search phrase (e.g. "fragrance-free mineral SPF
  // 30+ sunscreen") — never a specific product name. Present only for
  // ADD/CHANGE tips that describe something to shop for.
  shopQuery: string | null;
  // The new frequency a CHANGE tip proposes, when it proposes one.
  alternativeFrequency: number | null;
};

const ACTION_LABEL: Record<ProTipView["actionType"], string> = {
  ADD: "Suggested addition",
  REMOVE: "Suggested removal",
  CHANGE: "Suggested change",
  KEEP: "Worth keeping",
};

const ACTION_BADGE: Record<ProTipView["actionType"], string> = {
  ADD: "b-new",
  REMOVE: "b-out",
  CHANGE: "b-new",
  KEEP: "b-cat",
};

export function ProTipCard({
  tip,
  onAddProduct,
  onResolved,
}: {
  tip: ProTipView;
  /** Opens the add-product flow for this tip's suggested gap. */
  onAddProduct?: (tip: ProTipView) => void;
  onResolved?: (tip: ProTipView, status: "ACCEPTED" | "REJECTED") => void;
}) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // What the person just chose, shown at once; otherwise what the server says.
  const [justChose, setJustChose] = useState<"ACCEPTED" | "REJECTED" | null>(null);
  const status = justChose ?? tip.status;

  const kind = tipKind(tip, { alternativeFrequency: tip.alternativeFrequency, suggestedDescription: tip.shopQuery });

  async function respond(action: "accept" | "reject") {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/routine/${tip.routineId}/protips/${tip.id}/respond`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Something went wrong.");
        setBusy(false);
        return;
      }
      const newStatus = action === "accept" ? "ACCEPTED" : "REJECTED";
      setJustChose(newStatus);
      onResolved?.(tip, newStatus);
    } catch {
      setError("Couldn't reach the server. Check your connection and try again.");
      setBusy(false);
    }
  }

  const resolvedText =
    status === "ACCEPTED"
      ? kind === "shop"
        ? "✓ Added to your routine"
        : "✓ Done"
      : kind === "shop"
        ? "Skipped"
        : kind === "advice"
          ? "Dismissed"
          : "Left as it was";

  return (
    <div className="step">
      <div className="badges">
        <span className={`badge ${ACTION_BADGE[tip.actionType]}`}>{ACTION_LABEL[tip.actionType]}</span>
      </div>

      <p className="text-[20px] leading-snug">{tip.summary}</p>

      {tip.ruleLabel && (
        <p className="note">
          Source:{" "}
          {tip.ruleUrl ? (
            <a href={tip.ruleUrl} target="_blank" rel="noopener noreferrer" className="underline underline-offset-4">
              {tip.ruleLabel}
            </a>
          ) : (
            tip.ruleLabel
          )}
        </p>
      )}

      {tip.shopQuery && (kind === "shop" || kind === "advice") && status === "PENDING" && (
        <div className="flex flex-col gap-2">
          <p className="eyebrow">Where to look</p>
          <div className="flex flex-wrap gap-2">
            {Object.entries(buildShopLinks(tip.shopQuery)).map(([site, url]) => (
              <a key={site} href={url} target="_blank" rel="noopener noreferrer" className="btn btn-2 btn-sm">
                Shop on <span className="capitalize">{site}</span>
              </a>
            ))}
          </div>
        </div>
      )}

      {error && (
        <p role="alert" className="callout c-blush font-bold">
          {error}
        </p>
      )}

      {status !== "PENDING" ? (
        <p className="text-[19px] font-bold">{resolvedText}</p>
      ) : kind === "shop" ? (
        <div className="flex flex-col gap-2">
          <p className="note">Pick a product first. We&rsquo;ll check it against your routine before adding it.</p>
          <div className="flex flex-col gap-2 sm:flex-row">
            <button type="button" disabled={busy} onClick={() => onAddProduct?.(tip)} className="btn flex-1">
              I have one — add it
            </button>
            <button type="button" disabled={busy} onClick={() => respond("reject")} className="btn btn-2 flex-1">
              Skip this suggestion
            </button>
          </div>
        </div>
      ) : kind === "advice" ? (
        <button type="button" disabled={busy} onClick={() => respond("reject")} className="btn btn-2">
          Dismiss
        </button>
      ) : (
        <div className="flex flex-col gap-2 sm:flex-row">
          <button type="button" disabled={busy} onClick={() => respond("accept")} className="btn flex-1">
            {tip.actionType === "REMOVE"
              ? "Remove it"
              : tip.alternativeFrequency
                ? `Change to ${freqPhrase(tip.alternativeFrequency)}`
                : "Accept"}
          </button>
          <button type="button" disabled={busy} onClick={() => respond("reject")} className="btn btn-2 flex-1">
            {tip.actionType === "REMOVE" ? "Keep it" : "Keep as it is"}
          </button>
        </div>
      )}
    </div>
  );
}
