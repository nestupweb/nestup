# NestUp Implementation Plan — Phase 2: Marketplace

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Profile creation with interests, listing create/edit with photos, and the public Browse experience (filters + pagination + detail page) backed by a shared query module and a public API route.

**Architecture:** Server Components read through the Supabase server client (RLS-scoped); Server Actions mutate; one shared `queryListings()` powers both the Browse page and `GET /api/listings`. Anonymous visitors can browse; profile data stays invisible to them.

**Tech Stack:** as Phase 1. Prereq: Phase 1 complete (Tasks 1–9).

**Numbering continues from Phase 1.**

---

### Task 10: Image upload helper + shared UI atoms

**Files:**
- Create: `lib/storage.ts`, `components/ui/ScoreTag.tsx`, `components/ui/EmptyState.tsx`, `components/ui/TabBar.tsx`, `app/(app)/layout.tsx`

- [ ] **Step 1: Create `lib/storage.ts`**

```ts
import type { SupabaseClient } from "@supabase/supabase-js";
import { MAX_IMAGE_BYTES } from "@/lib/constants";

const ALLOWED_TYPES: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
};

/**
 * Uploads one image to `bucket` under the caller's own folder (RLS-enforced)
 * and returns its public URL. Throws Error with a user-safe message on bad input.
 */
export async function uploadImage(
  supabase: SupabaseClient,
  bucket: "avatars" | "listing-photos",
  userId: string,
  file: File
): Promise<string> {
  const ext = ALLOWED_TYPES[file.type];
  if (!ext) throw new Error("Only JPG, PNG, or WebP images are allowed.");
  if (file.size > MAX_IMAGE_BYTES) throw new Error("Images must be 5 MB or smaller.");

  const path = `${userId}/${crypto.randomUUID()}.${ext}`;
  const { error } = await supabase.storage.from(bucket).upload(path, file, {
    contentType: file.type,
  });
  if (error) throw new Error("Upload failed. Please try again.");

  return supabase.storage.from(bucket).getPublicUrl(path).data.publicUrl;
}
```

- [ ] **Step 2: Create `components/ui/ScoreTag.tsx`** (shows BOTH scores; social may be null)

```tsx
import { scoreLabel } from "@/lib/compatibility";

export function ScoreTag({ lifestyle, social }: { lifestyle: number; social: number | null }) {
  return (
    <span
      className="inline-flex items-center gap-2 rounded-lg border border-white/25 bg-black/55 px-2.5 py-1.5 text-[10px] font-semibold tracking-[0.14em] text-white backdrop-blur-sm"
      title={`Lifestyle: ${scoreLabel(lifestyle)}${social !== null ? ` · Social: ${scoreLabel(social)}` : ""}`}
    >
      {lifestyle} LIFESTYLE
      <span aria-hidden className="opacity-50">·</span>
      {social === null ? <span title="Add interests to see social match">— SOCIAL</span> : <>{social} SOCIAL</>}
    </span>
  );
}
```

- [ ] **Step 3: Create `components/ui/EmptyState.tsx`**

```tsx
export function EmptyState({ title, hint }: { title: string; hint?: string }) {
  return (
    <div className="mx-auto mt-20 max-w-sm px-6 text-center">
      <p className="font-serif text-2xl font-semibold">{title}</p>
      {hint ? <p className="mt-2 text-sm text-muted">{hint}</p> : null}
    </div>
  );
}
```

- [ ] **Step 4: Create `components/ui/TabBar.tsx`**

```tsx
"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const TABS = [
  { href: "/swipe", label: "Swipe" },
  { href: "/browse", label: "Browse" },
  { href: "/matches", label: "Matches" },
  { href: "/listing", label: "Listing" },
  { href: "/profile", label: "Profile" },
] as const;

export function TabBar() {
  const pathname = usePathname();
  return (
    <nav className="fixed inset-x-0 bottom-0 z-40 border-t border-hairline bg-surface/95 backdrop-blur">
      <div className="mx-auto flex max-w-lg justify-around py-2.5">
        {TABS.map((t) => {
          const active = pathname === t.href || pathname.startsWith(t.href + "/");
          return (
            <Link
              key={t.href}
              href={t.href}
              className={`text-[10px] font-semibold uppercase tracking-widest ${
                active ? "text-accent" : "text-muted hover:text-ink"
              }`}
            >
              {t.label}
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
```

- [ ] **Step 5: Create `app/(app)/layout.tsx`** (all signed-in screens share the tab bar + header)

```tsx
import Link from "next/link";
import { ThemeToggle } from "@/components/ui/ThemeToggle";
import { TabBar } from "@/components/ui/TabBar";
import { signOutAction } from "@/app/actions/auth";

export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="mx-auto min-h-dvh max-w-lg pb-20">
      <header className="flex items-center justify-between px-5 py-4">
        <Link href="/swipe" className="font-serif text-xl font-semibold">
          Nest<span className="italic font-normal text-accent">Up</span>
        </Link>
        <div className="flex items-center gap-2">
          <ThemeToggle />
          <form action={signOutAction}>
            <button className="rounded-full border border-hairline px-3 py-1.5 text-xs font-medium text-muted hover:text-ink">
              Log out
            </button>
          </form>
        </div>
      </header>
      {children}
      <TabBar />
    </div>
  );
}
```

- [ ] **Step 6: Verify + commit**

Run: `npx tsc --noEmit` → clean.

```bash
git add -A && git commit -m "feat: storage helper, score tag, tab bar, app shell"
```

---

### Task 11: Profile screen (create/edit, avatar, interests)

**Files:**
- Create: `app/actions/profile.ts`, `app/(app)/profile/page.tsx`, `components/profile/ProfileForm.tsx`, `components/profile/InterestsPicker.tsx`
- Test: `tests/unit/interests-picker.test.tsx`

- [ ] **Step 1: Write the failing test** — `tests/unit/interests-picker.test.tsx`

```tsx
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { expect, test } from "vitest";
import { InterestsPicker } from "@/components/profile/InterestsPicker";
import { MAX_INTERESTS } from "@/lib/constants";

test("toggles interests and enforces the max", async () => {
  render(<InterestsPicker initial={["Music"]} />);
  expect(screen.getByRole("checkbox", { name: "Music" })).toBeChecked();

  await userEvent.click(screen.getByRole("checkbox", { name: "Cooking" }));
  expect(screen.getByRole("checkbox", { name: "Cooking" })).toBeChecked();

  // check up to the cap, then one more must stay unchecked
  const boxes = screen.getAllByRole("checkbox");
  for (const box of boxes) {
    if (!(box as HTMLInputElement).checked) await userEvent.click(box);
  }
  const checked = boxes.filter((b) => (b as HTMLInputElement).checked);
  expect(checked.length).toBe(MAX_INTERESTS);
});
```

