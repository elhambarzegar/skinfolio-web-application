"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { CONCERN_OPTIONS } from "@/lib/concerns";
import {
  EXPERIENCE_OPTIONS,
  PRIORITY_OPTIONS,
  COMPLEXITY_OPTIONS,
  type ExperienceLevel,
  type Priority,
  type ComplexityPreference,
} from "@/lib/intakeProfile";
import { ProductSearchRow, type OwnedProductEntry } from "@/components/product-search-row";

const TOTAL_STEPS = 8;

function RadioList<T extends string>({
  options,
  value,
  onChange,
}: {
  options: readonly { value: T; label: string }[];
  value: T | null;
  onChange: (value: T) => void;
}) {
  return (
    <div className="mt-6 flex flex-col gap-2">
      {options.map((opt) => {
        const selected = value === opt.value;
        return (
          <button
            key={opt.value}
            type="button"
            onClick={() => onChange(opt.value)}
            className={`text-left text-[14px] px-4 py-3 rounded-[8px] border flex items-center gap-3 transition-colors ${
              selected
                ? "border-accent bg-accent/10 text-ink"
                : "border-line bg-bg-raise text-ink-2 hover:border-accent"
            }`}
          >
            <span
              className={`shrink-0 w-4 h-4 rounded-full border-2 flex items-center justify-center ${
                selected ? "border-accent" : "border-line"
              }`}
            >
              {selected && <span className="w-2 h-2 rounded-full bg-accent" />}
            </span>
            {opt.label}
          </button>
        );
      })}
    </div>
  );
}

