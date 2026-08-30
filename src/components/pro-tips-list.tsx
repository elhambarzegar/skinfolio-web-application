"use client";

import { useState } from "react";
import { ProTipCard, type ProTipView } from "./pro-tip-card";

export function ProTipsList({
  tips,
  emptyText,
  hideResolved,
  onTipResolved,
}: {
  tips: ProTipView[];
  emptyText?: string;
  hideResolved?: boolean;
  onTipResolved?: (tip: ProTipView, status: "ACCEPTED" | "REJECTED") => void;
}) {
  const [items, setItems] = useState(tips);

  function handleResolved(tip: ProTipView, status: "ACCEPTED" | "REJECTED") {
    setItems((prev) =>
      hideResolved ? prev.filter((t) => t.id !== tip.id) : prev.map((t) => (t.id === tip.id ? { ...t, status } : t))
    );
    onTipResolved?.(tip, status);
  }

  if (items.length === 0) {
    return emptyText ? <p className="text-[13px] text-ink-3">{emptyText}</p> : null;
  }

  return (
    <div className="flex flex-col gap-2">
      {items.map((tip) => (
        <ProTipCard key={tip.id} tip={tip} onResolved={handleResolved} />
      ))}
    </div>
  );
}