- [ ] **Step 2: Run to verify failure** — `npm test` → FAIL (module not found).

- [ ] **Step 3: Create `components/profile/InterestsPicker.tsx`**

```tsx
"use client";

import { useState } from "react";
import { INTERESTS, MAX_INTERESTS, MIN_INTERESTS } from "@/lib/constants";

export function InterestsPicker({ initial }: { initial: string[] }) {
  const [selected, setSelected] = useState<string[]>(initial);

  function toggle(tag: string) {
    setSelected((prev) =>
      prev.includes(tag)
        ? prev.filter((t) => t !== tag)
        : prev.length >= MAX_INTERESTS
          ? prev
          : [...prev, tag]
    );
  }

  return (
    <fieldset className="mt-4">
      <legend className="text-xs font-medium uppercase tracking-widest text-muted">
        Interests <span className="normal-case">(pick {MIN_INTERESTS}–{MAX_INTERESTS} — powers your Social score)</span>
      </legend>
      <div className="mt-2 flex flex-wrap gap-2">
        {INTERESTS.map((tag) => {
          const on = selected.includes(tag);
          return (
            <label
              key={tag}
              className={`cursor-pointer rounded-full border px-3 py-1.5 text-xs font-medium ${
                on ? "border-accent bg-accent text-accent-contrast" : "border-hairline bg-surface text-muted"
              }`}
            >
              <input
                type="checkbox"
                name="interests"
                value={tag}
                checked={on}
                onChange={() => toggle(tag)}
                className="sr-only"
              />
              {tag}
            </label>
          );
        })}
      </div>
    </fieldset>
  );
}
```

- [ ] **Step 4: Run to verify pass** — `npm test` → PASS.

- [ ] **Step 5: Create `app/actions/profile.ts`**

```ts
"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireUser } from "@/lib/auth";
import { uploadImage } from "@/lib/storage";
import { profileSchema } from "@/lib/validation/profile";

export type ProfileFormState = { error?: string };

export async function upsertProfileAction(
  _prev: ProfileFormState,
  formData: FormData
): Promise<ProfileFormState> {
  const { supabase, user } = await requireUser();

  const parsed = profileSchema.safeParse({
    full_name: formData.get("full_name"),
    age: formData.get("age"),
    occupation: formData.get("occupation") ?? "",
    bio: formData.get("bio") ?? "",
    smoker: formData.get("smoker") === "on",
    has_pet: formData.get("has_pet") === "on",
    cleanliness: formData.get("cleanliness"),
    sleep_schedule: formData.get("sleep_schedule"),
    guests_freq: formData.get("guests_freq"),
    interests: formData.getAll("interests"),
    ok_with_smoker: formData.get("ok_with_smoker") === "on",
    ok_with_pets: formData.get("ok_with_pets") === "on",
    budget_min: formData.get("budget_min") || 0,
    budget_max: formData.get("budget_max") || 0,
    preferred_cities: formData.getAll("preferred_cities"),
    earliest_move_in: (formData.get("earliest_move_in") as string) || null,
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Please check the form." };
  }

  let avatar_url: string | undefined;
  const avatar = formData.get("avatar");
  if (avatar instanceof File && avatar.size > 0) {
    try {
      avatar_url = await uploadImage(supabase, "avatars", user.id, avatar);
    } catch (e) {
      return { error: e instanceof Error ? e.message : "Avatar upload failed." };
    }
  }

  const { error } = await supabase.from("profiles").upsert({
    user_id: user.id,
    ...parsed.data,
    ...(avatar_url ? { avatar_url } : {}),
    updated_at: new Date().toISOString(),
  });
  if (error) return { error: "Could not save your profile. Please try again." };

  revalidatePath("/profile");
  redirect("/swipe");
}
```

- [ ] **Step 6: Create `components/profile/ProfileForm.tsx`**

