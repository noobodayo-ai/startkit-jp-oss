/**
 * シンプルなレート制限ユーティリティ。
 *
 * - デフォルトは in-memory（Vercel のホット個別インスタンス内のみ有効。
 *   Edge の冷起動や水平スケール下では完全保証されない）
 * - UPSTASH_REDIS_REST_URL / UPSTASH_REDIS_REST_TOKEN がセットされていれば
 *   Upstash Redis REST API（GET / INCR / EXPIRE）で永続化版に切替
 *
 * 高負荷・厳密保証が必要なら @upstash/ratelimit など別ライブラリを推奨。
 */

interface Bucket {
  count: number;
  resetAt: number;
}

const memStore = new Map<string, Bucket>();

export interface CheckResult {
  ok: boolean;
  remaining: number;
  resetAt: number;
}

export async function check(key: string, opts: { limit: number; windowSec: number }): Promise<CheckResult> {
  const url = process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN;
  if (url && token) {
    return checkUpstash(key, opts, url, token);
  }
  return checkMemory(key, opts);
}

function checkMemory(key: string, opts: { limit: number; windowSec: number }): CheckResult {
  const now = Date.now();
  const windowMs = opts.windowSec * 1000;
  const bucket = memStore.get(key);
  if (!bucket || bucket.resetAt < now) {
    const resetAt = now + windowMs;
    memStore.set(key, { count: 1, resetAt });
    return { ok: true, remaining: opts.limit - 1, resetAt };
  }
  if (bucket.count >= opts.limit) {
    return { ok: false, remaining: 0, resetAt: bucket.resetAt };
  }
  bucket.count += 1;
  return { ok: true, remaining: opts.limit - bucket.count, resetAt: bucket.resetAt };
}

async function checkUpstash(
  key: string,
  opts: { limit: number; windowSec: number },
  url: string,
  token: string,
): Promise<CheckResult> {
  // INCR で原子的にカウントアップ、初回のみ EXPIRE。
  // Upstash の pipeline API を使う：[["INCR", key], ["EXPIRE", key, window, "NX"]]
  const res = await fetch(`${url}/pipeline`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify([
      ["INCR", key],
      ["EXPIRE", key, String(opts.windowSec), "NX"],
      ["TTL", key],
    ]),
  });
  if (!res.ok) {
    // 上流障害時はフェイルオープン（業務止めない）。in-memory に記録。
    return checkMemory(key, opts);
  }
  const arr = (await res.json()) as { result: number | string }[];
  const count = Number(arr[0]?.result ?? 0);
  const ttl = Number(arr[2]?.result ?? opts.windowSec);
  const resetAt = Date.now() + Math.max(0, ttl) * 1000;
  if (count > opts.limit) {
    return { ok: false, remaining: 0, resetAt };
  }
  return { ok: true, remaining: Math.max(0, opts.limit - count), resetAt };
}

/**
 * Next.js Route Handler 用のヘッダ付与ヘルパ。
 */
export function rateLimitHeaders(r: CheckResult, limit: number): Record<string, string> {
  return {
    "X-RateLimit-Limit": String(limit),
    "X-RateLimit-Remaining": String(r.remaining),
    "X-RateLimit-Reset": String(Math.floor(r.resetAt / 1000)),
  };
}

/**
 * テスト用：in-memory ストアをクリアする
 */
export function _resetMemStore(): void {
  memStore.clear();
}
