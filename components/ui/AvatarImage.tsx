"use client";

import Image from "next/image";
import { useState } from "react";

/**
 * The photo layer of <Avatar>. Unmounts itself if the picture cannot load,
 * so a failed image leaves only the placeholder underneath — no broken-image
 * glyph and no text inside the circle.
 */
export function AvatarImage({ src, sizes, unoptimized }: { src: string; sizes: string; unoptimized: boolean }) {
  const [failed, setFailed] = useState(false);
  if (failed) return null;
  return <Image src={src} alt="" fill sizes={sizes} unoptimized={unoptimized} className="object-cover" onError={() => setFailed(true)} />;
}
