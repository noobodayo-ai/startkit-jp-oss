import { NextRequest, NextResponse } from "next/server";

/**
 * CSRF 防御：state-changing メソッド (POST/PUT/PATCH/DELETE) で
 * Origin（または Referer）が同一オリジンであることを検証する。
 *
 * 背景：
 * セッション cookie を SameSite=None（本番）にしている（Stripe Checkout 復路で
 * cookie を維持するため）。SameSite=None 単独では cross-origin の POST にも
 * cookie が送信されるため、サーバー側で同一オリジン由来であることを確認する
 * 必要がある。
 *
 * 例外：
 * - Stripe Webhook (`/api/billing/webhook`) は外部からの POST なので除外。
 *   署名検証で正当性を担保する。
 * - GET/HEAD は副作用がないので検証しない。
 */

const STATE_CHANGING_METHODS = new Set(["POST", "PUT", "PATCH", "DELETE"]);

/**
 * Origin チェックを除外するパス（外部サービスからの正規 POST）。
 *
 * 重要：マッチは厳密で、 `/api/billing/webhook-foo` のような prefix-with-suffix
 * は除外されない（`startsWith("${p}/")` でスラッシュを境界に強制）。新規エント
 * リを追加する際は、サブパス全体を除外したい場合のみ書き、より短い親パス
 * （例: `/api/billing`）を入れないこと。後者だと配下の全 POST API が CSRF
 * 防御をすり抜ける。
 */
const EXEMPT_PATHS = [
  "/api/billing/webhook", // Stripe Webhook（署名検証で正当性担保）
];

function isExempt(pathname: string): boolean {
  return EXEMPT_PATHS.some((p) => pathname === p || pathname.startsWith(`${p}/`));
}

export function middleware(req: NextRequest) {
  if (!STATE_CHANGING_METHODS.has(req.method)) return NextResponse.next();
  if (isExempt(req.nextUrl.pathname)) return NextResponse.next();

  const origin = req.headers.get("origin");
  const referer = req.headers.get("referer");
  const host = req.headers.get("host");
  if (!host) {
    return NextResponse.json({ error: "missing_host" }, { status: 400 });
  }

  // 期待するオリジン: 同一ホスト（http/https いずれも許可。Vercel preview/local の両対応）
  const expectedOrigins = new Set<string>([
    `https://${host}`,
    `http://${host}`,
  ]);
  // 明示的な APP_URL 設定があれば追加で許可（カスタムドメイン）
  const appUrl = process.env.NEXT_PUBLIC_APP_URL;
  if (appUrl) expectedOrigins.add(appUrl.replace(/\/$/, ""));

  const candidate = origin ?? (referer ? new URL(referer).origin : null);
  if (!candidate || !expectedOrigins.has(candidate)) {
    return NextResponse.json(
      { error: "csrf_origin_mismatch" },
      { status: 403 },
    );
  }
  return NextResponse.next();
}

export const config = {
  // /api/* のみ対象（ページ遷移には影響させない）
  matcher: ["/api/:path*"],
};
