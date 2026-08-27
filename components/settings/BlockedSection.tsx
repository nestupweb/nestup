import Link from "next/link";
import { Avatar } from "@/components/ui/Avatar";
import { Card } from "@/components/settings/Card";
import { UnblockButton } from "@/components/settings/UnblockButton";
import type { Profile } from "@/lib/types";

/**
 * Everyone this member has blocked, with the way back. Blocking is symmetric
 * and enforced in the database (migrations 0029/0030), so this list is the
 * only place it can be undone — which is why it lives in Settings rather than
 * being buried on the other member's profile.
 */
export function BlockedSection({ blocked }: { blocked: { profile: Profile; blockedAt: string }[] }) {
  return (
    <Card
      title="Blocked members"
      hint={
        blocked.length
          ? "You can't message each other, and neither of you sees the other's room in Swipe or Browse."
          : undefined
      }
    >
      {blocked.length === 0 ? (
        <p className="text-sm text-muted">
          You haven&rsquo;t blocked anyone. You can block someone from their profile, under Report / Block.
        </p>
      ) : (
        <ul className="divide-y divide-hairline">
          {blocked.map(({ profile, blockedAt }) => (
            <li key={profile.user_id} className="flex items-center gap-3 py-3 first:pt-0 last:pb-0">
              <Avatar url={profile.avatar_url} name={profile.full_name} size={10} />
              <div className="min-w-0 flex-1">
                <Link
                  href={`/people/${profile.user_id}`}
                  className="block truncate text-sm font-semibold text-ink underline-offset-2 hover:underline"
                >
                  {profile.full_name}
                </Link>
                <p className="truncate text-[13px] text-muted">
                  Blocked {new Date(blockedAt).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })}
                </p>
              </div>
              <UnblockButton memberId={profile.user_id} memberName={profile.full_name} />
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}
