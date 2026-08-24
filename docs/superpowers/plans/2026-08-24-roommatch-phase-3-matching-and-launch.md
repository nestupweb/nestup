# RoomMatch Implementation Plan — Phase 3: Matching & Launch

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** The swipe deck with both compatibility scores, the lister's Interested queue with server-authoritative match creation, matches list + realtime chat, Playwright E2E for the money flows, README, and Vercel deployment.

**Architecture:** Deck and queue are computed server-side (scores from `lib/compatibility.ts`, sorted by `sortKey`, **never filtered by score**). Match creation goes through the `respond_to_interest` Postgres function only. Chat = initial server fetch + Supabase Realtime inserts.

**Tech Stack:** as Phases 1–2, plus Playwright. Prereqs: Phases 1–2 complete (Tasks 1–15), seed data loaded.

**Numbering continues from Phase 2.**

---

### Task 16: Swipe deck

**Files:**
- Create: `lib/deck.ts`, `app/(app)/swipe/page.tsx`, `components/swipe/SwipeDeck.tsx`, `components/swipe/SwipeCard.tsx`
- Modify: `app/actions/swipe.ts` (replace the Phase-2 stub)
- Test: `tests/unit/swipe-card.test.tsx`

- [ ] **Step 1: Replace `app/actions/swipe.ts` entirely** (stub → final: validation, no redirect — the deck advances client-side; detail-page likes get a redirect via a wrapper)

```ts
"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireUser } from "@/lib/auth";
import type { SwipeDirection } from "@/lib/types";

export async function swipeAction(listingId: string, direction: SwipeDirection): Promise<{ error?: string }> {
  if (direction !== "like" && direction !== "skip") return { error: "Invalid direction." };
  if (!/^[0-9a-f-]{36}$/i.test(listingId)) return { error: "Invalid listing." };

  const { supabase, user } = await requireUser();

  // Can't swipe on your own listing
  const { data: own } = await supabase
    .from("listings").select("id").eq("id", listingId).eq("owner_id", user.id).maybeSingle();
  if (own) return { error: "That's your own listing." };

  const { error } = await supabase.from("swipes").upsert(
    { seeker_id: user.id, listing_id: listingId, direction },
    { onConflict: "seeker_id,listing_id" }
  );
  if (error) return { error: "Could not save your swipe." };

  revalidatePath("/swipe");
  return {};
}

/** Used by the Browse detail page's "I'm interested" button. */
export async function likeFromBrowseAction(listingId: string): Promise<void> {
  await swipeAction(listingId, "like");
  redirect("/swipe");
}
```

Then in `app/(public)/browse/[id]/page.tsx`, change the form line to use the wrapper:

```tsx
<form action={likeFromBrowseAction.bind(null, listing.id)}>
```

(and update the import from `@/app/actions/swipe` accordingly).

- [ ] **Step 2: Create `lib/deck.ts`**

```ts
import { createClient } from "@/lib/supabase/server";
import { lifestyleScore, socialScore, sortKey } from "@/lib/compatibility";
import type { Listing, Profile } from "@/lib/types";

export interface DeckItem {
  listing: Listing;
  owner: Profile;
  lifestyle: number;
  social: number | null;
}

const DECK_SIZE = 20;

/**
 * Active listings the seeker hasn't swiped and doesn't own, scored and sorted
 * by sortKey DESC. Scores sort — they NEVER exclude (spec rule 6).
 */
export async function getDeck(seeker: Profile): Promise<DeckItem[]> {
  const supabase = await createClient();

  const { data: swiped } = await supabase
    .from("swipes").select("listing_id").eq("seeker_id", seeker.user_id);
  const swipedIds = new Set((swiped ?? []).map((s) => s.listing_id as string));

  const { data } = await supabase
    .from("listings")
    .select("*, owner:profiles(*)")
    .eq("is_active", true)
    .neq("owner_id", seeker.user_id)
    .limit(200);

  const rows = (data ?? []) as unknown as (Listing & { owner: Profile })[];
  return rows
    .filter((l) => !swipedIds.has(l.id))
    .map(({ owner, ...listing }) => ({
      listing: listing as Listing,
      owner,
      lifestyle: lifestyleScore(seeker, listing as Listing, owner, "seeker"),
      social: socialScore(seeker, owner),
    }))
    .sort((a, b) => sortKey(b.lifestyle, b.social) - sortKey(a.lifestyle, a.social))
    .slice(0, DECK_SIZE);
}
```

- [ ] **Step 3: Write the failing SwipeCard test** — `tests/unit/swipe-card.test.tsx`