```tsx
"use client";

import { useActionState } from "react";
import { upsertProfileAction, type ProfileFormState } from "@/app/actions/profile";
import { InterestsPicker } from "@/components/profile/InterestsPicker";
import { CITIES } from "@/lib/constants";
import type { Profile } from "@/lib/types";

const input =
  "mt-1 w-full rounded-xl border border-hairline bg-surface px-3 py-2.5 text-sm text-ink outline-none focus:border-accent";
const label = "mt-4 block text-xs font-medium uppercase tracking-widest text-muted";

export function ProfileForm({ profile, onboarding }: { profile: Profile | null; onboarding: boolean }) {
  const [state, formAction, pending] = useActionState<ProfileFormState, FormData>(
    upsertProfileAction,
    {}
  );

  return (
    <form action={formAction} className="px-5 pb-10">
      <h1 className="font-serif text-3xl font-semibold">
        {onboarding ? "Tell us about you" : "Your profile"}
      </h1>
      {onboarding ? (
        <p className="mt-1 text-sm text-muted">This is what listers see when you swipe right.</p>
      ) : null}

      <label className={label}>Photo
        <input name="avatar" type="file" accept="image/jpeg,image/png,image/webp" className={input} />
      </label>
      <label className={label}>Full name
        <input name="full_name" required minLength={2} maxLength={60} defaultValue={profile?.full_name ?? ""} className={input} />
      </label>
      <div className="grid grid-cols-2 gap-3">
        <label className={label}>Age
          <input name="age" type="number" required min={18} max={120} defaultValue={profile?.age ?? ""} className={input} />
        </label>
        <label className={label}>Occupation
          <input name="occupation" maxLength={80} defaultValue={profile?.occupation ?? ""} className={input} />
        </label>
      </div>
      <label className={label}>Bio
        <textarea name="bio" maxLength={500} rows={3} defaultValue={profile?.bio ?? ""} className={input} />
      </label>

      <h2 className="mt-8 font-serif text-xl font-semibold">Lifestyle</h2>
      <div className="mt-2 flex flex-wrap gap-x-6 gap-y-2 text-sm">
        <label className="flex items-center gap-2"><input type="checkbox" name="smoker" defaultChecked={profile?.smoker} /> I smoke</label>
        <label className="flex items-center gap-2"><input type="checkbox" name="has_pet" defaultChecked={profile?.has_pet} /> I have a pet</label>
      </div>
      <label className={label}>Cleanliness (1 = relaxed, 5 = spotless)
        <input name="cleanliness" type="range" min={1} max={5} defaultValue={profile?.cleanliness ?? 3} className="mt-2 w-full accent-[var(--accent)]" />
      </label>
      <div className="grid grid-cols-2 gap-3">
        <label className={label}>Sleep schedule
          <select name="sleep_schedule" defaultValue={profile?.sleep_schedule ?? "flexible"} className={input}>
            <option value="early">Early riser</option>
            <option value="late">Night owl</option>
            <option value="flexible">Flexible</option>
          </select>
        </label>
        <label className={label}>Guests
          <select name="guests_freq" defaultValue={profile?.guests_freq ?? "sometimes"} className={input}>
            <option value="rare">Rarely</option>
            <option value="sometimes">Sometimes</option>
            <option value="often">Often</option>
          </select>
        </label>
      </div>

      <InterestsPicker initial={profile?.interests ?? []} />

      <h2 className="mt-8 font-serif text-xl font-semibold">Roommate preferences</h2>
      <div className="mt-2 flex flex-wrap gap-x-6 gap-y-2 text-sm">
        <label className="flex items-center gap-2"><input type="checkbox" name="ok_with_smoker" defaultChecked={profile?.ok_with_smoker ?? true} /> OK living with a smoker</label>
        <label className="flex items-center gap-2"><input type="checkbox" name="ok_with_pets" defaultChecked={profile?.ok_with_pets ?? true} /> OK living with pets</label>
      </div>

      <h2 className="mt-8 font-serif text-xl font-semibold">Apartment preferences</h2>
      <div className="grid grid-cols-2 gap-3">
        <label className={label}>Budget min (₪)
          <input name="budget_min" type="number" min={0} defaultValue={profile?.budget_min ?? 0} className={input} />
        </label>
        <label className={label}>Budget max (₪)
          <input name="budget_max" type="number" min={0} defaultValue={profile?.budget_max ?? 0} className={input} />
        </label>
      </div>
      <label className={label}>Earliest move-in
        <input name="earliest_move_in" type="date" defaultValue={profile?.earliest_move_in ?? ""} className={input} />
      </label>
      <fieldset className="mt-4">
        <legend className="text-xs font-medium uppercase tracking-widest text-muted">Preferred cities</legend>
        <div className="mt-2 flex flex-wrap gap-2">
          {CITIES.map((c) => (
            <label key={c} className="flex items-center gap-1.5 rounded-full border border-hairline px-3 py-1.5 text-xs">
              <input type="checkbox" name="preferred_cities" value={c} defaultChecked={profile?.preferred_cities.includes(c)} />
              {c}
            </label>
          ))}
        </div>
      </fieldset>

      {state.error ? <p role="alert" className="mt-4 text-sm text-red-600">{state.error}</p> : null}

      <button type="submit" disabled={pending}
        className="mt-8 w-full rounded-xl bg-accent py-3 text-sm font-semibold text-accent-contrast disabled:opacity-60">
        {pending ? "Saving…" : "Save profile"}
      </button>
    </form>
  );
}
```

- [ ] **Step 7: Create `app/(app)/profile/page.tsx`**

```tsx
import { getOwnProfile } from "@/lib/auth";
import { ProfileForm } from "@/components/profile/ProfileForm";

export default async function ProfilePage({
  searchParams,
}: {
  searchParams: Promise<{ onboarding?: string }>;
}) {
  const { profile } = await getOwnProfile();
  const { onboarding } = await searchParams;
  return <ProfileForm profile={profile} onboarding={onboarding === "1"} />;
}
```

- [ ] **Step 8: Manual verification**

`npm run dev` → sign up fresh → land on `/profile?onboarding=1` → fill the form with 3+ interests and a photo → Save → redirected to `/swipe` (404 until Phase 3 — redirect is the success signal). Check Supabase Table Editor: `profiles` has the row; `avatars` bucket has the file under your user-id folder. Reload `/profile` → the form is pre-filled.

- [ ] **Step 9: Commit**

```bash
git add -A && git commit -m "feat: profile screen with lifestyle, interests, preferences, avatar upload"
```

---

### Task 12: My Listing — create & edit with photos

**Files:**
- Create: `app/actions/listing.ts`, `app/(app)/listing/page.tsx`, `components/listings/ListingForm.tsx`

- [ ] **Step 1: Create `app/actions/listing.ts`**

```ts
"use server";

import { revalidatePath } from "next/cache";
import { requireUser } from "@/lib/auth";
import { uploadImage } from "@/lib/storage";
import { listingSchema } from "@/lib/validation/listing";
import { MAX_LISTING_PHOTOS } from "@/lib/constants";

export type ListingFormState = { error?: string; saved?: boolean };

export async function saveListingAction(
  _prev: ListingFormState,
  formData: FormData
): Promise<ListingFormState> {
  const { supabase, user } = await requireUser();

  const parsed = listingSchema.safeParse({
    title: formData.get("title"),
    description: formData.get("description") ?? "",
    city: formData.get("city"),
    neighborhood: formData.get("neighborhood") ?? "",
    rent: formData.get("rent"),
    available_from: formData.get("available_from"),
    roommates_count: formData.get("roommates_count"),
    pets_allowed: formData.get("pets_allowed") === "on",
    smoking_allowed: formData.get("smoking_allowed") === "on",
    balcony: formData.get("balcony") === "on",
    air_conditioning: formData.get("air_conditioning") === "on",
    parking: formData.get("parking") === "on",
    elevator: formData.get("elevator") === "on",
    furnished: formData.get("furnished") === "on",
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Please check the form." };
  }

  const keptUrls = formData.getAll("existing_photos").map(String);
  const newFiles = formData.getAll("photos").filter((f): f is File => f instanceof File && f.size > 0);
  if (keptUrls.length + newFiles.length > MAX_LISTING_PHOTOS) {
    return { error: `Up to ${MAX_LISTING_PHOTOS} photos.` };
  }
  const photo_urls = [...keptUrls];
  for (const file of newFiles) {
    try {
      photo_urls.push(await uploadImage(supabase, "listing-photos", user.id, file));
    } catch (e) {
      return { error: e instanceof Error ? e.message : "Photo upload failed." };
    }
  }

  const listingId = String(formData.get("listing_id") ?? "");
  const is_active = formData.get("is_active") !== null ? formData.get("is_active") === "on" : true;
  const row = { ...parsed.data, photo_urls, is_active, owner_id: user.id, updated_at: new Date().toISOString() };

  const { error } = listingId
    ? await supabase.from("listings").update(row).eq("id", listingId).eq("owner_id", user.id)
    : await supabase.from("listings").insert(row);
  if (error) return { error: "Could not save the listing. Please try again." };

  revalidatePath("/listing");
  revalidatePath("/browse");
  return { saved: true };
}
```

