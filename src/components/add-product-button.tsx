"use client";

import { useState } from "react";
import { AddProductModal } from "./add-product-modal";

export function AddProductButton() {
  const [open, setOpen] = useState(false);

  return (
    <>
      <button type="button" onClick={() => setOpen(true)} className="btn btn-block">
        Add a product
      </button>
      {open && <AddProductModal onClose={() => setOpen(false)} />}
    </>
  );
}