```tsx
import { render, screen } from "@testing-library/react";
import { expect, test } from "vitest";
import { SwipeCard } from "@/components/swipe/SwipeCard";
import type { Listing, Profile } from "@/lib/types";

const owner: Profile = {
  user_id: "u2", full_name: "Noa Peretz", age: 26, occupation: "Designer", bio: "",
  avatar_url: null, smoker: false, has_pet: false, cleanliness: 4,
  sleep_schedule: "early", guests_freq: "sometimes",
  interests: ["Cooking", "Yoga"], ok_with_smoker: false, ok_with_pets: true,
  budget_min: 0, budget_max: 0, preferred_cities: [], earliest_move_in: null,
  created_at: "", updated_at: "",
};

const listing: Listing = {
  id: "l1", owner_id: "u2", title: "Sunlit room in Florentin", description: "",
  city: "Tel Aviv", neighborhood: "Florentin", rent: 2800, available_from: "2026-10-01",
  roommates_count: 2, pets_allowed: true, smoking_allowed: false,
  balcony: true, air_conditioning: true, parking: false, elevator: false, furnished: true,
  photo_urls: [], is_active: true, created_at: "", updated_at: "",
};

test("shows title, rent, both scores, and roommate identity", () => {
  render(<SwipeCard listing={listing} owner={owner} lifestyle={92} social={78} />);
  expect(screen.getByText("Sunlit room in Florentin")).toBeInTheDocument();
  expect(screen.getByText(/2,800/)).toBeInTheDocument();
  expect(screen.getByText(/92 lifestyle/i)).toBeInTheDocument();
  expect(screen.getByText(/78 social/i)).toBeInTheDocument();
  expect(screen.getByText(/Noa Peretz, 26/)).toBeInTheDocument();
});

test("low scores still render — never hidden", () => {
  render(<SwipeCard listing={listing} owner={owner} lifestyle={12} social={0} />);
  expect(screen.getByText(/12 lifestyle/i)).toBeInTheDocument();
  expect(screen.getByText(/0 social/i)).toBeInTheDocument();
});

test("null social renders the em-dash state", () => {
  render(<SwipeCard listing={listing} owner={owner} lifestyle={80} social={null} />);
  expect(screen.getByText(/— social/i)).toBeInTheDocument();
});
```

- [ ] **Step 4: Run to verify failure** — `npm test` → FAIL.

- [ ] **Step 5: Create `components/swipe/SwipeCard.tsx`**

```tsx
import { ScoreTag } from "@/components/ui/ScoreTag";
import { FEATURES } from "@/lib/constants";
import type { Listing, Profile } from "@/lib/types";

export function SwipeCard({
  listing, owner, lifestyle, social,
}: {
  listing: Listing;
  owner: Profile;
  lifestyle: number;
  social: number | null;
}) {
  const features = FEATURES.filter((f) => listing[f.key]).map((f) => f.label);

  return (
    <article className="overflow-hidden rounded-3xl border border-hairline bg-surface shadow-xl">
      <div className="relative h-64 bg-hairline">
        {listing.photo_urls[0] ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={listing.photo_urls[0]} alt={listing.title} className="h-full w-full object-cover" />
        ) : null}
        <div className="absolute right-3 top-3">
          <ScoreTag lifestyle={lifestyle} social={social} />
        </div>
      </div>
      <div className="p-5">
        <div className="flex items-baseline justify-between gap-2">
          <h2 className="font-serif text-xl font-semibold">{listing.title}</h2>
          <p className="whitespace-nowrap font-serif text-lg font-semibold">
            ₪{listing.rent.toLocaleString()}<span className="text-xs font-normal text-muted"> /mo</span>
          </p>
        </div>
        <p className="mt-0.5 text-xs text-muted">
          {listing.city}{listing.neighborhood ? ` — ${listing.neighborhood}` : ""} · move in{" "}
          {new Date(listing.available_from).toLocaleDateString("en-GB", { day: "numeric", month: "short" })}
        </p>
        <p className="mt-3 border-y border-hairline py-2.5 text-[10px] font-semibold uppercase tracking-[0.14em] text-muted">
          {listing.roommates_count} flatmate{listing.roommates_count === 1 ? "" : "s"} ·{" "}
          {listing.pets_allowed ? "Pets welcome" : "No pets"} ·{" "}
          {listing.smoking_allowed ? "Smoking OK" : "No smoking"}
        </p>
        {features.length > 0 ? <p className="mt-2 text-xs text-muted">{features.join(" · ")}</p> : null}
        <div className="mt-3 flex items-center gap-2.5 border-t border-hairline pt-3">
          {owner.avatar_url ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={owner.avatar_url} alt={owner.full_name} className="h-8 w-8 rounded-full object-cover" />
          ) : (
            <div className="h-8 w-8 rounded-full bg-hairline" />
          )}
          <p className="text-xs text-muted">
            Living here — <span className="font-medium text-ink">{owner.full_name}, {owner.age}</span>
            {owner.occupation ? ` · ${owner.occupation}` : ""}
          </p>
        </div>
      </div>
    </article>
  );
}
```

- [ ] **Step 6: Run to verify pass** — `npm test` → PASS.

- [ ] **Step 7: Create `components/swipe/SwipeDeck.tsx`**

