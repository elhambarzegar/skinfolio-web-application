"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { ScanLabelModal } from "@/components/scan-label-modal";
import { ChangeFlow } from "@/components/change-flow";
import { buildShopLinks } from "@/lib/shopLinks";

export type ShelfProduct = {
  productId: string;
  brand: string;
  name: string;
  category: string;
  categoryLabel: string;
  ranOut: boolean;
  prescribed: boolean;
  /** Where it is used in the routine in use, e.g. "Morning · Every day". Empty when it isn't in the routine. */
  uses: string[];
  /** Null when we have no ingredient list at all. */
  ingredients: {
    text: string;
    fromPhoto: boolean;
    origin: string;
    date: string;
    bucket: "high" | "medium" | "low";
  } | null;
};

const ORIGIN_LABEL: Record<string, string> = {
  OPEN_BEAUTY_FACTS: "Open Beauty Facts",
  BRAND_SITE: "the brand's website",
  RETAILER: "a store listing",
  WEB_SEARCH: "a web search",
  USER_PHOTO: "your photo",
};

// What to search for when you want something different, never a brand.
const ALTERNATIVE_QUERY: Record<string, string> = {
  CLEANSE: "gentle fragrance-free face cleanser",
  TREAT: "face serum",
  MOISTURIZE: "face moisturizer",
  PROTECT: "face sunscreen SPF 30+",
  OTHER: "skincare",
};

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

/** Same text on the server and in the browser (no locale or time zone involved). */
function formatDate(iso: string): string {
  const d = new Date(iso);
  return `${d.getUTCDate()} ${MONTHS[d.getUTCMonth()]} ${d.getUTCFullYear()}`;
}

function ShopButtons({ query }: { query: string }) {
  return (
    <div className="flex flex-wrap gap-2">
      {Object.entries(buildShopLinks(query)).map(([site, url]) => (
        <a key={site} href={url} target="_blank" rel="noopener noreferrer" className="btn btn-2 btn-sm">
          Shop on <span className="capitalize">{site}</span>
        </a>
      ))}
    </div>
  );
}

/** What to do about a product that has run out: get it again, or get something else. */
function FindAlternativeModal({
  product,
  onClose,
  onPicked,
}: {
  product: ShelfProduct;
  onClose: () => void;
  onPicked: () => void;
}) {
  return (
    <div className="modal-scrim" onClick={onClose}>
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="alt-title"
        className="modal-card"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="modal-head">
          <h2 id="alt-title">Find an alternative</h2>
          <button type="button" onClick={onClose} aria-label="Close" className="modal-x">
            ×
          </button>
        </div>

        <p className="sub">
          You ran out of <b>{product.name}</b> ({product.brand}).
        </p>

        <div className="flex flex-col gap-2">
          <p className="eyebrow">Get the same one again</p>
          <ShopButtons query={`${product.brand} ${product.name}`} />
        </div>

        <div className="flex flex-col gap-2">
          <p className="eyebrow">Or try something different</p>
          <ShopButtons query={ALTERNATIVE_QUERY[product.category] ?? ALTERNATIVE_QUERY.OTHER} />
        </div>

        <div className="callout c-sky">
          <p className="note" style={{ color: "var(--ink)" }}>
            Once you have one, add it here. We&rsquo;ll check it against your routine before anything changes.
          </p>
          <button type="button" onClick={onPicked} className="btn">
            I picked one — add it
          </button>
        </div>
      </div>
    </div>
  );
}

