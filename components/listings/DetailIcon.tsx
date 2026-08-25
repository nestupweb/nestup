import type { JSX } from "react";

export type DetailIconName =
  | "building"
  | "home"
  | "door"
  | "ruler"
  | "users"
  | "paw"
  | "smoking"
  | "no-smoking"
  | "balcony"
  | "snowflake"
  | "parking"
  | "elevator"
  | "sofa"
  | "shield"
  | "food"
  | "calendar";

const PATHS: Record<DetailIconName, JSX.Element> = {
  calendar: (
    <>
      <rect x="3.5" y="5" width="17" height="15.5" rx="2.5" />
      <path d="M3.5 10h17M8 3v4M16 3v4" />
    </>
  ),
  building: (
    <>
      <path d="M6 21V5a2 2 0 0 1 2-2h8a2 2 0 0 1 2 2v16" />
      <path d="M4 21h16" />
      <path d="M10 7h.01M14 7h.01M10 11h.01M14 11h.01M10 15h.01M14 15h.01" />
    </>
  ),
  home: (
    <>
      <path d="M3 11.5 12 4l9 7.5" />
      <path d="M5.5 9.8V21h13V9.8" />
      <path d="M10 21v-5.5h4V21" />
    </>
  ),
  door: (
    <>
      <path d="M4 21h16" />
      <path d="M6.5 21V4.5a1.5 1.5 0 0 1 1.5-1.5h8a1.5 1.5 0 0 1 1.5 1.5V21" />
      <path d="M14 12h.01" />
    </>
  ),
  ruler: (
    <>
      <path d="M3 17 17 3l4 4L7 21l-4-4Z" />
      <path d="m8 12 1.5 1.5M11 9l1.5 1.5M14 6l1.5 1.5" />
    </>
  ),
  users: (
    <>
      <circle cx="9.5" cy="7.5" r="3.25" />
      <path d="M3.5 20.5v-1.25a5 5 0 0 1 5-5h2a5 5 0 0 1 5 5v1.25" />
      <path d="M15.5 4.6a3.25 3.25 0 0 1 0 5.8M18.5 14.5a5 5 0 0 1 2 4v2" />
    </>
  ),
  paw: (
    <>
      <circle cx="7" cy="9.5" r="1.6" />
      <circle cx="12" cy="7.5" r="1.6" />
      <circle cx="17" cy="9.5" r="1.6" />
      <path d="M12 12.5c-2.6 0-4.8 1.9-4.8 4 0 1.2.9 2 2.1 2h5.4c1.2 0 2.1-.8 2.1-2 0-2.1-2.2-4-4.8-4Z" />
    </>
  ),
  smoking: (
    <>
      <path d="M3 16.5h12.5v3H3z" />
      <path d="M17.5 16.5v3M20.5 16.5v3" />
      <path d="M17.5 8.5c1.4 1 1.4 2.6 0 3.6M20.5 6.5c2 1.5 2 3.8 0 5.6" />
    </>
  ),
  "no-smoking": (
    <>
      <circle cx="12" cy="12" r="9" />
      <path d="M6.5 10.75h8.75v2.5H6.5z" />
      <path d="M17.25 10.75v2.5" />
      <path d="m5.65 5.65 12.7 12.7" />
    </>
  ),
  balcony: (
    <>
      <path d="M3.5 11h17" />
      <path d="M5.5 11v9M9 11v9M12.5 11v9M16 11v9M19.5 11v9" />
      <path d="M3.5 20h17" />
      <path d="M8 11V7.5a4 4 0 0 1 8 0V11" />
    </>
  ),
  snowflake: (
    <>
      <path d="M2.5 12h19" />
      <path d="M12 2.5v19" />
      <path d="m19.5 16-4-4 4-4" />
      <path d="m4.5 8 4 4-4 4" />
      <path d="m16 4.5-4 4-4-4" />
      <path d="m8 19.5 4-4 4 4" />
    </>
  ),
  parking: (
    <>
      <rect x="3.5" y="3.5" width="17" height="17" rx="3" />
      <path d="M9.5 17V7h4a3 3 0 0 1 0 6h-4" />
    </>
  ),
  elevator: (
    <>
      <rect x="4.5" y="3" width="15" height="18" rx="2" />
      <path d="M9.5 10.5v-4M7.75 8 9.5 6.25 11.25 8" />
      <path d="M14.5 13.5v4M12.75 16l1.75 1.75L16.25 16" />
    </>
  ),
  shield: (
    <>
      <path d="M12 3.5 5 6v5.5c0 4.2 2.9 7.6 7 9 4.1-1.4 7-4.8 7-9V6l-7-2.5Z" />
      <path d="m9.25 12 2 2 3.5-4" />
    </>
  ),
  food: (
    <>
      <path d="M7 3.5v7M5 3.5v4.5a2 2 0 0 0 4 0V3.5M7 10.5v10" />
      <path d="M16.5 3.5c-1.7 1.2-2.5 3-2.5 5.5 0 1.6.8 2.5 2.5 2.5v9" />
    </>
  ),
  sofa: (
    <>
      <path d="M5.5 11V8.5a3 3 0 0 1 3-3h7a3 3 0 0 1 3 3V11" />
      <path d="M3 13.5a2 2 0 0 1 4 0V15h10v-1.5a2 2 0 0 1 4 0v3a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2Z" />
      <path d="M6 18.5V20M18 18.5V20" />
    </>
  ),
};

/** Minimal line icon for listing detail items — consistent stroke, muted tone. */
export function DetailIcon({ name }: { name: DetailIconName }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.5}
      strokeLinecap="round"
      strokeLinejoin="round"
      className="h-[18px] w-[18px] shrink-0 text-muted"
      aria-hidden="true"
    >
      {PATHS[name]}
    </svg>
  );
}