- [ ] **Step 2: Create `components/listings/ListingForm.tsx`**

```tsx
"use client";

import { useActionState } from "react";
import { saveListingAction, type ListingFormState } from "@/app/actions/listing";
import { CITIES, FEATURES, MAX_LISTING_PHOTOS } from "@/lib/constants";
import type { Listing } from "@/lib/types";

const input =
  "mt-1 w-full rounded-xl border border-hairline bg-surface px-3 py-2.5 text-sm text-ink outline-none focus:border-accent";
const label = "mt-4 block text-xs font-medium uppercase tracking-widest text-muted";

export function ListingForm({ listing }: { listing: Listing | null }) {
  const [state, formAction, pending] = useActionState<ListingFormState, FormData>(
    saveListingAction,
    {}
  );

  return (
    <form action={formAction} className="px-5 pb-10">
      <h1 className="font-serif text-3xl font-semibold">
        {listing ? "Your listing" : "List your room"}
      </h1>
      <p className="mt-1 text-sm text-muted">
        {listing ? "Edit details or pause the listing." : "Post a room and start reviewing interested seekers."}
      </p>

      {listing ? <input type="hidden" name="listing_id" value={listing.id} /> : null}
      {(listing?.photo_urls ?? []).map((url) => (
        <input key={url} type="hidden" name="existing_photos" value={url} />
      ))}

      <label className={label}>Title
        <input name="title" required minLength={5} maxLength={80} defaultValue={listing?.title ?? ""} className={input} />
      </label>
      <label className={label}>Description
        <textarea name="description" maxLength={2000} rows={4} defaultValue={listing?.description ?? ""} className={input} />
      </label>
      <div className="grid grid-cols-2 gap-3">
        <label className={label}>City
          <select name="city" required defaultValue={listing?.city ?? "Tel Aviv"} className={input}>
            {CITIES.map((c) => <option key={c} value={c}>{c}</option>)}
          </select>
        </label>
        <label className={label}>Neighborhood
          <input name="neighborhood" maxLength={80} defaultValue={listing?.neighborhood ?? ""} className={input} />
        </label>
        <label className={label}>Rent (₪ / month)
          <input name="rent" type="number" required min={1} defaultValue={listing?.rent ?? ""} className={input} />
        </label>
        <label className={label}>Available from
          <input name="available_from" type="date" required defaultValue={listing?.available_from ?? ""} className={input} />
        </label>
        <label className={label}>Current roommates
          <input name="roommates_count" type="number" required min={0} max={10} defaultValue={listing?.roommates_count ?? 1} className={input} />
        </label>
      </div>

      <h2 className="mt-8 font-serif text-xl font-semibold">House rules & features</h2>
      <div className="mt-2 flex flex-wrap gap-x-6 gap-y-2 text-sm">
        <label className="flex items-center gap-2"><input type="checkbox" name="pets_allowed" defaultChecked={listing?.pets_allowed} /> Pets allowed</label>
        <label className="flex items-center gap-2"><input type="checkbox" name="smoking_allowed" defaultChecked={listing?.smoking_allowed} /> Smoking allowed</label>
        {FEATURES.map((f) => (
          <label key={f.key} className="flex items-center gap-2">
            <input type="checkbox" name={f.key} defaultChecked={Boolean(listing?.[f.key])} /> {f.label}
          </label>
        ))}
      </div>

      <label className={label}>Photos (up to {MAX_LISTING_PHOTOS})
        <input name="photos" type="file" multiple accept="image/jpeg,image/png,image/webp" className={input} />
      </label>
      {listing && listing.photo_urls.length > 0 ? (
        <div className="mt-2 flex gap-2 overflow-x-auto">
          {listing.photo_urls.map((url) => (
            // eslint-disable-next-line @next/next/no-img-element
            <img key={url} src={url} alt="Listing photo" className="h-20 w-20 rounded-lg object-cover" />
          ))}
        </div>
      ) : null}

      {listing ? (
        <label className="mt-4 flex items-center gap-2 text-sm">
          <input type="checkbox" name="is_active" defaultChecked={listing.is_active} /> Listing is active
        </label>
      ) : null}

      {state.error ? <p role="alert" className="mt-4 text-sm text-red-600">{state.error}</p> : null}
      {state.saved ? <p role="status" className="mt-4 text-sm text-accent">Saved.</p> : null}

      <button type="submit" disabled={pending}
        className="mt-6 w-full rounded-xl bg-accent py-3 text-sm font-semibold text-accent-contrast disabled:opacity-60">
        {pending ? "Saving…" : listing ? "Save changes" : "Publish listing"}
      </button>
    </form>
  );
}
```

- [ ] **Step 3: Create `app/(app)/listing/page.tsx`** (Interested queue is added here in Phase 3, Task 16)

```tsx
import { requireProfile } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { ListingForm } from "@/components/listings/ListingForm";
import type { Listing } from "@/lib/types";

export default async function MyListingPage() {
  const { userId } = await requireProfile();
  const supabase = await createClient();
  const { data } = await supabase
    .from("listings")
    .select("*")
    .eq("owner_id", userId)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  return <ListingForm listing={(data as Listing | null) ?? null} />;
}
```

- [ ] **Step 4: Manual verification**

Dev server → `/listing` → publish a listing with 2 photos → “Saved.” → Supabase: `listings` row exists, `listing-photos` bucket has files. Edit rent → Save → row updated. Try a second *active* listing from SQL editor for the same owner → expect unique-index error (one active listing per user).

- [ ] **Step 5: Commit**

```bash
git add -A && git commit -m "feat: create/edit listing with photos and active toggle"
```

---

### Task 13: Shared listing query + public API route (TDD on the query builder)

**Files:**
- Create: `lib/listings.ts`, `app/api/listings/route.ts`
- Test: `tests/unit/listing-query.test.ts`

- [ ] **Step 1: Write the failing test** — `tests/unit/listing-query.test.ts`

The filter→query translation is the logic worth testing; fake the supabase builder chain:

```ts
import { describe, expect, test } from "vitest";
import { applyListingFilters } from "@/lib/listings";
import { listingFiltersSchema } from "@/lib/validation/filters";

type Call = [string, ...unknown[]];

function fakeQuery() {
  const calls: Call[] = [];
  const q: Record<string, (...args: unknown[]) => unknown> = {};
  for (const m of ["eq", "gte", "lte", "order", "range"]) {
    q[m] = (...args: unknown[]) => {
      calls.push([m, ...args]);
      return q;
    };
  }
  return { q: q as never, calls };
}

describe("applyListingFilters", () => {
  test("translates filters into supabase calls with pagination", () => {
    const { q, calls } = fakeQuery();
    const filters = listingFiltersSchema.parse({
      city: "Tel Aviv", rent_min: "2000", rent_max: "3500",
      pets_allowed: "true", balcony: "true", page: "2", page_size: "10",
    });
    applyListingFilters(q, filters);
    expect(calls).toContainEqual(["eq", "city", "Tel Aviv"]);
    expect(calls).toContainEqual(["gte", "rent", 2000]);
    expect(calls).toContainEqual(["lte", "rent", 3500]);
    expect(calls).toContainEqual(["eq", "pets_allowed", true]);
    expect(calls).toContainEqual(["eq", "balcony", true]);
    expect(calls).toContainEqual(["range", 10, 19]); // page 2, size 10
  });

  test("omitted filters add no calls besides order/range", () => {
    const { q, calls } = fakeQuery();
    applyListingFilters(q, listingFiltersSchema.parse({}));
    const filterCalls = calls.filter(([m]) => m !== "order" && m !== "range");
    expect(filterCalls).toHaveLength(0);
  });
});
```

- [ ] **Step 2: Run to verify failure** — `npm test` → FAIL.

- [ ] **Step 3: Create `lib/listings.ts`**

```ts
import { createClient } from "@/lib/supabase/server";
import type { ListingFilters } from "@/lib/validation/filters";
import type { Listing } from "@/lib/types";

/** Minimal query surface we drive — lets unit tests fake the builder. */
export interface FilterableQuery {
  eq(column: string, value: unknown): FilterableQuery;
  gte(column: string, value: unknown): FilterableQuery;
  lte(column: string, value: unknown): FilterableQuery;
  order(column: string, opts: { ascending: boolean }): FilterableQuery;
  range(from: number, to: number): FilterableQuery;
}

const BOOL_KEYS = [
  "pets_allowed", "smoking_allowed", "balcony",
  "air_conditioning", "parking", "elevator", "furnished",
] as const;

export function applyListingFilters<Q extends FilterableQuery>(q: Q, f: ListingFilters): Q {
  if (f.city) q.eq("city", f.city);
  if (f.rent_min !== undefined) q.gte("rent", f.rent_min);
  if (f.rent_max !== undefined) q.lte("rent", f.rent_max);
  if (f.move_in_by) q.lte("available_from", f.move_in_by);
  if (f.roommates_max !== undefined) q.lte("roommates_count", f.roommates_max);
  for (const key of BOOL_KEYS) {
    if (f[key] !== undefined) q.eq(key, f[key]);
  }
  q.order("created_at", { ascending: false });
  const from = (f.page - 1) * f.page_size;
  q.range(from, from + f.page_size - 1);
  return q;
}

/** Public browse query — RLS exposes only active listings to anon. */
export async function queryListings(
  filters: ListingFilters
): Promise<{ listings: Listing[]; total: number }> {
  const supabase = await createClient();
  const query = supabase
    .from("listings")
    .select("*", { count: "exact" })
    .eq("is_active", true);
  applyListingFilters(query as unknown as FilterableQuery, filters);
  const { data, count, error } = await query;
  if (error) return { listings: [], total: 0 };
  return { listings: (data as Listing[]) ?? [], total: count ?? 0 };
}
```

- [ ] **Step 4: Run to verify pass** — `npm test` → PASS.

- [ ] **Step 5: Create `app/api/listings/route.ts`**

```ts
import { NextResponse, type NextRequest } from "next/server";
import { listingFiltersSchema } from "@/lib/validation/filters";
import { queryListings } from "@/lib/listings";

export async function GET(request: NextRequest) {
  const params = Object.fromEntries(request.nextUrl.searchParams);
  const filters = listingFiltersSchema.parse(params); // .catch() defaults make this total
  const { listings, total } = await queryListings(filters);
  return NextResponse.json({
    listings,
    total,
    page: filters.page,
    page_size: filters.page_size,
  });
}
```

- [ ] **Step 6: Manual verification**

Dev server: `curl "http://localhost:3000/api/listings?city=Tel%20Aviv&rent_max=3000"` → JSON with your listing; `curl "http://localhost:3000/api/listings?rent_max=banana"` → 200 with defaults (no crash).

- [ ] **Step 7: Commit**

```bash
git add -A && git commit -m "feat: shared listing query with filters + public /api/listings route"
```

---

### Task 14: Public Browse — filters, cards, detail page

**Files:**
- Create: `app/(public)/layout.tsx`, `app/(public)/browse/page.tsx`, `app/(public)/browse/[id]/page.tsx`, `components/listings/ListingCard.tsx`, `components/listings/FilterBar.tsx`
- Delete: `app/page.tsx` (replaced by `app/(public)/page.tsx` in Task 15)
- Test: `tests/unit/filter-bar.test.tsx`

- [ ] **Step 1: Create `app/(public)/layout.tsx`**

```tsx
import Link from "next/link";
import { ThemeToggle } from "@/components/ui/ThemeToggle";
import { createClient } from "@/lib/supabase/server";

export default async function PublicLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  return (
    <div className="mx-auto min-h-dvh max-w-3xl">
      <header className="flex items-center justify-between px-5 py-4">
        <Link href="/" className="font-serif text-xl font-semibold">
          Nest<span className="italic font-normal text-accent">Up</span>
        </Link>
        <div className="flex items-center gap-2">
          <ThemeToggle />
          <Link href="/browse" className="px-2 text-sm text-muted hover:text-ink">Browse</Link>
          {user ? (
            <Link href="/swipe" className="rounded-full bg-accent px-4 py-1.5 text-sm font-semibold text-accent-contrast">Open app</Link>
          ) : (
            <Link href="/login" className="rounded-full bg-accent px-4 py-1.5 text-sm font-semibold text-accent-contrast">Log in</Link>
          )}
        </div>
      </header>
      {children}
    </div>
  );
}
```

- [ ] **Step 2: Write the failing FilterBar test** — `tests/unit/filter-bar.test.tsx`

```tsx
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { expect, test, vi } from "vitest";

const push = vi.fn();
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push }),
  useSearchParams: () => new URLSearchParams("city=Haifa"),
  usePathname: () => "/browse",
}));

import { FilterBar } from "@/components/listings/FilterBar";

test("submits chosen filters into the URL and resets page", async () => {
  render(<FilterBar />);
  expect(screen.getByLabelText(/city/i)).toHaveValue("Haifa"); // initialized from URL
  await userEvent.type(screen.getByLabelText(/max rent/i), "3000");
  await userEvent.click(screen.getByRole("checkbox", { name: /pets allowed/i }));
  await userEvent.click(screen.getByRole("button", { name: /apply filters/i }));
  expect(push).toHaveBeenCalledTimes(1);
  const url = String(push.mock.calls[0][0]);
  expect(url).toContain("city=Haifa");
  expect(url).toContain("rent_max=3000");
  expect(url).toContain("pets_allowed=true");
  expect(url).not.toContain("page=");
});
```

