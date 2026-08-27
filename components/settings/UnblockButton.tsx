"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { unblockUserAction, type ModerationState } from "@/app/actions/moderation";
import { useStickyForm } from "@/lib/hooks";

/** One row's way out of a block. No confirmation: unblocking takes nothing away. */
export function UnblockButton({ memberId, memberName }: { memberId: string; memberName: string }) {
  const router = useRouter();
  const [state, form, pending] = useStickyForm<ModerationState>(unblockUserAction, {});

  useEffect(() => {
    if (state.done) router.refresh();
  }, [state.done, router]);

  return (
    <form {...form} className="shrink-0">
      <input type="hidden" name="blocked_id" value={memberId} />
      <button
        type="submit"
        disabled={pending}
        aria-label={`Unblock ${memberName}`}
        className="rounded-full border border-hairline px-3.5 py-1.5 text-[13px] font-semibold text-ink transition-colors hover:border-accent hover:text-accent disabled:opacity-60"
      >
        {pending ? "Unblocking…" : "Unblock"}
      </button>
      {state.error ? <p role="alert" className="mt-1 text-[13px] text-danger">{state.error}</p> : null}
    </form>
  );
}
