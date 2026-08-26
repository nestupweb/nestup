import Link from "next/link";
import { profileGroups, type PublicDetails } from "@/lib/people";
import { DailyLifeView } from "@/components/profile/DailyLifeView";
import type { Profile } from "@/lib/types";

const h3 = "text-[15px] font-bold uppercase tracking-[0.18em] text-accent";

/**
 * A member's About-me, read-only, exactly as other members see it: interest
 * chips, the introduction, the Daily life table, the chores they take on,
 * then the remaining details in groups (never phone / e-mail — those and the
 * social links live in the header's ContactRow). Used on `/people/[id]` and,
 * when `PROFILE_EDIT_ON_PENCIL_PAGE` is on, on the owner's own Profile tab.
 */
export function AboutView({
  profile,
  details,
  self = false,
}: {
  profile: Profile;
  details: PublicDetails | null;
  self?: boolean;
}) {
  const groups = profileGroups(profile, details);
  const about = details?.about?.trim() ?? "";
  const first = profile.full_name.split(" ")[0] || profile.full_name;
  const chores = profile.chores ?? [];

  return (
    <div>
      {profile.interests.length > 0 ? (
        <div className="flex flex-wrap gap-1.5">
          {profile.interests.map((s) => (
            <span
              key={s}
              className="rounded-full border border-accent/40 bg-accent/10 px-2.5 py-0.5 text-[11px] font-bold uppercase tracking-wider text-accent"
            >
              {s}
            </span>
          ))}
        </div>
      ) : null}

      {about ? (
        <p className="mt-5 max-w-2xl whitespace-pre-line text-[16px] leading-6">{about}</p>
      ) : self ? (
        <p className="mt-5 text-sm text-muted">
          You haven&rsquo;t written an introduction yet —{" "}
          <Link href="/profile/edit" className="text-accent underline-offset-2 hover:underline">
            tap the pencil
          </Link>{" "}
          to add one.
        </p>
      ) : (
        <p className="mt-5 text-sm text-muted">{first} hasn&rsquo;t written an introduction yet.</p>
      )}

      <section className="mt-7 border-t border-hairline pt-5">
        <h3 className={h3}>Daily life</h3>
        <div className="mt-4">
          <DailyLifeView profile={profile} />
        </div>
      </section>

      {chores.length > 0 ? (
        <section className="mt-7 border-t border-hairline pt-5">
          <h3 className={h3}>Household chores</h3>
          <p className="mt-1 text-sm text-muted">{self ? "What you're happy to take on." : `What ${first} is happy to take on.`}</p>
          <ul className="mt-3 flex flex-wrap gap-2">
            {chores.map((c) => (
              <li key={c} className="rounded-full border border-hairline bg-surface px-3 py-1 text-[12px] font-semibold text-ink">
                {c}
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      <div className="mt-7 space-y-7">
        {groups.map((g) => (
          <section key={g.title} className="border-t border-hairline pt-5">
            <h3 className={h3}>{g.title}</h3>
            <dl className="mt-3 grid grid-cols-1 gap-x-6 gap-y-3 sm:grid-cols-2">
              {g.rows.map((r) => (
                <div key={r.label} className="min-w-0">
                  <dt className="text-[11px] font-semibold uppercase tracking-[0.18em] text-muted">{r.label}</dt>
                  <dd className="mt-0.5 break-words text-sm text-ink">
                    {r.href ? (
                      <a href={r.href} target="_blank" rel="noopener noreferrer" className="text-accent underline-offset-2 hover:underline">
                        {r.value}
                      </a>
                    ) : (
                      r.value
                    )}
                  </dd>
                </div>
              ))}
            </dl>
          </section>
        ))}
      </div>
    </div>
  );
}
