"use client";

import { useState } from "react";
import { ChangeFlow } from "@/components/change-flow";
import type { ChangeView } from "@/lib/routine/changes";

/** Changes the app has worked out and that wait for the person's OK. */
export function PendingChanges({ changes }: { changes: ChangeView[] }) {
  const [open, setOpen] = useState<string | null>(null);
  if (changes.length === 0) return null;

  return (
    <>
      <div className="flex flex-col gap-4">
        {changes.map((c) => (
          <div key={c.id} className="callout c-sun">
            <p className="eyebrow">Waiting for your OK</p>
            <h2>{c.summary}</h2>
            <p className="note" style={{ color: "var(--ink)" }}>
              {c.trigger}
            </p>
            <button type="button" onClick={() => setOpen(c.id)} className="btn">
              Read it and decide
            </button>
          </div>
        ))}
      </div>
      {open && <ChangeFlow mode={{ kind: "review", changeId: open }} onClose={() => setOpen(null)} />}
    </>
  );
}
