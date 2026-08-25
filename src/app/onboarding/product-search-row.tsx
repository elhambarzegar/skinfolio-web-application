"use client";

import { useEffect, useRef, useState } from "react";

export type OwnedProductEntry = {
  brand: string;
  name: string;
  productId: string | null;
};

type SearchResult = { id: string; brand: string; name: string; step: string };

const DEBOUNCE_MS = 250;

export function ProductSearchRow({
  entry,
  onChange,
  onRemove,
  showRemove,
}: {
  entry: OwnedProductEntry;
  onChange: (entry: OwnedProductEntry) => void;
  onRemove: () => void;
  showRemove: boolean;
}) {
  const [mode, setMode] = useState<"search" | "matched" | "manual">(
    entry.productId ? "matched" : "search"
  );
  const [query, setQuery] = useState(
    entry.productId ? `${entry.brand} — ${entry.name}` : ""
  );
  const [results, setResults] = useState<SearchResult[]>([]);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [searchError, setSearchError] = useState<string | null>(null);
  const abortRef = useRef<AbortController | null>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (mode !== "search") return;
    if (query.trim().length < 2) {
      setResults([]);
      setSearchError(null);
      setOpen(false);
      return;
    }

    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(async () => {
      abortRef.current?.abort();
      const controller = new AbortController();
      abortRef.current = controller;
      setLoading(true);
      setSearchError(null);
      try {
        const res = await fetch(`/api/products/search?q=${encodeURIComponent(query.trim())}`, {
          signal: controller.signal,
        });
        if (!res.ok) {
          const body = await res.json().catch(() => null);
          setSearchError(body?.error ?? `Search failed (${res.status}). You can still add this manually below.`);
          setOpen(true);
          return;
        }
        const data = await res.json();
        setResults(data.products ?? []);
        setOpen(true);
      } catch (err) {
        if (err instanceof DOMException && err.name === "AbortError") return;
        setSearchError("Couldn't reach the server. You can still add this manually below.");
        setOpen(true);
      } finally {
        setLoading(false);
      }
    }, DEBOUNCE_MS);

    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [query, mode]);

  function selectResult(r: SearchResult) {
    onChange({ brand: r.brand, name: r.name, productId: r.id });
    setQuery(`${r.brand} — ${r.name}`);
    setMode("matched");
    setOpen(false);
  }

  function clearMatch() {
    onChange({ brand: "", name: "", productId: null });
    setQuery("");
    setMode("search");
  }

  function switchToManual() {
    onChange({ brand: "", name: "", productId: null });
    setMode("manual");
    setOpen(false);
  }

  function switchToSearch() {
    onChange({ brand: "", name: "", productId: null });
    setQuery("");
    setMode("search");
  }

  if (mode === "matched") {
    return (
      <div className="flex items-center gap-2">
        <div className="flex-1 flex items-center justify-between border border-line rounded-[6px] px-3 py-2 bg-bg-raise">
          <span className="text-[14px] text-ink">
            {entry.brand} — {entry.name}
          </span>
          <button
            type="button"
            onClick={clearMatch}
            className="text-[12px] text-ink-3 hover:text-danger ml-3 shrink-0"
          >
            Change
          </button>
        </div>
        {showRemove && (
          <button
            type="button"
            onClick={onRemove}
            aria-label="Remove product"
            className="text-[13px] text-ink-3 hover:text-danger px-2"
          >
            Remove
          </button>
        )}
      </div>
    );
  }

  if (mode === "manual") {
    return (
      <div className="flex flex-col gap-1.5">
        <div className="flex items-center gap-2">
          <input
            type="text"
            placeholder="Brand"
            value={entry.brand}
            onChange={(e) => onChange({ ...entry, brand: e.target.value, productId: null })}
            className="flex-1 border border-line rounded-[6px] px-3 py-2 text-[14px] text-ink bg-bg-raise outline-none focus:border-accent"
          />
          <input
            type="text"
            placeholder="Product name"
            value={entry.name}
            onChange={(e) => onChange({ ...entry, name: e.target.value, productId: null })}
            className="flex-[1.5] border border-line rounded-[6px] px-3 py-2 text-[14px] text-ink bg-bg-raise outline-none focus:border-accent"
          />
          {showRemove && (
            <button
              type="button"
              onClick={onRemove}
              aria-label="Remove product"
              className="text-[13px] text-ink-3 hover:text-danger px-2"
            >
              Remove
            </button>
          )}
        </div>
        <button
          type="button"
          onClick={switchToSearch}
          className="self-start text-[12px] font-semibold text-accent"
        >
          ← Search instead
        </button>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex items-center gap-2 relative">
        <div className="flex-1 relative">
          <input
            type="text"
            autoComplete="off"
            placeholder="Search for a product, e.g. CeraVe Moisturizing Cream"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onFocus={() => (results.length > 0 || searchError) && setOpen(true)}
            onBlur={() => setTimeout(() => setOpen(false), 150)}
            className="w-full border border-line rounded-[6px] px-3 py-2 text-[14px] text-ink bg-bg-raise outline-none focus:border-accent"
          />
          {open && (
            <div className="absolute z-10 top-full left-0 right-0 mt-1 bg-bg-raise border border-line rounded-[6px] shadow-lg max-h-64 overflow-y-auto">
              {loading && (
                <div className="px-3 py-2 text-[13px] text-ink-3">Searching…</div>
              )}
              {!loading && searchError && (
                <div className="px-3 py-2 text-[13px] text-danger">{searchError}</div>
              )}
              {!loading && !searchError && results.length === 0 && query.trim().length >= 2 && (
                <div className="px-3 py-2 text-[13px] text-ink-3">No matches yet.</div>
              )}
              {!loading &&
                !searchError &&
                results.map((r) => (
                  <button
                    key={r.id}
                    type="button"
                    onMouseDown={(e) => e.preventDefault()}
                    onClick={() => selectResult(r)}
                    className="w-full text-left px-3 py-2 text-[14px] text-ink hover:bg-chip"
                  >
                    <span className="font-semibold">{r.brand}</span> — {r.name}
                  </button>
                ))}
            </div>
          )}
        </div>
        {showRemove && (
          <button
            type="button"
            onClick={onRemove}
            aria-label="Remove product"
            className="text-[13px] text-ink-3 hover:text-danger px-2"
          >
            Remove
          </button>
        )}
      </div>
      <button
        type="button"
        onClick={switchToManual}
        className="self-start text-[12px] font-semibold text-accent"
      >
        Can&rsquo;t find it? Add manually
      </button>
    </div>
  );
}
