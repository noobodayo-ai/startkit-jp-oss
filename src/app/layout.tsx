import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

const appName = process.env.NEXT_PUBLIC_APP_NAME ?? "StartKit JP";
const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";
// NEXT_PUBLIC_OG_IMAGE_URL があればそれを優先、無ければ Next.js が
// src/app/opengraph-image.tsx を /opengraph-image で自動配信する。
const ogImage = process.env.NEXT_PUBLIC_OG_IMAGE_URL;
const description =
  "日本市場向け Next.js + Firebase + Stripe SaaS ボイラープレート。Stripe 日本円・適格請求書ひな形の PDF・特商法テンプレ・マルチテナント・Gemini ラッパーを同梱。";

export const metadata: Metadata = {
  metadataBase: new URL(appUrl),
  title: {
    default: appName,
    template: `%s | ${appName}`,
  },
  description,
  keywords: [
    "Next.js",
    "Firebase",
    "Stripe",
    "SaaS",
    "ボイラープレート",
    "適格請求書",
    "インボイス",
    "日本",
    "Gemini",
  ],
  authors: [{ name: appName }],
  openGraph: {
    type: "website",
    locale: "ja_JP",
    url: appUrl,
    siteName: appName,
    title: appName,
    description,
    ...(ogImage
      ? { images: [{ url: ogImage, width: 1200, height: 630, alt: appName }] }
      : {}),
  },
  twitter: {
    card: "summary_large_image",
    title: appName,
    description,
    ...(ogImage ? { images: [ogImage] } : {}),
  },
  alternates: {
    canonical: appUrl,
  },
  robots: {
    index: true,
    follow: true,
  },
};

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#fafafa" },
    { media: "(prefers-color-scheme: dark)", color: "#09090b" },
  ],
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="ja"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col bg-zinc-50 dark:bg-zinc-950 text-zinc-900 dark:text-zinc-100">
        {children}
      </body>
    </html>
  );
}
