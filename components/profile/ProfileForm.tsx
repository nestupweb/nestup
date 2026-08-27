"use client";

import { useActionState } from "react";
import { ProfilePhotos } from "@/components/profile/ProfilePhotos";
import { upsertProfileAction, type ProfileFormState } from "@/app/actions/profile";
import { InterestsPicker } from "@/components/profile/InterestsPicker";
import { ChoresPicker } from "@/components/profile/ChoresPicker";
import { CityMultiPicker } from "@/components/profile/CityMultiPicker";
import { BudgetRange } from "@/components/profile/BudgetRange";
import { DailyLifeFields } from "@/components/profile/DailyLifeFields";
import { PhoneField } from "@/components/profile/PhoneField";
import { SocialLinkInput } from "@/components/profile/SocialLinkInput";
import { DatePicker } from "@/components/ui/DatePicker";
import { Select, TimeSelect } from "@/components/ui/Select";
import { hourChoices, nearestHour } from "@/lib/clock";
import { BED_TIMES, PREF_LEASE_TERMS, WAKE_TIMES } from "@/lib/constants";
import { DEFAULT_INTRO } from "@/lib/swipe-intro";
import type { Profile, ProfileDetails } from "@/lib/types";

const input =
  "mt-1 w-full rounded-xl border border-hairline bg-surface px-3 py-2.5 text-sm text-ink outline-none focus:border-accent";
const label = "block text-[11px] font-semibold uppercase tracking-[0.18em] text-muted";
const note = "font-normal normal-case tracking-normal";

function Section({
  step,
  title,
  hint,
  children,
}: {
  step: number;
  title: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <section className="mt-9 border-t border-hairline pt-6" aria-label={title}>
      <div className="flex items-baseline gap-3">
        <span className="text-[11px] font-bold tabular-nums text-muted">{String(step).padStart(2, "0")}</span>
        <h2 className="text-[15px] font-bold uppercase tracking-[0.18em] text-accent">{title}</h2>
      </div>
      {hint ? <p className="mt-1 text-sm text-muted">{hint}</p> : null}
      <div className="mt-4">{children}</div>
    </section>
  );
}

/**
 * The one profile form (onboarding and the pencil page). Sections in the
 * order a member reads them: who I am → how to reach me → the home I want →
 * how I live (and want to live) → the chores I take on → what I'm into.
 * Every section is always open — nothing folds away. `about` is present on
 * the pencil page only, and adds the private details (`profile_details`).
 */