- [ ] **Step 3: Run to verify failure** — `npm test` → FAIL.

- [ ] **Step 4: Create `components/listings/FilterBar.tsx`**

```tsx
"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { CITIES, FEATURES } from "@/lib/constants";

const input =
  "mt-1 w-full rounded-xl border border-hairline bg-surface px-3 py-2 text-sm text-ink outline-none focus:border-accent";
const label = "block text-[10px] font-semibold uppercase tracking-widest text-muted";

export function FilterBar() {
  const router = useRouter();
  const params = useSearchParams();

  function apply(formData: FormData) {
    const next = new URLSearchParams();
    for (const [key, value] of formData.entries()) {
      const v = String(value);
      if (v === "" || v === "any") continue;
      next.set(key, v === "on" ? "true" : v);
    }
    router.push(`/browse?${next.toString()}`);
  }

  return (
    <form action={apply} className="rounded-2xl border border-hairline bg-surface p-4">
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <label className={label}>City
          <select name="city" defaultValue={params.get("city") ?? "any"} className={input}>
            <option value="any">Any city</option>
            {CITIES.map((c) => <option key={c} value={c}>{c}</option>)}
          </select>
        </label>
        <label className={label}>Min rent (₪)
          <input name="rent_min" type="number" min={0} defaultValue={params.get("rent_min") ?? ""} className={input} />
        </label>
        <label className={label}>Max rent (₪)
          <input name="rent_max" type="number" min={0} defaultValue={params.get("rent_max") ?? ""} className={input} />
        </label>
        <label className={label}>Move in by
          <input name="move_in_by" type="date" defaultValue={params.get("move_in_by") ?? ""} className={input} />
        </label>
        <label className={label}>Max roommates
          <input name="roommates_max" type="number" min={0} max={10} defaultValue={params.get("roommates_max") ?? ""} className={input} />
        </label>
      </div>
      <div className="mt-3 flex flex-wrap gap-x-5 gap-y-2 text-sm">
        <label className="flex items-center gap-1.5">
          <input type="checkbox" name="pets_allowed" defaultChecked={params.get("pets_allowed") === "true"} /> Pets allowed
        </label>
        <label className="flex items-center gap-1.5">
          <input type="checkbox" name="smoking_allowed" defaultChecked={params.get("smoking_allowed") === "true"} /> Smoking allowed
        </label>
        {FEATURES.map((f) => (
          <label key={f.key} className="flex items-center gap-1.5">
            <input type="checkbox" name={f.key} defaultChecked={params.get(f.key) === "true"} /> {f.label}
          </label>
        ))}
      </div>
      <button type="submit" className="mt-4 rounded-xl bg-accent px-5 py-2 text-sm font-semibold text-accent-contrast">
        Apply filters
      </button>
    </form>
  );
}
```

- [ ] **Step 5: Run to verify pass** — `npm test` → PASS.

- [ ] **Step 6: Create `components/listings/ListingCard.tsx`**

```tsx
import Link from "next/link";
import type { Listing } from "@/lib/types";

export function ListingCard({ listing }: { listing: Listing }) {
  const specs = [
    `${listing.roommates_count} flatmate${listing.roommates_count === 1 ? "" : "s"}`,
    listing.pets_allowed ? "Pets welcome" : "No pets",
    listing.smoking_allowed ? "Smoking OK" : "No smoking",
  ].join("  ·  ");

  return (
    <Link
      href={`/browse/${listing.id}`}
      className="block overflow-hidden rounded-2xl border border-hairline bg-surface transition-shadow hover:shadow-lg"
    >
      <div className="h-44 bg-hairline">
        {listing.photo_urls[0] ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={listing.photo_urls[0]} alt={listing.title} className="h-full w-full object-cover" />
        ) : null}
      </div>
      <div className="p-4">
        <div className="flex items-baseline justify-between gap-2">
          <h3 className="font-serif text-lg font-semibold">{listing.title}</h3>
          <p className="whitespace-nowrap font-serif font-semibold">
            ₪{listing.rent.toLocaleString()}<span className="text-xs font-normal text-muted"> /mo</span>
          </p>
        </div>
        <p className="mt-0.5 text-xs text-muted">
          {listing.city}{listing.neighborhood ? ` — ${listing.neighborhood}` : ""} · from{" "}
          {new Date(listing.available_from).toLocaleDateString("en-GB", { day: "numeric", month: "short" })}
        </p>
        <p className="mt-2 border-t border-hairline pt-2 text-[10px] font-semibold uppercase tracking-[0.14em] text-muted">
          {specs}
        </p>
      </div>
    </Link>
  );
}
```

- [ ] **Step 7: Create `app/(public)/browse/page.tsx`**

```tsx
import Link from "next/link";
import { listingFiltersSchema } from "@/lib/validation/filters";
import { queryListings } from "@/lib/listings";
import { FilterBar } from "@/components/listings/FilterBar";
import { ListingCard } from "@/components/listings/ListingCard";
import { EmptyState } from "@/components/ui/EmptyState";

export default async function BrowsePage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string>>;
}) {
  const filters = listingFiltersSchema.parse(await searchParams);
  const { listings, total } = await queryListings(filters);
  const lastPage = Math.max(1, Math.ceil(total / filters.page_size));

  const pageLink = (page: number) => {
    const params = new URLSearchParams(
      Object.entries(filters)
        .filter(([, v]) => v !== undefined)
        .map(([k, v]) => [k, String(v)])
    );
    params.set("page", String(page));
    return `/browse?${params.toString()}`;
  };

  return (
    <main className="px-5 pb-16">
      <h1 className="font-serif text-3xl font-semibold">Find a room</h1>
      <p className="mb-4 mt-1 text-sm text-muted">{total} available room{total === 1 ? "" : "s"}</p>
      <FilterBar />
      {listings.length === 0 ? (
        <EmptyState title="No rooms match these filters" hint="Try widening the rent range or clearing a filter." />
      ) : (
        <div className="mt-5 grid gap-4 sm:grid-cols-2">
          {listings.map((l) => <ListingCard key={l.id} listing={l} />)}
        </div>
      )}
      {lastPage > 1 ? (
        <div className="mt-6 flex items-center justify-center gap-4 text-sm">
          {filters.page > 1 ? <Link className="text-accent underline" href={pageLink(filters.page - 1)}>← Previous</Link> : null}
          <span className="text-muted">Page {filters.page} of {lastPage}</span>
          {filters.page < lastPage ? <Link className="text-accent underline" href={pageLink(filters.page + 1)}>Next →</Link> : null}
        </div>
      ) : null}
    </main>
  );
}
```

