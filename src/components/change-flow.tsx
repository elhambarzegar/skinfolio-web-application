"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ProductSearchRow, type OwnedProductEntry } from "@/components/product-search-row";
import { ScanLabelModal } from "@/components/scan-label-modal";
import { TypedSteps } from "@/components/typed-steps";
import type { ChangeView } from "@/lib/routine/changes";

export type ChangeMode =
  /** A shelf product the person wants in the routine. */
  | { kind: "use"; productId: string; label: string }
  /** Something ran out: pick what takes its place. */
  | { kind: "swap"; replacesProductId: string; label: string }
  /** A prescribed product, which the routine adapts around. */
  | { kind: "prescribed" }
  /** A change that is already waiting for the person's OK. */
  | { kind: "review"; changeId: string };

type Phase = "loading" | "pick" | "photo" | "usage" | "working" | "preview" | "applying" | "done" | "error";

const WORKING_LINES = [
  "Looking at your routine",
  "Checking the ingredients together",
  "Working out what needs to adjust",
  "Writing up what this means for you",
];
const WORKING_LINES_NEW_PRODUCT = ["Looking up the new product", ...WORKING_LINES];

const RISK_BADGE: Record<ChangeView["risk"], { cls: string; text: string }> = {
  none: { cls: "b-ok", text: "✓ Looks fine" },
  caution: { cls: "b-new", text: "Use with care" },
  conflict: { cls: "b-out", text: "Needs your attention" },
};

const DIFF_MARK: Record<"add" | "remove" | "change", { sym: string; cls: string; word: string }> = {
  add: { sym: "+", cls: "bg-mint-deep", word: "Add" },
  remove: { sym: "−", cls: "bg-blush-deep", word: "Remove" },
  change: { sym: "↻", cls: "bg-chip", word: "Change" },
};

const TITLE: Record<ChangeMode["kind"], string> = {
  use: "Use this in my routine",
  swap: "Pick a replacement",
  prescribed: "Add a prescribed product",
  review: "A change for your routine",
};

/**
 * Every change to the routine goes through here: it is worked out, explained,
 * shown as exact differences, and only made after "I understand".
 */
