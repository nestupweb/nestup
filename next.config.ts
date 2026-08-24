import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  images: {
    remotePatterns: [
      // Seed/demo photos. Unsplash URLs carry ?w=&q= params, so `search` stays unset.
      { protocol: "https", hostname: "images.unsplash.com" },
      // Supabase storage public objects (listing photos, avatars).
      {
        protocol: "https",
        hostname: "eiykciushbnbwpxpvybi.supabase.co",
        pathname: "/storage/v1/object/public/**",
      },
    ],
  },
};

export default nextConfig;
