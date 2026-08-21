"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { CONCERN_OPTIONS } from "@/lib/concerns";

type OwnedProduct = { brand: string; name: string };

const TOTAL_STEPS = 4;

export function OnboardingForm() {
  const router = useRouter();
  const [step, setStep] = useState(1);
  const [concerns, setConcerns] = useState<string[]>([]);
  const [questionnaire, setQuestionnaire] = useState("");
  const [ownedProducts, setOwnedProducts] = useState<OwnedProduct[]>([
    { brand: "", name: "" },
  ]);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  function toggleConcern(concern: string) {
    setConcerns((prev) =>
      prev.includes(concern) ? prev.filter((c) => c !== concern) : [...prev, concern]
    );
  }

  function updateProduct(index: number, field: keyof OwnedProduct, value: string) {
    setOwnedProducts((prev) =>
      prev.map((p, i) => (i === index ? { ...p, [field]: value } : p))
    );
  }

  function addProductRow() {
    setOwnedProducts((prev) => [...prev, { brand: "", name: "" }]);
  }

  function removeProductRow(index: number) {
    setOwnedProducts((prev) => prev.filter((_, i) => i !== index));
  }

  function goNext() {
    setError(null);
    if (step === 1 && concerns.length === 0) {
      setError("Pick at least one concern to continue.");
      return;
    }
    if (step === 2 && questionnaire.trim().length < 10) {
      setError("A couple sentences helps — at least 10 characters.");
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

    const cleanedProducts = ownedProducts.filter(
      (p) => p.brand.trim() && p.name.trim()
    );

    try {
      const res = await fetch("/api/intake", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ concerns, questionnaire, ownedProducts: cleanedProducts }),
      });
      const data = await res.json();

      if (!res.ok) {
        setError(data.error ?? "Something went wrong. Try again.");
        setSubmitting(false);
        return;
      }

      router.push("/dashboard");
      router.refresh();
    } catch {
      setError("Couldn't reach the server. Check your connection and try again.");
      setSubmitting(false);
    }
  }

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

      {step === 2 && (
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

      {step === 3 && (
        <div>
          <h1 className="text-[24px] font-bold text-ink">What do you already use?</h1>
          <p className="mt-1 text-[14px] text-ink-2">
            Optional. Add anything currently in your routine — we&rsquo;ll check it
            against the rest.
          </p>
          <div className="mt-6 flex flex-col gap-3">
            {ownedProducts.map((product, i) => (
              <div key={i} className="flex items-center gap-2">
                <input
                  type="text"
                  placeholder="Brand"
                  value={product.brand}
                  onChange={(e) => updateProduct(i, "brand", e.target.value)}
                  className="flex-1 border border-line rounded-[6px] px-3 py-2 text-[14px] text-ink bg-bg-raise outline-none focus:border-accent"
                />
                <input
                  type="text"
                  placeholder="Product name"
                  value={product.name}
                  onChange={(e) => updateProduct(i, "name", e.target.value)}
                  className="flex-[1.5] border border-line rounded-[6px] px-3 py-2 text-[14px] text-ink bg-bg-raise outline-none focus:border-accent"
                />
                {ownedProducts.length > 1 && (
                  <button
                    type="button"
                    onClick={() => removeProductRow(i)}
                    aria-label="Remove product"
                    className="text-[13px] text-ink-3 hover:text-danger px-2"
                  >
                    Remove
                  </button>
                )}
              </div>
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

      {step === 4 && (
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
