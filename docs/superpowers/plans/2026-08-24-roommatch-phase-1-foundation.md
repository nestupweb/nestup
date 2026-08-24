# RoomMatch Implementation Plan — Phase 1: Foundation

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Scaffold the RoomMatch Next.js app with theming, Supabase (schema + RLS), the two compatibility-score engines, validation schemas, and working auth.

**Architecture:** Server-first Next.js App Router. Supabase is DB + Auth + Storage + Realtime; RLS is the authorization backbone. All scoring/validation logic lives in pure, unit-tested TypeScript modules under `lib/`.

**Tech Stack:** Next.js 15 (App Router) · TypeScript · Tailwind CSS v4 · @supabase/ssr + @supabase/supabase-js · Zod · Vitest + React Testing Library.

**Spec:** `docs/superpowers/specs/2026-08-24-roommatch-design.md` — read it first.
**Phases:** 1 of 3 (this file) → `…-phase-2-marketplace.md` → `…-phase-3-matching-and-launch.md`. Execute in order.
**Repo root:** `C:\Users\licht\OneDrive\UNIVERSITY\Year B\Semester B\FULL-STACK\Final-Project` (already a git repo, contains `docs/` and the assignment PDF).

---

### Task 1: Scaffold the Next.js app into the existing repo

**Files:**
- Create: entire Next.js scaffold at repo root (`app/`, `package.json`, `tsconfig.json`, `next.config.ts`, …)
- Modify: `.gitignore` (merge scaffold entries with existing ones)

- [ ] **Step 1: Scaffold into a temp folder, then move to repo root**

Run from the repo root (Bash):

```bash
npx create-next-app@latest tmp-scaffold --ts --tailwind --eslint --app --no-src-dir --import-alias "@/*" --use-npm --yes
# Move everything (incl. dotfiles) up to the repo root
shopt -s dotglob
rm -rf tmp-scaffold/.git          # keep OUR git history, not the scaffold's
cat tmp-scaffold/.gitignore >> .gitignore && rm tmp-scaffold/.gitignore
mv tmp-scaffold/* .
rmdir tmp-scaffold
```

Then dedupe `.gitignore` by hand — it must contain at least: `node_modules/`, `.next/`, `out/`, `.env`, `.env*.local`, `.superpowers/`, `.vercel/`, `*.tsbuildinfo`, `.DS_Store`.

- [ ] **Step 2: Verify the dev server boots**

Run: `npm run dev` — open http://localhost:3000, expect the Next.js starter page. Stop the server.

- [ ] **Step 3: Commit**

```bash
git add -A && git commit -m "chore: scaffold Next.js 15 + TypeScript + Tailwind app"
```

---

### Task 2: Test tooling (Vitest + RTL)

**Files:**
- Create: `vitest.config.ts`, `tests/setup.ts`
- Modify: `package.json` (scripts)

- [ ] **Step 1: Install dev dependencies**

```bash
npm i -D vitest @vitejs/plugin-react jsdom @testing-library/react @testing-library/jest-dom @testing-library/user-event
```

- [ ] **Step 2: Create `vitest.config.ts`**

```ts
import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";
import path from "node:path";

export default defineConfig({
  plugins: [react()],
  test: {
    environment: "jsdom",
    setupFiles: "./tests/setup.ts",
    include: ["tests/unit/**/*.test.{ts,tsx}"],
  },
  resolve: { alias: { "@": path.resolve(__dirname, ".") } },
});
```

- [ ] **Step 3: Create `tests/setup.ts`**

```ts
import "@testing-library/jest-dom/vitest";
```

- [ ] **Step 4: Add scripts to `package.json`** (inside `"scripts"`)

```json
"test": "vitest run",
"test:watch": "vitest"
```

- [ ] **Step 5: Smoke-test the runner**

Create `tests/unit/smoke.test.ts`:

```ts
import { expect, test } from "vitest";
test("vitest runs", () => expect(1 + 1).toBe(2));
```

Run: `npm test` → Expected: `1 passed`. Then delete `tests/unit/smoke.test.ts`.

- [ ] **Step 6: Commit**

```bash
git add -A && git commit -m "chore: add Vitest + React Testing Library"
```

---

### Task 3: Design system — fonts, theme tokens, dark mode toggle

**Files:**
- Modify: `app/globals.css`, `app/layout.tsx`
- Create: `components/ui/ThemeToggle.tsx`
- Test: `tests/unit/theme-toggle.test.tsx`

- [ ] **Step 1: Replace `app/globals.css` entirely**

```css
@import "tailwindcss";

:root {
  --paper: #faf7f2;
  --ink: #201d1a;
  --accent: #2f5d50;
  --accent-contrast: #faf7f2;
  --surface: #ffffff;
  --hairline: rgba(32, 29, 26, 0.1);
  --muted: rgba(32, 29, 26, 0.55);
}

[data-theme="dark"] {
  --paper: #191613;
  --ink: #f5efe6;
  --accent: #c9a468;
  --accent-contrast: #191613;
  --surface: #201c18;
  --hairline: rgba(255, 255, 255, 0.1);
  --muted: rgba(245, 239, 230, 0.55);
}

@theme inline {
  --color-paper: var(--paper);
  --color-ink: var(--ink);
  --color-accent: var(--accent);
  --color-accent-contrast: var(--accent-contrast);
  --color-surface: var(--surface);
  --color-hairline: var(--hairline);
  --color-muted: var(--muted);
  --font-serif: var(--font-fraunces);
  --font-sans: var(--font-inter);
}

body {
  background: var(--paper);
  color: var(--ink);
  font-family: var(--font-inter), system-ui, sans-serif;
}
```

This gives Tailwind utilities `bg-paper text-ink bg-surface border-hairline text-muted bg-accent text-accent-contrast font-serif font-sans` in both themes.

- [ ] **Step 2: Replace `app/layout.tsx` entirely**

```tsx
import type { Metadata } from "next";
import { Fraunces, Inter } from "next/font/google";
import "./globals.css";

const fraunces = Fraunces({ subsets: ["latin"], variable: "--font-fraunces" });
const inter = Inter({ subsets: ["latin"], variable: "--font-inter" });

export const metadata: Metadata = {
  title: "RoomMatch",
  description: "Find your next shared apartment — and the roommates you'll actually get along with.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <script
          dangerouslySetInnerHTML={{
            __html: `try{if(localStorage.theme==="dark")document.documentElement.dataset.theme="dark"}catch(e){}`,
          }}
        />
      </head>
      <body className={`${fraunces.variable} ${inter.variable} antialiased`}>{children}</body>
    </html>
  );
}
```

