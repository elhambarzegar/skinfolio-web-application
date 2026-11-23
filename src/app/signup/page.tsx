"use client";

import { useState, type FormEvent } from "react";
import { signIn } from "next-auth/react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { BRAND } from "@/lib/brand";

export default function SignupPage() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);

    try {
      const res = await fetch("/api/signup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, email, password }),
      });
      const data = await res.json();

      if (!res.ok) {
        setError(data.error ?? "Something went wrong. Try again.");
        setSubmitting(false);
        return;
      }

      const signInResult = await signIn("credentials", {
        email,
        password,
        redirect: false,
      });

      if (signInResult?.error) {
        setError("Account created, but sign-in failed. Try signing in.");
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
          <h1 className="page-title mt-2">Create your account</h1>
          <p className="sub mt-1">Takes about a minute. Your routine comes next.</p>
        </div>

        <form onSubmit={handleSubmit} className="flex flex-col gap-5">
          <label className="flex flex-col gap-2">
            <span className="field-label">Name (optional)</span>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="input"
              autoComplete="name"
            />
          </label>

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
              minLength={8}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="input"
              autoComplete="new-password"
            />
            <span className="note">At least 8 characters.</span>
          </label>

          {error && (
            <p role="alert" className="callout c-blush font-bold">
              {error}
            </p>
          )}

          <button type="submit" disabled={submitting} className="btn btn-block">
            {submitting ? "Creating account…" : "Create account"}
          </button>
        </form>

        <p className="sub">
          Already have an account?{" "}
          <Link href="/login" className="font-bold text-ink underline underline-offset-4">
            Sign in
          </Link>
        </p>
      </div>
    </div>
  );
}
