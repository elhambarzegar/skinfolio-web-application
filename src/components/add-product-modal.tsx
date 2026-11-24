"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { ProductSearchRow, type OwnedProductEntry } from "@/components/product-search-row";
import { TypedSteps } from "@/components/typed-steps";

type Row = OwnedProductEntry & { rowId: number };

// A brand-new product can go through a real web-search lookup before we
// even get to comparing it (up to ~2 minutes in the slow case) — without
// visible progress that reads as stuck, not slow.
const ANALYZE_STEPS = [
  "Looking up product details",
  "Checking ingredients",
  "Comparing with your routine",
  "Checking for conflicts",
];

type CompatibilityResult = {
  productId: string;
  brand: string;
  name: string;
  compatibility: string;
  concern: "none" | "caution" | "conflict";
  ruleLabel: string | null;
  ruleUrl: string | null;
};

const CONCERN_STYLE: Record<CompatibilityResult["concern"], string> = {
  none: "bg-ok/10 text-ok",
  caution: "bg-warn/10 text-warn",
  conflict: "bg-danger/10 text-danger",
};

const CONCERN_LABEL: Record<CompatibilityResult["concern"], string> = {
  none: "Fits well",
  caution: "Use with care",
  conflict: "Conflict",
};

export function AddProductModal({ onClose }: { onClose: () => void }) {
  const router = useRouter();
  const nextRowId = useRef(1);
  const [rows, setRows] = useState<Row[]>([{ rowId: 0, brand: "", name: "", productId: null }]);
  const [phase, setPhase] = useState<"input" | "results">("input");
  const [analyzing, setAnalyzing] = useState(false);
  const [integrating, setIntegrating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [results, setResults] = useState<CompatibilityResult[]>([]);

  function updateRow(rowId: number, entry: OwnedProductEntry) {
    setRows((prev) => prev.map((r) => (r.rowId === rowId ? { ...entry, rowId } : r)));
  }

  function addRow() {
    setRows((prev) => [...prev, { rowId: nextRowId.current++, brand: "", name: "", productId: null }]);
  }

  function removeRow(rowId: number) {
    setRows((prev) => prev.filter((r) => r.rowId !== rowId));
  }

  async function handleAnalyze() {
    setError(null);
    const cleaned = rows.filter((r) => r.brand.trim() && r.name.trim());
    if (cleaned.length === 0) {
      setError("Add at least one product.");
      return;
    }

    setAnalyzing(true);

    try {
      const res = await fetch("/api/routine/add-product/analyze", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          products: cleaned.map(({ brand, name, productId }) => ({ brand, name, productId })),
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Something went wrong.");
        setAnalyzing(false);
        return;
      }
      setResults(data.results);
      setPhase("results");
      setAnalyzing(false);
    } catch {
      setError("Couldn't reach the server. Check your connection and try again.");
      setAnalyzing(false);
    }
  }

  async function handleIntegrate() {
    setError(null);
    setIntegrating(true);
    try {
      const res = await fetch("/api/routine/add-product/integrate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ productIds: results.map((r) => r.productId) }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Couldn't update the routine.");
        setIntegrating(false);
        return;
      }
      if (data.refused) {
        setError(
          `${data.concern} ${data.routing} We didn't rebuild the routine — this isn't something a product recommendation should weigh in on.`
        );
        setIntegrating(false);
        return;
      }
      router.push(`/routine/${data.id}`);
      router.refresh();
    } catch {
      setError("Couldn't reach the server. Check your connection and try again.");
      setIntegrating(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4" onClick={onClose}>
      <div
        className="bg-bg-raise border border-line rounded-[12px] max-w-lg w-full p-5 max-h-[85vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-1">
          <h2 className="text-[16px] font-bold text-ink">Add product{rows.length > 1 ? "s" : ""} to your routine</h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="text-ink-3 hover:text-ink text-[20px] leading-none px-1"
          >
            ×
          </button>
        </div>

        {phase === "input" && (
          <>
            <p className="text-[13px] text-ink-2 mb-4">
              We&rsquo;ll check how it fits with what you&rsquo;re already using before anything changes.
            </p>
            <div className="flex flex-col gap-3">
              {rows.map((row) => (
                <ProductSearchRow
                  key={row.rowId}
                  entry={row}
                  onChange={(entry) => updateRow(row.rowId, entry)}
                  onRemove={() => removeRow(row.rowId)}
                  showRemove={rows.length > 1}
                />
              ))}
              <button type="button" onClick={addRow} className="self-start text-[13px] font-semibold text-accent">
                + Add another product
              </button>
            </div>

            {error && (
              <p className="mt-4 text-[13px] text-danger border border-danger/40 bg-danger/10 rounded-[6px] px-3 py-2">
                {error}
              </p>
            )}

            {analyzing ? (
              <div className="mt-5 flex flex-col gap-4">
                <TypedSteps
                  lines={ANALYZE_STEPS}
                  label="Checking how this product fits your routine. A new product can take a couple of minutes."
                  patienceNote={null}
                />
                <p className="note">
                  A brand-new product can take a couple of minutes the first time — we&rsquo;re looking it up for real.
                </p>
              </div>
            ) : (
              <button
                type="button"
                onClick={handleAnalyze}
                className="mt-5 w-full text-[15px] font-bold bg-accent text-accent-ink px-6 py-2.5 rounded-[6px] hover:opacity-90"
              >
                Check fit
              </button>
            )}
          </>
        )}

        {phase === "results" && (
          <>
            <p className="text-[13px] text-ink-2 mb-4">
              Here&rsquo;s how {results.length === 1 ? "it" : "they"} would fit with your current routine. Nothing
              has changed yet.
            </p>
            <div className="flex flex-col gap-3">
              {results.map((r) => (
                <div key={r.productId} className="border border-line rounded-[8px] p-3 bg-bg">
                  <div className="flex items-start justify-between gap-3">
                    <span className="text-[14px] font-bold text-ink">
                      {r.brand} — {r.name}
                    </span>
                    <span
                      className={`text-[11px] font-semibold px-2 py-0.5 rounded-full whitespace-nowrap shrink-0 ${CONCERN_STYLE[r.concern]}`}
                    >
                      {CONCERN_LABEL[r.concern]}
                    </span>
                  </div>
                  <p className="mt-1.5 text-[13px] text-ink-2 leading-relaxed">{r.compatibility}</p>
                  {r.ruleLabel && (
                    <p className="mt-1.5 text-[11px] text-ink-3">
                      Source:{" "}
                      {r.ruleUrl ? (
                        <a href={r.ruleUrl} target="_blank" rel="noopener noreferrer" className="text-accent hover:underline">
                          {r.ruleLabel}
                        </a>
                      ) : (
                        r.ruleLabel
                      )}
                    </p>
                  )}
                </div>
              ))}
            </div>

            {error && (
              <p className="mt-4 text-[13px] text-danger border border-danger/40 bg-danger/10 rounded-[6px] px-3 py-2">
                {error}
              </p>
            )}

            <div className="mt-5 flex gap-2">
              <button
                type="button"
                onClick={() => setPhase("input")}
                disabled={integrating}
                className="flex-1 text-[14px] font-semibold text-ink-2 border border-line rounded-[6px] py-2.5 disabled:opacity-50"
              >
                Back
              </button>
              <button
                type="button"
                onClick={handleIntegrate}
                disabled={integrating}
                className="flex-1 text-[15px] font-bold bg-accent text-accent-ink rounded-[6px] py-2.5 hover:opacity-90 disabled:opacity-50"
              >
                {integrating ? "Updating routine…" : "Add to routine"}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