```tsx
"use client";

import { useState, useTransition } from "react";
import { swipeAction } from "@/app/actions/swipe";
import { SwipeCard } from "@/components/swipe/SwipeCard";
import { EmptyState } from "@/components/ui/EmptyState";
import type { DeckItem } from "@/lib/deck";
import type { SwipeDirection } from "@/lib/types";

export function SwipeDeck({ items }: { items: DeckItem[] }) {
  const [index, setIndex] = useState(0);
  const [exiting, setExiting] = useState<SwipeDirection | null>(null);
  const [, startTransition] = useTransition();

  const current = items[index];
  if (!current) {
    return (
      <EmptyState
        title="No more rooms right now"
        hint="Check back later, or widen your preferences in your profile."
      />
    );
  }

  function swipe(direction: SwipeDirection) {
    if (exiting) return;
    const listingId = current.listing.id;
    setExiting(direction);
    // optimistic: advance after the exit animation; persist in the background
    setTimeout(() => {
      setIndex((i) => i + 1);
      setExiting(null);
    }, 220);
    startTransition(async () => {
      await swipeAction(listingId, direction);
    });
  }

  return (
    <div className="px-5">
      <div
        className={`transition-transform duration-200 ${
          exiting === "like" ? "translate-x-24 rotate-6 opacity-0" :
          exiting === "skip" ? "-translate-x-24 -rotate-6 opacity-0" : ""
        }`}
      >
        <SwipeCard
          listing={current.listing}
          owner={current.owner}
          lifestyle={current.lifestyle}
          social={current.social}
        />
      </div>
      <div className="mt-5 flex items-center justify-center gap-7">
        <button
          type="button"
          onClick={() => swipe("skip")}
          aria-label="Skip"
          className="flex h-14 w-14 items-center justify-center rounded-full border border-hairline bg-surface text-xl shadow-md hover:border-red-300"
        >
          <svg width="20" height="20" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" fill="none"><path d="M6 6l12 12M18 6L6 18" /></svg>
        </button>
        <button
          type="button"
          onClick={() => swipe("like")}
          aria-label="Like"
          className="flex h-14 w-14 items-center justify-center rounded-full bg-accent text-accent-contrast shadow-lg"
        >
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><path d="M12 20.5C12 20.5 4 15.3 4 9.9C4 6.9 6.3 4.9 8.8 4.9C10.3 4.9 11.5 5.7 12 6.4C12.5 5.7 13.7 4.9 15.2 4.9C17.7 4.9 20 6.9 20 9.9C20 15.3 12 20.5 12 20.5Z" /></svg>
        </button>
      </div>
      <p className="mt-3 text-center text-xs text-muted">{items.length - index} room{items.length - index === 1 ? "" : "s"} in your deck</p>
    </div>
  );
}
```

- [ ] **Step 8: Create `app/(app)/swipe/page.tsx`**

```tsx
import { requireProfile } from "@/lib/auth";
import { getDeck } from "@/lib/deck";
import { SwipeDeck } from "@/components/swipe/SwipeDeck";

export default async function SwipePage() {
  const { profile } = await requireProfile();
  const items = await getDeck(profile);
  return <SwipeDeck items={items} />;
}
```

- [ ] **Step 9: Manual verification**

Log in as `maya@demo.roommatch` (`Demo1234!`) → `/swipe` shows Noa's and Omer's listings, Noa's first (higher combined score for Maya). Both score tags visible. Swipe right on Noa's card → card animates out, next card appears; `swipes` table has the row. Refresh → the liked listing is gone from the deck.

- [ ] **Step 10: Commit**

```bash
git add -A && git commit -m "feat: swipe deck with dual compatibility scores and optimistic swiping"
```

---

### Task 17: Interested queue + match creation

**Files:**
- Create: `components/listings/InterestedQueue.tsx`
- Modify: `app/actions/swipe.ts` (add `respondToInterestAction`), `app/(app)/listing/page.tsx`

- [ ] **Step 1: Add to `app/actions/swipe.ts`** (append; keep existing exports)

```ts
export async function respondToInterestAction(
  swipeId: string,
  response: "liked" | "skipped"
): Promise<{ error?: string; matchId?: string }> {
  if (response !== "liked" && response !== "skipped") return { error: "Invalid response." };
  const { supabase } = await requireUser();

  // Server-authoritative: RLS blocks direct swipe updates & match inserts;
  // only this SECURITY DEFINER function can create a match.
  const { data, error } = await supabase.rpc("respond_to_interest", {
    p_swipe_id: swipeId,
    p_response: response,
  });
  if (error) return { error: "Could not save your response." };

  revalidatePath("/listing");
  revalidatePath("/matches");
  return { matchId: (data as string | null) ?? undefined };
}
```

- [ ] **Step 2: Create `components/listings/InterestedQueue.tsx`**

