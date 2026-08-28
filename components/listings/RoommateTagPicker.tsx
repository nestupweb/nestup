"use client";

import { useEffect, useId, useRef, useState } from "react";
import { searchMembersAction } from "@/app/actions/co-posters";
import { Avatar } from "@/components/ui/Avatar";
import {
  MIN_MEMBER_QUERY,
  maxTaggedRoommates,
  tagCapError,
  tagCapHint,
  tagStatusLabel,
  type TaggedMember,
} from "@/lib/co-posters";

const input =
  "mt-1 w-full rounded-xl border border-hairline bg-surface px-3 py-2.5 text-sm text-ink outline-none focus:border-accent disabled:opacity-60";
const label = "block text-xs font-medium uppercase tracking-widest text-muted";

/**
 * "Who else lives here" — the creator tags the roommates who share the home,
 * and each of them is asked to confirm before the room joins their profile.
 *
 * The cap is `roommates_count - 1`, recomputed as the member edits that number
 * (which is why the parent owns it): one of the rooms is the one being
 * advertised, and it stays open for whoever answers the ad. This is the
 * courteous version of the rule — `invite_listing_roommates` enforces it again
 * in the database, where it cannot be skipped.
 *
 * Nobody is added to anything here. Publishing only *asks*; the tagged member
 * decides on their own Profile page.
 */
export function RoommateTagPicker({
  initial,
  roommatesCount,
  listingId,
}: {
  initial: TaggedMember[];
  roommatesCount: number;
  /** Lets the search treat this room's own roommates as still available. */
  listingId?: string;
}) {
  const [tagged, setTagged] = useState<TaggedMember[]>(initial);
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<TaggedMember[]>([]);
  /** The query `results` answer, so "are we still waiting?" is derived, not tracked. */
  const [resultsFor, setResultsFor] = useState("");
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(-1);
  const listId = useId();
  const boxRef = useRef<HTMLDivElement>(null);

  const max = maxTaggedRoommates(roommatesCount);
  const full = tagged.length >= max;
  const capError = tagCapError(tagged.length, roommatesCount);

  const q = query.trim();
  const tooShort = q.length < MIN_MEMBER_QUERY;
  const searching = open && !tooShort && resultsFor !== q;

  // Debounced, and only ever writing state from the timer — a search that the
  // member has already typed past is dropped rather than landing late over a
  // newer one.
  useEffect(() => {
    if (tooShort || resultsFor === q) return;
    let cancelled = false;
    const timer = setTimeout(async () => {
      const { members } = await searchMembersAction(q, listingId);
      if (cancelled) return;
      setResults(members);
      setResultsFor(q);
      setActive(-1);
    }, 300);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [q, tooShort, resultsFor, listingId]);

  // Clicking away closes the suggestions without clearing what was typed.
  useEffect(() => {
    function onDown(e: MouseEvent) {
      if (boxRef.current && !boxRef.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, []);

  const shown =
    open && !tooShort && resultsFor === q
      ? results.filter((m) => !tagged.some((t) => t.user_id === m.user_id))
      : [];

  function add(member: TaggedMember) {
    if (full || tagged.some((t) => t.user_id === member.user_id)) return;
    setTagged((prev) => [...prev, { ...member, status: undefined }]);
    setQuery("");
    setOpen(false);
    setActive(-1);
  }

  function remove(userId: string) {
    setTagged((prev) => prev.filter((t) => t.user_id !== userId));
  }

  function onKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (shown.length === 0) return;
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setActive((i) => (i + 1) % shown.length);
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActive((i) => (i <= 0 ? shown.length - 1 : i - 1));
    } else if (e.key === "Enter" && active >= 0) {
      e.preventDefault();
      const pick = shown[active];
      if (pick) add(pick);
    } else if (e.key === "Escape") {
      setResults([]);
      setActive(-1);
    }
  }

  return (
    <div>
      {/* What the form posts. The picker's own input is never submitted. */}
      {tagged.map((t) => (
        <input key={t.user_id} type="hidden" name="tagged_roommates" value={t.user_id} />
      ))}

      <div className="flex items-baseline justify-between gap-3">
        <label className={label} htmlFor={`${listId}-search`}>
          Tag your roommates
        </label>
        <span className={`text-xs ${full ? "text-accent" : "text-muted"}`}>{tagCapHint(tagged.length, roommatesCount)}</span>
      </div>

      <div ref={boxRef} className="relative">
        <input
          id={`${listId}-search`}
          type="search"
          autoComplete="off"
          role="combobox"
          aria-expanded={shown.length > 0}
          aria-controls={listId}
          aria-autocomplete="list"
          disabled={max === 0 || full}
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            setOpen(true);
          }}
          onFocus={() => setOpen(true)}
          onKeyDown={onKeyDown}
          placeholder={
            max === 0
              ? "Raise “Current roommates” to tag anyone"
              : full
                ? "Every spot is tagged"
                : "Search members by name"
          }
          className={input}
        />

        {shown.length > 0 ? (
          <ul
            id={listId}
            role="listbox"
            className="absolute z-20 mt-1 max-h-72 w-full overflow-y-auto rounded-xl border border-hairline bg-surface py-1 shadow-[0_16px_40px_-16px_rgba(0,0,0,0.5)]"
          >
            {shown.map((m, i) => (
              <li key={m.user_id} role="option" aria-selected={i === active}>
                <button
                  type="button"
                  onMouseEnter={() => setActive(i)}
                  onClick={() => add(m)}
                  className={`flex w-full items-center gap-3 px-3 py-2 text-left ${i === active ? "bg-hairline/60" : ""}`}
                >
                  <Avatar url={m.avatar_url} name={m.full_name} size={10} />
                  <span className="min-w-0">
                    <span className="block truncate text-sm text-ink">{m.full_name}</span>
                    {m.occupation ? <span className="block truncate text-xs text-muted">{m.occupation}</span> : null}
                  </span>
                </button>
              </li>
            ))}
          </ul>
        ) : null}
      </div>

      {searching ? <p className="mt-2 text-xs text-muted">Searching…</p> : null}
      {!searching && query.trim().length >= MIN_MEMBER_QUERY && shown.length === 0 ? (
        <p className="mt-2 text-xs text-muted">
          Nobody free by that name — members who already have a listing of their own, or who have
          joined another home, can&rsquo;t be tagged.
        </p>
      ) : null}

      {tagged.length > 0 ? (
        <ul className="mt-3 space-y-2">
          {tagged.map((t) => (
            <li key={t.user_id} className="flex items-center gap-3 rounded-xl border border-hairline px-3 py-2">
              <Avatar url={t.avatar_url} name={t.full_name} size={10} />
              <span className="min-w-0 flex-1">
                <span className="block truncate text-sm text-ink">{t.full_name}</span>
                <span className="block truncate text-xs text-muted">{tagStatusLabel(t.status)}</span>
              </span>
              <button
                type="button"
                onClick={() => remove(t.user_id)}
                aria-label={`Remove ${t.full_name}`}
                className="shrink-0 rounded-full border border-hairline px-3 py-1 text-xs font-semibold text-muted transition-colors hover:border-danger hover:text-danger"
              >
                Remove
              </button>
            </li>
          ))}
        </ul>
      ) : null}

      {capError ? (
        <p role="alert" className="mt-3 text-sm text-danger">
          {capError}
        </p>
      ) : null}
    </div>
  );
}
