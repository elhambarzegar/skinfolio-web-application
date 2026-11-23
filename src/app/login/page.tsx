"use client";

import { useState, type FormEvent } from "react";
import { signIn } from "next-auth/react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { BRAND } from "@/lib/brand";

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);

    try {
      const result = await signIn("credentials", {
        email,
        password,
        redirect: false,
      });

      if (result?.error) {
        setError("That email and password don't match an account.");
        setSubmitting(false);
        return;
      }

      router.push("/today");
      router.refresh();
    } catch {
      setError("Couldn't reach the server. Check your connection and try again.");
      setSubmitting(false);
    }
  }

  return (
    <div className="flex flex-1 items-center justify-center px-5 py-12">
      <div className="flex w-full max-w-[440px] flex-col gap-6">
        <div>
          <Link href="/" className="eyebrow">
            {BRAND.name}
          </Link>
          <h1 className="page-title mt-2">Welcome back</h1>
          <p className="sub mt-1">Sign in and your routine is waiting.</p>
        </div>

        <form onSubmit={handleSubmit} className="flex flex-col gap-5">
          <label className="flex flex-col gap-2">
            <span className="field-label">Email</span>
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="input"
              autoComplete="email"
            />
          </label>

          <label className="flex flex-col gap-2">
            <span className="field-label">Password</span>
            <input
              type="password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="input"
              autoComplete="current-password"
            />
          </label>

          {error && (
            <p role="alert" className="callout c-blush font-bold">
              {error}
            </p>
          )}

          <button type="submit" disabled={submitting} className="btn btn-block">
            {submitting ? "Signing in…" : "Sign in"}
          </button>
        </form>

        <p className="sub">
          New here?{" "}
          <Link href="/signup" className="font-bold text-ink underline underline-offset-4">
            Create an account
          </Link>
        </p>
      </div>
    </div>
  );
}
