import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // 適格請求書 PDF 生成で使う Noto Sans JP を該当 API ルートの関数バンドルに同梱する。
  // Vercel では public/ は CDN 配信のみで関数バンドルには含まれないため明示が必要。
  // v1.5.12 から PDF はオンザフライ生成（webhook では生成しない）なので
  // /api/invoices/[invoiceNumber]/pdf のルートにフォントを同梱する。
  outputFileTracingIncludes: {
    "/api/invoices/[invoiceNumber]/pdf": ["./public/fonts/**/*"],
    "/api/invoices/[invoiceNumber]/pdf/route": ["./public/fonts/**/*"],
  },
};

export default nextConfig;