- [ ] **Step 3: Write the failing test** — `tests/unit/theme-toggle.test.tsx`

```tsx
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, expect, test } from "vitest";
import { ThemeToggle } from "@/components/ui/ThemeToggle";

beforeEach(() => {
  localStorage.clear();
  delete document.documentElement.dataset.theme;
});

test("toggles dark theme on <html> and persists to localStorage", async () => {
  render(<ThemeToggle />);
  const button = screen.getByRole("button", { name: /switch to dark mode/i });
  await userEvent.click(button);
  expect(document.documentElement.dataset.theme).toBe("dark");
  expect(localStorage.theme).toBe("dark");
  await userEvent.click(screen.getByRole("button", { name: /switch to light mode/i }));
  expect(document.documentElement.dataset.theme).toBeUndefined();
  expect(localStorage.theme).toBe("light");
});
```

- [ ] **Step 4: Run to verify it fails**

Run: `npm test` → Expected: FAIL (`Cannot find module '@/components/ui/ThemeToggle'`).

- [ ] **Step 5: Create `components/ui/ThemeToggle.tsx`**

```tsx
"use client";

import { useEffect, useState } from "react";

export function ThemeToggle() {
  const [dark, setDark] = useState(false);

  useEffect(() => {
    setDark(document.documentElement.dataset.theme === "dark");
  }, []);

  function toggle() {
    const next = !dark;
    setDark(next);
    if (next) document.documentElement.dataset.theme = "dark";
    else delete document.documentElement.dataset.theme;
    try {
      localStorage.theme = next ? "dark" : "light";
    } catch {}
  }

  return (
    <button
      type="button"
      onClick={toggle}
      aria-label={dark ? "Switch to light mode" : "Switch to dark mode"}
      className="rounded-full border border-hairline px-3 py-1.5 text-xs font-medium tracking-wide text-muted hover:text-ink"
    >
      {dark ? "Light" : "Dark"}
    </button>
  );
}
```

- [ ] **Step 6: Run to verify it passes**

Run: `npm test` → Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add -A && git commit -m "feat: Editorial/Noir theme tokens, fonts, and dark-mode toggle"
```

---

### Task 4: Constants and domain types

**Files:**
- Create: `lib/constants.ts`, `lib/types.ts`

- [ ] **Step 1: Create `lib/constants.ts`**

```ts
export const CITIES = [
  "Tel Aviv", "Jerusalem", "Haifa", "Ramat Gan", "Givatayim", "Herzliya",
  "Beer Sheva", "Rishon LeZion", "Petah Tikva", "Netanya", "Rehovot", "Raanana",
] as const;

export const INTERESTS = [
  "Music", "Concerts", "Cooking", "Fitness", "Yoga", "Running", "Hiking",
  "Travel", "Gaming", "Movies & TV", "Reading", "Art", "Photography", "Tech",
  "Football", "Basketball", "Board games", "Nightlife", "Vegan food", "Volunteering",
] as const;

export const MIN_INTERESTS = 3;
export const MAX_INTERESTS = 10;
export const MAX_LISTING_PHOTOS = 5;
export const MAX_IMAGE_BYTES = 5 * 1024 * 1024; // 5 MB

export const FEATURES = [
  { key: "balcony", label: "Balcony" },
  { key: "air_conditioning", label: "Air conditioning" },
  { key: "parking", label: "Parking" },
  { key: "elevator", label: "Elevator" },
  { key: "furnished", label: "Furnished" },
] as const;
```

- [ ] **Step 2: Create `lib/types.ts`** (mirrors the SQL schema in Task 6 — keep the two in sync)

```ts
export type SleepSchedule = "early" | "late" | "flexible";
export type GuestsFreq = "rare" | "sometimes" | "often";
export type SwipeDirection = "like" | "skip";
export type ListerResponse = "pending" | "liked" | "skipped";

export interface Profile {
  user_id: string;
  full_name: string;
  age: number;
  occupation: string;
  bio: string;
  avatar_url: string | null;
  smoker: boolean;
  has_pet: boolean;
  cleanliness: number; // 1..5
  sleep_schedule: SleepSchedule;
  guests_freq: GuestsFreq;
  interests: string[];
  ok_with_smoker: boolean;
  ok_with_pets: boolean;
  budget_min: number;
  budget_max: number; // 0 = not set
  preferred_cities: string[];
  earliest_move_in: string | null; // ISO date
  created_at: string;
  updated_at: string;
}

export interface Listing {
  id: string;
  owner_id: string;
  title: string;
  description: string;
  city: string;
  neighborhood: string;
  rent: number;
  available_from: string; // ISO date
  roommates_count: number;
  pets_allowed: boolean;
  smoking_allowed: boolean;
  balcony: boolean;
  air_conditioning: boolean;
  parking: boolean;
  elevator: boolean;
  furnished: boolean;
  photo_urls: string[];
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export type ListingWithOwner = Listing & { owner: Profile };

export interface Swipe {
  id: string;
  seeker_id: string;
  listing_id: string;
  direction: SwipeDirection;
  lister_response: ListerResponse;
  created_at: string;
}

export interface Match {
  id: string;
  listing_id: string;
  seeker_id: string;
  lister_id: string;
  created_at: string;
}

export interface Message {
  id: string;
  match_id: string;
  sender_id: string;
  content: string;
  created_at: string;
}
```

- [ ] **Step 3: Verify it compiles**

Run: `npx tsc --noEmit` → Expected: no errors.

- [ ] **Step 4: Commit**

```bash
git add lib && git commit -m "feat: domain types and app constants"
```

---

### Task 5: Supabase project, env vars, and clients

**Files:**
- Create: `lib/supabase/server.ts`, `lib/supabase/client.ts`, `lib/supabase/middleware.ts`, `middleware.ts`, `.env.local` (not committed), `.env.example`

- [ ] **Step 1: Create the Supabase project (manual, one-time)**

In https://supabase.com/dashboard → New project → name `roommatch`, region close to Israel (eu-central), generate a strong DB password and save it. From **Project Settings → API** copy: Project URL, `anon` public key, `service_role` key.

- [ ] **Step 2: Install client libraries**

```bash
npm i @supabase/supabase-js @supabase/ssr
```

- [ ] **Step 3: Create `.env.local`** (gitignored) **and `.env.example`** (committed)

`.env.local`:
```
NEXT_PUBLIC_SUPABASE_URL=https://YOUR-PROJECT.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=YOUR-ANON-KEY
SUPABASE_SERVICE_ROLE_KEY=YOUR-SERVICE-ROLE-KEY
```

`.env.example` (same three keys, placeholder values, plus one comment line each: URL and anon key are public and RLS-protected; service key is server-only, used by the seed script).

- [ ] **Step 4: Create `lib/supabase/server.ts`**

```ts
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

export async function createClient() {
  const cookieStore = await cookies();
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll: () => cookieStore.getAll(),
        setAll: (cookiesToSet) => {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            );
          } catch {
            // called from a Server Component — middleware refreshes sessions instead
          }
        },
      },
    }
  );
}
```

- [ ] **Step 5: Create `lib/supabase/client.ts`**

```ts
import { createBrowserClient } from "@supabase/ssr";

