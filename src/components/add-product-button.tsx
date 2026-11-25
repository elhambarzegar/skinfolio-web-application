"use client";

import { useState } from "react";
import { ChangeFlow } from "./change-flow";

export function AddProductButton() {
  const [open, setOpen] = useState(false);

  return (
    <>
      <button type="button" onClick={() => setOpen(true)} className="btn btn-block">
        Add a product
      </button>
      {open && <ChangeFlow mode={{ kind: "add" }} onClose={() => setOpen(false)} />}
    </>
  );
}
