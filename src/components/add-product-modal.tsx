"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ProductSearchRow, type OwnedProductEntry } from "@/components/product-search-row";
import { TypedSteps } from "@/components/typed-steps";
import { freqPhrase } from "@/lib/schedule";

type Row = OwnedProductEntry & { rowId: number };

// A brand-new product can go through a real web-search lookup before we
// even get to comparing it (a minute or two in the slow case) — without
// visible progress that reads as stuck, not slow.
const ANALYZE_STEPS = [
  "Looking up product details",
  "Checking ingredients",
  "Comparing with your routine",
  "Checking for conflicts",
];

type Placement = {
  timeOfDay: "AM" | "PM";
  position: number;
  frequencyPerWeek: number;
  timeCostMinutes: number | null;
};

type CompatibilityResult = {
  productId: string;
  brand: string;
  name: string;
  compatibility: string;
  concern: "none" | "caution" | "conflict";
  ruleCitation: number | null;
  ruleLabel: string | null;
  ruleUrl: string | null;
  category: string;
  ingredients: "verified" | "unverified" | "none";
  placements: Placement[];
  fillsStepId: string | null;
};

const CONCERN_BADGE: Record<CompatibilityResult["concern"], { cls: string; text: string }> = {
  none: { cls: "b-ok", text: "✓ Fits well" },
  caution: { cls: "b-new", text: "Use with care" },
  conflict: { cls: "b-out", text: "Conflict" },
};

/**
 * Checks a product against the routine, then adds it. "Add" is the approval:
 * the check is shown first, and nothing changes until that button is pressed.
 *
 * With `fill`, the product is meant for one of the routine's suggested gaps
 * (a Pro Tip that says "look for X"), and takes that slot.
 */