export function createClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );
}
```

- [ ] **Step 6: Create `lib/supabase/middleware.ts`**

```ts
import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

const PROTECTED_PREFIXES = ["/swipe", "/matches", "/listing", "/profile"];

export async function updateSession(request: NextRequest) {
  let response = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll: () => request.cookies.getAll(),
        setAll: (cookiesToSet) => {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
          response = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, options)
          );
        },
      },
    }
  );

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const path = request.nextUrl.pathname;
  const needsAuth = PROTECTED_PREFIXES.some((p) => path === p || path.startsWith(p + "/"));
  if (needsAuth && !user) {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    url.searchParams.set("next", path);
    return NextResponse.redirect(url);
  }
  return response;
}
```

- [ ] **Step 7: Create root `middleware.ts`**

```ts
import { type NextRequest } from "next/server";
import { updateSession } from "@/lib/supabase/middleware";

export async function middleware(request: NextRequest) {
  return await updateSession(request);
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)"],
};
```

- [ ] **Step 8: Verify**

Run: `npx tsc --noEmit` (no errors), then `npm run dev` and open http://localhost:3000/swipe → Expected: redirect to `/login` (404 page for now — the route comes in Task 9; the *redirect* is what you're verifying).

- [ ] **Step 9: Commit**

```bash
git add -A && git commit -m "feat: Supabase clients, session middleware, route protection"
```

---

### Task 6: Database migration — schema, RLS, match function, storage, realtime

**Files:**
- Create: `supabase/migrations/0001_init.sql`

- [ ] **Step 1: Create `supabase/migrations/0001_init.sql`** with exactly:

```sql
-- ===== enums =====
create type sleep_schedule as enum ('early','late','flexible');
create type guests_freq as enum ('rare','sometimes','often');
create type swipe_direction as enum ('like','skip');
create type lister_response as enum ('pending','liked','skipped');

-- ===== profiles =====
create table public.profiles (
  user_id uuid primary key references auth.users(id) on delete cascade,
  full_name text not null check (char_length(full_name) between 2 and 60),
  age int not null check (age between 18 and 120),
  occupation text not null default '',
  bio text not null default '' check (char_length(bio) <= 500),
  avatar_url text,
  smoker boolean not null default false,
  has_pet boolean not null default false,
  cleanliness int not null default 3 check (cleanliness between 1 and 5),
  sleep_schedule sleep_schedule not null default 'flexible',
  guests_freq guests_freq not null default 'sometimes',
  interests text[] not null default '{}',
  ok_with_smoker boolean not null default true,
  ok_with_pets boolean not null default true,
  budget_min int not null default 0 check (budget_min >= 0),
  budget_max int not null default 0 check (budget_max >= 0),
  preferred_cities text[] not null default '{}',
  earliest_move_in date,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (budget_max = 0 or budget_max >= budget_min)
);

