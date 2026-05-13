import type { Metadata, Viewport } from "next";
import { Manrope } from "next/font/google";
import { Suspense } from "react";
import { Providers } from "@/components/providers";
import { SiteShell } from "@/components/site-shell";
import "./globals.css";

const bodyFont = Manrope({
  variable: "--font-body",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Vishu.shop",
  description: "Unified fashion store",
  metadataBase: new URL(
    process.env.NEXT_PUBLIC_SITE_URL?.trim() || "https://vishu.shop",
  ),
  openGraph: {
    title: "Vishu.shop",
    description: "Unified fashion store",
    siteName: "Vishu.shop",
    url: "/",
    type: "website",
    images: [
      {
        url: "/vishu-tab-logo.png",
        alt: "Vishu.shop",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "Vishu.shop",
    description: "Unified fashion store",
    images: ["/vishu-tab-logo.png"],
  },
  icons: {
    icon: "/vishu-tab-logo.png",
    shortcut: "/vishu-tab-logo.png",
    apple: "/vishu-tab-logo.png",
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className={bodyFont.variable}>
        <Providers>
          <Suspense fallback={<div className="page" />}>
            <SiteShell>{children}</SiteShell>
          </Suspense>
        </Providers>
      </body>
    </html>
  );
}
