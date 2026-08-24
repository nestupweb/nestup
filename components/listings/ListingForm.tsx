"use client";

import { useActionState } from "react";
import { saveListingAction, type ListingFormState } from "@/app/actions/listing";
import { CITIES, FEATURES, MAX_LISTING_PHOTOS, PROPERTY_TYPES } from "@/lib/constants";
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
    <form action={formAction} className="mx-auto w-full max-w-3xl px-4 pb-12 sm:px-6">
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
      <div className="grid grid-cols-2 gap-3 md:grid-cols-3">
        <label className={label}>City
          <select name="city" required defaultValue={listing?.city ?? "Tel Aviv"} className={input}>
            {CITIES.map((c) => <option key={c} value={c}>{c}</option>)}
          </select>
        </label>
        <label className={label}>Neighborhood
          <input name="neighborhood" maxLength={80} defaultValue={listing?.neighborhood ?? ""} className={input} />
        </label>
        <label className={label}>Property type
          <select name="property_type" required defaultValue={listing?.property_type ?? "apartment"} className={input}>
            {PROPERTY_TYPES.map((p) => <option key={p.key} value={p.key}>{p.label}</option>)}
          </select>
        </label>
        <label className={label}>Rooms
          <input name="rooms" type="number" required min={1} max={12} step={0.5} defaultValue={listing?.rooms ?? 3} className={input} />
        </label>
        <label className={label}>Size (m²)
          <input name="size_sqm" type="number" min={10} max={1000} defaultValue={listing?.size_sqm ?? ""} className={input} />
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

      {state.error ? <p role="alert" className="mt-4 text-sm text-danger">{state.error}</p> : null}
      {state.saved ? <p role="status" className="mt-4 text-sm text-accent">Saved.</p> : null}

      <button type="submit" disabled={pending}
        className="mt-6 w-full rounded-xl bg-accent py-3 text-sm font-semibold text-accent-contrast disabled:opacity-60 sm:w-auto sm:px-10">
        {pending ? "Saving…" : listing ? "Save changes" : "Publish listing"}
      </button>
    </form>
  );
}