-- ===== listings =====
create table public.listings (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references public.profiles(user_id) on delete cascade,
  title text not null check (char_length(title) between 5 and 80),
  description text not null default '' check (char_length(description) <= 2000),
  city text not null,
  neighborhood text not null default '',
  rent int not null check (rent > 0),
  available_from date not null,
  roommates_count int not null check (roommates_count between 0 and 10),
  pets_allowed boolean not null default false,
  smoking_allowed boolean not null default false,
  balcony boolean not null default false,
  air_conditioning boolean not null default false,
  parking boolean not null default false,
  elevator boolean not null default false,
  furnished boolean not null default false,
  photo_urls text[] not null default '{}' check (array_length(photo_urls, 1) is null or array_length(photo_urls, 1) <= 5),
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
-- one ACTIVE listing per user (v1 rule)
create unique index one_active_listing_per_owner on public.listings (owner_id) where is_active;
create index listings_browse_idx on public.listings (city, rent, available_from) where is_active;

-- ===== swipes =====
create table public.swipes (
  id uuid primary key default gen_random_uuid(),
  seeker_id uuid not null references public.profiles(user_id) on delete cascade,
  listing_id uuid not null references public.listings(id) on delete cascade,
  direction swipe_direction not null,
  lister_response lister_response not null default 'pending',
  created_at timestamptz not null default now(),
  unique (seeker_id, listing_id)
);
create index swipes_likes_by_listing_idx on public.swipes (listing_id) where direction = 'like';
create index swipes_by_seeker_idx on public.swipes (seeker_id);

-- ===== matches =====
create table public.matches (
  id uuid primary key default gen_random_uuid(),
  listing_id uuid not null references public.listings(id) on delete cascade,
  seeker_id uuid not null references public.profiles(user_id) on delete cascade,
  lister_id uuid not null references public.profiles(user_id) on delete cascade,
  created_at timestamptz not null default now(),
  unique (listing_id, seeker_id)
);
create index matches_by_seeker_idx on public.matches (seeker_id);
create index matches_by_lister_idx on public.matches (lister_id);

-- ===== messages =====
create table public.messages (
  id uuid primary key default gen_random_uuid(),
  match_id uuid not null references public.matches(id) on delete cascade,
  sender_id uuid not null references public.profiles(user_id) on delete cascade,
  content text not null check (char_length(content) between 1 and 2000),
  created_at timestamptz not null default now()
);
create index messages_by_match_idx on public.messages (match_id, created_at);

-- ===== RLS =====
alter table public.profiles enable row level security;
alter table public.listings enable row level security;
alter table public.swipes enable row level security;
alter table public.matches enable row level security;
alter table public.messages enable row level security;

-- profiles: readable by signed-in users; writable only by the owner
create policy "profiles are readable by authenticated users"
  on public.profiles for select to authenticated using (true);
create policy "users insert their own profile"
  on public.profiles for insert to authenticated with check (user_id = auth.uid());
create policy "users update their own profile"
  on public.profiles for update to authenticated using (user_id = auth.uid());

-- listings: PUBLIC read of active listings (approved rule); owner manages own
create policy "active listings are public"
  on public.listings for select to anon, authenticated
  using (is_active or owner_id = auth.uid());
create policy "owners insert their own listing"
  on public.listings for insert to authenticated with check (owner_id = auth.uid());
create policy "owners update their own listing"
  on public.listings for update to authenticated using (owner_id = auth.uid());
create policy "owners delete their own listing"
  on public.listings for delete to authenticated using (owner_id = auth.uid());

-- swipes: seeker creates own; visible to seeker and to the listing's owner.
-- No UPDATE policy: lister_response changes ONLY via respond_to_interest().
create policy "seekers insert their own swipes"
  on public.swipes for insert to authenticated with check (seeker_id = auth.uid());
create policy "swipes visible to seeker and listing owner"
  on public.swipes for select to authenticated
  using (
    seeker_id = auth.uid()
    or exists (select 1 from public.listings l where l.id = listing_id and l.owner_id = auth.uid())
  );

-- matches: participants read; NOBODY inserts directly (only the function below)
create policy "participants read their matches"
  on public.matches for select to authenticated
  using (seeker_id = auth.uid() or lister_id = auth.uid());

-- messages: participants of the match read and write as themselves
create policy "participants read match messages"
  on public.messages for select to authenticated
  using (exists (
    select 1 from public.matches m
    where m.id = match_id and (m.seeker_id = auth.uid() or m.lister_id = auth.uid())
  ));
create policy "participants send messages as themselves"
  on public.messages for insert to authenticated
  with check (
    sender_id = auth.uid()
    and exists (
      select 1 from public.matches m
      where m.id = match_id and (m.seeker_id = auth.uid() or m.lister_id = auth.uid())
    )
  );

-- ===== match creation: single transaction, server-authoritative =====
create or replace function public.respond_to_interest(p_swipe_id uuid, p_response lister_response)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_swipe swipes%rowtype;
  v_listing listings%rowtype;
  v_match_id uuid;
begin
  if p_response not in ('liked','skipped') then
    raise exception 'response must be liked or skipped';
  end if;

  select * into v_swipe from swipes where id = p_swipe_id;
  if not found then raise exception 'swipe not found'; end if;

  select * into v_listing from listings where id = v_swipe.listing_id;
  if v_listing.owner_id is distinct from auth.uid() then
    raise exception 'only the listing owner may respond';
  end if;
  if v_swipe.direction <> 'like' then
    raise exception 'can only respond to likes';
  end if;

  update swipes set lister_response = p_response where id = p_swipe_id;

  if p_response = 'liked' then
    insert into matches (listing_id, seeker_id, lister_id)
    values (v_listing.id, v_swipe.seeker_id, v_listing.owner_id)
    on conflict (listing_id, seeker_id) do nothing;
    select id into v_match_id from matches
      where listing_id = v_listing.id and seeker_id = v_swipe.seeker_id;
  end if;

  return v_match_id;
end;
$$;
revoke all on function public.respond_to_interest from public;
grant execute on function public.respond_to_interest to authenticated;

-- ===== storage buckets & policies =====
insert into storage.buckets (id, name, public) values ('avatars', 'avatars', true);
insert into storage.buckets (id, name, public) values ('listing-photos', 'listing-photos', true);

create policy "users upload to their own avatar folder"
  on storage.objects for insert to authenticated
  with check (bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text);
create policy "users replace their own avatars"
  on storage.objects for update to authenticated
  using (bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text);
create policy "users delete their own avatars"
  on storage.objects for delete to authenticated
  using (bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text);
create policy "users upload to their own listing-photos folder"
  on storage.objects for insert to authenticated
  with check (bucket_id = 'listing-photos' and (storage.foldername(name))[1] = auth.uid()::text);
create policy "users delete their own listing photos"
  on storage.objects for delete to authenticated
  using (bucket_id = 'listing-photos' and (storage.foldername(name))[1] = auth.uid()::text);

-- ===== realtime for chat =====
alter publication supabase_realtime add table public.messages;
```

- [ ] **Step 2: Apply the migration**

Supabase dashboard → SQL Editor → paste the entire file → Run. Expected: “Success. No rows returned”.

- [ ] **Step 3: Verify RLS from the dashboard**

Table Editor → confirm all 5 tables exist and each shows “RLS enabled”. SQL Editor sanity check:

```sql
select count(*) from public.listings;  -- runs as service role: expect 0, no error
```

- [ ] **Step 4: Commit**

```bash
git add supabase && git commit -m "feat: database schema, RLS policies, match function, storage, realtime"
```

---

### Task 7: Validation schemas (TDD)

**Files:**
- Create: `lib/validation/profile.ts`, `lib/validation/listing.ts`, `lib/validation/message.ts`, `lib/validation/filters.ts`
- Test: `tests/unit/validation.test.ts`

- [ ] **Step 1: Install zod**

```bash
npm i zod
```

- [ ] **Step 2: Write the failing tests** — `tests/unit/validation.test.ts`

```ts
import { describe, expect, test } from "vitest";
import { profileSchema } from "@/lib/validation/profile";
import { listingSchema } from "@/lib/validation/listing";
import { messageSchema } from "@/lib/validation/message";
import { listingFiltersSchema } from "@/lib/validation/filters";

const validProfile = {
  full_name: "Dana Levi", age: 26, occupation: "Student", bio: "Hi!",
  smoker: false, has_pet: false, cleanliness: 4,
  sleep_schedule: "early", guests_freq: "sometimes",
  interests: ["Music", "Cooking", "Travel"],
  ok_with_smoker: false, ok_with_pets: true,
  budget_min: 2000, budget_max: 3500,
  preferred_cities: ["Tel Aviv"], earliest_move_in: "2026-10-01",
};

describe("profileSchema", () => {
  test("accepts a valid profile", () => {
    expect(profileSchema.safeParse(validProfile).success).toBe(true);
  });
  test("rejects age under 18", () => {
    expect(profileSchema.safeParse({ ...validProfile, age: 17 }).success).toBe(false);
  });
  test("rejects fewer than 3 interests", () => {
    expect(profileSchema.safeParse({ ...validProfile, interests: ["Music"] }).success).toBe(false);
  });
  test("rejects unknown interest tags", () => {
    expect(profileSchema.safeParse({ ...validProfile, interests: ["Music", "Cooking", "Zzz"] }).success).toBe(false);
  });
  test("rejects budget_max below budget_min", () => {
    expect(profileSchema.safeParse({ ...validProfile, budget_min: 4000, budget_max: 3000 }).success).toBe(false);
  });
});

describe("listingSchema", () => {
  const validListing = {
    title: "Sunlit room in Florentin", description: "Great flat", city: "Tel Aviv",
    neighborhood: "Florentin", rent: 2800, available_from: "2026-10-01",
    roommates_count: 2, pets_allowed: true, smoking_allowed: false,
    balcony: true, air_conditioning: true, parking: false, elevator: false, furnished: true,
  };
  test("accepts a valid listing", () => {
    expect(listingSchema.safeParse(validListing).success).toBe(true);
  });
  test("rejects rent of 0", () => {
    expect(listingSchema.safeParse({ ...validListing, rent: 0 }).success).toBe(false);
  });
  test("rejects a city outside the list", () => {
    expect(listingSchema.safeParse({ ...validListing, city: "Paris" }).success).toBe(false);
  });
  test("rejects a 3-character title", () => {
    expect(listingSchema.safeParse({ ...validListing, title: "abc" }).success).toBe(false);
  });
});

describe("messageSchema", () => {
  test("accepts a normal message and trims it", () => {
    const r = messageSchema.safeParse({ content: "  hey there  " });
    expect(r.success).toBe(true);
    if (r.success) expect(r.data.content).toBe("hey there");
  });
  test("rejects empty and over-long content", () => {
    expect(messageSchema.safeParse({ content: "   " }).success).toBe(false);
    expect(messageSchema.safeParse({ content: "x".repeat(2001) }).success).toBe(false);
  });
});

describe("listingFiltersSchema", () => {
  test("parses url-style strings and fills defaults", () => {
    const r = listingFiltersSchema.parse({ city: "Haifa", rent_max: "3000", page: "2" });
    expect(r).toMatchObject({ city: "Haifa", rent_max: 3000, page: 2, page_size: 20 });
  });
  test("clamps nonsense to safe defaults", () => {
    const r = listingFiltersSchema.parse({ page: "-5", page_size: "9999", rent_max: "banana" });
    expect(r.page).toBe(1);
    expect(r.page_size).toBe(20);
    expect(r.rent_max).toBeUndefined();
  });
});
```

- [ ] **Step 3: Run to verify failure** — `npm test` → Expected: FAIL (modules not found).

- [ ] **Step 4: Create `lib/validation/profile.ts`**

```ts
import { z } from "zod";
import { CITIES, INTERESTS, MAX_INTERESTS, MIN_INTERESTS } from "@/lib/constants";

export const profileSchema = z
  .object({
    full_name: z.string().trim().min(2).max(60),
    age: z.coerce.number().int().min(18).max(120),
    occupation: z.string().trim().max(80).default(""),
    bio: z.string().trim().max(500).default(""),
    smoker: z.coerce.boolean().default(false),
    has_pet: z.coerce.boolean().default(false),
    cleanliness: z.coerce.number().int().min(1).max(5),
    sleep_schedule: z.enum(["early", "late", "flexible"]),
    guests_freq: z.enum(["rare", "sometimes", "often"]),
    interests: z.array(z.enum(INTERESTS)).min(MIN_INTERESTS).max(MAX_INTERESTS),
    ok_with_smoker: z.coerce.boolean().default(false),
    ok_with_pets: z.coerce.boolean().default(false),
    budget_min: z.coerce.number().int().min(0).default(0),
    budget_max: z.coerce.number().int().min(0).default(0),
    preferred_cities: z.array(z.enum(CITIES)).default([]),
    earliest_move_in: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullable().default(null),
  })
  .refine((p) => p.budget_max === 0 || p.budget_max >= p.budget_min, {
    message: "Max budget must be at least the min budget",
    path: ["budget_max"],
  });

export type ProfileInput = z.infer<typeof profileSchema>;
```

- [ ] **Step 5: Create `lib/validation/listing.ts`**

```ts
import { z } from "zod";
import { CITIES } from "@/lib/constants";

export const listingSchema = z.object({
  title: z.string().trim().min(5).max(80),
  description: z.string().trim().max(2000).default(""),
  city: z.enum(CITIES),
  neighborhood: z.string().trim().max(80).default(""),
  rent: z.coerce.number().int().positive(),
  available_from: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  roommates_count: z.coerce.number().int().min(0).max(10),
  pets_allowed: z.coerce.boolean().default(false),
  smoking_allowed: z.coerce.boolean().default(false),
  balcony: z.coerce.boolean().default(false),
  air_conditioning: z.coerce.boolean().default(false),
  parking: z.coerce.boolean().default(false),
  elevator: z.coerce.boolean().default(false),
  furnished: z.coerce.boolean().default(false),
});

export type ListingInput = z.infer<typeof listingSchema>;
```

- [ ] **Step 6: Create `lib/validation/message.ts`**

```ts
import { z } from "zod";

export const messageSchema = z.object({
  content: z.string().trim().min(1).max(2000),
});
```

- [ ] **Step 7: Create `lib/validation/filters.ts`**

```ts
import { z } from "zod";
import { CITIES } from "@/lib/constants";

const optionalInt = z.preprocess((v) => {
  if (v === undefined || v === null || v === "") return undefined;
  const n = Number(v);
  return Number.isFinite(n) ? Math.trunc(n) : undefined;
}, z.number().int().min(0).optional());

const optionalBool = z.preprocess(
  (v) => (v === "true" || v === true ? true : v === "false" || v === false ? false : undefined),
  z.boolean().optional()
);

export const listingFiltersSchema = z.object({
  city: z.enum(CITIES).optional().catch(undefined),
  rent_min: optionalInt.catch(undefined),
  rent_max: optionalInt.catch(undefined),
  move_in_by: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional().catch(undefined),
  roommates_max: optionalInt.catch(undefined),
  pets_allowed: optionalBool.catch(undefined),
  smoking_allowed: optionalBool.catch(undefined),
  balcony: optionalBool.catch(undefined),
  air_conditioning: optionalBool.catch(undefined),
  parking: optionalBool.catch(undefined),
  elevator: optionalBool.catch(undefined),
  furnished: optionalBool.catch(undefined),
  page: z.preprocess((v) => Math.max(1, Number(v) || 1), z.number().int().min(1)).default(1),
  page_size: z.preprocess((v) => {
    const n = Number(v) || 20;
    return n < 1 || n > 50 ? 20 : Math.trunc(n);
  }, z.number().int()).default(20),
});

export type ListingFilters = z.infer<typeof listingFiltersSchema>;
```

- [ ] **Step 8: Run to verify pass** — `npm test` → Expected: all validation tests PASS.

- [ ] **Step 9: Commit**

```bash
git add -A && git commit -m "feat: zod validation schemas for profile, listing, message, filters"
```

---

### Task 8: Compatibility engines — Lifestyle + Social (TDD)

**Files:**
- Create: `lib/compatibility.ts`
- Test: `tests/unit/compatibility.test.ts`

Scoring rules (from spec §5 — implement exactly):

- **Lifestyle (0–100)**, weighted: budget 25 · city 20 · move-in 15 · smoking 10 · pets 10 · cleanliness 10 · sleep 5 · guests 5.
  - Budget: `budget_max === 0` (unset) → 15 (neutral); `rent <= budget_max` → 25; `rent <= budget_max * 1.1` → 12; else 0.
  - City: no preferred cities → 12 (neutral); listing city in preferences → 20; else 0.
  - Move-in: seeker has no date → 9 (neutral); |available_from − earliest_move_in| ≤ 14 days → 15; ≤ 45 days → 8; else 0.
  - Smoking: 0 if the seeker smokes and the listing forbids smoking, or if the *perspective holder* isn't ok with a smoking counterpart who smokes; else 10.
  - Pets: same shape as smoking with `has_pet` / `pets_allowed` / `ok_with_pets`.
  - Cleanliness: `max(0, 10 − 2.5 × |seeker − lister|)`.
  - Sleep: equal → 5; either is `flexible` → 3; else 0.
  - Guests: equal → 5; adjacent (rare↔sometimes, sometimes↔often) → 2.5; else 0.
  - `perspective: "seeker"` uses the seeker's `ok_with_*` against the lister's habits; `"lister"` uses the lister's `ok_with_*` against the seeker's habits. Result is rounded.
- **Social (0–100 | null)**: `null` if either side has no interests; else `round(100 × |shared| / min(|a|, |b|))`.
- **Labels**: ≥80 Great fit · ≥60 Good · ≥40 Fair · else Low.
- **sortKey**: social null → lifestyle; else mean of the two. **Scores never filter — they only sort.**

- [ ] **Step 1: Write the failing tests** — `tests/unit/compatibility.test.ts`

```ts
import { describe, expect, test } from "vitest";
import { lifestyleScore, socialScore, scoreLabel, sortKey } from "@/lib/compatibility";
import type { Listing, Profile } from "@/lib/types";

function profile(overrides: Partial<Profile> = {}): Profile {
  return {
    user_id: "u1", full_name: "Test User", age: 25, occupation: "", bio: "",
    avatar_url: null, smoker: false, has_pet: false, cleanliness: 3,
    sleep_schedule: "flexible", guests_freq: "sometimes",
    interests: ["Music", "Cooking", "Travel"],
    ok_with_smoker: true, ok_with_pets: true,
    budget_min: 0, budget_max: 3000, preferred_cities: ["Tel Aviv"],
    earliest_move_in: "2026-10-01", created_at: "", updated_at: "",
    ...overrides,
  };
}

function listing(overrides: Partial<Listing> = {}): Listing {
  return {
    id: "l1", owner_id: "u2", title: "Sunlit room in Florentin", description: "",
    city: "Tel Aviv", neighborhood: "Florentin", rent: 2800,
    available_from: "2026-10-01", roommates_count: 2,
    pets_allowed: true, smoking_allowed: false,
    balcony: false, air_conditioning: false, parking: false, elevator: false, furnished: false,
    photo_urls: [], is_active: true, created_at: "", updated_at: "",
    ...overrides,
  };
}

describe("lifestyleScore", () => {
  test("perfect practical fit scores 100", () => {
    const seeker = profile({ cleanliness: 4, sleep_schedule: "early", guests_freq: "rare" });
    const lister = profile({ user_id: "u2", cleanliness: 4, sleep_schedule: "early", guests_freq: "rare" });
    expect(lifestyleScore(seeker, listing(), lister, "seeker")).toBe(100);
  });

  test("rent 10% over budget gets partial budget credit", () => {
    const inBudget = lifestyleScore(profile(), listing({ rent: 3000 }), profile({ user_id: "u2" }), "seeker");
    const nearBudget = lifestyleScore(profile(), listing({ rent: 3200 }), profile({ user_id: "u2" }), "seeker");
    const farOver = lifestyleScore(profile(), listing({ rent: 4000 }), profile({ user_id: "u2" }), "seeker");
    expect(inBudget - nearBudget).toBe(13); // 25 -> 12
    expect(nearBudget - farOver).toBe(12); // 12 -> 0
  });

  test("unset budget is neutral, not zero", () => {
    const noBudget = profile({ budget_max: 0 });
    const s = lifestyleScore(noBudget, listing({ rent: 99999 }), profile({ user_id: "u2" }), "seeker");
    expect(s).toBeGreaterThan(0);
  });

  test("smoker seeker vs no-smoking listing loses exactly the smoking weight", () => {
    const smoker = profile({ smoker: true });
    const base = lifestyleScore(profile(), listing(), profile({ user_id: "u2" }), "seeker");
    const s = lifestyleScore(smoker, listing({ smoking_allowed: false }), profile({ user_id: "u2" }), "seeker");
    expect(base - s).toBe(10);
  });

  test("is directional: lister who rejects pets scores a pet-owner seeker lower", () => {
    const seekerWithPet = profile({ has_pet: true });
    const strictLister = profile({ user_id: "u2", ok_with_pets: false });
    const seekerView = lifestyleScore(seekerWithPet, listing({ pets_allowed: true }), strictLister, "seeker");
    const listerView = lifestyleScore(seekerWithPet, listing({ pets_allowed: true }), strictLister, "lister");
    expect(listerView).toBeLessThan(seekerView);
  });

  test("move-in 30 days apart gets partial date credit", () => {
    const s14 = lifestyleScore(profile({ earliest_move_in: "2026-10-01" }), listing({ available_from: "2026-10-10" }), profile({ user_id: "u2" }), "seeker");
    const s30 = lifestyleScore(profile({ earliest_move_in: "2026-10-01" }), listing({ available_from: "2026-10-31" }), profile({ user_id: "u2" }), "seeker");
    const s90 = lifestyleScore(profile({ earliest_move_in: "2026-10-01" }), listing({ available_from: "2026-12-30" }), profile({ user_id: "u2" }), "seeker");
    expect(s14).toBeGreaterThan(s30);
    expect(s30).toBeGreaterThan(s90);
  });
});

describe("socialScore", () => {
  test("full containment of the smaller set scores 100", () => {
    const a = profile({ interests: ["Music", "Cooking", "Travel"] });
    const b = profile({ interests: ["Music", "Cooking", "Travel", "Gaming", "Hiking"] });
    expect(socialScore(a, b)).toBe(100);
  });
  test("partial overlap", () => {
    const a = profile({ interests: ["Music", "Cooking", "Travel", "Art"] });
    const b = profile({ interests: ["Music", "Gaming", "Hiking", "Tech"] });
    expect(socialScore(a, b)).toBe(25); // 1 shared / min(4,4)
  });
  test("no interests on either side -> null, never 0", () => {
    expect(socialScore(profile({ interests: [] }), profile())).toBeNull();
    expect(socialScore(profile(), profile({ interests: [] }))).toBeNull();
  });
  test("is symmetric", () => {
    const a = profile({ interests: ["Music", "Cooking", "Art"] });
    const b = profile({ interests: ["Art", "Tech", "Gaming", "Music"] });
    expect(socialScore(a, b)).toBe(socialScore(b, a));
  });
});

describe("labels and sorting", () => {
  test("label thresholds", () => {
    expect(scoreLabel(80)).toBe("Great fit");
    expect(scoreLabel(79)).toBe("Good");
    expect(scoreLabel(60)).toBe("Good");
    expect(scoreLabel(59)).toBe("Fair");
    expect(scoreLabel(40)).toBe("Fair");
    expect(scoreLabel(39)).toBe("Low");
  });
  test("sortKey averages when social exists, falls back to lifestyle when null", () => {
    expect(sortKey(80, 60)).toBe(70);
    expect(sortKey(80, null)).toBe(80);
  });
});
```

- [ ] **Step 2: Run to verify failure** — `npm test` → Expected: FAIL (`lib/compatibility` not found).

- [ ] **Step 3: Create `lib/compatibility.ts`**

```ts
import type { GuestsFreq, Listing, Profile } from "@/lib/types";

export type Perspective = "seeker" | "lister";

const DAY_MS = 24 * 60 * 60 * 1000;
const GUEST_ORDER: Record<GuestsFreq, number> = { rare: 0, sometimes: 1, often: 2 };

function budgetPoints(seeker: Profile, listing: Listing): number {
  if (seeker.budget_max === 0) return 15; // no budget set: neutral
  if (listing.rent <= seeker.budget_max) return 25;
  if (listing.rent <= seeker.budget_max * 1.1) return 12;
  return 0;
}

function cityPoints(seeker: Profile, listing: Listing): number {
  if (seeker.preferred_cities.length === 0) return 12; // no preference: neutral
  return seeker.preferred_cities.includes(listing.city) ? 20 : 0;
}

function moveInPoints(seeker: Profile, listing: Listing): number {
  if (!seeker.earliest_move_in) return 9; // no date set: neutral
  const diffDays =
    Math.abs(Date.parse(listing.available_from) - Date.parse(seeker.earliest_move_in)) / DAY_MS;
  if (diffDays <= 14) return 15;
  if (diffDays <= 45) return 8;
  return 0;
}

function smokingPoints(seeker: Profile, listing: Listing, lister: Profile, p: Perspective): number {
  if (seeker.smoker && !listing.smoking_allowed) return 0;
  const holder = p === "seeker" ? seeker : lister;
  const other = p === "seeker" ? lister : seeker;
  if (other.smoker && !holder.ok_with_smoker) return 0;
  return 10;
}

function petPoints(seeker: Profile, listing: Listing, lister: Profile, p: Perspective): number {
  if (seeker.has_pet && !listing.pets_allowed) return 0;
  const holder = p === "seeker" ? seeker : lister;
  const other = p === "seeker" ? lister : seeker;
  if (other.has_pet && !holder.ok_with_pets) return 0;
  return 10;
}

function cleanlinessPoints(seeker: Profile, lister: Profile): number {
  return Math.max(0, 10 - 2.5 * Math.abs(seeker.cleanliness - lister.cleanliness));
}

function sleepPoints(seeker: Profile, lister: Profile): number {
  if (seeker.sleep_schedule === lister.sleep_schedule) return 5;
  if (seeker.sleep_schedule === "flexible" || lister.sleep_schedule === "flexible") return 3;
  return 0;
}

function guestPoints(seeker: Profile, lister: Profile): number {
  const diff = Math.abs(GUEST_ORDER[seeker.guests_freq] - GUEST_ORDER[lister.guests_freq]);
  if (diff === 0) return 5;
  if (diff === 1) return 2.5;
  return 0;
}

/**
 * Lifestyle compatibility 0–100. Directional: pass the perspective of the
 * person LOOKING (seeker viewing a listing, or lister viewing a seeker).
 * Scores NEVER filter — they only inform and sort (spec rule 6).
 */
export function lifestyleScore(
  seeker: Profile,
  listing: Listing,
  lister: Profile,
  perspective: Perspective
): number {
  return Math.round(
    budgetPoints(seeker, listing) +
      cityPoints(seeker, listing) +
      moveInPoints(seeker, listing) +
      smokingPoints(seeker, listing, lister, perspective) +
      petPoints(seeker, listing, lister, perspective) +
      cleanlinessPoints(seeker, lister) +
      sleepPoints(seeker, lister) +
      guestPoints(seeker, lister)
  );
}

/** Social compatibility 0–100 from shared interests; null when either side has none. */
export function socialScore(a: Profile, b: Profile): number | null {
  if (a.interests.length === 0 || b.interests.length === 0) return null;
  const setB = new Set(b.interests);
  const shared = a.interests.filter((i) => setB.has(i)).length;
  return Math.round((100 * shared) / Math.min(a.interests.length, b.interests.length));
}

export function scoreLabel(score: number): "Great fit" | "Good" | "Fair" | "Low" {
  if (score >= 80) return "Great fit";
  if (score >= 60) return "Good";
  if (score >= 40) return "Fair";
  return "Low";
}

/** Deck/queue ordering key. Sorting only — never used to exclude anyone. */
export function sortKey(lifestyle: number, social: number | null): number {
  return social === null ? lifestyle : (lifestyle + social) / 2;
}
```

- [ ] **Step 4: Run to verify pass** — `npm test` → Expected: all compatibility tests PASS.

- [ ] **Step 5: Commit**

```bash
git add -A && git commit -m "feat: lifestyle and social compatibility engines with full unit coverage"
```

---

### Task 9: Auth — signup, login, logout

**Files:**
- Create: `app/actions/auth.ts`, `app/(auth)/login/page.tsx`, `app/(auth)/signup/page.tsx`, `components/auth/AuthForm.tsx`, `lib/auth.ts`

- [ ] **Step 1: Create `app/actions/auth.ts`**

```ts
"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

export type AuthState = { error?: string };

const emailOk = (e: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e);

export async function signUpAction(_prev: AuthState, formData: FormData): Promise<AuthState> {
  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  const password = String(formData.get("password") ?? "");
  if (!emailOk(email)) return { error: "Please enter a valid email address." };
  if (password.length < 8) return { error: "Password must be at least 8 characters." };

  const supabase = await createClient();
  const { error } = await supabase.auth.signUp({ email, password });
  if (error) return { error: "Could not create the account. Try a different email." };
  redirect("/profile?onboarding=1");
}

export async function signInAction(_prev: AuthState, formData: FormData): Promise<AuthState> {
  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  const password = String(formData.get("password") ?? "");
  const next = String(formData.get("next") ?? "") || "/swipe";
  if (!emailOk(email) || password.length === 0) return { error: "Email and password are required." };

  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) return { error: "Wrong email or password." };
  redirect(next.startsWith("/") ? next : "/swipe");
}

