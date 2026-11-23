import Link from "next/link";
import { BRAND } from "@/lib/brand";

const principles = [
  {
    title: "A routine, not a shelf",
    body: "Tell us your concerns and what you already own. You get one ordered morning and evening routine, not a list of things to buy.",
  },
  {
    title: "Every step has a reason",
    body: "Each recommendation names the rule behind it: sunscreen goes last, retinoids are for night. No unexplained swaps.",
  },
  {
    title: "You have the last word",
    body: "Approve it, change a step, or say no before anything becomes your routine.",
  },
];

export default function Home() {
  return (
    <div className="flex flex-1 flex-col">
      <header className="flex items-center justify-between gap-3 px-5 py-4 sm:px-10">
        <span className="font-heading text-[28px] font-bold leading-none">{BRAND.name}</span>
        <Link href="/login" className="btn btn-2 btn-sm">
          Sign in
        </Link>
      </header>

      <main className="flex flex-1 flex-col items-center px-5 py-14 text-center sm:py-20">
        <p className="eyebrow">{BRAND.tagline}</p>
        <h1 className="page-title mt-3 max-w-[18ch] text-[40px] sm:text-[56px]">Skin advice with its reasoning on the label</h1>
        <p className="mt-5 max-w-[34rem] text-[21px] text-ink-2">
          Get a morning and evening routine from the products you already own, checked against dermatology-sourced
          ingredient rules. Then tick it off, one step at a time.
        </p>
        <div className="mt-8 flex w-full max-w-[420px] flex-col gap-3">
          <Link href="/signup" className="btn btn-block">
            Build my routine
          </Link>
          <Link href="/login" className="btn btn-2 btn-block">
            I already have an account
          </Link>
        </div>

        <div className="mt-16 grid w-full max-w-[960px] gap-4 text-left sm:grid-cols-3">
          {principles.map((p, i) => (
            <div key={p.title} className={`callout ${["c-blush", "c-sky", "c-mint"][i]}`}>
              <h2>{p.title}</h2>
              <p>{p.body}</p>
            </div>
          ))}
        </div>
      </main>

      <footer className="px-5 py-8 text-center note sm:px-10">
        {BRAND.name} is a personal skincare planning tool, not a medical device. For a diagnosis or a specific skin
        condition, see a board-certified dermatologist.
      </footer>
    </div>
  );
}
