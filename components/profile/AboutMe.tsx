"use client";

import { useActionState } from "react";
import { saveAboutAction, type AboutFormState } from "@/app/actions/about";
import { AboutFields } from "@/components/profile/AboutFields";
import type { Profile, ProfileDetails } from "@/lib/types";

/**
 * The inline About-me editor (used on the Profile tab when
 * `PROFILE_EDIT_ON_PENCIL_PAGE` is off). Saves to `profile_details`
 * (private) and mirrors the shared basics onto `profiles`.
 */
export function AboutMe({ profile, details, email }: { profile: Profile; details: ProfileDetails | null; email: string }) {
  const [state, formAction, pending] = useActionState<AboutFormState, FormData>(saveAboutAction, {});

  return (
    <form action={formAction} className="space-y-6" aria-label="About me">
      <AboutFields profile={profile} details={details} email={email} />

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
