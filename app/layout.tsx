import type { Metadata, Viewport } from "next";
import { Suspense } from "react";
import { Inter } from "next/font/google";
import "./globals.css";
import { PageTransition } from "@/components/ui/PageTransition";
import { HideLinkPreview } from "@/components/ui/HideLinkPreview";
import { SiteNav } from "@/components/ui/SiteNav";

// TODO: Cache Components adoption. Refactor this route so this opt-out can be removed.
// See: https://nextjs.org/docs/app/guides/migrating-to-cache-components
export const instant = false;

// One typeface everywhere: Inter for headings, body and UI alike.
const inter = Inter({ subsets: ["latin"], variable: "--font-inter" });

export const metadata: Metadata = {
  title: "NestUp",
  applicationName: "NestUp",
  description: "Find your next shared apartment — and the roommates you'll actually get along with.",
  manifest: "/manifest.webmanifest",
  // Safari "Add to Dock" / iOS home-screen mode: run as a standalone web app
  // whose navigation stays inside the app (scope "/" comes from the manifest).
  appleWebApp: { capable: true, title: "NestUp", statusBarStyle: "default" },
};

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#ffffff" },
    { media: "(prefers-color-scheme: dark)", color: "#201c18" },
  ],
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <script
          dangerouslySetInnerHTML={{
            __html: `try{if(localStorage.theme==="dark")document.documentElement.dataset.theme="dark"}catch(e){}`,
          }}
        />
      </head>
      <body className={`${inter.variable} antialiased`}>
        <HideLinkPreview />
        <PageTransition>{children}</PageTransition>
        {/* Outside the transition, and above both route groups, so crossing
            between them never unmounts it. See SiteNav. */}
        <Suspense fallback={null}>
          <SiteNav />
        </Suspense>
      </body>
    </html>
  );
}