export async function signOutAction(): Promise<void> {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect("/");
}
```

Note: in the Supabase dashboard → Authentication → Providers → Email, **disable "Confirm email"** for this project so signup works without an email server (documented as a known v1 limitation in the security doc).

- [ ] **Step 2: Create `components/auth/AuthForm.tsx`**

```tsx
"use client";

import { useActionState } from "react";
import Link from "next/link";
import type { AuthState } from "@/app/actions/auth";

export function AuthForm({
  mode,
  action,
  next,
}: {
  mode: "login" | "signup";
  action: (prev: AuthState, formData: FormData) => Promise<AuthState>;
  next?: string;
}) {
  const [state, formAction, pending] = useActionState(action, {});

  return (
    <form action={formAction} className="mx-auto mt-16 w-full max-w-sm px-6">
      <h1 className="font-serif text-3xl font-semibold">
        {mode === "login" ? "Welcome back" : "Create your account"}
      </h1>
      <p className="mt-1 text-sm text-muted">
        {mode === "login" ? "Log in to keep swiping." : "Takes less than a minute."}
      </p>

      {next ? <input type="hidden" name="next" value={next} /> : null}

      <label className="mt-6 block text-xs font-medium uppercase tracking-widest text-muted">
        Email
        <input
          name="email" type="email" required autoComplete="email"
          className="mt-1 w-full rounded-xl border border-hairline bg-surface px-3 py-2.5 text-sm text-ink outline-none focus:border-accent"
        />
      </label>
      <label className="mt-4 block text-xs font-medium uppercase tracking-widest text-muted">
        Password
        <input
          name="password" type="password" required minLength={8}
          autoComplete={mode === "login" ? "current-password" : "new-password"}
          className="mt-1 w-full rounded-xl border border-hairline bg-surface px-3 py-2.5 text-sm text-ink outline-none focus:border-accent"
        />
      </label>

      {state.error ? (
        <p role="alert" className="mt-3 text-sm text-red-600">{state.error}</p>
      ) : null}

      <button
        type="submit" disabled={pending}
        className="mt-6 w-full rounded-xl bg-accent py-2.5 text-sm font-semibold text-accent-contrast disabled:opacity-60"
      >
        {pending ? "One moment…" : mode === "login" ? "Log in" : "Sign up"}
      </button>

      <p className="mt-4 text-sm text-muted">
        {mode === "login" ? (
          <>New here? <Link href="/signup" className="text-accent underline">Create an account</Link></>
        ) : (
          <>Already have an account? <Link href="/login" className="text-accent underline">Log in</Link></>
        )}
      </p>
    </form>
  );
}
```

- [ ] **Step 3: Create the two pages**

`app/(auth)/login/page.tsx`:

```tsx
import { AuthForm } from "@/components/auth/AuthForm";
import { signInAction } from "@/app/actions/auth";

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string }>;
}) {
  const { next } = await searchParams;
  return <AuthForm mode="login" action={signInAction} next={next} />;
}
```

`app/(auth)/signup/page.tsx`:

```tsx
import { AuthForm } from "@/components/auth/AuthForm";
import { signUpAction } from "@/app/actions/auth";

