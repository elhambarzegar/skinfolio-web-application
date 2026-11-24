"use client";

import { ProTipCard, type ProTipView } from "./pro-tip-card";

/** The tips as the server last reported them; each card shows its own choice at once. */
export function ProTipsList({
  tips,
  onAddProduct,
  onTipResolved,
}: {
  tips: ProTipView[];
  onAddProduct?: (tip: ProTipView) => void;
  onTipResolved?: (tip: ProTipView, status: "ACCEPTED" | "REJECTED") => void;
}) {
  if (tips.length === 0) return null;

  return (
    <div className="flex flex-col gap-4">
      {tips.map((tip) => (
        <ProTipCard key={tip.id} tip={tip} onAddProduct={onAddProduct} onResolved={onTipResolved} />
      ))}
    </div>
  );
}
