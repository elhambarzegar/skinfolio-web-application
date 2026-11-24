"use client";

import { useState } from "react";
import { ChangeFlow } from "@/components/change-flow";

export function PrescribedButton() {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button type="button" onClick={() => setOpen(true)} className="btn btn-2 btn-block">
        Add a prescribed product
      </button>
      {open && <ChangeFlow mode={{ kind: "prescribed" }} onClose={() => setOpen(false)} />}
    </>
  );
}