- [ ] **Step 8: Create `app/(public)/browse/[id]/page.tsx`** (public detail; roommate identity only for signed-in users; Like requires sign-in)

```tsx
import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { FEATURES } from "@/lib/constants";
import { swipeAction } from "@/app/actions/swipe";
import type { Listing, Profile } from "@/lib/types";

export default async function ListingDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { data } = await supabase.from("listings").select("*").eq("id", id).maybeSingle();
  const listing = data as Listing | null;
  if (!listing) notFound();

  // RLS: this returns null for anonymous visitors — by design.
  const { data: ownerData } = await supabase
    .from("profiles")
    .select("*")
    .eq("user_id", listing.owner_id)
    .maybeSingle();
  const owner = ownerData as Profile | null;

  const features = FEATURES.filter((f) => listing[f.key]).map((f) => f.label);

  return (
    <main className="px-5 pb-16">
      <div className="flex gap-2 overflow-x-auto">
        {listing.photo_urls.length > 0 ? (
          listing.photo_urls.map((url) => (
            // eslint-disable-next-line @next/next/no-img-element
            <img key={url} src={url} alt={listing.title} className="h-64 w-auto rounded-2xl object-cover" />
          ))
        ) : (
          <div className="h-64 w-full rounded-2xl bg-hairline" />
        )}
      </div>

      <div className="mt-4 flex items-baseline justify-between gap-3">
        <h1 className="font-serif text-3xl font-semibold">{listing.title}</h1>
        <p className="whitespace-nowrap font-serif text-2xl font-semibold">
          ₪{listing.rent.toLocaleString()}<span className="text-sm font-normal text-muted"> /mo</span>
        </p>
      </div>
      <p className="mt-1 text-sm text-muted">
        {listing.city}{listing.neighborhood ? ` — ${listing.neighborhood}` : ""} · available from{" "}
        {new Date(listing.available_from).toLocaleDateString("en-GB", { dateStyle: "long" })}
      </p>

      <p className="mt-4 border-y border-hairline py-3 text-[11px] font-semibold uppercase tracking-[0.14em] text-muted">
        {listing.roommates_count} flatmate{listing.roommates_count === 1 ? "" : "s"} ·{" "}
        {listing.pets_allowed ? "Pets welcome" : "No pets"} ·{" "}
        {listing.smoking_allowed ? "Smoking OK" : "No smoking"}
      </p>

      {features.length > 0 ? <p className="mt-3 text-sm text-muted">{features.join(" · ")}</p> : null}
      {listing.description ? <p className="mt-4 whitespace-pre-line text-sm leading-relaxed">{listing.description}</p> : null}

      <section className="mt-6 rounded-2xl border border-hairline bg-surface p-4">
        <h2 className="text-[11px] font-semibold uppercase tracking-widest text-muted">Who lives here</h2>
        {owner ? (
          <div className="mt-2 flex items-center gap-3">
            {owner.avatar_url ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={owner.avatar_url} alt={owner.full_name} className="h-10 w-10 rounded-full object-cover" />
            ) : (
              <div className="h-10 w-10 rounded-full bg-hairline" />
            )}
            <div>
              <p className="text-sm font-medium">{owner.full_name}, {owner.age}</p>
              <p className="text-xs text-muted">{owner.occupation}</p>
            </div>
          </div>
        ) : (
          <p className="mt-2 text-sm text-muted">
            <Link href={`/login?next=/browse/${listing.id}`} className="text-accent underline">Sign in</Link>{" "}
            to see who lives here and your compatibility scores.
          </p>
        )}
      </section>

      <div className="mt-6">
        {user ? (
          <form action={swipeAction.bind(null, listing.id, "like")}>
            <button className="w-full rounded-xl bg-accent py-3 text-sm font-semibold text-accent-contrast">
              I'm interested
            </button>
          </form>
        ) : (
          <Link
            href={`/login?next=/browse/${listing.id}`}
            className="block w-full rounded-xl bg-accent py-3 text-center text-sm font-semibold text-accent-contrast"
          >
            Sign in to show interest
          </Link>
        )}
      </div>
    </main>
  );
}
```

Note: `swipeAction` is defined in Phase 3 Task 15. To keep this task shippable on its own, create the stub `app/actions/swipe.ts` now — Phase 3 replaces its body:

```ts
"use server";

import { redirect } from "next/navigation";
import { requireUser } from "@/lib/auth";
import type { SwipeDirection } from "@/lib/types";

export async function swipeAction(listingId: string, direction: SwipeDirection): Promise<void> {
  const { supabase } = await requireUser();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  await supabase.from("swipes").upsert(
    { seeker_id: user!.id, listing_id: listingId, direction },
    { onConflict: "seeker_id,listing_id" }
  );
  redirect("/swipe");
}
```

- [ ] **Step 9: Manual verification**

Log out. `/browse` shows your listing with filters working (try city + max-rent). Open the detail page: “Sign in to see who lives here” appears (RLS hides the profile). Log in: the owner card appears. Run `npm test` — all green.

- [ ] **Step 10: Commit**

```bash
git add -A && git commit -m "feat: public browse with filters, pagination, and listing detail"
```

---

### Task 15 (Phase-2 finale): Landing page + seed data

**Files:**
- Create: `app/(public)/page.tsx`, `scripts/seed.ts`
- Delete: `app/page.tsx` (the scaffold one, if not already removed)
- Modify: `package.json` (seed script)

- [ ] **Step 1: Delete the scaffold home page** — remove `app/page.tsx` (the `(public)/page.tsx` below replaces it; two root pages would conflict).

- [ ] **Step 2: Create `app/(public)/page.tsx`**

