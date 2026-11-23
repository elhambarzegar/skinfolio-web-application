"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

/**
 * Tells the server which timezone the browser is in, so "today" and the
 * weekday on the checklist are the user's own. Renders nothing; when the
 * stored zone was wrong it refreshes the page once so Today redraws.
 */
export function TimezoneSync({ stored }: { stored: string }) {
  const router = useRouter();

  useEffect(() => {
    const zone = Intl.DateTimeFormat().resolvedOptions().timeZone;
    if (!zone || zone === stored) return;

    fetch("/api/me/timezone", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ timezone: zone }),
    })
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (data?.changed) router.refresh();
      })
      .catch(() => {
        // Not worth interrupting anyone over: Today just keeps the old zone.
      });
  }, [stored, router]);

  return null;
}
