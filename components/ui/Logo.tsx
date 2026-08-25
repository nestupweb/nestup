import type { CSSProperties } from "react";

/**
 * The NestUp wordmark (from `my listing-guy/Logo-NU.jpeg`, extracted to a
 * transparent mask in `public/brand/nestup-wordmark.png`). Rendered as a CSS
 * mask filled with the current text colour, so it follows the theme: ink on
 * the light surface, cream on the dark one. 714×245 source → aspect below.
 */
const MASK = "url(/brand/nestup-wordmark.png)";
const style: CSSProperties = {
  aspectRatio: "714 / 245",
  WebkitMaskImage: MASK,
  maskImage: MASK,
  WebkitMaskSize: "contain",
  maskSize: "contain",
  WebkitMaskRepeat: "no-repeat",
  maskRepeat: "no-repeat",
  WebkitMaskPosition: "left center",
  maskPosition: "left center",
};

export function Logo({ className = "h-7" }: { className?: string }) {
  return (
    <span
      role="img"
      aria-label="NestUp"
      data-testid="logo"
      style={style}
      className={`inline-block shrink-0 bg-current ${className}`}
    />
  );
}
