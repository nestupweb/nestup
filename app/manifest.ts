import type { MetadataRoute } from "next";

/**
 * Web app manifest. Besides making NestUp installable, `scope: "/"` matters
 * for navigation: Safari "Add to Dock" / iOS "Add to Home Screen" web apps
 * treat any URL outside the declared scope as external and open it in the
 * browser. Without a manifest the scope is inferred, so moving between
 * /swipe, /browse, /chat and /profile could bounce out to a new Safari tab.
 *
 * `display: "browser"` on purpose (user decision 2026-08-26): NestUp is a
 * website, not an installable app, and Chrome/Edge only show their
 * "Install app" omnibox button for standalone/fullscreen/minimal-ui
 * manifests. The scope declaration above still applies.
 */
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "NestUp",
    short_name: "NestUp",
    description: "Find your next shared apartment — and the roommates you'll actually get along with.",
    id: "/",
    start_url: "/",
    scope: "/",
    display: "browser",
    background_color: "#faf7f2",
    theme_color: "#2f5d50",
    icons: [
      { src: "/icons/icon-192.png", sizes: "192x192", type: "image/png" },
      { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png" },
      { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  };
}