export function ChangeFlow({ mode, onClose }: { mode: ChangeMode; onClose: () => void }) {
  const router = useRouter();
  const started = useRef(false);

  const [phase, setPhase] = useState<Phase>(mode.kind === "use" ? "working" : mode.kind === "review" ? "loading" : "pick");
  const [change, setChange] = useState<ChangeView | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [retry, setRetry] = useState<(() => void) | null>(null);

  const [entry, setEntry] = useState<OwnedProductEntry>({ brand: "", name: "", productId: null });
  const [directions, setDirections] = useState("");
  const [productId, setProductId] = useState<string | null>(null);
  const [hasIngredients, setHasIngredients] = useState(false);
  const [scanning, setScanning] = useState(false);
  const [periods, setPeriods] = useState<("AM" | "PM")[]>(["PM"]);
  const [frequency, setFrequency] = useState(7);
  const [busy, setBusy] = useState(false);

  const busyNow = phase === "working" || phase === "applying" || busy;

  async function postJson(url: string, body: unknown) {
    const res = await fetch(url, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data?.error ?? "Something went wrong.");
    return data;
  }

  function fail(err: unknown, again: () => void) {
    setError(err instanceof Error ? err.message : "Couldn't reach the server. Check your connection and try again.");
    setRetry(() => again);
    setPhase("error");
  }

  async function propose(body: Record<string, unknown>) {
    setPhase("working");
    try {
      const data = await postJson("/api/changes", body);
      setChange(data.change);
      setPhase("preview");
    } catch (err) {
      fail(err, () => propose(body));
    }
  }

  // "Use" starts straight away; "review" loads what is already waiting.
  useEffect(() => {
    if (started.current) return;
    started.current = true;
    if (mode.kind === "use") {
      void propose({ kind: "USE_PRODUCT", productId: mode.productId });
    } else if (mode.kind === "review") {
      void (async () => {
        try {
          const res = await fetch(`/api/changes/${mode.changeId}`);
          const data = await res.json();
          if (!res.ok) throw new Error(data.error ?? "Couldn't open this change.");
          setChange(data.change);
          setPhase("preview");
        } catch (err) {
          fail(err, onClose);
        }
      })();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function submitSwap() {
    if (mode.kind !== "swap") return;
    if (!entry.brand.trim() || !entry.name.trim()) {
      setError("Enter the brand and the product name.");
      return;
    }
    setError(null);
    setPhase("working");
    try {
      const shelf = await postJson("/api/shelf", { brand: entry.brand, name: entry.name, productId: entry.productId, lookup: true });
      await propose({ kind: "SWAP", productId: shelf.productId, replacesProductId: mode.replacesProductId });
    } catch (err) {
      fail(err, submitSwap);
    }
  }

  async function submitPrescribed() {
    if (!entry.brand.trim() || !entry.name.trim()) {
      setError("Enter the brand and the product name.");
      return;
    }
    setError(null);
    setBusy(true);
    try {
      const shelf = await postJson("/api/shelf", {
        brand: entry.brand,
        name: entry.name,
        productId: entry.productId,
        prescribed: true,
        directions,
      });
      setProductId(shelf.productId);
      setHasIngredients(shelf.hasIngredients);
      setPhase("photo");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong.");
    } finally {
      setBusy(false);
    }
  }

  function proposePrescribed(usage?: { periods: ("AM" | "PM")[]; frequencyPerWeek: number }) {
    return propose({ kind: "PRESCRIBED", productId, directions, usage });
  }

  async function approve() {
    if (!change) return;
    setPhase("applying");
    try {
      await postJson(`/api/changes/${change.id}/apply`, { understood: true });
      setPhase("done");
    } catch (err) {
      fail(err, approve);
    }
  }

  async function notNow() {
    if (change) {
      setBusy(true);
      await fetch(`/api/changes/${change.id}/dismiss`, { method: "POST" }).catch(() => null);
      setBusy(false);
    }
    close();
  }

  function close() {
    // Something may have changed behind this window.
    router.refresh();
    onClose();
  }

  const lines = mode.kind === "swap" ? WORKING_LINES_NEW_PRODUCT : WORKING_LINES;

  return (
    <div className="modal-scrim" onClick={() => !busyNow && close()}>
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="change-title"
        className="modal-card"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="modal-head">
          <h2 id="change-title">{phase === "done" ? "Done" : TITLE[mode.kind]}</h2>
          <button type="button" onClick={close} disabled={busyNow} aria-label="Close" className="modal-x">
            ×
          </button>
        </div>

        {phase === "loading" && <p className="sub">Opening…</p>}

        {phase === "pick" && (
          <>
            {mode.kind === "swap" ? (
              <p className="sub">
                You ran out of <b>{mode.label}</b>. Type the product that takes its place. We&rsquo;ll show you exactly what
                would change before anything does.
              </p>
            ) : (
              <p className="sub">
                A product your doctor or another professional prescribed. Your routine adapts around it. Nothing changes
                until you&rsquo;ve read it and approved it.
              </p>
            )}
            <ProductSearchRow entry={entry} onChange={setEntry} onRemove={() => undefined} showRemove={false} />
            {mode.kind === "prescribed" && (
              <label className="flex flex-col gap-2">
                <span className="field-label">Directions from your prescriber (optional)</span>
                <textarea
                  value={directions}
                  onChange={(e) => setDirections(e.target.value)}
                  rows={3}
                  maxLength={600}
                  placeholder="For example: a pea-sized amount at night, three nights a week"
                  className="input py-3"
                  style={{ minHeight: 96 }}
                />
              </label>
            )}
            {error && (
              <p role="alert" className="callout c-blush font-bold">
                {error}
              </p>
            )}
            <button
              type="button"
              disabled={busy}
              onClick={mode.kind === "swap" ? submitSwap : submitPrescribed}
              className="btn btn-block"
            >
              {busy ? "Adding…" : mode.kind === "swap" ? "Check it against my routine" : "Continue"}
            </button>
          </>
        )}

        {phase === "photo" && (
          <>
            <p className="sub">
              {hasIngredients
                ? "We already have an ingredient list for this product. A photo of your own label makes the check exact, but it's optional."
                : "To check this against the rest of your routine, we need to see what's in it. Take a photo of the ingredient label."}
            </p>
            <div className="flex flex-col gap-3">
              <button type="button" onClick={() => setScanning(true)} className="btn btn-block">
                Take or upload a photo
              </button>
              {hasIngredients ? (
                <button type="button" onClick={() => proposePrescribed()} className="btn btn-2 btn-block">
                  Continue without a photo
                </button>
              ) : (
                <button type="button" onClick={() => setPhase("usage")} className="btn btn-2 btn-block">
                  Skip. Add it as I entered it
                </button>
              )}
            </div>
            {!hasIngredients && <p className="note">If you skip, we can&rsquo;t check it against your routine. It goes in exactly as you say.</p>}
          </>
        )}

        {phase === "usage" && (
          <>
            <p className="sub">Tell us how you use it. We can&rsquo;t check it, so it goes into your routine exactly like this.</p>
            <div className="flex flex-col gap-2">
              <p className="field-label">When do you use it?</p>
              <div className="flex flex-wrap gap-2">
                {(["AM", "PM"] as const).map((p) => (
                  <button
                    key={p}
                    type="button"
                    className="pill"
                    aria-pressed={periods.includes(p)}
                    onClick={() => setPeriods((prev) => (prev.includes(p) ? prev.filter((x) => x !== p) : [...prev, p]))}
                  >
                    {periods.includes(p) ? "✓ " : ""}
                    {p === "AM" ? "Morning" : "Evening"}
                  </button>
                ))}
              </div>
            </div>
            <label className="flex flex-col gap-2">
              <span className="field-label">How often?</span>
              <select className="input" value={frequency} onChange={(e) => setFrequency(Number(e.target.value))}>
                {[7, 6, 5, 4, 3, 2, 1].map((n) => (
                  <option key={n} value={n}>
                    {n === 7 ? "Every day" : n === 1 ? "Once a week" : `${n} days a week`}
                  </option>
                ))}
              </select>
            </label>
            {periods.length === 0 && <p className="note">Pick morning, evening or both.</p>}
            <button
              type="button"
              disabled={periods.length === 0}
              onClick={() => proposePrescribed({ periods, frequencyPerWeek: frequency })}
              className="btn btn-block"
            >
              Continue
            </button>
          </>
        )}

        {phase === "working" && (
          <div className="flex flex-col gap-4">
            <TypedSteps lines={lines} label="Working out how this fits your routine. This can take a minute or two." />
          </div>
        )}

        {(phase === "preview" || phase === "applying") && change && (
          <>
            <p className="note">{change.trigger}</p>
            <div className="flex flex-col gap-3">
              <div className="badges">
                <span className={`badge ${RISK_BADGE[change.risk].cls}`}>{RISK_BADGE[change.risk].text}</span>
              </div>
              <p className="text-[21px] font-bold leading-snug">{change.summary}</p>
            </div>

            {change.consequences.length > 0 && (
              <div className="flex flex-col gap-2">
                <p className="eyebrow">What this means for you</p>
                <ul className="flex flex-col gap-2">
                  {change.consequences.map((c, i) => (
                    <li key={i} className="text-[19px] leading-relaxed">
                      {c}
                    </li>
                  ))}
                </ul>
              </div>
            )}

            <div className="flex flex-col gap-2">
              <p className="eyebrow">What would change</p>
              <ul className="flex flex-col gap-3">
                {change.diff.map((d, i) => {
                  const mark = DIFF_MARK[d.kind];
                  return (
                    <li key={i} className="flex items-start gap-3 text-[19px] leading-snug">
                      <span
                        aria-hidden="true"
                        className={`mt-px flex h-[30px] w-[30px] flex-none items-center justify-center rounded-full font-bold ${mark.cls}`}
                      >
                        {mark.sym}
                      </span>
                      <span>{d.text}</span>
                    </li>
                  );
                })}
              </ul>
              <p className="note">Today&rsquo;s ticks stay as they are.</p>
            </div>

            <div className="flex flex-col gap-3">
              <button type="button" onClick={approve} disabled={phase === "applying"} className="btn btn-ok btn-block">
                {phase === "applying" ? "Making the change…" : "I understand, make this change"}
              </button>
              <button type="button" onClick={notNow} disabled={phase === "applying" || busy} className="btn btn-2 btn-block">
                Not now
              </button>
            </div>
          </>
        )}

        {phase === "done" && (
          <>
            <div className="callout c-mint">
              <h2>✓ Your routine is updated</h2>
              <p>The change is made. Your Today list already reflects it.</p>
            </div>
            <div className="flex flex-col gap-3">
              <Link href="/routine" onClick={close} className="btn btn-block">
                See my routine
              </Link>
              <button type="button" onClick={close} className="btn btn-2 btn-block">
                Done
              </button>
            </div>
          </>
        )}

        {phase === "error" && (
          <>
            <p role="alert" className="callout c-blush font-bold">
              {error}
            </p>
            <div className="flex flex-col gap-3">
              {retry && (
                <button type="button" onClick={() => retry()} className="btn btn-block">
                  Try again
                </button>
              )}
              <button type="button" onClick={close} className="btn btn-2 btn-block">
                Close
              </button>
            </div>
          </>
        )}
      </div>

      {scanning && productId && (
        <ScanLabelModal
          productId={productId}
          productLabel={`${entry.brand} — ${entry.name}`}
          onClose={() => setScanning(false)}
          onSuccess={() => {
            setScanning(false);
            void proposePrescribed();
          }}
        />
      )}
    </div>
  );
}