function ShelfCard({
  product,
  hasRoutine,
  onScan,
  onAlternative,
  onUse,
}: {
  product: ShelfProduct;
  hasRoutine: boolean;
  onScan: (p: ShelfProduct) => void;
  onAlternative: (p: ShelfProduct) => void;
  onUse: (p: ShelfProduct) => void;
}) {
  const router = useRouter();
  const [, startRefresh] = useTransition();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function call(method: "PATCH" | "DELETE", body?: Record<string, unknown>) {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/shelf/${product.productId}`, {
        method,
        headers: { "Content-Type": "application/json" },
        body: body ? JSON.stringify(body) : undefined,
      });
      if (!res.ok) {
        const data = await res.json().catch(() => null);
        setError(data?.error ?? "Something went wrong.");
        return;
      }
      startRefresh(() => router.refresh());
    } catch {
      setError("Couldn't reach the server. Check your connection and try again.");
    } finally {
      setBusy(false);
    }
  }

  const ing = product.ingredients;
  const inRoutine = product.uses.length > 0;

  return (
    <div className="step">
      <div className="flex flex-col gap-1">
        <h3>{product.name}</h3>
        <p className="brand">{product.brand}</p>
      </div>

      <div className="badges">
        <span className="badge b-cat">{product.categoryLabel}</span>
        {product.uses.map((u) => (
          <span key={u} className="badge b-ok">
            ✓ {u}
          </span>
        ))}
        {product.prescribed && <span className="badge b-rx">Prescribed</span>}
        {product.ranOut && <span className="badge b-out">Ran out · paused</span>}
        {!ing && <span className="badge b-out">No ingredients yet</span>}
      </div>

      <details className="why">
        <summary>Ingredients</summary>
        <div className="why-body">
          {ing ? (
            <>
              <p className="text-[19px] font-bold">
                {ing.fromPhoto
                  ? `From Your Photo · taken ${formatDate(ing.date)}`
                  : ing.origin === "COMMUNITY"
                    ? `From App Library · confirmed by several people's photos, ${formatDate(ing.date)}`
                    : `From App Library · from ${ORIGIN_LABEL[ing.origin] ?? "the web"}, ${formatDate(ing.date)}`}
              </p>
              {!ing.fromPhoto && ing.bucket === "low" && (
                <p className="note">We couldn&rsquo;t confirm this list is current. A photo of your bottle makes it exact.</p>
              )}
              <p className="text-[19px] leading-relaxed">{ing.text}</p>
            </>
          ) : (
            <p className="text-[19px]">We haven&rsquo;t found this product&rsquo;s ingredients yet. A photo of the label fixes that.</p>
          )}
          <button type="button" onClick={() => onScan(product)} className="btn btn-2 btn-sm self-start">
            {ing?.fromPhoto ? "Update with a new photo" : ing ? "Use a photo of my bottle" : "Add a photo of the label"}
          </button>
        </div>
      </details>

      {error && (
        <p role="alert" className="callout c-blush font-bold">
          {error}
        </p>
      )}

      <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap">
        {product.ranOut ? (
          <>
            <button type="button" disabled={busy} onClick={() => onAlternative(product)} className="btn btn-sm">
              Find an alternative
            </button>
            <button type="button" disabled={busy} onClick={() => call("PATCH", { ranOut: false })} className="btn btn-2 btn-sm">
              I have it again
            </button>
          </>
        ) : (
          <button type="button" disabled={busy} onClick={() => call("PATCH", { ranOut: true })} className="btn btn-2 btn-sm">
            I ran out
          </button>
        )}
        {!inRoutine && !product.ranOut && hasRoutine && (
          <button type="button" disabled={busy} onClick={() => onUse(product)} className="btn btn-sm">
            Use in my routine
          </button>
        )}
        {!inRoutine && (
          <button type="button" disabled={busy} onClick={() => call("DELETE")} className="link-btn text-danger">
            Remove from shelf
          </button>
        )}
      </div>
      {product.ranOut && inRoutine && (
        <p className="note">Its steps are paused in Today until you have it again.</p>
      )}
    </div>
  );
}

/** The whole shelf, in three groups: what's in the routine, what isn't, and what has run out. */
export function ShelfList({ products, hasRoutine }: { products: ShelfProduct[]; hasRoutine: boolean }) {
  const router = useRouter();
  const [scanning, setScanning] = useState<ShelfProduct | null>(null);
  const [alternativeFor, setAlternativeFor] = useState<ShelfProduct | null>(null);
  const [swapping, setSwapping] = useState(false);
  const [using, setUsing] = useState<ShelfProduct | null>(null);

  const groups = [
    { key: "in", title: "In my routine", items: products.filter((p) => !p.ranOut && p.uses.length > 0) },
    { key: "out", title: "Not in my routine", items: products.filter((p) => !p.ranOut && p.uses.length === 0) },
    { key: "ran", title: "Ran out", items: products.filter((p) => p.ranOut) },
  ];

  return (
    <>
      <div className="flex flex-col gap-4">
        {groups.map((g) => (
          <details key={g.key} className="acc" open={g.items.length > 0}>
            <summary>
              <span>
                {g.title} <span className="font-normal text-ink-2">({g.items.length})</span>
              </span>
            </summary>
            <div className="acc-body">
              {g.items.length === 0 ? (
                <p className="note">Nothing here.</p>
              ) : (
                <div className="steps">
                  {g.items.map((p) => (
                    <ShelfCard key={p.productId} product={p} hasRoutine={hasRoutine} onScan={setScanning} onAlternative={setAlternativeFor} onUse={setUsing} />
                  ))}
                </div>
              )}
            </div>
          </details>
        ))}
      </div>

      {scanning && (
        <ScanLabelModal
          productId={scanning.productId}
          productLabel={`${scanning.brand} — ${scanning.name}`}
          onClose={() => setScanning(null)}
          onSuccess={() => {
            setScanning(null);
            router.refresh();
          }}
        />
      )}

      {alternativeFor && !swapping && (
        <FindAlternativeModal
          product={alternativeFor}
          onClose={() => setAlternativeFor(null)}
          onPicked={() => setSwapping(true)}
        />
      )}

      {alternativeFor && swapping && (
        <ChangeFlow
          mode={{ kind: "swap", replacesProductId: alternativeFor.productId, label: alternativeFor.name }}
          onClose={() => {
            setSwapping(false);
            setAlternativeFor(null);
          }}
        />
      )}

      {using && (
        <ChangeFlow mode={{ kind: "use", productId: using.productId, label: using.name }} onClose={() => setUsing(null)} />
      )}
    </>
  );
}