export default function SignupPage() {
  return <AuthForm mode="signup" action={signUpAction} />;
}
```

- [ ] **Step 4: Create `lib/auth.ts`** (server helpers used by every protected page)

```ts
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import type { Profile } from "@/lib/types";

export async function requireUser() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");
  return { supabase, user };
}

/** Returns the signed-in user's profile, or null if they haven't created one yet. */
export async function getOwnProfile(): Promise<{ profile: Profile | null; userId: string }> {
  const { supabase, user } = await requireUser();
  const { data } = await supabase
    .from("profiles")
    .select("*")
    .eq("user_id", user.id)
    .maybeSingle();
  return { profile: (data as Profile | null) ?? null, userId: user.id };
}

/** For pages that require a completed profile (swipe, listing, matches). */
export async function requireProfile(): Promise<{ profile: Profile; userId: string }> {
  const { profile, userId } = await getOwnProfile();
  if (!profile) redirect("/profile?onboarding=1");
  return { profile, userId };
}
```

- [ ] **Step 5: Manual verification**

`npm run dev`, then: ① `/signup` with a real-looking email + 8-char password → redirected to `/profile?onboarding=1` (404 until Phase 2 — the redirect is the success signal). ② `/login` with wrong password → “Wrong email or password.” ③ `/swipe` while logged out → lands on `/login?next=/swipe`.

- [ ] **Step 6: Commit**

```bash
git add -A && git commit -m "feat: email/password auth with signup, login, and route guards"
```

---

## Phase 1 exit criteria

- `npm test` green (theme toggle, validation, compatibility).
- `npx tsc --noEmit` clean.
- Supabase has all 5 tables with RLS enabled + storage buckets + `respond_to_interest`.
- Sign up / log in / log out work locally; protected routes redirect.

Continue with `docs/superpowers/plans/2026-08-24-roommatch-phase-2-marketplace.md`.
