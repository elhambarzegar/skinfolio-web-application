"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { ScanLabelModal } from "./scan-label-modal";

export type OwnedProductRow = {
  id: string;
  brand: string;
  name: string;
  bucket: "high" | "medium" | "low" | null;
  origin: string | null;
  fetchedAt: string | null;
};

const BUCKET_STYLE: Record<"high" | "medium" | "low", string> = {
  high: "bg-ok/10 text-ok",
  medium: "bg-warn/10 text-warn",
  low: "bg-danger/10 text-danger",
};

const BUCKET_LABEL: Record<"high" | "medium" | "low", string> = {
  high: "High confidence",
  medium: "Medium confidence",
  low: "Low confidence — unverified",
};

const ORIGIN_LABEL: Record<string, string> = {
  OPEN_BEAUTY_FACTS: "Open Beauty Facts",
  BRAND_SITE: "brand site",
  RETAILER: "retailer listing",
  WEB_SEARCH: "web search",
  USER_PHOTO: "your photo",
};

export function OwnedProductsList({ products }: { products: OwnedProductRow[] }) {
  const router = useRouter();
  const [rows, setRows] = useState(products);
  const [scanningId, setScanningId] = useState<string | null>(null);

  function handleScanned(productId: string, bucket: "high" | "medium" | "low") {
    setRows((prev) =>
      prev.map((p) =>
        p.id === productId ? { ...p, bucket, origin: "USER_PHOTO", fetchedAt: new Date().toISOString() } : p
      )
    );
    setScanningId(null);
    router.refresh();
  }

  if (rows.length === 0) {
    return <p className="mt-2 text-[14px] text-ink-3">None listed.</p>;
  }

  const scanningProduct = rows.find((p) => p.id === scanningId);

  return (
    <>
      <ul className="mt-2 flex flex-col gap-2">
        {rows.map((p) => {
          const needsData = !p.bucket || p.bucket === "low";
          return (
            <li key={p.id} className="flex items-center justify-between gap-3 py-1.5">
              <span className="text-[14px] text-ink">
                {p.brand} — {p.name}
              </span>
              <div className="flex items-center gap-2 shrink-0">
                {needsData && (
                  <button
                    type="button"
                    onClick={() => setScanningId(p.id)}
                    className="text-[12px] font-semibold text-accent whitespace-nowrap"
                  >
                    Scan label
                  </button>
                )}
                {p.bucket ? (
                  <span
                    className={`text-[12px] font-semibold px-2.5 py-1 rounded-full whitespace-nowrap ${BUCKET_STYLE[p.bucket]}`}
                    title={
                      p.origin && p.fetchedAt
                        ? `${ORIGIN_LABEL[p.origin] ?? p.origin}, checked ${new Date(p.fetchedAt).toLocaleDateString()}`
                        : undefined
                    }
                  >
                    {BUCKET_LABEL[p.bucket]}
                  </span>
                ) : (
                  <span className="text-[12px] font-semibold px-2.5 py-1 rounded-full whitespace-nowrap bg-chip text-ink-3">
                    No ingredient data yet
                  </span>
                )}
              </div>
            </li>
          );
        })}
      </ul>

      {scanningProduct && (
        <ScanLabelModal
          productId={scanningProduct.id}
          productLabel={`${scanningProduct.brand} — ${scanningProduct.name}`}
          onClose={() => setScanningId(null)}
          onSuccess={(bucket) => handleScanned(scanningProduct.id, bucket)}
        />
      )}
    </>
  );
}
