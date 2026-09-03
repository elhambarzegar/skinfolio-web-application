"use client";

import { useState } from "react";
import { AddProductModal } from "./add-product-modal";

export function AddProductButton() {
  const [open, setOpen] = useState(false);

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="text-[13px] font-semibold text-accent whitespace-nowrap"
      >
        + Add product to routine
      </button>
      {open && <AddProductModal onClose={() => setOpen(false)} />}
    </>
  );
}
