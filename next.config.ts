import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  experimental: {
    serverActions: {
      // Listing form accepts up to 5 photos × 5MB (+ multipart overhead);
      // the default 1MB cap silently killed profile/listing saves with photos.
      bodySizeLimit: "30mb",
    },
  },
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
