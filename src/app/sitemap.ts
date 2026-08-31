import type { MetadataRoute } from "next";

const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";

export default function sitemap(): MetadataRoute.Sitemap {
  const now = new Date();
  const publicRoutes = [
    "",
    "/pricing",
    "/faq",
    "/legal/terms",
    "/legal/privacy",
    "/legal/tokushoho",
  ];
  return publicRoutes.map((p) => ({
    url: `${appUrl}${p}`,
    lastModified: now,
    changeFrequency: p === "" || p === "/pricing" ? "weekly" : "monthly",
    priority: p === "" ? 1.0 : p === "/pricing" ? 0.9 : 0.5,
  }));
}
