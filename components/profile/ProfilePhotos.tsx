"use client";

import { useEffect, useRef, useState } from "react";
import { Avatar } from "@/components/ui/Avatar";

/**
 * The profile picture on the editor — just the circle. Tapping it opens the
 * file picker; the new picture previews in place and uploads on save.
 */
export function ProfilePhotos({ name, avatarUrl }: { name: string; avatarUrl: string | null }) {
  const [preview, setPreview] = useState<string | null>(null);
  const input = useRef<HTMLInputElement>(null);

  useEffect(() => () => { if (preview) URL.revokeObjectURL(preview); }, [preview]);

  return (
    <div className="mt-5">
      <input
        ref={input}
        name="avatar"
        type="file"
        accept="image/jpeg,image/png,image/webp"
        aria-label="Change profile photo"
        onChange={(e) => {
          const f = e.target.files?.[0];
          setPreview(f ? URL.createObjectURL(f) : null);
        }}
        className="sr-only"
      />
      <button
        type="button"
        onClick={() => input.current?.click()}
        aria-label={avatarUrl || preview ? "Change profile photo" : "Add profile photo"}
        title="Profile photo"
        className="block rounded-full ring-2 ring-accent ring-offset-2 ring-offset-paper transition-transform hover:scale-[1.03] focus-visible:outline-none focus-visible:ring-4"
      >
        <Avatar url={preview ?? avatarUrl} name={name} size={20} />
      </button>
    </div>
  );
}