```tsx
"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { respondToInterestAction } from "@/app/actions/swipe";
import { scoreLabel } from "@/lib/compatibility";
import type { Profile } from "@/lib/types";

export interface InterestedSeeker {
  swipeId: string;
  seeker: Profile;
  lifestyle: number;
  social: number | null;
}

export function InterestedQueue({ seekers }: { seekers: InterestedSeeker[] }) {
  const [handled, setHandled] = useState<Record<string, "liked" | "skipped">>({});
  const [matched, setMatched] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function respond(swipeId: string, response: "liked" | "skipped") {
    startTransition(async () => {
      const result = await respondToInterestAction(swipeId, response);
      if (result.error) {
        setError(result.error);
        return;
      }
      setError(null);
      setHandled((h) => ({ ...h, [swipeId]: response }));
      if (result.matchId) setMatched(result.matchId);
    });
  }

  const open = seekers.filter((s) => !handled[s.swipeId]);

  return (
    <section className="mt-10 px-0">
      <h2 className="font-serif text-2xl font-semibold">Interested in your room</h2>
      <p className="mt-1 text-sm text-muted">
        Sorted by your compatibility with them — low scores are shown too. You decide.
      </p>

      {matched ? (
        <p role="status" className="mt-3 rounded-xl border border-accent bg-surface p-3 text-sm">
          It's a match! <Link href={`/matches/${matched}`} className="text-accent underline">Open the chat →</Link>
        </p>
      ) : null}
      {error ? <p role="alert" className="mt-3 text-sm text-red-600">{error}</p> : null}

      {open.length === 0 ? (
        <p className="mt-4 text-sm text-muted">No new interested seekers right now.</p>
      ) : (
        <ul className="mt-4 space-y-3">
          {open.map(({ swipeId, seeker, lifestyle, social }) => (
            <li key={swipeId} className="rounded-2xl border border-hairline bg-surface p-4">
              <div className="flex items-center gap-3">
                {seeker.avatar_url ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={seeker.avatar_url} alt={seeker.full_name} className="h-12 w-12 rounded-full object-cover" />
                ) : (
                  <div className="h-12 w-12 rounded-full bg-hairline" />
                )}
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium">{seeker.full_name}, {seeker.age}</p>
                  <p className="truncate text-xs text-muted">{seeker.occupation}</p>
                  <p className="mt-0.5 text-[10px] font-semibold uppercase tracking-widest text-muted">
                    {lifestyle} lifestyle ({scoreLabel(lifestyle)})
                    {" · "}
                    {social === null ? "— social" : `${social} social (${scoreLabel(social)})`}
                  </p>
                </div>
              </div>
              {seeker.bio ? <p className="mt-2 text-sm text-muted">{seeker.bio}</p> : null}
              {seeker.interests.length > 0 ? (
                <p className="mt-1 text-xs text-muted">Into: {seeker.interests.join(", ")}</p>
              ) : null}
              <div className="mt-3 flex gap-2">
                <button
                  type="button" disabled={pending}
                  onClick={() => respond(swipeId, "skipped")}
                  className="flex-1 rounded-xl border border-hairline py-2 text-sm font-medium text-muted hover:text-ink disabled:opacity-60"
                >
                  Skip
                </button>
                <button
                  type="button" disabled={pending}
                  onClick={() => respond(swipeId, "liked")}
                  className="flex-1 rounded-xl bg-accent py-2 text-sm font-semibold text-accent-contrast disabled:opacity-60"
                >
                  Like back
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
```

- [ ] **Step 3: Replace `app/(app)/listing/page.tsx` entirely** (form + queue)

```tsx
import { requireProfile } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { ListingForm } from "@/components/listings/ListingForm";
import { InterestedQueue, type InterestedSeeker } from "@/components/listings/InterestedQueue";
import { lifestyleScore, socialScore, sortKey } from "@/lib/compatibility";
import type { Listing, Profile, Swipe } from "@/lib/types";

export default async function MyListingPage() {
  const { profile, userId } = await requireProfile();
  const supabase = await createClient();

  const { data: listingData } = await supabase
    .from("listings")
    .select("*")
    .eq("owner_id", userId)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  const listing = (listingData as Listing | null) ?? null;

  let seekers: InterestedSeeker[] = [];
  if (listing) {
    const { data: swipeData } = await supabase
      .from("swipes")
      .select("*, seeker:profiles!swipes_seeker_id_fkey(*)")
      .eq("listing_id", listing.id)
      .eq("direction", "like")
      .eq("lister_response", "pending");

    const rows = (swipeData ?? []) as unknown as (Swipe & { seeker: Profile })[];
    seekers = rows
      .map((s) => ({
        swipeId: s.id,
        seeker: s.seeker,
        lifestyle: lifestyleScore(s.seeker, listing, profile, "lister"),
        social: socialScore(s.seeker, profile),
      }))
      .sort((a, b) => sortKey(b.lifestyle, b.social) - sortKey(a.lifestyle, a.social));
  }

  return (
    <div className="px-5 pb-10">
      <ListingForm listing={listing} />
      {listing ? <InterestedQueue seekers={seekers} /> : null}
    </div>
  );
}
```

Note: `ListingForm` already renders its own `px-5` wrapper from Phase 2 — remove the `px-5` from the form's root `<form className="px-5 pb-10">` → `className="pb-4"` so spacing isn't doubled.

- [ ] **Step 4: Manual verification (two browsers)**

Browser A: log in as `maya@demo.roommatch`, swipe right on Noa's listing. Browser B (incognito): log in as `noa@demo.roommatch` → `/listing` → Maya appears with her lifestyle + social scores → “Like back” → “It's a match!” banner with chat link. Supabase: `matches` row exists; `swipes.lister_response = 'liked'`. Also verify a direct SQL insert into `matches` as the `authenticated` role is rejected (RLS).

- [ ] **Step 5: Commit**

```bash
git add -A && git commit -m "feat: interested queue with directional scores and server-authoritative matching"
```

---

### Task 18: Matches list + realtime chat