export function AddProductModal({
  onClose,
  routineId,
  fill,
}: {
  onClose: () => void;
  /** Check against this routine (one still in review) instead of the one in use. */
  routineId?: string;
  fill?: { stepId: string; description: string };
}) {
  const router = useRouter();
  const nextRowId = useRef(1);
  const [rows, setRows] = useState<Row[]>([{ rowId: 0, brand: "", name: "", productId: null }]);
  const [phase, setPhase] = useState<"input" | "results" | "done">("input");
  const [analyzing, setAnalyzing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [results, setResults] = useState<CompatibilityResult[]>([]);
  const [addedCount, setAddedCount] = useState(0);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape" && !analyzing && !saving) close();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [analyzing, saving, phase]);

  function close() {
    // After an add, the page behind needs the new data.
    if (phase === "done") router.refresh();
    onClose();
  }

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
          routineId,
          fillStepId: fill?.stepId,
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

  async function handleAdd() {
    setError(null);
    setSaving(true);
    try {
      const res = await fetch("/api/routine/add-product/integrate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          routineId,
          fillStepId: fill?.stepId,
          items: results.map((r) => ({
            productId: r.productId,
            category: r.category,
            rationale: r.compatibility,
            ruleCitation: r.ruleCitation,
            fillsStepId: r.fillsStepId,
            placements: r.placements,
          })),
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Couldn't update the routine.");
        setSaving(false);
        return;
      }
      setAddedCount(data.added ?? 0);
      setPhase("done");
      setSaving(false);
    } catch {
      setError("Couldn't reach the server. Check your connection and try again.");
      setSaving(false);
    }
  }

  const anyUnsure = results.some((r) => r.ingredients !== "verified");
  const anyPlaced = !!fill || results.some((r) => r.placements.length > 0);
  const addLabel = !anyPlaced ? "Save to my shelf only" : anyUnsure ? "Add anyway" : "Add to my routine";

  return (
    <div className="modal-scrim" onClick={() => !analyzing && !saving && close()}>
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="add-product-title"
        className="modal-card"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="modal-head">
          <h2 id="add-product-title">
            {phase === "done"
              ? "Done"
              : fill
                ? "Add the product you chose"
                : `Add product${rows.length > 1 ? "s" : ""} to your routine`}
          </h2>
          <button type="button" onClick={close} aria-label="Close" className="modal-x">
            ×
          </button>
        </div>

        {phase === "input" && (
          <>
            {fill ? (
              <div className="callout c-sky">
                <p className="eyebrow">What we suggested</p>
                <p className="text-[20px] font-bold">{fill.description}</p>
                <p className="note">
                  Type the product you picked. We&rsquo;ll check it against your routine before anything is added.
                </p>
              </div>
            ) : (
              <p className="sub">We&rsquo;ll check how it fits with what you&rsquo;re already using before anything changes.</p>
            )}

            <div className="flex flex-col gap-4">
              {rows.map((row) => (
                <ProductSearchRow
                  key={row.rowId}
                  entry={row}
                  onChange={(entry) => updateRow(row.rowId, entry)}
                  onRemove={() => removeRow(row.rowId)}
                  showRemove={rows.length > 1}
                />
              ))}
              {!fill && (
                <button type="button" onClick={addRow} className="link-btn self-start">
                  + Add another product
                </button>
              )}
            </div>

            {error && (
              <p role="alert" className="callout c-blush font-bold">
                {error}
              </p>
            )}

            {analyzing ? (
              <div className="flex flex-col gap-4">
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
              <button type="button" onClick={handleAnalyze} className="btn btn-block">
                Check fit
              </button>
            )}
          </>
        )}

        {phase === "results" && (
          <>
            <p className="sub">
              Here&rsquo;s how {results.length === 1 ? "it" : "they"} would fit with your routine. Nothing has changed
              yet.
            </p>

            <div className="flex flex-col gap-4">
              {results.map((r) => {
                const badge = CONCERN_BADGE[r.concern];
                return (
                  <div key={r.productId} className="step">
                    <div className="flex flex-col gap-1">
                      <h3>{r.name}</h3>
                      <p className="brand">{r.brand}</p>
                    </div>
                    <div className="badges">
                      <span className={`badge ${badge.cls}`}>{badge.text}</span>
                    </div>
                    <p className="text-[19px] leading-relaxed">{r.compatibility}</p>

                    {r.ingredients !== "verified" && (
                      <p className="callout c-sun text-[18px]">
                        {r.ingredients === "none"
                          ? "We couldn't find this product's ingredients online, so this check goes by the kind of product only. You can add a photo of the label later to make it exact."
                          : "We found an ingredient list, but couldn't confirm it's up to date. Treat this check as a good guess."}
                      </p>
                    )}

                    <div className="flex flex-col gap-1">
                      <p className="eyebrow">Where it would go</p>
                      {fill ? (
                        <p className="text-[19px] font-bold">It takes the slot we suggested in your routine.</p>
                      ) : r.placements.length > 0 ? (
                        <>
                          {r.placements.map((p) => (
                            <p key={p.timeOfDay} className="text-[19px] font-bold">
                              {p.timeOfDay === "AM" ? "Morning" : "Evening"} · step {p.position} · {freqPhrase(p.frequencyPerWeek)}
                            </p>
                          ))}
                          {r.fillsStepId && <p className="note">This takes the empty slot we suggested earlier.</p>}
                        </>
                      ) : (
                        <p className="text-[19px] font-bold">Not in your routine. It stays on your shelf.</p>
                      )}
                    </div>

                    {r.ruleLabel && (
                      <p className="note">
                        Source:{" "}
                        {r.ruleUrl ? (
                          <a href={r.ruleUrl} target="_blank" rel="noopener noreferrer" className="underline underline-offset-4">
                            {r.ruleLabel}
                          </a>
                        ) : (
                          r.ruleLabel
                        )}
                      </p>
                    )}
                  </div>
                );
              })}
            </div>

            {error && (
              <p role="alert" className="callout c-blush font-bold">
                {error}
              </p>
            )}

            <div className="flex flex-col gap-3">
              <button type="button" onClick={handleAdd} disabled={saving} className="btn btn-ok btn-block">
                {saving ? "Adding…" : addLabel}
              </button>
              <button type="button" onClick={() => setPhase("input")} disabled={saving} className="btn btn-2 btn-block">
                Back
              </button>
            </div>
          </>
        )}

        {phase === "done" && (
          <>
            <div className="callout c-mint">
              <h2>{addedCount > 0 ? "✓ Added to your routine" : "✓ Saved to your shelf"}</h2>
              <p>
                {addedCount > 0
                  ? "It's in your routine now, and today's ticks are untouched."
                  : "It isn't part of your routine, so nothing there changed."}
              </p>
            </div>
            <div className="flex flex-col gap-3">
              {addedCount > 0 && !routineId && (
                <Link href="/routine" onClick={() => router.refresh()} className="btn btn-block">
                  See my routine
                </Link>
              )}
              <button type="button" onClick={close} className={`btn btn-block ${addedCount > 0 && !routineId ? "btn-2" : ""}`}>
                Done
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
