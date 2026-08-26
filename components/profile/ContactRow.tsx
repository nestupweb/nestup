import { socialHref } from "@/lib/social";

type Kind = "instagram" | "facebook" | "linkedin";

const NETWORKS: { kind: Kind; label: string }[] = [
  { kind: "instagram", label: "Instagram" },
  { kind: "facebook", label: "Facebook" },
  { kind: "linkedin", label: "LinkedIn" },
];

const icon = "h-3.5 w-3.5 shrink-0";
const stroke = { fill: "none", stroke: "currentColor", strokeWidth: 1.8, strokeLinecap: "round", strokeLinejoin: "round" } as const;

function Glyph({ kind }: { kind: Kind | "phone" | "mail" }) {
  switch (kind) {
    case "instagram":
      return (
        <svg viewBox="0 0 24 24" className={icon} aria-hidden="true" {...stroke}>
          <rect x="3" y="3" width="18" height="18" rx="5" />
          <circle cx="12" cy="12" r="3.8" />
          <circle cx="17.3" cy="6.7" r="0.9" fill="currentColor" stroke="none" />
        </svg>
      );
    case "facebook":
      return (
        <svg viewBox="0 0 24 24" className={icon} aria-hidden="true" fill="currentColor">
          <path d="M14.2 8.6h2.6V5.5h-2.6c-2.3 0-4 1.7-4 4v1.8H8v3.1h2.2V21h3.2v-6.6h2.6l.5-3.1h-3.1V9.6c0-.6.4-1 .8-1z" />
        </svg>
      );
    case "linkedin":
      return (
        <svg viewBox="0 0 24 24" className={icon} aria-hidden="true" {...stroke}>
          <rect x="3" y="3" width="18" height="18" rx="3" />
          <path d="M8 10.5v6M8 7.5v.1M11.5 16.5v-3.4c0-1.4.9-2.4 2.2-2.4s2.1 1 2.1 2.4v3.4M11.5 10.5v6" />
        </svg>
      );
    case "phone":
      return (
        <svg viewBox="0 0 24 24" className={icon} aria-hidden="true" {...stroke}>
          <path d="M5 4h4l2 5-2.5 1.5a11 11 0 0 0 5 5L15 13l5 2v4a2 2 0 0 1-2 2A16 16 0 0 1 3 6a2 2 0 0 1 2-2z" />
        </svg>
      );
    case "mail":
      return (
        <svg viewBox="0 0 24 24" className={icon} aria-hidden="true" {...stroke}>
          <rect x="3" y="5" width="18" height="14" rx="2" />
          <path d="M3 7l9 6 9-6" />
        </svg>
      );
  }
}

// One quiet chip for every contact, link or not (user decision: no green chips here); accent only on hover.
const plainPill =
  "inline-flex max-w-full items-center gap-1.5 rounded-full border border-hairline px-3 py-1 text-[12px] text-ink transition-colors hover:border-accent hover:text-accent";
const linkPill = plainPill;

/**
 * Contact details in the profile header: social profiles as opening links,
 * plus phone / e-mail when given — on the owner's own page and, since
 * migration 0020, on other members' pages too. Renders nothing when there is
 * nothing to show.
 */
export function ContactRow({
  instagram = "",
  facebook = "",
  linkedin = "",
  phone = "",
  email = "",
  className = "mt-3",
}: {
  instagram?: string;
  facebook?: string;
  linkedin?: string;
  phone?: string;
  email?: string;
  className?: string;
}) {
  const raw: Record<Kind, string> = { instagram: instagram.trim(), facebook: facebook.trim(), linkedin: linkedin.trim() };
  const socials = NETWORKS.filter((n) => raw[n.kind]).map((n) => ({ ...n, value: raw[n.kind], href: socialHref(n.kind, raw[n.kind]) }));
  const tel = phone.trim();
  const mail = email.trim();
  if (socials.length === 0 && !tel && !mail) return null;

  return (
    <div className={`flex flex-wrap items-center gap-2 ${className}`} aria-label="Contact">
      {socials.map((s) =>
        s.href ? (
          <a key={s.kind} href={s.href} target="_blank" rel="noopener noreferrer" className={linkPill} aria-label={`Open ${s.label} profile`}>
            <Glyph kind={s.kind} />
            {s.label}
          </a>
        ) : (
          <span key={s.kind} className={plainPill}>
            <Glyph kind={s.kind} />
            <span className="truncate">{s.value}</span>
          </span>
        )
      )}
      {tel ? (
        <a href={`tel:${tel.replace(/\s+/g, "")}`} className={plainPill}>
          <Glyph kind="phone" />
          <span className="truncate">{tel}</span>
        </a>
      ) : null}
      {mail ? (
        <a href={`mailto:${mail}`} className={plainPill}>
          <Glyph kind="mail" />
          <span className="truncate">{mail}</span>
        </a>
      ) : null}
    </div>
  );
}
