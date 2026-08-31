import { describe, it, expect } from "vitest";
import { middleware } from "./middleware";
import { NextRequest } from "next/server";

function buildReq(opts: {
  method: string;
  url: string;
  origin?: string;
  referer?: string;
  host?: string;
}): NextRequest {
  const headers = new Headers();
  if (opts.origin) headers.set("origin", opts.origin);
  if (opts.referer) headers.set("referer", opts.referer);
  headers.set("host", opts.host ?? "startkit-jp-dogfood.vercel.app");
  return new NextRequest(opts.url, { method: opts.method, headers });
}

describe("middleware CSRF protection", () => {
  it("GET は無条件で通す", () => {
    const res = middleware(
      buildReq({
        method: "GET",
        url: "https://startkit-jp-dogfood.vercel.app/api/tenants",
      }),
    );
    expect(res.status).toBe(200); // NextResponse.next()
  });

  it("Webhook パスは Origin チェック対象外", () => {
    const res = middleware(
      buildReq({
        method: "POST",
        url: "https://startkit-jp-dogfood.vercel.app/api/billing/webhook",
        // origin なし（Stripe からの直接呼び出し）
      }),
    );
    expect(res.status).toBe(200);
  });

  it("同一オリジン POST は通す", () => {
    const res = middleware(
      buildReq({
        method: "POST",
        url: "https://startkit-jp-dogfood.vercel.app/api/billing/checkout",
        origin: "https://startkit-jp-dogfood.vercel.app",
      }),
    );
    expect(res.status).toBe(200);
  });

  it("Referer から復元した同一オリジン POST も通す", () => {
    const res = middleware(
      buildReq({
        method: "POST",
        url: "https://startkit-jp-dogfood.vercel.app/api/billing/checkout",
        referer: "https://startkit-jp-dogfood.vercel.app/dashboard/billing",
      }),
    );
    expect(res.status).toBe(200);
  });

  it("cross-origin POST は 403 を返す", () => {
    const res = middleware(
      buildReq({
        method: "POST",
        url: "https://startkit-jp-dogfood.vercel.app/api/billing/checkout",
        origin: "https://attacker.example.com",
      }),
    );
    expect(res.status).toBe(403);
  });

  it("Origin も Referer も無い POST は 403", () => {
    const res = middleware(
      buildReq({
        method: "POST",
        url: "https://startkit-jp-dogfood.vercel.app/api/billing/checkout",
      }),
    );
    expect(res.status).toBe(403);
  });
});
