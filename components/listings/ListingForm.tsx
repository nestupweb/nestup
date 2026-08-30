"use client";

import { useEffect, useRef, useState } from "react";
import { saveListingAction, type ListingFormState } from "@/app/actions/listing";
import { CityCombobox } from "@/components/ui/CityCombobox";
import { PhotoPicker } from "@/components/listings/PhotoPicker";
import { RoommateTagPicker } from "@/components/listings/RoommateTagPicker";
import type { TaggedMember } from "@/lib/co-posters";
import { ViewingHoursEditor } from "@/components/listings/ViewingHoursEditor";
import { DatePicker } from "@/components/ui/DatePicker";
import { AmountInput } from "@/components/ui/AmountInput";
import { Select } from "@/components/ui/Select";
import { PinField } from "@/components/map/PinField";
import { pointOf } from "@/lib/geo";
import { normalizeSlots } from "@/lib/availability";
import { useStickyForm } from "@/lib/hooks";
import { FEATURES, GENDERS, LEASE_TERMS, MAX_LISTING_PHOTOS, MIN_LISTING_PHOTOS, PROPERTY_TYPES, SAFE_ROOM_OPTIONS } from "@/lib/constants";
import type { Listing } from "@/lib/types";

const input =
  "mt-1 w-full rounded-xl border border-hairline bg-surface px-3 py-2.5 text-sm text-ink outline-none focus:border-accent";
const label = "block text-xs font-medium uppercase tracking-widest text-muted";
const section = "mt-9 border-t border-hairline pt-6";
const heading = "text-lg font-semibold";
const check = "flex items-center gap-2 text-sm";

