"use client";

import { useEffect, useRef, useState } from "react";

export type OwnedProductEntry = {
  brand: string;
  name: string;
  productId: string | null;
};

type ProductResult = { id: string; brand: string; name: string; step: string };

const DEBOUNCE_MS = 250;

function useDebouncedFetch<T>(
  fetcher: (signal: AbortSignal) => Promise<T>,
  deps: unknown[],
  enabled: boolean
) {
  const [data, setData] = useState<T | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const abortRef = useRef<AbortController | null>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    if (!enabled) return;

    debounceRef.current = setTimeout(async () => {
      abortRef.current?.abort();
      const controller = new AbortController();
      abortRef.current = controller;
      setLoading(true);
      setError(null);
      try {
        const result = await fetcher(controller.signal);
        setData(result);
      } catch (err) {
        if (err instanceof DOMException && err.name === "AbortError") return;
        setError("Couldn't reach the server. You can still type this in by hand.");
      } finally {
        setLoading(false);
      }
    }, DEBOUNCE_MS);

    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);

  // While a search is switched off (e.g. a product was just picked), show nothing.
  return { data: enabled ? data : null, loading: enabled && loading, error: enabled ? error : null };
}

async function fetchJson(url: string, signal: AbortSignal) {
  const res = await fetch(url, { signal });
  if (!res.ok) {
    const body = await res.json().catch(() => null);
    throw new Error(body?.error ?? `Request failed (${res.status})`);
  }
  return res.json();
}

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
  const [brandQuery, setBrandQuery] = useState(entry.brand);
  const [nameQuery, setNameQuery] = useState(entry.name);
  const [productId, setProductId] = useState<string | null>(entry.productId);
  const [brandOpen, setBrandOpen] = useState(false);
  const [nameOpen, setNameOpen] = useState(false);

  const brandSearch = useDebouncedFetch<{ brands: string[] }>(
    (signal) => fetchJson(`/api/products/brands?q=${encodeURIComponent(brandQuery.trim())}`, signal),
    [brandQuery],
    brandQuery.trim().length >= 2 && !productId
  );

  const nameSearch = useDebouncedFetch<{ products: ProductResult[] }>(
    (signal) =>
      fetchJson(
        `/api/products/search?brand=${encodeURIComponent(brandQuery.trim())}&q=${encodeURIComponent(nameQuery.trim())}`,
        signal
      ),
    [brandQuery, nameQuery],
    brandQuery.trim().length >= 1 && !productId
  );

  useEffect(() => {
    onChange({ brand: brandQuery, name: nameQuery, productId });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [brandQuery, nameQuery, productId]);

  function selectBrand(brand: string) {
    setBrandQuery(brand);
    setBrandOpen(false);
    setNameQuery("");
    setProductId(null);
  }

  function selectProduct(p: ProductResult) {
    setBrandQuery(p.brand);
    setNameQuery(p.name);
    setProductId(p.id);
    setNameOpen(false);
  }

  const brandOptions = brandSearch.data?.brands ?? [];
  const nameOptions = nameSearch.data?.products ?? [];

  return (
    <div className="search-row">
      <div className="relative flex-1">
        <input
          type="text"
          autoComplete="off"
          placeholder="Brand"
          value={brandQuery}
          onChange={(e) => {
            setBrandQuery(e.target.value);
            setProductId(null);
            setBrandOpen(e.target.value.trim().length >= 2);
          }}
          onFocus={() => brandQuery.trim().length >= 2 && setBrandOpen(true)}
          onBlur={() => setTimeout(() => setBrandOpen(false), 150)}
          aria-label="Brand"
          className="input"
        />
        {brandOpen && !productId && (
          <div className="suggest">
            {brandSearch.loading && <div className="suggest-note">Searching…</div>}
            {!brandSearch.loading && brandSearch.error && (
              <div className="suggest-note font-bold text-danger">{brandSearch.error}</div>
            )}
            {!brandSearch.loading &&
              !brandSearch.error &&
              brandOptions.length === 0 &&
              brandQuery.trim().length >= 2 && (
                <div className="suggest-note">
                  No matching brand — keep typing to add it yourself.
                </div>
              )}
            {!brandSearch.loading &&
              !brandSearch.error &&
              brandOptions.map((b) => (
                <button
                  key={b}
                  type="button"
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={() => selectBrand(b)}
                  className="suggest-item font-bold"
                >
                  {b}
                </button>
              ))}
          </div>
        )}
      </div>

      <div className="relative flex-[1.5]">
        <input
          type="text"
          autoComplete="off"
          placeholder="Product name"
          value={nameQuery}
          disabled={brandQuery.trim().length === 0}
          onChange={(e) => {
            setNameQuery(e.target.value);
            setProductId(null);
            setNameOpen(brandQuery.trim().length >= 1);
          }}
          onFocus={() => brandQuery.trim().length >= 1 && setNameOpen(true)}
          onBlur={() => setTimeout(() => setNameOpen(false), 150)}
          aria-label="Product name"
          className="input disabled:opacity-50"
        />
        {productId && (
          <span className="absolute right-4 top-1/2 -translate-y-1/2 text-[16px] font-bold text-ok">
            ✓ In catalog
          </span>
        )}
        {nameOpen && !productId && (
          <div className="suggest">
            {nameSearch.loading && <div className="suggest-note">Searching…</div>}
            {!nameSearch.loading && nameSearch.error && (
              <div className="suggest-note font-bold text-danger">{nameSearch.error}</div>
            )}
            {!nameSearch.loading && !nameSearch.error && nameOptions.length === 0 && (
              <div className="suggest-note">
                No matching product for this brand — keep typing to add it yourself.
              </div>
            )}
            {!nameSearch.loading &&
              !nameSearch.error &&
              nameOptions.map((p) => (
                <button
                  key={p.id}
                  type="button"
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={() => selectProduct(p)}
                  className="suggest-item"
                >
                  {p.name}
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
          className="link-btn text-danger"
        >
          Remove
        </button>
      )}
    </div>
  );
}
