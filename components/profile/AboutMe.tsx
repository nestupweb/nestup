"use client";

import { useActionState } from "react";
import { saveAboutAction, type AboutFormState } from "@/app/actions/about";
import { SHABBAT_OPTIONS } from "@/lib/validation/about";
import type { Profile, ProfileDetails } from "@/lib/types";

const input =
  "mt-1 w-full rounded-xl border border-hairline bg-surface px-3 py-2.5 text-sm text-ink outline-none focus:border-accent";
const label = "block text-[10px] font-semibold uppercase tracking-[0.18em] text-muted";
const check = "flex items-center gap-2 text-sm";

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="border-t border-hairline pt-5">
      <h3 className="text-[11px] font-semibold uppercase tracking-[0.2em] text-accent">{title}</h3>
      <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2">{children}</div>
    </section>
  );
}

/**
 * The About me tab: a long free-text introduction on top, then the
 * personal details in small groups. Saves to `profile_details` (private)
 * and mirrors the shared basics onto `profiles`.
 */
export function AboutMe({ profile, details, email }: { profile: Profile; details: ProfileDetails | null; email: string }) {
  const [state, formAction, pending] = useActionState<AboutFormState, FormData>(saveAboutAction, {});
  const d = details;

  return (
    <form action={formAction} className="space-y-6" aria-label="About me">
      <div>
        <label htmlFor="about-text" className={label}>
          About me
        </label>
        <textarea
          id="about-text"
          name="about"
          rows={7}
          maxLength={3000}
          defaultValue={d?.about ?? ""}
          placeholder="Who you are, how you live, what you're looking for in a home and in roommates…"
          className={`${input} min-h-40 text-[15px] leading-6`}
        />
      </div>

      <Section title="Daily life">
        <label className={label}>Occupation
          <input name="occupation" maxLength={80} defaultValue={profile.occupation} className={input} />
        </label>
        <label className={label}>Daily lifestyle
          <input name="lifestyle" maxLength={200} defaultValue={d?.lifestyle ?? ""} placeholder="e.g. work from home, gym in the evenings" className={input} />
        </label>
        <label className={label}>Wake-up time
          <input name="wake_time" type="time" defaultValue={d?.wake_time ?? ""} className={input} />
        </label>
        <label className={label}>Bedtime
          <input name="bed_time" type="time" defaultValue={d?.bed_time ?? ""} className={input} />
        </label>
        <label className={label}>Shabbat observance
          <select name="shabbat" defaultValue={d?.shabbat ?? ""} className={input}>
            {SHABBAT_OPTIONS.map((o) => (
              <option key={o.key} value={o.key}>{o.label}</option>
            ))}
          </select>
        </label>
        <label className={label}>Cooking habits
          <input name="cooking" maxLength={120} defaultValue={d?.cooking ?? ""} placeholder="e.g. cook most evenings, love hosting" className={input} />
        </label>
      </Section>

      <Section title="Habits & home">
        <label className={label}>Languages
          <input name="languages" defaultValue={(d?.languages ?? []).join(", ")} placeholder="Hebrew, English, …" className={input} />
        </label>
        <label className={label}>Dietary habits
          <input name="diet" maxLength={120} defaultValue={d?.diet ?? ""} placeholder="e.g. kosher, vegetarian, everything" className={input} />
        </label>
        <div>
          <span className={label}>Pets</span>
          <label className={`${check} mt-2.5`}>
            <input type="checkbox" name="has_pet" defaultChecked={profile.has_pet} /> I have a pet
          </label>
          <input name="pet_details" maxLength={120} defaultValue={d?.pet_details ?? ""} placeholder="Which pet?" className={input} />
        </div>
        <div>
          <span className={label}>Smoking</span>
          <label className={`${check} mt-2.5`}>
            <input type="checkbox" name="smoker" defaultChecked={profile.smoker} /> I smoke
          </label>
        </div>
      </Section>

      <Section title="Contact">
        <label className={label}>Phone number
          <input name="phone" type="tel" maxLength={30} defaultValue={d?.phone ?? ""} className={input} />
        </label>
        <label className={label}>Email address
          <input name="contact_email" type="email" maxLength={120} defaultValue={d?.contact_email || email} className={input} />
        </label>
        <label className={label}>Instagram
          <input name="instagram" maxLength={120} defaultValue={d?.instagram ?? ""} placeholder="@handle" className={input} />
        </label>
        <label className={label}>Facebook
          <input name="facebook" maxLength={160} defaultValue={d?.facebook ?? ""} placeholder="Profile link or name" className={input} />
        </label>
        <label className={`${label} sm:col-span-2`}>LinkedIn
          <input name="linkedin" maxLength={160} defaultValue={d?.linkedin ?? ""} placeholder="linkedin.com/in/…" className={input} />
        </label>
      </Section>

      <Section title="Looking for">
        <label className={label}>Budget min (₪ / month)
          <input name="budget_min" type="number" min={0} defaultValue={profile.budget_min} className={input} />
        </label>
        <label className={label}>Budget max (₪ / month)
          <input name="budget_max" type="number" min={0} defaultValue={profile.budget_max} className={input} />
        </label>
        <label className={label}>Preferred move-in date
          <input name="earliest_move_in" type="date" defaultValue={profile.earliest_move_in ?? ""} className={input} />
        </label>
      </Section>

      <div className="flex items-center gap-4 border-t border-hairline pt-5">
        <button
          type="submit"
          disabled={pending}
          className="rounded-full bg-accent px-6 py-2.5 text-sm font-semibold text-accent-contrast disabled:opacity-60"
        >
          {pending ? "Saving…" : "Save"}
        </button>
        {state.error ? <p role="alert" className="text-sm text-danger">{state.error}</p> : null}
        {state.saved && !state.error ? <p role="status" className="text-sm text-accent">Saved.</p> : null}
      </div>
    </form>
  );
}