export function ListingForm({
  listing,
  userId,
  taggedRoommates = [],
  canTagRoommates = true,
}: {
  listing: Listing | null;
  userId: string;
  /** Roommates already tagged on this listing, with each one's answer. */
  taggedRoommates?: TaggedMember[];
  /**
   * False for a confirmed roommate editing a room they co-own: they may change
   * every detail, but tagging stays with the member who created it (0033).
   */
  canTagRoommates?: boolean;
}) {
  const [state, form, pending] = useStickyForm<ListingFormState>(saveListingAction, {});
  // Open on a room that already has a requirement, so editing shows the rule
  // as it stands rather than as if there were none.
  const [genderOnly, setGenderOnly] = useState(Boolean(listing?.wanted_gender));
  // Tracked (not just left as defaultValue) so PinField can preview where the
  // room will land as these are typed, before the form is ever submitted.
  const [city, setCity] = useState(listing?.city ?? "");
  const [street, setStreet] = useState(listing?.street ?? "");
  const [houseNumber, setHouseNumber] = useState(listing?.house_number ?? "");
  // Controlled, because the co-poster cap is `roommates_count - 1` and has to
  // move the moment this number does.
  const [roommatesCount, setRoommatesCount] = useState(listing?.roommates_count ?? 1);
  // The input's own text is tracked separately from roommatesCount so the field
  // can sit empty mid-edit instead of snapping to "0" on every backspace; only
  // onBlur forces it back to a valid number (below).
  const [roommatesCountText, setRoommatesCountText] = useState(String(listing?.roommates_count ?? 1));
  // A validation message lands next to the button, below a long form — bring it into view.
  const alertRef = useRef<HTMLParagraphElement>(null);
  useEffect(() => {
    if (state.error) alertRef.current?.scrollIntoView({ behavior: "smooth", block: "center" });
  }, [state.error]);

  return (
    <form {...form} className="mx-auto w-full max-w-3xl px-4 pb-12 sm:px-6">
      <h1 className="text-3xl font-bold">
        {listing ? (canTagRoommates ? "Your listing" : "Your shared listing") : "List your room"}
      </h1>
      <p className="mt-1 text-sm text-muted">
        {!listing
          ? "Post a room and start reviewing interested seekers."
          : canTagRoommates
            ? "Edit details or pause the listing."
            : "You co-post this room. Your changes are the same room everyone else sees."}
      </p>

      {listing ? <input type="hidden" name="listing_id" value={listing.id} /> : null}

      {/* ===== Photos ===== */}
      <section id="photos" className={`${section} scroll-mt-24`}>
        <h2 className={heading}>Photos</h2>
        <p className="mt-1 text-sm text-muted">
          {MIN_LISTING_PHOTOS}–{MAX_LISTING_PHOTOS} photos. Include the living room, a bedroom and the bathroom, and tag each
          photo with the room it shows. Each photo is checked as you add it: anything that isn&rsquo;t a photo of the
          apartment is removed on the spot, and a photo tagged with the wrong room is re-tagged to the room it shows.
        </p>
        <PhotoPicker userId={userId} initialUrls={listing?.photo_urls ?? []} initialLabels={listing?.photo_labels ?? []} />
      </section>

      {/* ===== Address ===== */}
      <section className={section}>
        <h2 className={heading}>Address</h2>
        <div className="mt-3 grid grid-cols-2 gap-3">
          <label className={label} htmlFor="listing-city">
            City *
            <CityCombobox id="listing-city" name="city" required defaultValue={listing?.city ?? ""} onChange={setCity} />
          </label>
          <label className={label}>
            Area
            <input name="neighborhood" maxLength={80} defaultValue={listing?.neighborhood ?? ""} placeholder="Optional" className={input} />
          </label>
          <label className={label}>
            Street *
            <input
              name="street"
              required
              minLength={2}
              maxLength={80}
              value={street}
              onChange={(e) => setStreet(e.target.value)}
              className={input}
            />
          </label>
          <label className={label}>
            House number *
            <input
              name="house_number"
              required
              maxLength={10}
              value={houseNumber}
              onChange={(e) => setHouseNumber(e.target.value)}
              className={input}
            />
          </label>
        </div>
        <div className="mt-3">
          <PinField
            initial={pointOf({ lat: listing?.lat ?? null, lng: listing?.lng ?? null })}
            street={street}
            houseNumber={houseNumber}
            city={city}
            hasPoint={Boolean(listing?.lat && listing?.lng)}
          />
        </div>
      </section>

      {/* ===== Description ===== */}
      <section className={section}>
        <label className={label}>
          Description
          <textarea name="description" maxLength={2000} rows={4} defaultValue={listing?.description ?? ""} className={input} />
        </label>
      </section>

      {/* ===== The home ===== */}
      <section className={section}>
        <h2 className={heading}>The home</h2>
        <div className="mt-3 grid grid-cols-2 gap-3 md:grid-cols-4">
          <label className={label}>
            Property type
            <select name="property_type" required defaultValue={listing?.property_type ?? "apartment"} className={input}>
              {PROPERTY_TYPES.map((p) => (
                <option key={p.key} value={p.key}>{p.label}</option>
              ))}
            </select>
          </label>
          <label className={label}>
            Rooms
            <input name="rooms" type="number" required min={1} max={12} step={0.5} defaultValue={listing?.rooms ?? 3} className={input} />
          </label>
          <label className={label}>
            Size (m²)
            <input name="size_sqm" type="number" min={10} max={1000} defaultValue={listing?.size_sqm ?? ""} className={input} />
          </label>
          <label className={label}>
            Rent (₪ / month)
            <AmountInput name="rent" required defaultValue={listing?.rent ?? ""} className={input} />
          </label>
        </div>
        <div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-3">
          <label className={label}>
            Entrance date
            <DatePicker name="available_from" defaultValue={listing?.available_from ?? ""} placeholder="Pick a date" />
          </label>
          <label className={label}>
            For how long
            {/* A rough duration, never an end date (user decision). */}
            <select name="lease_term" defaultValue={listing?.lease_term ?? "flexible"} className={input}>
              {LEASE_TERMS.map((t) => (
                <option key={t.key} value={t.key}>{t.label}</option>
              ))}
            </select>
          </label>
          <label className={`${label} col-span-2 sm:col-span-1`}>
            Current roommates
            <input
              name="roommates_count"
              type="number"
              required
              min={0}
              max={10}
              value={roommatesCountText}
              onChange={(e) => {
                const raw = e.target.value;
                setRoommatesCountText(raw);
                const parsed = Number(raw);
                if (raw !== "" && Number.isFinite(parsed) && parsed >= 0) setRoommatesCount(parsed);
              }}
              onFocus={(e) => e.target.select()}
              onBlur={(e) => {
                const parsed = Number(e.target.value);
                const next = e.target.value === "" || !Number.isFinite(parsed) || parsed <= 0 ? 1 : parsed;
                setRoommatesCount(next);
                setRoommatesCountText(String(next));
              }}
              className={input}
            />
          </label>
        </div>
      </section>

      {/* ===== Who else lives here ===== */}
      {canTagRoommates ? (
      <section className={section}>
        <h2 className={heading}>Who else lives here</h2>
        <p className="mt-1 text-sm text-muted">
          Post the room together with the roommates you already live with. Each of them is asked to confirm before
          the room appears on their profile — you can tag {Math.max(roommatesCount - 1, 0)} of your{" "}
          {roommatesCount} current roommate{roommatesCount === 1 ? "" : "s"}, because the last room is the one you
          are advertising.
        </p>
        <div className="mt-3">
          <RoommateTagPicker
            initial={taggedRoommates}
            roommatesCount={roommatesCount}
            listingId={listing?.id}
          />
        </div>
      </section>
      ) : null}

      {/* ===== House rules & features ===== */}
      <section className={section}>
        <h2 className={heading}>House rules &amp; features</h2>
        <div className="mt-3 flex flex-wrap gap-x-6 gap-y-2.5">
          <label className={check}><input type="checkbox" name="pets_allowed" defaultChecked={listing?.pets_allowed} /> Pets allowed</label>
          <label className={check}><input type="checkbox" name="smoking_allowed" defaultChecked={listing?.smoking_allowed} /> Smoking allowed</label>
          {FEATURES.map((f) => (
            <label key={f.key} className={check}>
              <input type="checkbox" name={f.key} defaultChecked={Boolean(listing?.[f.key])} /> {f.label}
            </label>
          ))}
        </div>

        {/*
          The toggle is a control, not a column: what gets saved is the
          requirement itself, so switching it off submits an empty value and
          the room goes back to being open to anyone. Same four options as
          everywhere else — one list, in lib/constants.
        */}
        <div className="mt-5">
          <label className={check}>
            <input
              type="checkbox"
              checked={genderOnly}
              onChange={(e) => setGenderOnly(e.target.checked)}
            />
            Looking for a specific gender only
          </label>
          {genderOnly ? (
            <div className="mt-2 max-w-xs">
              <Select name="wanted_gender" aria-label="Which gender" defaultValue={listing?.wanted_gender ?? ""}>
                <option value="">Choose a gender</option>
                {GENDERS.map((g) => (
                  <option key={g.key} value={g.key}>{g.label}</option>
                ))}
              </Select>
              <p className="mt-1.5 text-xs text-muted">
                Only members of that gender will be shown this room.
              </p>
            </div>
          ) : null}
        </div>

        <fieldset className="mt-5">
          <legend className={label}>Mamad (safe room)</legend>
          <div className="mt-2 flex flex-wrap gap-x-6 gap-y-2">
            {SAFE_ROOM_OPTIONS.map((o) => (
              <label key={o.key} className={check}>
                <input type="radio" name="safe_room" value={o.key} defaultChecked={(listing?.safe_room ?? "none") === o.key} /> {o.label}
              </label>
            ))}
          </div>
        </fieldset>

        <label className={`${label} mt-5`}>
          Food restrictions
          <input
            name="food_restrictions"
            maxLength={200}
            defaultValue={listing?.food_restrictions ?? ""}
            placeholder="e.g. kosher kitchen, vegetarian only — leave empty if none"
            className={input}
          />
        </label>
      </section>

      {/* ===== Viewing hours ===== */}
      <section className={section}>
        <h2 className={heading}>Viewing hours</h2>
        <p className="mt-1 text-sm text-muted">
          When can seekers come by? In the chat they can only request times inside these hours, and you approve each
          viewing before it goes on the calendar.
        </p>
        <ViewingHoursEditor initial={normalizeSlots(listing?.viewing_slots)} />
      </section>

      {listing ? (
        <label className={`${check} mt-6`}>
          <input type="checkbox" name="is_active" defaultChecked={listing.is_active} /> Listing is active
        </label>
      ) : null}

      {state.error ? <p ref={alertRef} role="alert" className="mt-4 text-sm text-danger">{state.error}</p> : null}

      <button
        type="submit"
        disabled={pending}
        className="mt-6 w-full rounded-xl bg-accent py-3 text-sm font-semibold text-accent-contrast disabled:opacity-60 sm:w-auto sm:px-10"
      >
        {pending ? "Saving…" : listing ? "Save changes" : "Publish listing"}
      </button>
    </form>
  );
}
