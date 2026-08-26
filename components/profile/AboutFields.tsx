import { SHABBAT_OPTIONS } from "@/lib/validation/about";
import { DatePicker } from "@/components/ui/DatePicker";
import { Select, TimeSelect } from "@/components/ui/Select";
import type { Profile, ProfileDetails } from "@/lib/types";
import { DEFAULT_INTRO } from "@/lib/swipe-intro";

const input =
  "mt-1 w-full rounded-xl border border-hairline bg-surface px-3 py-2.5 text-sm text-ink outline-none focus:border-accent";
const label = "block text-[11px] font-semibold uppercase tracking-[0.18em] text-muted";
const check = "flex items-center gap-2 text-sm";

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="border-t border-hairline pt-5">
      <h3 className="text-[12px] font-semibold uppercase tracking-[0.2em] text-accent">{title}</h3>
      <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2">{children}</div>
    </section>
  );
}

/**
 * The About-me inputs (no <form>): the long introduction, then the details in
 * small groups. `compact` omits the fields the main profile form already has
 * (occupation, smoking, pet yes/no, budget, move-in) so the two can share one
 * form without asking twice.
 */
export function AboutFields({
  profile,
  details,
  email,
  compact = false,
}: {
  profile: Profile | null;
  details: ProfileDetails | null;
  email: string;
  compact?: boolean;
}) {
  const d = details;
  return (
    <div className="space-y-6">
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
          className={`${input} min-h-40 text-[16px] leading-6`}
        />
      </div>

      <Section title="Daily life">
        {compact ? null : (
          <label className={label}>Occupation
            <input name="occupation" maxLength={80} defaultValue={profile?.occupation ?? ""} className={input} />
          </label>
        )}
        <label className={label}>Daily lifestyle
          <input name="lifestyle" maxLength={200} defaultValue={d?.lifestyle ?? ""} placeholder="e.g. work from home, gym in the evenings" className={input} />
        </label>
        <label className={label}>Wake-up time
          <TimeSelect name="wake_time" step={15} allowEmpty defaultValue={d?.wake_time ?? ""} />
        </label>
        <label className={label}>Bedtime
          <TimeSelect name="bed_time" step={15} allowEmpty defaultValue={d?.bed_time ?? ""} />
        </label>
        <label className={label}>Shabbat observance
          <Select name="shabbat" defaultValue={d?.shabbat ?? ""}>
            {SHABBAT_OPTIONS.map((o) => (
              <option key={o.key} value={o.key}>{o.label}</option>
            ))}
          </Select>
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
        {compact ? (
          <label className={label}>Pet details
            <input name="pet_details" maxLength={120} defaultValue={d?.pet_details ?? ""} placeholder="Which pet? (if you have one)" className={input} />
          </label>
        ) : (
          <>
            <div>
              <span className={label}>Pets</span>
              <label className={`${check} mt-2.5`}>
                <input type="checkbox" name="has_pet" defaultChecked={profile?.has_pet ?? false} /> I have a pet
              </label>
              <input name="pet_details" maxLength={120} defaultValue={d?.pet_details ?? ""} placeholder="Which pet?" className={input} />
            </div>
            <div>
              <span className={label}>Smoking</span>
              <label className={`${check} mt-2.5`}>
                <input type="checkbox" name="smoker" defaultChecked={profile?.smoker ?? false} /> I smoke
              </label>
            </div>
          </>
        )}
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

      <Section title="Swipe">
        <label className={`${label} sm:col-span-2`}>Default hello message
          <textarea
            name="intro_template"
            rows={3}
            maxLength={500}
            defaultValue={d?.intro_template ?? ""}
            placeholder={DEFAULT_INTRO}
            className={`${input} text-[16px] leading-6`}
          />
          <span className="mt-1.5 block text-xs font-normal normal-case tracking-normal text-muted">
            Offered every time you like a room — you can still edit it before sending. Write {"{name}"} where the host&rsquo;s first name should go. Leave empty for the standard text.
          </span>
        </label>
      </Section>

      {compact ? null : (
        <Section title="Looking for">
          <label className={label}>Budget min (₪ / month)
            <input name="budget_min" type="number" min={0} defaultValue={profile?.budget_min ?? 0} className={input} />
          </label>
          <label className={label}>Budget max (₪ / month)
            <input name="budget_max" type="number" min={0} defaultValue={profile?.budget_max ?? 0} className={input} />
          </label>
          <label className={label}>Preferred move-in date
            <DatePicker name="earliest_move_in" defaultValue={profile?.earliest_move_in ?? ""} clearable placeholder="Any time" />
          </label>
        </Section>
      )}
    </div>
  );
}
