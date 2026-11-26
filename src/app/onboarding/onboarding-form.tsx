"use client";

import { useRef, useState } from "react";
import Link from "next/link";
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
import { BRAND } from "@/lib/brand";

const TOTAL_STEPS = 8;

/** What they gave last time, when redoing the intake. */
export type OnboardingInitial = {
  concerns: string[];
  questionnaire: string;
  experienceLevel: ExperienceLevel | null;
  priority: Priority | null;
  complexityPreference: ComplexityPreference | null;
  safetyAcknowledged: boolean;
  products: { brand: string; name: string; productId: string }[];
};

type SaveResult = {
  updated: boolean;
  addedNames: string[];
  removedNames: string[];
  routineStepsRemoved: number;
  draftSetAside: boolean;
  checking: boolean;
};

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

export function OnboardingForm({ initial }: { initial: OnboardingInitial | null }) {
  const router = useRouter();
  // Already agreed to the safety note once: start at the questions.
  const [step, setStep] = useState(initial?.safetyAcknowledged ? 2 : 1);
  const [safetyAcknowledged, setSafetyAcknowledged] = useState(initial?.safetyAcknowledged ?? false);
  const [concerns, setConcerns] = useState<string[]>(initial?.concerns ?? []);
  const [questionnaire, setQuestionnaire] = useState(initial?.questionnaire ?? "");
  const [experienceLevel, setExperienceLevel] = useState<ExperienceLevel | null>(initial?.experienceLevel ?? null);
  const [priority, setPriority] = useState<Priority | null>(initial?.priority ?? null);
  const [complexityPreference, setComplexityPreference] = useState<ComplexityPreference | null>(
    initial?.complexityPreference ?? null
  );
  const nextRowId = useRef(initial?.products.length || 1);
  const [ownedProducts, setOwnedProducts] = useState<(OwnedProductEntry & { rowId: number })[]>(
    initial && initial.products.length > 0
      ? initial.products.map((p, i) => ({ rowId: i, ...p }))
      : [{ rowId: 0, brand: "", name: "", productId: null }]
  );
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [saved, setSaved] = useState<SaveResult | null>(null);
  const isUpdate = !!initial;

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

      // Redoing it: say what changed. The first time, carry straight on.
      if (data.updated) {
        setSaved(data);
        setSubmitting(false);
        router.refresh();
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

  if (saved) {
    const changedShelf = saved.addedNames.length > 0 || saved.removedNames.length > 0;
    return (
      <div className="mt-5 flex w-full flex-col gap-5">
        <h1 className="page-title">Saved</h1>
        <div className="callout c-mint">
          <h2>✓ Your details are updated</h2>
          {changedShelf ? (
            <ul className="flex flex-col gap-2 text-[20px]">
              {saved.addedNames.length > 0 && (
                <li>
                  <b>Added to your shelf:</b> {saved.addedNames.join(", ")}
                </li>
              )}
              {saved.removedNames.length > 0 && (
                <li>
                  <b>Taken off your shelf:</b> {saved.removedNames.join(", ")}
                  {saved.routineStepsRemoved > 0 ? `. Its steps are out of your routine too.` : "."}
                </li>
              )}
            </ul>
          ) : (
            <p>Your products are the same as before.</p>
          )}
        </div>
        {saved.draftSetAside && (
          <p className="callout c-sun text-[20px]">
            The routine you were reviewing no longer matched your details, so it was set aside. You can build a new one on Today.
          </p>
        )}
        {saved.checking && (
          <p className="callout c-sky text-[20px]">
            We&rsquo;re checking your routine against these changes. If something should change, we&rsquo;ll ask you first. It
            appears on Today in about a minute.
          </p>
        )}
        <Link href="/today" className="btn btn-block">
          Go to Today
        </Link>
      </div>
    );
  }

  return (
    <div className="mt-5 w-full">
      {isUpdate && <p className="eyebrow">Updating your details</p>}
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
            A quick read before we start. This sets what {BRAND.name} can and can&rsquo;t do for you.
          </p>

          <div className="mt-6 flex flex-col gap-3">
            {[
              "Helps you make sense of what you already own.",
              "Tells you which products you actually need, and which you don't.",
              "Explains how ingredients work together.",
              "Builds your routine around your goals, not a ready-made one.",
            ].map((line) => (
              <div key={line} className="flex items-start gap-3 text-[20px] text-ink">
                <span className="font-bold text-ok" aria-hidden="true">✓</span>
                {line}
              </div>
            ))}
          </div>

          <div className="callout c-sky mt-6">
            <h2>Independent, with nothing to sell</h2>
            <p className="text-[20px] leading-relaxed">
              {BRAND.name} isn&rsquo;t owned by, paid by or connected to any skincare brand or store. It never promotes a brand or
              a product, and it doesn&rsquo;t push a set routine. Think of it as a consultant that cuts through the confusion of
              too many products to buy, and helps you see what you need and what you don&rsquo;t.
            </p>
            <p className="note" style={{ color: "var(--ink)" }}>
              Any shopping links are plain searches, not recommendations.
            </p>
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
            {isUpdate
              ? "This is your shelf. Add what's new and remove what you no longer have."
              : "Optional. Add anything currently in your routine — we\u2019ll check it against the rest."}
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
          <p className="sub mt-2">{isUpdate ? "This is what we\u2019ll check your routine against." : "This is what we\u2019ll build your routine around."}</p>

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
            {submitting ? "Saving…" : isUpdate ? "Save changes" : "Save and continue"}
          </button>
        )}
      </div>
    </div>
  );
}