**Files:**
- Create: `app/actions/chat.ts`, `app/(app)/matches/page.tsx`, `app/(app)/matches/[id]/page.tsx`, `components/matches/ChatThread.tsx`
- Test: `tests/unit/chat-thread.test.tsx`

- [ ] **Step 1: Create `app/actions/chat.ts`**

```ts
"use server";

import { requireUser } from "@/lib/auth";
import { messageSchema } from "@/lib/validation/message";

export async function sendMessageAction(
  matchId: string,
  content: string
): Promise<{ error?: string }> {
  const parsed = messageSchema.safeParse({ content });
  if (!parsed.success) return { error: "Message must be 1–2000 characters." };

  const { supabase, user } = await requireUser();
  // RLS enforces membership; sender_id must be the caller.
  const { error } = await supabase.from("messages").insert({
    match_id: matchId,
    sender_id: user.id,
    content: parsed.data.content,
  });
  if (error) return { error: "Could not send the message." };
  return {};
}
```

- [ ] **Step 2: Write the failing ChatThread test** — `tests/unit/chat-thread.test.tsx`

```tsx
import { render, screen } from "@testing-library/react";
import { expect, test, vi } from "vitest";

vi.mock("@/lib/supabase/client", () => ({
  createClient: () => ({
    channel: () => ({ on: vi.fn().mockReturnThis(), subscribe: vi.fn().mockReturnThis() }),
    removeChannel: vi.fn(),
  }),
}));
vi.mock("@/app/actions/chat", () => ({ sendMessageAction: vi.fn(async () => ({})) }));

import { ChatThread } from "@/components/matches/ChatThread";
import type { Message } from "@/lib/types";

const messages: Message[] = [
  { id: "m1", match_id: "x", sender_id: "me", content: "Hi! Is the room still free?", created_at: "2026-08-24T10:00:00Z" },
  { id: "m2", match_id: "x", sender_id: "them", content: "Yes! Want to visit?", created_at: "2026-08-24T10:05:00Z" },
];

test("renders both sides of the conversation", () => {
  render(<ChatThread matchId="x" myUserId="me" initialMessages={messages} otherName="Noa" />);
  expect(screen.getByText("Hi! Is the room still free?")).toBeInTheDocument();
  expect(screen.getByText("Yes! Want to visit?")).toBeInTheDocument();
  expect(screen.getByRole("textbox")).toBeInTheDocument();
  expect(screen.getByRole("button", { name: /send/i })).toBeInTheDocument();
});
```

- [ ] **Step 3: Run to verify failure** — `npm test` → FAIL.

- [ ] **Step 4: Create `components/matches/ChatThread.tsx`**

```tsx
"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { createClient } from "@/lib/supabase/client";
import { sendMessageAction } from "@/app/actions/chat";
import type { Message } from "@/lib/types";

export function ChatThread({
  matchId, myUserId, initialMessages, otherName,
}: {
  matchId: string;
  myUserId: string;
  initialMessages: Message[];
  otherName: string;
}) {
  const [messages, setMessages] = useState<Message[]>(initialMessages);
  const [draft, setDraft] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const supabase = createClient();
    const channel = supabase
      .channel(`match-${matchId}`)
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "messages", filter: `match_id=eq.${matchId}` },
        (payload) => {
          const message = payload.new as Message;
          setMessages((prev) => (prev.some((m) => m.id === message.id) ? prev : [...prev, message]));
        }
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [matchId]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages.length]);

  function send() {
    const content = draft.trim();
    if (!content || pending) return;
    setDraft("");
    // optimistic append; realtime insert is deduped by id
    const optimistic: Message = {
      id: `tmp-${Math.random().toString(36).slice(2)}`,
      match_id: matchId, sender_id: myUserId, content,
      created_at: new Date().toISOString(),
    };
    setMessages((prev) => [...prev, optimistic]);
    startTransition(async () => {
      const result = await sendMessageAction(matchId, content);
      if (result.error) {
        setError(result.error);
        setMessages((prev) => prev.filter((m) => m.id !== optimistic.id));
      } else {
        setError(null);
      }
    });
  }

  return (
    <div className="flex h-[calc(100dvh-180px)] flex-col px-5">
      <div className="flex-1 space-y-2 overflow-y-auto py-3">
        {messages.length === 0 ? (
          <p className="mt-10 text-center text-sm text-muted">
            You matched with {otherName}. Say hi!
          </p>
        ) : null}
        {messages.map((m) => {
          const mine = m.sender_id === myUserId;
          return (
            <div key={m.id} className={`flex ${mine ? "justify-end" : "justify-start"}`}>
              <p
                className={`max-w-[75%] whitespace-pre-line rounded-2xl px-3.5 py-2 text-sm ${
                  mine
                    ? "rounded-br-sm bg-accent text-accent-contrast"
                    : "rounded-bl-sm border border-hairline bg-surface"
                }`}
              >
                {m.content}
              </p>
            </div>
          );
        })}
        <div ref={bottomRef} />
      </div>
      {error ? <p role="alert" className="pb-1 text-xs text-red-600">{error}</p> : null}
      <form
        action={send}
        className="flex gap-2 border-t border-hairline py-3"
      >
        <input
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          maxLength={2000}
          placeholder={`Message ${otherName}…`}
          className="flex-1 rounded-xl border border-hairline bg-surface px-3 py-2.5 text-sm outline-none focus:border-accent"
        />
        <button
          type="submit"
          disabled={pending || draft.trim().length === 0}
          className="rounded-xl bg-accent px-5 text-sm font-semibold text-accent-contrast disabled:opacity-60"
        >
          Send
        </button>
      </form>
    </div>
  );
}
```

