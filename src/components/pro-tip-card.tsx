"use client";

import { useState } from "react";

export type ProTipView = {
  id: string;
  routineId: string;
  stepId: string;
  summary: string;
  actionType: "ADD" | "REMOVE" | "CHANGE" | "KEEP";
  status: "PENDING" | "ACCEPTED" | "REJECTED";
  ruleLabel: string | null;
  ruleUrl: string | null;
};

const ACTION_LABEL: Record<ProTipView["actionType"], string> = {
  ADD: "Suggested addition",
  REMOVE: "Suggested removal",
  CHANGE: "Suggested change",
  KEEP: "Worth keeping",
};

const ACTION_STYLE: Record<ProTipView["actionType"], string> = {
  ADD: "bg-ok/10 text-ok",
  REMOVE: "bg-danger/10 text-danger",
  CHANGE: "bg-warn/10 text-warn",
  KEEP: "bg-chip text-ink-2",
};

export function ProTipCard({
  tip,
  onResolved,
}: {
  tip: ProTipView;
  onResolved?: (tip: ProTipView, status: "ACCEPTED" | "REJECTED") => void;
}) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [localStatus, setLocalStatus] = useState(tip.status);

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
      setLocalStatus(newStatus);
      onResolved?.(tip, newStatus);
    } catch {
      setError("Couldn't reach the server. Check your connection and try again.");
      setBusy(false);
    }
  }

  return (
    <div className="border border-line rounded-[8px] p-3 bg-bg-raise">
      <div className="flex items-start justify-between gap-3">
        <p className="text-[13px] text-ink flex-1 leading-relaxed">{tip.summary}</p>
        <span
          className={`text-[11px] font-semibold px-2 py-0.5 rounded-full whitespace-nowrap shrink-0 ${ACTION_STYLE[tip.actionType]}`}
        >
          Pro Tip · {ACTION_LABEL[tip.actionType]}
        </span>
      </div>

      {tip.ruleLabel && (
        <p className="mt-1.5 text-[11px] text-ink-3">
          Source:{" "}
          {tip.ruleUrl ? (
            <a href={tip.ruleUrl} target="_blank" rel="noopener noreferrer" className="text-accent hover:underline">
              {tip.ruleLabel}
            </a>
          ) : (
            tip.ruleLabel
          )}
        </p>
      )}

      {error && <p className="mt-2 text-[12px] text-danger">{error}</p>}

      {localStatus === "PENDING" ? (
        <div className="mt-2.5 flex gap-2">
          <button
            type="button"
            disabled={busy}
            onClick={() => respond("accept")}
            className="text-[12px] font-semibold bg-accent text-accent-ink px-3 py-1.5 rounded-[6px] disabled:opacity-50"
          >
            Accept
          </button>
          <button
            type="button"
            disabled={busy}
            onClick={() => respond("reject")}
            className="text-[12px] font-semibold text-ink-2 border border-line px-3 py-1.5 rounded-[6px] disabled:opacity-50"
          >
            Reject
          </button>
        </div>
      ) : (
        <p className="mt-2.5 text-[11px] text-ink-3">
          {localStatus === "ACCEPTED" ? "Accepted" : "Rejected"}
        </p>
      )}
    </div>
  );
}
