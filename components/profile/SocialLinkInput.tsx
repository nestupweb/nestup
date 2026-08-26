"use client";

import { useState } from "react";
import { socialHref } from "@/lib/social";

const input =
  "mt-1 w-full rounded-xl border border-hairline bg-surface px-3 py-2.5 pr-20 text-sm text-ink outline-none focus:border-accent";

/**
 * A social handle field that turns into a link as you type: "@dana", a bare
 * "instagram.com/dana" or a full URL all get an "Open ↗" pill that opens the
 * profile in a new tab, so members can check the username points where they
 * think it does.
 */
export function SocialLinkInput({
  name,
  kind,
  label,
  defaultValue = "",
  placeholder,
  maxLength,
  className = "",
}: {
  name: string;
  kind: "instagram" | "facebook" | "linkedin";
  label: string;
  defaultValue?: string;
  placeholder?: string;
  maxLength?: number;
  className?: string;
}) {
  const [value, setValue] = useState(defaultValue);
  const href = socialHref(kind, value);
  return (
    <label className={`block text-[11px] font-semibold uppercase tracking-[0.18em] text-muted ${className}`}>
      {label}
      <span className="relative block">
        <input
          name={name}
          value={value}
          onChange={(e) => setValue(e.target.value)}
          placeholder={placeholder}
          maxLength={maxLength}
          autoComplete="off"
          spellCheck={false}
          className={input}
        />
        {href ? (
          <a
            href={href}
            target="_blank"
            rel="noopener noreferrer"
            aria-label={`Open ${label} profile`}
            className="absolute right-2 top-1/2 mt-0.5 -translate-y-1/2 rounded-full border border-accent/40 bg-accent/10 px-2.5 py-1 text-[10px] font-bold tracking-wider text-accent transition-colors hover:bg-accent hover:text-accent-contrast"
          >
            OPEN ↗
          </a>
        ) : null}
      </span>
    </label>
  );
}
