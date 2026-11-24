"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { ReactNode } from "react";
import { BRAND } from "@/lib/brand";

const icon = (children: ReactNode) => (
  <svg
    viewBox="0 0 24 24"
    aria-hidden="true"
    className="h-[30px] w-[30px] flex-none"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    {children}
  </svg>
);

const ITEMS = [
  {
    href: "/today",
    label: "Today",
    // The check-in form is reached from Today, so it keeps Today lit.
    also: ["/checkin"],
    icon: icon(
      <>
        <circle cx="12" cy="12" r="4" />
        <path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4" />
      </>
    ),
  },
  {
    href: "/shelf",
    label: "Shelf",
    also: [],
    icon: icon(
      <>
        <rect x="3" y="3" width="18" height="5" rx="1.5" />
        <rect x="3" y="10" width="18" height="5" rx="1.5" />
        <rect x="3" y="17" width="18" height="4" rx="1.5" />
      </>
    ),
  },
  {
    href: "/routine",
    label: "Routine",
    also: [],
    icon: icon(
      <>
        <path d="M9 6h11M9 12h11M9 18h11" />
        <path d="M3.5 6l1.2 1.2L7 5M3.5 12l1.2 1.2L7 11M3.5 18l1.2 1.2L7 17" />
      </>
    ),
  },
  {
    href: "/progress",
    label: "Progress",
    also: [],
    icon: icon(<path d="M4 20V10M10 20V4M16 20v-7M22 20H2" />),
  },
  {
    href: "/me",
    label: "Me",
    also: [],
    icon: icon(
      <>
        <circle cx="12" cy="8" r="4" />
        <path d="M4 21c1-4 4-6 8-6s7 2 8 6" />
      </>
    ),
  },
];

function isActive(pathname: string, href: string, also: string[]) {
  return [href, ...also].some((h) => pathname === h || pathname.startsWith(h + "/"));
}

/**
 * Five spaces, one job each. A bar along the bottom on a phone; the same
 * five become a menu down the left side on a computer.
 */
export function AppNav() {
  const pathname = usePathname();

  return (
    <nav
      aria-label="Main"
      className="fixed inset-x-0 bottom-0 z-40 grid grid-cols-5 gap-1 border-t-[1.5px] border-edge/50 bg-blush px-2 pt-2 pb-[max(10px,env(safe-area-inset-bottom))] md:sticky md:inset-x-auto md:bottom-auto md:top-0 md:flex md:h-dvh md:w-[280px] md:flex-none md:flex-col md:gap-2 md:border-r-[1.5px] md:border-t-0 md:p-4"
    >
      <p className="hidden px-3 pb-3 pt-2 font-heading text-[30px] font-bold leading-tight md:block">{BRAND.name}</p>
      {ITEMS.map((item) => {
        const active = isActive(pathname, item.href, item.also);
        return (
          <Link
            key={item.href}
            href={item.href}
            aria-current={active ? "page" : undefined}
            className={`flex min-h-[74px] flex-col items-center justify-center gap-1 rounded-[18px] border-2 text-[16px] font-bold md:min-h-[64px] md:flex-row md:justify-start md:gap-4 md:px-4 md:text-[21px] ${
              active ? "border-edge bg-paper" : "border-transparent hover:bg-paper/60"
            }`}
          >
            {item.icon}
            {item.label}
          </Link>
        );
      })}
    </nav>
  );
}