```tsx
import Link from "next/link";

export default function LandingPage() {
  return (
    <main className="px-6 pb-24 pt-16 text-center">
      <h1 className="mx-auto max-w-xl font-serif text-5xl font-semibold leading-tight">
        Find the room <span className="italic text-accent">and</span> the roommates.
      </h1>
      <p className="mx-auto mt-4 max-w-md text-muted">
        Swipe through shared apartments, see your lifestyle and social compatibility with the
        people already living there, and match only when both sides say yes.
      </p>
      <div className="mt-8 flex justify-center gap-3">
        <Link href="/browse" className="rounded-xl border border-hairline px-6 py-3 text-sm font-semibold hover:border-accent">
          Browse rooms
        </Link>
        <Link href="/signup" className="rounded-xl bg-accent px-6 py-3 text-sm font-semibold text-accent-contrast">
          Start swiping
        </Link>
      </div>
      <div className="mx-auto mt-16 grid max-w-2xl gap-4 text-left sm:grid-cols-3">
        {[
          ["Two scores, no black box", "Lifestyle fit and shared-interest fit, computed from transparent rules — never hiding anyone."],
          ["Both sides choose", "A match happens only when the seeker likes the room and the roommates like them back."],
          ["Privacy by default", "Anyone can browse rooms; personal profiles are visible to signed-in users only."],
        ].map(([title, body]) => (
          <div key={title} className="rounded-2xl border border-hairline bg-surface p-4">
            <h3 className="font-serif text-lg font-semibold">{title}</h3>
            <p className="mt-1 text-sm text-muted">{body}</p>
          </div>
        ))}
      </div>
    </main>
  );
}
```

- [ ] **Step 3: Create `scripts/seed.ts`** (demo users + listings for development, E2E, and the presentation)

```ts
/**
 * Seeds demo data. Requires SUPABASE_SERVICE_ROLE_KEY (server-only).
 * Run: npm run seed   — idempotent: safe to re-run.
 * Demo accounts all use password "Demo1234!".
 */
import { createClient } from "@supabase/supabase-js";
import { config } from "dotenv";

config({ path: ".env.local" });

const admin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { autoRefreshToken: false, persistSession: false } }
);

const PASSWORD = "Demo1234!";

const USERS = [
  {
    email: "noa@demo.roommatch", full_name: "Noa Peretz", age: 26, occupation: "Product designer",
    bio: "Early riser, plant person, cooks a mean shakshuka.",
    smoker: false, has_pet: false, cleanliness: 4, sleep_schedule: "early", guests_freq: "sometimes",
    interests: ["Cooking", "Yoga", "Art", "Travel", "Reading"],
    ok_with_smoker: false, ok_with_pets: true, budget_min: 0, budget_max: 0,
    preferred_cities: ["Tel Aviv"], earliest_move_in: null,
    listing: {
      title: "Sunlit room in Florentin 3BR", description: "Bright room in a renovated flat. We're two easygoing professionals; balcony dinners on Fridays.",
      city: "Tel Aviv", neighborhood: "Florentin", rent: 2800, available_from: "2026-10-01",
      roommates_count: 2, pets_allowed: true, smoking_allowed: false,
      balcony: true, air_conditioning: true, parking: false, elevator: false, furnished: true,
      photo_urls: ["https://images.unsplash.com/photo-1522708323590-d24dbb6b0267?w=1200&q=80"],
    },
  },
  {
    email: "omer@demo.roommatch", full_name: "Omer Katz", age: 28, occupation: "Backend engineer",
    bio: "Night owl, board-game host, quiet on weekdays.",
    smoker: false, has_pet: true, cleanliness: 3, sleep_schedule: "late", guests_freq: "often",
    interests: ["Gaming", "Board games", "Tech", "Movies & TV"],
    ok_with_smoker: true, ok_with_pets: true, budget_min: 0, budget_max: 0,
    preferred_cities: ["Ramat Gan", "Givatayim"], earliest_move_in: null,
    listing: {
      title: "Big room near the Diamond District", description: "Spacious flat with a friendly cat. Looking for someone chill about occasional game nights.",
      city: "Ramat Gan", neighborhood: "", rent: 2300, available_from: "2026-09-15",
      roommates_count: 1, pets_allowed: true, smoking_allowed: false,
      balcony: false, air_conditioning: true, parking: true, elevator: true, furnished: false,
      photo_urls: ["https://images.unsplash.com/photo-1502672260266-1c1ef2d93688?w=1200&q=80"],
    },
  },
  {
    email: "maya@demo.roommatch", full_name: "Maya Shalev", age: 24, occupation: "MSc student",
    bio: "Runner, vegan cook, library-quiet during exams.",
    smoker: false, has_pet: false, cleanliness: 5, sleep_schedule: "early", guests_freq: "rare",
    interests: ["Running", "Vegan food", "Hiking", "Music", "Volunteering"],
    ok_with_smoker: false, ok_with_pets: false, budget_min: 1500, budget_max: 2600,
    preferred_cities: ["Tel Aviv", "Givatayim"], earliest_move_in: "2026-10-01",
    listing: null,
  },
] as const;

async function main() {
  for (const u of USERS) {
    const { data: created, error } = await admin.auth.admin.createUser({
      email: u.email,
      password: PASSWORD,
      email_confirm: true,
    });
    let userId = created?.user?.id;
    if (error) {
      // already exists — look it up
      const { data: list } = await admin.auth.admin.listUsers();
      userId = list.users.find((x) => x.email === u.email)?.id;
      if (!userId) throw new Error(`Cannot create or find ${u.email}: ${error.message}`);
    }

    const { listing, email, ...profile } = u;
    const { error: pErr } = await admin.from("profiles").upsert({ user_id: userId, ...profile });
    if (pErr) throw pErr;

    if (listing) {
      const { data: existing } = await admin
        .from("listings").select("id").eq("owner_id", userId).limit(1).maybeSingle();
      const { error: lErr } = existing
        ? await admin.from("listings").update({ ...listing, owner_id: userId }).eq("id", existing.id)
        : await admin.from("listings").insert({ ...listing, owner_id: userId });
      if (lErr) throw lErr;
    }
    console.log(`✓ ${email}`);
  }
  console.log(`\nDone. Log in with any demo email + password ${PASSWORD}`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
```

- [ ] **Step 4: Install script deps and register the command**

```bash
npm i -D tsx dotenv
```

Add to `package.json` scripts: `"seed": "tsx scripts/seed.ts"`.

- [ ] **Step 5: Run it**

`npm run seed` → Expected: `✓ noa@demo.roommatch`, `✓ omer@demo.roommatch`, `✓ maya@demo.roommatch`. Then `/browse` (logged out) shows 2 listings.

- [ ] **Step 6: Commit**

```bash
git add -A && git commit -m "feat: landing page and idempotent demo seed script"
```

---

## Phase 2 exit criteria

- `npm test` green (adds interests-picker, listing-query, filter-bar suites).
- Full profile + listing CRUD works against Supabase with photos.
- Logged-out browse: filters, pagination, detail page, roommate privacy, `/api/listings`.
- Seed data in place (needed by Phase 3 E2E and the demo).

Continue with `docs/superpowers/plans/2026-08-24-roommatch-phase-3-matching-and-launch.md`.