- [ ] **Step 5: Run to verify pass** — `npm test` → PASS.

- [ ] **Step 6: Create `app/(app)/matches/page.tsx`**

```tsx
import Link from "next/link";
import { requireProfile } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { EmptyState } from "@/components/ui/EmptyState";
import type { Listing, Match, Profile } from "@/lib/types";

type MatchRow = Match & { listing: Listing; seeker: Profile; lister: Profile };

export default async function MatchesPage() {
  const { userId } = await requireProfile();
  const supabase = await createClient();
  const { data } = await supabase
    .from("matches")
    .select(
      "*, listing:listings(*), seeker:profiles!matches_seeker_id_fkey(*), lister:profiles!matches_lister_id_fkey(*)"
    )
    .order("created_at", { ascending: false });

  const matches = ((data ?? []) as unknown as MatchRow[]);

  return (
    <main className="px-5 pb-10">
      <h1 className="font-serif text-3xl font-semibold">Matches</h1>
      {matches.length === 0 ? (
        <EmptyState title="No matches yet" hint="Swipe right on rooms you like — when the roommates like you back, they'll appear here." />
      ) : (
        <ul className="mt-4 space-y-3">
          {matches.map((m) => {
            const other = m.seeker_id === userId ? m.lister : m.seeker;
            return (
              <li key={m.id}>
                <Link href={`/matches/${m.id}`} className="flex items-center gap-3 rounded-2xl border border-hairline bg-surface p-4 hover:shadow-md">
                  {other.avatar_url ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={other.avatar_url} alt={other.full_name} className="h-12 w-12 rounded-full object-cover" />
                  ) : (
                    <div className="h-12 w-12 rounded-full bg-hairline" />
                  )}
                  <div className="min-w-0">
                    <p className="text-sm font-medium">{other.full_name}</p>
                    <p className="truncate text-xs text-muted">{m.listing.title}</p>
                  </div>
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </main>
  );
}
```

- [ ] **Step 7: Create `app/(app)/matches/[id]/page.tsx`**

```tsx
import { notFound } from "next/navigation";
import { requireProfile } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { ChatThread } from "@/components/matches/ChatThread";
import type { Listing, Match, Message, Profile } from "@/lib/types";

type MatchRow = Match & { listing: Listing; seeker: Profile; lister: Profile };

export default async function ChatPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { userId } = await requireProfile();
  const supabase = await createClient();

  // RLS: returns null unless the caller is a participant — that IS the authorization.
  const { data } = await supabase
    .from("matches")
    .select(
      "*, listing:listings(*), seeker:profiles!matches_seeker_id_fkey(*), lister:profiles!matches_lister_id_fkey(*)"
    )
    .eq("id", id)
    .maybeSingle();
  const match = data as MatchRow | null;
  if (!match) notFound();

  const { data: messageData } = await supabase
    .from("messages")
    .select("*")
    .eq("match_id", id)
    .order("created_at", { ascending: true })
    .limit(100);

  const other = match.seeker_id === userId ? match.lister : match.seeker;

  return (
    <div>
      <div className="border-b border-hairline px-5 pb-3">
        <p className="font-serif text-xl font-semibold">{other.full_name}</p>
        <p className="text-xs text-muted">{match.listing.title}</p>
      </div>
      <ChatThread
        matchId={id}
        myUserId={userId}
        initialMessages={(messageData ?? []) as Message[]}
        otherName={other.full_name.split(" ")[0]}
      />
    </div>
  );
}
```

- [ ] **Step 8: Manual verification (two browsers)**

