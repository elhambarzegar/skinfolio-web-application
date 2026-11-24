import Link from "next/link";
import { auth } from "@/auth";
import { loadToday } from "@/lib/today";
import { BuildRoutineButton } from "@/components/build-routine-button";
import { TodayChecklist } from "./today-checklist";

export default async function TodayPage() {
  const session = await auth();
  const data = await loadToday(session!.user.id);

  if (data.state === "no_intake") {
    return (
      <div className="flex flex-col gap-5">
        <div>
          <p className="eyebrow">{data.dateLabel}</p>
          <h1 className="page-title">Welcome{data.firstName ? `, ${data.firstName}` : ""}</h1>
        </div>
        <div className="callout c-sky">
          <h2>Let&rsquo;s set up your routine</h2>
          <p>A few quick questions about your skin and what you already own. It takes about five minutes.</p>
          <Link href="/onboarding" className="btn">
            Start
          </Link>
        </div>
      </div>
    );
  }

  if (data.state === "no_routine") {
    return (
      <div className="flex flex-col gap-5">
        <div>
          <p className="eyebrow">{data.dateLabel}</p>
          <h1 className="page-title">Your routine</h1>
        </div>
        {data.draftRoutineId ? (
          <div className="callout c-sun">
            <h2>Your routine is ready to review</h2>
            <p>Nothing starts until you approve it.</p>
            <Link href={`/routine/${data.draftRoutineId}`} className="btn">
              Review it
            </Link>
          </div>
        ) : (
          <div className="callout c-sky">
            <h2>Ready when you are</h2>
            <p>We&rsquo;ll build a morning and evening routine from what&rsquo;s on your shelf.</p>
            <BuildRoutineButton />
          </div>
        )}
      </div>
    );
  }

  if (data.state === "paused") {
    return (
      <div className="flex flex-col gap-5">
        <div>
          <p className="eyebrow">{data.dateLabel}</p>
          <h1 className="page-title">Your routine is paused</h1>
        </div>
        <div className="callout c-blush">
          {data.pausedReason && <p>{data.pausedReason}</p>}
          <p className="note" style={{ color: "var(--ink)" }}>
            We paused it out of caution. Nothing here replaces seeing a dermatologist if you&rsquo;re worried.
          </p>
          <Link href="/checkin" className="btn btn-block">
            Tell us how your skin feels
          </Link>
          <Link href="/routine" className="btn btn-2 btn-block">
            See my routine
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-5">
      <TodayChecklist
        steps={data.steps}
        defaultPeriod={data.defaultPeriod}
        dateLabel={data.dateLabel}
        firstName={data.firstName}
      />

      {data.draftRoutineId && (
        <div className="callout c-sun">
          <h2>An updated routine is ready to review</h2>
          <Link href={`/routine/${data.draftRoutineId}`} className="btn btn-2">
            Review it
          </Link>
        </div>
      )}

      <div className="callout c-sky">
        <h2>How does your skin feel today?</h2>
        <Link href="/checkin" className="btn btn-blue">
          Tell us
        </Link>
      </div>

      {data.pendingTipCount > 0 && (
        <div className="callout c-blush">
          <h2>
            {data.pendingTipCount} suggestion{data.pendingTipCount === 1 ? " is" : "s are"} waiting for your decision
          </h2>
          <Link href="/routine" className="btn btn-2">
            Take a look
          </Link>
        </div>
      )}

      {data.ranOut.length > 0 && (
        <div className="callout c-blush">
          <h2>
            {data.ranOut.length} step{data.ranOut.length === 1 ? " is" : "s are"} paused: you ran out
          </h2>
          <ul className="flex flex-col gap-1 text-[19px]">
            {data.ranOut.map((s) => (
              <li key={s.id}>
                <b>{s.name}</b>
                <span className="note"> · {s.brand} · {s.period === "AM" ? "Morning" : "Evening"}</span>
              </li>
            ))}
          </ul>
          <Link href="/shelf" className="btn btn-2">
            Go to my shelf
          </Link>
        </div>
      )}

      {data.notToday.length > 0 && (
        <details className="acc">
          <summary>Not on today&rsquo;s list ({data.notToday.length})</summary>
          <div className="acc-body">
            {data.notToday.map((s) => (
              <div key={s.id} className="acc-row">
                <b>{s.name}</b>
                <span className="note">
                  {s.brand} · {s.period === "AM" ? "Morning" : "Evening"}
                  {s.days ? ` · ${s.days}` : ""}
                </span>
                <span className="note">Next: {s.nextDay}</span>
              </div>
            ))}
          </div>
        </details>
      )}
    </div>
  );
}