export function ProfileForm({
  profile,
  onboarding,
  next = "",
  about,
}: {
  profile: Profile | null;
  onboarding: boolean;
  next?: string;
  /** Present on the pencil page: the About-me details ride along in this form. */
  about?: { details: ProfileDetails | null; email: string };
}) {
  const [state, formAction, pending] = useActionState<ProfileFormState, FormData>(
    upsertProfileAction,
    {}
  );
  const d = about?.details ?? null;
  const wake = nearestHour(d?.wake_time ?? "");
  const bed = nearestHour(d?.bed_time ?? "");
  // Sections are numbered in reading order; the Contact and Swipe sections exist on the pencil page only.
  let step = 0;
  const stepNo = () => ++step;

  return (
    <form action={formAction} className="mx-auto w-full max-w-3xl px-4 pb-12 sm:px-6">
      {next ? <input type="hidden" name="next" value={next} /> : null}
      <h1 className="text-3xl font-bold">
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

      {/* Basics: the photo and the line under it everywhere in the app. */}
      <div className="mt-5 flex flex-col gap-5 sm:flex-row sm:items-start">
        <ProfilePhotos name={profile?.full_name || "Your photo"} avatarUrl={profile?.avatar_url ?? null} />
        <div className="min-w-0 flex-1 sm:mt-5">
          <label className={label}>Full name
            <input name="full_name" required minLength={2} maxLength={60} defaultValue={profile?.full_name ?? ""} className={input} />
          </label>
          <div className="mt-3 grid grid-cols-[6rem_1fr] gap-3">
            <label className={label}>Age
              <input name="age" type="number" required min={18} max={120} defaultValue={profile?.age ?? ""} className={input} />
            </label>
            <label className={label}>Occupation
              <input name="occupation" maxLength={80} defaultValue={profile?.occupation ?? ""} className={input} />
            </label>
          </div>
        </div>
      </div>

      <Section step={stepNo()} title="Bio & About me" hint="The short line goes under your name; the longer text is your introduction on your profile.">
        <label className={label}>Bio · one line
          <input name="bio" maxLength={500} defaultValue={profile?.bio ?? ""} placeholder="e.g. Early riser, plant person, cooks a mean shakshuka." className={input} />
        </label>
        {about ? (
          <label className={`${label} mt-4`}>About me
            <textarea
              name="about"
              rows={6}
              maxLength={3000}
              defaultValue={d?.about ?? ""}
              placeholder="Who you are, how you live, what you're looking for in a home and in roommates…"
              className={`${input} min-h-36 text-[16px] leading-6`}
            />
          </label>
        ) : null}
      </Section>

      {about ? (
        <Section step={stepNo()} title="Contact" hint="Phone and e-mail stay private. Social usernames show on your profile as links.">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <PhoneField defaultValue={d?.phone ?? ""} labelClassName={label} inputClassName={input.replace("mt-1 w-full ", "")} />
            <label className={label}>Email address
              <input name="contact_email" type="email" maxLength={120} defaultValue={d?.contact_email || about.email} className={input} />
            </label>
            <SocialLinkInput name="instagram" kind="instagram" label="Instagram" defaultValue={d?.instagram ?? ""} placeholder="@handle" maxLength={120} />
            <SocialLinkInput name="facebook" kind="facebook" label="Facebook" defaultValue={d?.facebook ?? ""} placeholder="username or profile link" maxLength={160} />
            <SocialLinkInput name="linkedin" kind="linkedin" label="LinkedIn" defaultValue={d?.linkedin ?? ""} placeholder="linkedin.com/in/…" maxLength={160} className="sm:col-span-2" />
          </div>
        </Section>
      ) : null}

      <Section step={stepNo()} title="Apartment preferences" hint="Powers the budget, city and move-in parts of your Lifestyle match.">
        <div className="rounded-2xl border border-hairline bg-surface px-4 py-4 sm:px-5">
          <p className={label}>Monthly budget</p>
          <div className="mt-2">
            <BudgetRange initialMin={profile?.budget_min ?? 0} initialMax={profile?.budget_max ?? 0} />
          </div>
        </div>
        <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2">
          <label className={label}>Earliest move-in
            <DatePicker name="earliest_move_in" defaultValue={profile?.earliest_move_in ?? ""} clearable placeholder="Any time" />
          </label>
          <label className={label}>For how long
            {/* The seeker's side of the listing's lease term — a rough duration, never an end date. */}
            <Select name="pref_lease_term" defaultValue={profile?.pref_lease_term ?? "any"}>
              {PREF_LEASE_TERMS.map((t) => (
                <option key={t.key} value={t.key}>{t.label}</option>
              ))}
            </Select>
          </label>
          <fieldset className="min-w-0 sm:col-span-2">
            <legend className={label}>Preferred cities</legend>
            <div className="mt-1">
              <CityMultiPicker name="preferred_cities" initial={profile?.preferred_cities ?? []} />
            </div>
          </fieldset>
        </div>
      </Section>

      <Section step={stepNo()} title="Daily life" hint="How you live on the left, what you're looking for in roommates on the right — both count toward the Lifestyle match.">
        <DailyLifeFields profile={profile} />
        {about ? (
          <div className="mt-6">
            <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-ink">More about my day</p>
            <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2">
              <label className={label}>Wake-up time <span className={note}>· around, optional</span>
                <TimeSelect name="wake_time" options={hourChoices(WAKE_TIMES, wake)} allowEmpty emptyLabel="Not set" defaultValue={wake} />
              </label>
              <label className={label}>Bedtime <span className={note}>· around, optional</span>
                <TimeSelect name="bed_time" options={hourChoices(BED_TIMES, bed)} allowEmpty emptyLabel="Not set" defaultValue={bed} />
              </label>
              <label className={label}>Languages
                <input name="languages" defaultValue={(d?.languages ?? []).join(", ")} placeholder="Hebrew, English, …" className={input} />
              </label>
              <label className={label}>Daily lifestyle
                <input name="lifestyle" maxLength={200} defaultValue={d?.lifestyle ?? ""} placeholder="e.g. work from home, gym in the evenings" className={input} />
              </label>
              <label className={label}>Cooking habits
                <input name="cooking" maxLength={120} defaultValue={d?.cooking ?? ""} placeholder="e.g. cook most evenings, love hosting" className={input} />
              </label>
              <label className={label}>Pet details
                <input name="pet_details" maxLength={120} defaultValue={d?.pet_details ?? ""} placeholder="Which pet? (if you have one)" className={input} />
              </label>
            </div>
          </div>
        ) : null}
      </Section>

      <Section step={stepNo()} title="Household chores" hint="Tick the chores you're happy to take on — roommates see these on your profile.">
        <ChoresPicker initial={profile?.chores ?? []} />
      </Section>

      <Section step={stepNo()} title="Interests" hint="Pick what you're into — shared interests power your Social match.">
        <InterestsPicker initial={profile?.interests ?? []} />
      </Section>

      {about ? (
        <Section step={stepNo()} title="Swipe" hint="Your default hello when you like a room — you can still edit it before sending.">
          <label className={label}>Default hello message
            <textarea
              name="intro_template"
              rows={3}
              maxLength={500}
              defaultValue={d?.intro_template ?? ""}
              placeholder={DEFAULT_INTRO}
              className={`${input} text-[16px] leading-6`}
            />
            <span className="mt-1.5 block text-xs font-normal normal-case tracking-normal text-muted">
              Leave empty for the standard text.
            </span>
          </label>
        </Section>
      ) : null}

      {state.error ? <p role="alert" className="mt-4 text-sm text-danger">{state.error}</p> : null}

      <button type="submit" disabled={pending}
        className="mt-8 w-full rounded-xl bg-accent py-3 text-sm font-semibold text-accent-contrast disabled:opacity-60 sm:w-auto sm:px-10">
        {pending ? "Saving…" : "Save profile"}
      </button>
    </form>
  );
}