Maya and Noa (from Task 17's match): both open `/matches` → the match is listed. Open the chat in both browsers; send from Maya → appears instantly in Noa's window without refresh (Realtime). Copy the match URL, open it as `omer@demo.roommatch` → 404 (RLS). Send a 0-char message → button disabled.

- [ ] **Step 9: Commit**

```bash
git add -A && git commit -m "feat: matches list and realtime chat with optimistic sends"
```

---

### Task 19: Playwright E2E — the money flows

**Files:**
- Create: `playwright.config.ts`, `tests/e2e/core-flows.spec.ts`
- Modify: `package.json` (e2e script), `vitest.config.ts` already excludes e2e (include-list covers it)

- [ ] **Step 1: Install Playwright**

```bash
npm i -D @playwright/test
npx playwright install chromium
```

- [ ] **Step 2: Create `playwright.config.ts`**

```ts
import { defineConfig } from "@playwright/test";

export default defineConfig({
  testDir: "tests/e2e",
  timeout: 60_000,
  retries: 1,
  use: {
    baseURL: "http://localhost:3000",
    trace: "retain-on-failure",
  },
  webServer: {
    command: "npm run dev",
    url: "http://localhost:3000",
    reuseExistingServer: true,
    timeout: 120_000,
  },
});
```

Add to `package.json` scripts: `"e2e": "playwright test"`.

- [ ] **Step 3: Create `tests/e2e/core-flows.spec.ts`**

Runs against the dev server + the real Supabase project. Uses fresh throwaway accounts per run (timestamped emails) so it's rerunnable; assumes seed data exists (`npm run seed`).

```ts
import { test, expect, type Page } from "@playwright/test";

const RUN = Date.now();
const PASSWORD = "E2ePassw0rd!";
const seekerEmail = `e2e-seeker-${RUN}@demo.roommatch`;
const listerEmail = `e2e-lister-${RUN}@demo.roommatch`;
const LISTING_TITLE = `E2E flat ${RUN}`;

async function signUp(page: Page, email: string) {
  await page.goto("/signup");
  await page.getByLabel(/email/i).fill(email);
  await page.getByLabel(/password/i).fill(PASSWORD);
  await page.getByRole("button", { name: /sign up/i }).click();
  await page.waitForURL(/\/profile/);
}

async function fillProfile(page: Page, name: string, interests: string[]) {
  await page.getByLabel(/full name/i).fill(name);
  await page.getByLabel(/^age/i).fill("25");
  for (const tag of interests) {
    await page.getByRole("checkbox", { name: tag, exact: true }).check();
  }
  await page.getByRole("button", { name: /save profile/i }).click();
  await page.waitForURL(/\/swipe/);
}

test.describe.serial("core flows", () => {
  test("anonymous can browse but is walled off from swiping", async ({ page }) => {
    await page.goto("/browse");
    await expect(page.getByRole("heading", { name: /find a room/i })).toBeVisible();
    await page.goto("/swipe");
    await expect(page).toHaveURL(/\/login/); // redirected — the permission wall
  });

  test("signup → profile → the deck shows rooms with both scores", async ({ page }) => {
    await signUp(page, seekerEmail);
    await fillProfile(page, "E2E Seeker", ["Music", "Cooking", "Travel"]);
    await expect(page.getByText(/lifestyle/i).first()).toBeVisible();
    await expect(page.getByText(/social/i).first()).toBeVisible();
  });

  test("lister posts a room; seeker likes it; mutual like creates a match; chat works", async ({ browser }) => {
    // Lister
    const listerCtx = await browser.newContext();
    const lister = await listerCtx.newPage();
    await signUp(lister, listerEmail);
    await fillProfile(lister, "E2E Lister", ["Music", "Tech", "Hiking"]);
    await lister.goto("/listing");
    await lister.getByLabel(/title/i).fill(LISTING_TITLE);
    await lister.getByLabel(/rent/i).fill("2500");
    await lister.getByLabel(/available from/i).fill("2026-10-01");
    await lister.getByRole("button", { name: /publish listing/i }).click();
    await expect(lister.getByText(/saved/i)).toBeVisible();

    // Seeker likes it from the browse detail page (deterministic target)
    const seekerCtx = await browser.newContext();
    const seeker = await seekerCtx.newPage();
    await seeker.goto("/login");
    await seeker.getByLabel(/email/i).fill(seekerEmail);
    await seeker.getByLabel(/password/i).fill(PASSWORD);
    await seeker.getByRole("button", { name: /log in/i }).click();
    await seeker.waitForURL(/\/swipe/);
    await seeker.goto("/browse");
    await seeker.getByRole("link", { name: new RegExp(LISTING_TITLE) }).click();
    await seeker.getByRole("button", { name: /i'm interested/i }).click();
    await seeker.waitForURL(/\/swipe/);

    // Lister likes back → match
    await lister.goto("/listing");
    await expect(lister.getByText("E2E Seeker, 25")).toBeVisible();
    await lister.getByRole("button", { name: /like back/i }).click();
    await expect(lister.getByText(/it's a match/i)).toBeVisible();

    // Chat both ways
    await lister.getByRole("link", { name: /open the chat/i }).click();
    await lister.getByRole("textbox").fill("Hey! Want to come see the flat?");
    await lister.getByRole("button", { name: /send/i }).click();

    await seeker.goto("/matches");
    await seeker.getByRole("link", { name: /E2E Lister/i }).click();
    await expect(seeker.getByText("Hey! Want to come see the flat?")).toBeVisible();
    await seeker.getByRole("textbox").fill("Yes! Tomorrow evening?");
    await seeker.getByRole("button", { name: /send/i }).click();
    await expect(lister.getByText("Yes! Tomorrow evening?")).toBeVisible({ timeout: 10_000 });

    // Data isolation: a third party cannot open their chat
    const strangerCtx = await browser.newContext();
    const stranger = await strangerCtx.newPage();
    await stranger.goto("/login");
    await stranger.getByLabel(/email/i).fill("maya@demo.roommatch");
    await stranger.getByLabel(/password/i).fill("Demo1234!");
    await stranger.getByRole("button", { name: /log in/i }).click();
    const chatUrl = lister.url();
    await stranger.goto(chatUrl);
    await expect(stranger.getByText(/not found|404/i)).toBeVisible();

    await listerCtx.close();
    await seekerCtx.close();
    await strangerCtx.close();
  });
});
```

- [ ] **Step 4: Run**

`npm run seed` (if not already), then `npm run e2e` → Expected: 3 passed. If the realtime assertion flakes, re-check that `alter publication supabase_realtime add table public.messages` ran in Task 6.

- [ ] **Step 5: Commit**

```bash
git add -A && git commit -m "test: Playwright E2E for browse wall, onboarding, match, chat, and data isolation"
```

---

### Task 20: README — local run instructions & env vars (assignment deliverable #9)

**Files:**
- Create/Replace: `README.md`

- [ ] **Step 1: Replace `README.md` entirely**

```markdown
# RoomMatch

Find the room *and* the roommates. A two-sided marketplace for shared apartments:
seekers swipe on rooms, listers review interested seekers, a mutual like opens an
in-app chat. Two transparent compatibility scores — **Lifestyle** and **Social**
(shared interests) — inform every decision but never filter anyone out.

**Live app:** <VERCEL-URL — filled in after Task 21>
**Stack:** Next.js 15 · TypeScript · Tailwind CSS 4 · Supabase (Postgres + Auth + Storage + Realtime) · Vercel

## Local development

Prereqs: Node 20+, a free Supabase project.

1. `npm install`
2. Create `.env.local` from `.env.example` (see variables below).
3. Apply the database schema: open the Supabase dashboard → SQL Editor → run
   `supabase/migrations/0001_init.sql`.
4. In Supabase → Authentication → Providers → Email: disable "Confirm email".
5. (Recommended) `npm run seed` — creates demo users (password `Demo1234!`):
   `noa@demo.roommatch` (lister), `omer@demo.roommatch` (lister), `maya@demo.roommatch` (seeker).
6. `npm run dev` → http://localhost:3000

## Environment variables

| Variable | Where used | Notes |
|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | client + server | Project URL. Public by design. |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | client + server | Anonymous key; every request it makes is constrained by Row Level Security. |
| `SUPABASE_SERVICE_ROLE_KEY` | `scripts/seed.ts` only | **Secret.** Bypasses RLS; never shipped to the browser, never committed. |

## Scripts

| Command | What it does |
|---|---|
| `npm run dev` | Dev server |
| `npm test` | Unit + component tests (Vitest + Testing Library) |
| `npm run e2e` | End-to-end flows (Playwright; needs seeded Supabase) |
| `npm run seed` | Idempotent demo data |
| `npm run build` | Production build |

## Project structure

- `app/(public)` — landing, browse, listing detail (no login needed)
- `app/(auth)` — login / signup
- `app/(app)` — swipe, matches + chat, my listing, profile (login required)
- `app/actions` — all server actions (mutations)
- `app/api/listings` — public, filterable, paginated REST endpoint
- `lib` — Supabase clients, compatibility engines, validation schemas, queries
- `supabase/migrations` — schema, RLS policies, match function, storage, realtime
- `tests` — unit (Vitest) and e2e (Playwright)

## Documentation

Product spec, technical design, test spec, scale and security documents live in `docs/`.
```

- [ ] **Step 2: Commit**

```bash
git add README.md && git commit -m "docs: README with local run instructions and env var explanation"
```

---

### Task 21: Deploy — GitHub + Vercel

**Files:** none (infrastructure); Modify: `README.md` (live URL)

- [ ] **Step 1: Production build gate**

```bash
npm run build
```

Expected: build succeeds with no type errors. Fix anything it surfaces before deploying.

- [ ] **Step 2: Push to GitHub**

```bash
gh repo create roommatch --private --source . --push
```

(If `gh` is not authenticated: create an empty repo named `roommatch` on github.com, then `git remote add origin <url> && git push -u origin main`.)

- [ ] **Step 3: Import to Vercel (dashboard)**

vercel.com → Add New Project → import the `roommatch` repo → Framework: Next.js (auto) → add env vars `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, and `SUPABASE_SERVICE_ROLE_KEY` (all three, values from `.env.local`) → Deploy.

- [ ] **Step 4: Point Supabase auth at production**

Supabase dashboard → Authentication → URL Configuration → set Site URL to the Vercel URL and add it to Redirect URLs.

- [ ] **Step 5: Production smoke test**

On the live URL: ① anonymous `/browse` shows seeded listings; ② `/swipe` redirects to login; ③ log in as `maya@demo.roommatch` → swipe works with both scores; ④ dark-mode toggle persists across reload; ⑤ open a match chat and send a message.

- [ ] **Step 6: Record the URL + final commit**

Replace `<VERCEL-URL — filled in after Task 21>` in `README.md` with the real URL.

```bash
git add README.md && git commit -m "docs: add live deployment URL" && git push
```

---

## Phase 3 exit criteria (= implementation done)

- `npm test` and `npm run e2e` fully green; `npm run build` clean.
- Live Vercel URL: anonymous browse works, matching + realtime chat work, RLS isolation verified.
- README documents local run + env vars.

**Remaining assignment deliverables (separate docs effort, not code):** product spec doc, technical design doc, test spec doc, scale doc, security doc, and the 10–15 min presentation — all seeded by `docs/superpowers/specs/2026-08-24-roommatch-design.md` §§8–10 and the implemented reality.
