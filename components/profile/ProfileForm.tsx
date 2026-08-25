"use client";

import { useActionState } from "react";
import { upsertProfileAction, type ProfileFormState } from "@/app/actions/profile";
import { InterestsPicker } from "@/components/profile/InterestsPicker";
import { CITIES } from "@/lib/constants";
import type { Profile } from "@/lib/types";

const input =
  "mt-1 w-full rounded-xl border border-hairline bg-surface px-3 py-2.5 text-sm text-ink outline-none focus:border-accent";
const label = "mt-4 block text-xs font-medium uppercase tracking-widest text-muted";

export function ProfileForm({
  profile,
  onboarding,
  next = "",
}: {
  profile: Profile | null;
  onboarding: boolean;
  next?: string;
}) {
  const [state, formAction, pending] = useActionState<ProfileFormState, FormData>(
    upsertProfileAction,
    {}
  );

  return (
    <form action={formAction} className="mx-auto w-full max-w-3xl px-4 pb-12 sm:px-6">
      {next ? <input type="hidden" name="next" value={next} /> : null}
      <h1 className="text-3xl font-semibold">
        {onboarding ? "Tell us about you" : "Your profile"}
      </h1>
      {onboarding ? (
        <p className="mt-1 text-sm text-muted">This is what listers see when you swipe right.</p>
      ) : null}
      {onboarding && next ? (
        <p className="mt-4 rounded-xl border border-accent/30 bg-accent/5 px-4 py-3 text-sm text-accent">
          One quick step first: complete your profile so the lister knows who&rsquo;s
          writing. Save it and you&rsquo;ll continue straight to your chat.
        </p>
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

      <h2 className="mt-8 text-xl font-semibold">Lifestyle</h2>
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

      <h2 className="mt-8 text-xl font-semibold">Roommate preferences</h2>
      <div className="mt-2 flex flex-wrap gap-x-6 gap-y-2 text-sm">
        <label className="flex items-center gap-2"><input type="checkbox" name="ok_with_smoker" defaultChecked={profile?.ok_with_smoker ?? true} /> OK living with a smoker</label>
        <label className="flex items-center gap-2"><input type="checkbox" name="ok_with_pets" defaultChecked={profile?.ok_with_pets ?? true} /> OK living with pets</label>
      </div>

      <h2 className="mt-8 text-xl font-semibold">Apartment preferences</h2>
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

      {state.error ? <p role="alert" className="mt-4 text-sm text-danger">{state.error}</p> : null}

      <button type="submit" disabled={pending}
        className="mt-8 w-full rounded-xl bg-accent py-3 text-sm font-semibold text-accent-contrast disabled:opacity-60 sm:w-auto sm:px-10">
        {pending ? "Saving…" : "Save profile"}
      </button>
    </form>
  );
}
