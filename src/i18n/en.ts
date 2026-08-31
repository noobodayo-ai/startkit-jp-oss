import type { Dict } from "./ja";

/**
 * 英語辞書。型は ja.ts と一致させる。
 * Marketing は ShipFast 等の海外競合と比較されるため、英語版でも自然な文言にする。
 */

export const en: Dict = {
  marketing: {
    hero: {
      kicker: "Japan-localized SaaS Starter Kit",
      title1: "Ship a Japan-ready SaaS",
      title2: "in 5 minutes.",
      lead:
        "Stripe JPY, qualified invoice PDF, Japanese commerce-law templates, multi-tenant auth, and a Gemini wrapper — everything that overseas starter kits leave out. Built on Next.js + Firebase + Stripe.",
      ctaBuy: "Get Pro for ¥19,800",
      ctaDemo: "Try the demo",
      ctaOss: "See OSS edition (free)",
      guarantee: "One-time purchase · 1 year of free updates · 14-day refund",
    },
    compare: {
      title: "Are you re-implementing 28–52 hours of Japan support on every project?",
      sub: "At ¥3,000/hr, that's ¥84,000–¥156,000 of work each time.",
      colTask: "Task",
      colSelf: "Build it yourself",
      colKit: "StartKit JP",
      total: "Total",
    },
    features: {
      title: "What's included",
    },
  },
  pricing: {
    title: "Pricing",
    sub: "All one-time, lifetime updates for 1 year, 14-day refund",
    note: "Prices are tax-inclusive. No subscription.",
    faqTitle: "FAQ",
  },
};
