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
    <div className="mt-6 flex flex-col gap-3" role="radiogroup">
      {options.map((opt) => {
        const selected = value === opt.value;
        return (
          <button
            key={opt.value}
            type="button"
            role="radio"
            aria-checked={selected}
            onClick={() => onChange(opt.value)}
            className="choice"
          >
            <span className="dot" aria-hidden="true">
              {selected && <span className="dot-fill" />}
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
  const nextRowId = useRef(1);
  const [ownedProducts, setOwnedProducts] = useState<(OwnedProductEntry & { rowId: number })[]>([
    { rowId: 0, brand: "", name: "", productId: null },
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
  const listedProducts = ownedProducts.filter((p) => p.brand.trim() && p.name.trim());

  return (
    <div className="mt-5 w-full">
      <p className="eyebrow">
        Step {step} of {TOTAL_STEPS}
      </p>
      <div
        className="mt-2 mb-8 flex items-center gap-1.5"
        role="progressbar"
        aria-valuemin={1}
        aria-valuemax={TOTAL_STEPS}
        aria-valuenow={step}
        aria-label={`Step ${step} of ${TOTAL_STEPS}`}
      >
        {Array.from({ length: TOTAL_STEPS }).map((_, i) => (
          <div key={i} className={`h-2.5 flex-1 rounded-full ${i < step ? "bg-accent" : "bg-line"}`} />
        ))}
      </div>

      {step === 1 && (
        <div>
          <h1 className="page-title">Safety agreement</h1>
          <p className="sub mt-2">
            A quick read before we start. This sets what {`Skinfolio`} can and can&rsquo;t do for you.
          </p>

          <div className="mt-6 flex flex-col gap-3">
            {[
              "Helps organize your skincare routine.",
              "Explains ingredient interactions.",
              "Suggests routines based on your goals.",
            ].map((line) => (
              <div key={line} className="flex items-start gap-3 text-[20px] text-ink">
                <span className="font-bold text-ok" aria-hidden="true">✓</span>
                {line}
              </div>
            ))}
          </div>

          <div className="callout c-blush mt-6">
            <h2>It does not:</h2>
            <ul className="flex list-inside list-disc flex-col gap-1.5 text-[20px]">
              <li>diagnose skin conditions</li>
              <li>prescribe treatments</li>
              <li>replace a dermatologist</li>
            </ul>
          </div>

          <p className="sub mt-5">
            If you report pain, bleeding, rapidly changing spots, or other concerning symptoms, we&rsquo;ll
            recommend seeing a dermatologist.
          </p>

          <label className="check-row mt-6">
            <input
              type="checkbox"
              checked={safetyAcknowledged}
              onChange={(e) => setSafetyAcknowledged(e.target.checked)}
            />
            <span>I understand.</span>
          </label>
        </div>
      )}

      {step === 2 && (
        <div>
          <h1 className="page-title">What are your concerns?</h1>
          <p className="sub mt-2">Pick as many as apply.</p>
          <div className="mt-6 flex flex-wrap gap-3">
            {CONCERN_OPTIONS.map((concern) => {
              const selected = concerns.includes(concern);
              return (
                <button
                  key={concern}
                  type="button"
                  aria-pressed={selected}
                  onClick={() => toggleConcern(concern)}
                  className="pill"
                >
                  {selected && <span aria-hidden="true">✓ </span>}
                  {concern}
                </button>
              );
            })}
          </div>
        </div>
      )}

      {step === 3 && (
        <div>
          <h1 className="page-title">Tell us about your skin</h1>
          <p className="sub mt-2">Texture, sensitivity, how it changes day to day — whatever&rsquo;s relevant.</p>
          <textarea
            value={questionnaire}
            onChange={(e) => setQuestionnaire(e.target.value)}
            rows={6}
            aria-label="About your skin"
            placeholder="e.g. Dryness on my cheeks, occasional flaking around my nose. Starting to notice fine lines near my eyes."
            className="input mt-6 resize-none py-3"
          />
        </div>
      )}

      {step === 4 && (
        <div>
          <h1 className="page-title">Which statement best describes you?</h1>
          <RadioList options={EXPERIENCE_OPTIONS} value={experienceLevel} onChange={setExperienceLevel} />
        </div>
      )}

      {step === 5 && (
        <div>
          <h1 className="page-title">If possible, I&rsquo;d rather&hellip;</h1>
          <p className="sub mt-2">Select one.</p>
          <RadioList options={PRIORITY_OPTIONS} value={priority} onChange={setPriority} />
        </div>
      )}

      {step === 6 && (
        <div>
          <h1 className="page-title">Which best describes you?</h1>
          <RadioList
            options={COMPLEXITY_OPTIONS}
            value={complexityPreference}
            onChange={setComplexityPreference}
          />
        </div>
      )}

      {step === 7 && (
        <div>
          <h1 className="page-title">What do you already use?</h1>
          <p className="sub mt-2">
            Optional. Add anything currently in your routine — we&rsquo;ll check it against the rest.
          </p>
          <div className="mt-6 flex flex-col gap-5">
            {ownedProducts.map((product) => (
              <ProductSearchRow
                key={product.rowId}
                entry={product}
                onChange={(entry) => updateProductEntry(product.rowId, entry)}
                onRemove={() => removeProductRow(product.rowId)}
                showRemove={ownedProducts.length > 1}
              />
            ))}
            <button type="button" onClick={addProductRow} className="btn btn-2 btn-sm self-start">
              + Add another product
            </button>
          </div>
        </div>
      )}

      {step === 8 && (
        <div>
          <h1 className="page-title">Review</h1>
          <p className="sub mt-2">This is what we&rsquo;ll build your routine around.</p>

          <div className="mt-6 flex flex-col gap-4">
            <section className="card">
              <h2 className="eyebrow">Concerns</h2>
              <div className="badges mt-3">
                {concerns.map((c) => (
                  <span key={c} className="badge b-cat">
                    {c}
                  </span>
                ))}
              </div>
            </section>

            <section className="card">
              <h2 className="eyebrow">About your skin</h2>
              <p className="mt-2 text-[20px] leading-relaxed">{questionnaire}</p>
            </section>

            <section className="card">
              <h2 className="eyebrow">Your profile</h2>
              <ul className="mt-2 flex flex-col gap-2 text-[20px]">
                <li>{experienceLabel}</li>
                <li>{priorityLabel}</li>
                <li>{complexityLabel}</li>
              </ul>
            </section>

            <section className="card">
              <h2 className="eyebrow">Products you already use</h2>
              {listedProducts.length === 0 ? (
                <p className="sub mt-2">None listed.</p>
              ) : (
                <ul className="mt-2 flex flex-col gap-2 text-[20px]">
                  {listedProducts.map((p, i) => (
                    <li key={i}>
                      <b>{p.brand}</b> — {p.name}
                    </li>
                  ))}
                </ul>
              )}
            </section>
          </div>
        </div>
      )}

      {error && (
        <p role="alert" className="callout c-blush mt-6 font-bold">
          {error}
        </p>
      )}

      <div className="mt-8 flex gap-3">
        {step > 1 && (
          <button type="button" onClick={goBack} className="btn btn-2">
            Back
          </button>
        )}

        {step < TOTAL_STEPS ? (
          <button type="button" onClick={goNext} className="btn flex-1">
            Continue
          </button>
        ) : (
          <button type="button" onClick={handleSubmit} disabled={submitting} className="btn flex-1">
            {submitting ? "Saving…" : "Save and continue"}
          </button>
        )}
      </div>
    </div>
  );
}
