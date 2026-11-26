"use client";

import { useEffect, useState } from "react";
import { signOut } from "next-auth/react";

/** Download everything held about you, or delete the account for good. */
export function AccountActions({ hasPassword }: { hasPassword: boolean }) {
  const [open, setOpen] = useState(false);
  const [confirm, setConfirm] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape" && !busy) setOpen(false);
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, busy]);

  const ready = confirm.trim().toUpperCase() === "DELETE" && (!hasPassword || password.length > 0);

  async function remove() {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/me/delete", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ confirm, password }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data.error ?? "Something went wrong. Nothing was deleted.");
        setBusy(false);
        return;
      }
      await signOut({ callbackUrl: "/goodbye" });
    } catch {
      setError("Couldn't reach the server. Nothing was deleted.");
      setBusy(false);
    }
  }

  return (
    <>
      <div className="flex flex-col gap-3">
        <p>You can keep a copy of everything we hold about you, or remove it all.</p>
        <a href="/api/me/export" download className="btn btn-2 btn-block">
          Download my data
        </a>
        <button type="button" onClick={() => setOpen(true)} className="link-btn self-start text-danger">
          Delete my account
        </button>
      </div>

      {open && (
        <div className="modal-scrim" onClick={() => !busy && setOpen(false)}>
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="delete-title"
            className="modal-card"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="modal-head">
              <h2 id="delete-title">Delete my account</h2>
              <button type="button" onClick={() => setOpen(false)} disabled={busy} aria-label="Close" className="modal-x">
                ×
              </button>
            </div>

            <div className="callout c-blush">
              <p className="text-[20px] font-bold">This is permanent and can&rsquo;t be undone.</p>
              <ul className="flex list-outside list-disc flex-col gap-1.5 pl-6 text-[19px]">
                <li>Your account and sign-in</li>
                <li>Your skin details, shelf and routines</li>
                <li>Your progress and check-ins</li>
                <li>Your label-photo records</li>
              </ul>
              <p className="note" style={{ color: "var(--ink)" }}>
                Want a copy first? Close this and use &ldquo;Download my data&rdquo;.
              </p>
            </div>

            <label className="flex flex-col gap-2">
              <span className="field-label">Type DELETE to confirm</span>
              <input
                value={confirm}
                onChange={(e) => setConfirm(e.target.value)}
                autoComplete="off"
                autoCapitalize="characters"
                className="input"
              />
            </label>

            {hasPassword && (
              <label className="flex flex-col gap-2">
                <span className="field-label">Your password</span>
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  autoComplete="current-password"
                  className="input"
                />
              </label>
            )}

            {error && (
              <p role="alert" className="callout c-blush font-bold">
                {error}
              </p>
            )}

            <div className="flex flex-col gap-3">
              <button
                type="button"
                onClick={remove}
                disabled={!ready || busy}
                className="btn btn-block"
                style={{ background: "var(--accent)", color: "var(--accent-ink)" }}
              >
                {busy ? "Deleting…" : "Delete everything"}
              </button>
              <button type="button" onClick={() => setOpen(false)} disabled={busy} className="btn btn-2 btn-block">
                Keep my account
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
