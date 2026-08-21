import Link from "next/link";

const principles = [
  {
    title: "A routine, not a shelf",
    body: "Tell it your concerns and what you already own. It builds one ordered AM/PM routine, not a list of products to buy.",
  },
  {
    title: "Every step has a reason",
    body: "Each recommendation comes with the rule it's based on — sunscreen goes last, retinoids are night-only, no unexplained swaps.",
  },
  {
    title: "You always have the last word",
    body: "Accept it, edit a step, or flag a concern before it becomes your routine. Nothing is final without you.",
  },
];

export default function Home() {
  return (
    <div className="flex-1 flex flex-col">
      <header className="flex items-center justify-between px-6 sm:px-10 py-5 border-b border-line">
        <span className="text-[15px] font-bold tracking-tight text-ink">Skinfolio</span>
        <nav className="flex items-center gap-3">
          <Link
            href="/login"
            className="text-[14px] font-semibold text-ink-2 hover:text-ink px-3 py-1.5"
          >
            Log in
          </Link>
          <Link
            href="/signup"
            className="text-[14px] font-bold bg-accent text-accent-ink px-4 py-1.5 rounded-[6px] hover:opacity-90"
          >
            Get started
          </Link>
        </nav>
      </header>

      <main className="flex-1 flex flex-col items-center px-6 sm:px-10 py-20 sm:py-28 text-center">
        <p className="text-[13px] font-bold tracking-[0.14em] uppercase text-accent mb-4">
          A skincare routine you can actually check
        </p>
        <h1 className="text-[34px] sm:text-[48px] leading-[1.08] font-bold text-ink max-w-3xl text-balance">
          Skin advice with its reasoning on the label
        </h1>
        <p className="mt-5 text-[16px] sm:text-[18px] text-ink-2 max-w-xl">
          Skinfolio builds you a personalized AM/PM routine, checks it against
          dermatology-sourced ingredient rules, and shows its work — so you can
          decide, not just trust.
        </p>
        <div className="mt-8 flex items-center gap-3">
          <Link
            href="/signup"
            className="text-[15px] font-bold bg-accent text-accent-ink px-6 py-3 rounded-[6px] hover:opacity-90"
          >
            Build my routine
          </Link>
          <Link
            href="/login"
            className="text-[15px] font-semibold text-ink-2 hover:text-ink px-6 py-3"
          >
            I already have an account
          </Link>
        </div>

        <div className="mt-20 grid gap-4 sm:grid-cols-3 max-w-4xl text-left w-full">
          {principles.map((p) => (
            <div
              key={p.title}
              className="bg-bg-raise border border-line rounded-[10px] p-5"
            >
              <h3 className="text-[15px] font-bold text-ink mb-1.5">{p.title}</h3>
              <p className="text-[14px] text-ink-2 leading-relaxed">{p.body}</p>
            </div>
          ))}
        </div>
      </main>

      <footer className="px-6 sm:px-10 py-6 border-t border-line text-[13px] text-ink-3 text-center">
        Skinfolio is a personal skincare planning tool, not a medical device. For a diagnosis or a specific skin condition, see a board-certified dermatologist.
      </footer>
    </div>
  );
}