export function OnboardingForm() {
  const router = useRouter();
  const [step, setStep] = useState(1);
  const [safetyAcknowledged, setSafetyAcknowledged] = useState(false);
  const [concerns, setConcerns] = useState<string[]>([]);
  const [questionnaire, setQuestionnaire] = useState("");
  const [experienceLevel, setExperienceLevel] = useState<ExperienceLevel | null>(null);
  const [priority, setPriority] = useState<Priority | null>(null);
  const [complexityPreference, setComplexityPreference] = useState<ComplexityPreference | null>(null);
  const nextRowId = useRef(0);
  const [ownedProducts, setOwnedProducts] = useState<(OwnedProductEntry & { rowId: number })[]>([
    { rowId: nextRowId.current++, brand: "", name: "", productId: null },
  ]);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  function toggleConcern(concern: string) {
    setConcerns((prev) =>
      prev.includes(concern) ? prev.filter((c) => c !== concern) : [...prev, concern]
    );
  }

  function updateProductEntry(rowId: number, entry: OwnedProductEntry) {
    setOwnedProducts((prev) => prev.map((p) => (p.rowId === rowId ? { ...entry, rowId } : p)));
  }

  function addProductRow() {
    setOwnedProducts((prev) => [
      ...prev,
      { rowId: nextRowId.current++, brand: "", name: "", productId: null },
    ]);
  }

  function removeProductRow(rowId: number) {
    setOwnedProducts((prev) => prev.filter((p) => p.rowId !== rowId));
  }

  function goNext() {
    setError(null);
    if (step === 1 && !safetyAcknowledged) {
      setError("Check the box to confirm you understand before continuing.");
      return;
    }
    if (step === 2 && concerns.length === 0) {
      setError("Pick at least one concern to continue.");
      return;
    }
    if (step === 3 && questionnaire.trim().length < 10) {
      setError("A couple sentences helps — at least 10 characters.");
      return;
    }
    if (step === 4 && !experienceLevel) {
      setError("Pick the option that fits best.");
      return;
    }
    if (step === 5 && !priority) {
      setError("Pick one to continue.");
      return;
    }
    if (step === 6 && !complexityPreference) {
      setError("Pick the option that fits best.");
      return;
    }
    setStep((s) => Math.min(s + 1, TOTAL_STEPS));
  }

  function goBack() {
    setError(null);
    setStep((s) => Math.max(s - 1, 1));
  }

  async function handleSubmit() {
    setError(null);
    setSubmitting(true);

    const cleanedProducts = ownedProducts
      .filter((p) => p.brand.trim() && p.name.trim())
      .map(({ brand, name, productId }) => ({ brand, name, productId }));

    try {
      const res = await fetch("/api/intake", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          concerns,
          questionnaire,
          experienceLevel,
          priority,
          complexityPreference,
          safetyAcknowledged,
          ownedProducts: cleanedProducts,
        }),
      });
      const data = await res.json();

      if (!res.ok) {
        setError(data.error ?? "Something went wrong. Try again.");
        setSubmitting(false);
        return;
      }

      router.push("/today");
      router.refresh();
    } catch {
      setError("Couldn't reach the server. Check your connection and try again.");
      setSubmitting(false);
    }
  }

  const experienceLabel = EXPERIENCE_OPTIONS.find((o) => o.value === experienceLevel)?.label;
  const priorityLabel = PRIORITY_OPTIONS.find((o) => o.value === priority)?.label;
  const complexityLabel = COMPLEXITY_OPTIONS.find((o) => o.value === complexityPreference)?.label;

  return (
    <div className="w-full max-w-xl">
      <div className="flex items-center gap-1.5 mb-8">
        {Array.from({ length: TOTAL_STEPS }).map((_, i) => (
          <div
            key={i}
            className={`h-1 flex-1 rounded-full ${
              i < step ? "bg-accent" : "bg-line"
            }`}
          />
        ))}
      </div>

      {step === 1 && (
        <div>
          <h1 className="text-[24px] font-bold text-ink">Safety agreement</h1>
          <p className="mt-1 text-[14px] text-ink-2">
            Quick read before we start — this sets what Skinfolio can and can&rsquo;t
            do for you.
          </p>

          <div className="mt-6 flex flex-col gap-2">
            {[
              "Helps organize your skincare routine.",
              "Explains ingredient interactions.",
              "Suggests routines based on your goals.",
            ].map((line) => (
              <div key={line} className="flex items-start gap-2.5 text-[14px] text-ink">
                <span className="text-ok mt-0.5">✓</span>
                {line}
              </div>
            ))}
          </div>

          <p className="mt-5 text-[13px] font-semibold text-ink-2">It does not:</p>
          <ul className="mt-2 flex flex-col gap-1.5 text-[14px] text-ink-2 list-disc list-inside">
            <li>diagnose skin conditions</li>
            <li>prescribe treatments</li>
            <li>replace a dermatologist</li>
          </ul>

          <p className="mt-5 text-[13px] text-ink-2 leading-relaxed">
            If you report pain, bleeding, rapidly changing spots, or other
            concerning symptoms, we&rsquo;ll recommend seeing a dermatologist.
          </p>

          <label className="mt-6 flex items-start gap-2.5 text-[14px] text-ink cursor-pointer">
            <input
              type="checkbox"
              checked={safetyAcknowledged}
              onChange={(e) => setSafetyAcknowledged(e.target.checked)}
              className="mt-0.5 w-4 h-4 accent-accent"
            />
            I understand.
          </label>
        </div>
      )}

      {step === 2 && (
        <div>
          <h1 className="text-[24px] font-bold text-ink">What are your concerns?</h1>
          <p className="mt-1 text-[14px] text-ink-2">Pick as many as apply.</p>
          <div className="mt-6 flex flex-wrap gap-2">
            {CONCERN_OPTIONS.map((concern) => {
              const selected = concerns.includes(concern);
              return (
                <button
                  key={concern}
                  type="button"
                  onClick={() => toggleConcern(concern)}
                  className={`text-[14px] font-semibold px-4 py-2 rounded-full border transition-colors ${
                    selected
                      ? "bg-accent text-accent-ink border-accent"
                      : "bg-bg-raise text-ink-2 border-line hover:border-accent"
                  }`}
                >
                  {concern}
                </button>
              );
            })}
          </div>
        </div>
      )}

      {step === 3 && (
        <div>
          <h1 className="text-[24px] font-bold text-ink">Tell us about your skin</h1>
          <p className="mt-1 text-[14px] text-ink-2">
            Texture, sensitivity, how it changes day to day — whatever's relevant.
          </p>
          <textarea
            value={questionnaire}
            onChange={(e) => setQuestionnaire(e.target.value)}
            rows={6}
            placeholder="e.g. Dryness on my cheeks, occasional flaking around my nose. Starting to notice fine lines near my eyes."
            className="mt-6 w-full border border-line rounded-[6px] px-3 py-2.5 text-[14px] text-ink bg-bg-raise outline-none focus:border-accent resize-none"
          />
        </div>
      )}

      {step === 4 && (
        <div>
          <h1 className="text-[24px] font-bold text-ink">Which statement best describes you?</h1>
          <RadioList options={EXPERIENCE_OPTIONS} value={experienceLevel} onChange={setExperienceLevel} />
        </div>
      )}

      {step === 5 && (
        <div>
          <h1 className="text-[24px] font-bold text-ink">If possible, I&rsquo;d rather&hellip;</h1>
          <p className="mt-1 text-[14px] text-ink-2">Select one.</p>
          <RadioList options={PRIORITY_OPTIONS} value={priority} onChange={setPriority} />
        </div>
      )}

      {step === 6 && (
        <div>
          <h1 className="text-[24px] font-bold text-ink">Which best describes you?</h1>
          <RadioList
            options={COMPLEXITY_OPTIONS}
            value={complexityPreference}
            onChange={setComplexityPreference}
          />
        </div>
      )}

      {step === 7 && (
        <div>
          <h1 className="text-[24px] font-bold text-ink">What do you already use?</h1>
          <p className="mt-1 text-[14px] text-ink-2">
            Optional. Add anything currently in your routine — we&rsquo;ll check it
            against the rest.
          </p>
          <div className="mt-6 flex flex-col gap-4">
            {ownedProducts.map((product) => (
              <ProductSearchRow
                key={product.rowId}
                entry={product}
                onChange={(entry) => updateProductEntry(product.rowId, entry)}
                onRemove={() => removeProductRow(product.rowId)}
                showRemove={ownedProducts.length > 1}
              />
            ))}
            <button
              type="button"
              onClick={addProductRow}
              className="self-start text-[13px] font-semibold text-accent"
            >
              + Add another product
            </button>
          </div>
        </div>
      )}

      {step === 8 && (
        <div>
          <h1 className="text-[24px] font-bold text-ink">Review</h1>
          <p className="mt-1 text-[14px] text-ink-2">
            This is what we&rsquo;ll build your routine around.
          </p>

          <div className="mt-6 flex flex-col gap-5">
            <div>
              <h3 className="text-[12px] font-bold tracking-[0.08em] uppercase text-ink-3">
                Concerns
              </h3>
              <div className="mt-2 flex flex-wrap gap-2">
                {concerns.map((c) => (
                  <span
                    key={c}
                    className="text-[13px] font-semibold px-3 py-1 rounded-full bg-chip text-ink-2"
                  >
                    {c}
                  </span>
                ))}
              </div>
            </div>

            <div>
              <h3 className="text-[12px] font-bold tracking-[0.08em] uppercase text-ink-3">
                About your skin
              </h3>
              <p className="mt-2 text-[14px] text-ink leading-relaxed">{questionnaire}</p>
            </div>

            <div>
              <h3 className="text-[12px] font-bold tracking-[0.08em] uppercase text-ink-3">
                Your profile
              </h3>
              <ul className="mt-2 flex flex-col gap-1 text-[14px] text-ink">
                <li>{experienceLabel}</li>
                <li>{priorityLabel}</li>
                <li>{complexityLabel}</li>
              </ul>
            </div>

            <div>
              <h3 className="text-[12px] font-bold tracking-[0.08em] uppercase text-ink-3">
                Products you already use
              </h3>
              {ownedProducts.filter((p) => p.brand.trim() && p.name.trim()).length === 0 ? (
                <p className="mt-2 text-[14px] text-ink-3">None listed.</p>
              ) : (
                <ul className="mt-2 flex flex-col gap-1">
                  {ownedProducts
                    .filter((p) => p.brand.trim() && p.name.trim())
                    .map((p, i) => (
                      <li key={i} className="text-[14px] text-ink">
                        {p.brand} — {p.name}
                      </li>
                    ))}
                </ul>
              )}
            </div>
          </div>
        </div>
      )}

      {error && (
        <p className="mt-6 text-[13px] text-danger border border-danger/40 bg-danger/10 rounded-[6px] px-3 py-2">
          {error}
        </p>
      )}

      <div className="mt-8 flex items-center justify-between">
        {step > 1 ? (
          <button
            type="button"
            onClick={goBack}
            className="text-[14px] font-semibold text-ink-2 hover:text-ink px-4 py-2.5"
          >
            Back
          </button>
        ) : (
          <span />
        )}

        {step < TOTAL_STEPS ? (
          <button
            type="button"
            onClick={goNext}
            className="text-[15px] font-bold bg-accent text-accent-ink px-6 py-2.5 rounded-[6px] hover:opacity-90"
          >
            Continue
          </button>
        ) : (
          <button
            type="button"
            onClick={handleSubmit}
            disabled={submitting}
            className="text-[15px] font-bold bg-accent text-accent-ink px-6 py-2.5 rounded-[6px] hover:opacity-90 disabled:opacity-50"
          >
            {submitting ? "Saving…" : "Save and continue"}
          </button>
        )}
      </div>
    </div>
  );
}
