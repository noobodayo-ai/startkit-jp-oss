import { afterEach, describe, it, expect, beforeEach, vi } from "vitest";
import { check, _resetMemStore } from "./rate-limit";

describe("rate-limit (in-memory)", () => {
  beforeEach(() => {
    delete process.env.UPSTASH_REDIS_REST_URL;
    delete process.env.UPSTASH_REDIS_REST_TOKEN;
    _resetMemStore();
  });

  it("allows first N requests, blocks N+1", async () => {
    const opts = { limit: 3, windowSec: 60 };
    expect((await check("k1", opts)).ok).toBe(true);
    expect((await check("k1", opts)).ok).toBe(true);
    expect((await check("k1", opts)).ok).toBe(true);
    const blocked = await check("k1", opts);
    expect(blocked.ok).toBe(false);
    expect(blocked.remaining).toBe(0);
  });

  it("separate keys do not interfere", async () => {
    const opts = { limit: 1, windowSec: 60 };
    expect((await check("a", opts)).ok).toBe(true);
    expect((await check("b", opts)).ok).toBe(true);
    expect((await check("a", opts)).ok).toBe(false);
  });

  it("remaining decreases each call", async () => {
    const opts = { limit: 3, windowSec: 60 };
    const r1 = await check("c", opts);
    const r2 = await check("c", opts);
    const r3 = await check("c", opts);
    expect(r1.remaining).toBe(2);
    expect(r2.remaining).toBe(1);
    expect(r3.remaining).toBe(0);
  });
});

describe("rate-limit (Upstash REST)", () => {
  const URL = "https://example.upstash.io";
  const TOKEN = "tok_xxx";

  beforeEach(() => {
    process.env.UPSTASH_REDIS_REST_URL = URL;
    process.env.UPSTASH_REDIS_REST_TOKEN = TOKEN;
    _resetMemStore();
  });
  afterEach(() => {
    delete process.env.UPSTASH_REDIS_REST_URL;
    delete process.env.UPSTASH_REDIS_REST_TOKEN;
    vi.unstubAllGlobals();
  });

  function stubFetch(responseBody: { result: number | string }[], ok = true) {
    const fetchMock = vi.fn(async () => ({
      ok,
      json: async () => responseBody,
    }));
    vi.stubGlobal("fetch", fetchMock);
    return fetchMock;
  }

  it("初回の INCR=1 で許可 + Authorization Bearer + pipeline body を送る", async () => {
    const fetchMock = stubFetch([
      { result: 1 }, // INCR
      { result: "OK" }, // EXPIRE NX
      { result: 60 }, // TTL
    ]);
    const r = await check("k1", { limit: 5, windowSec: 60 });
    expect(r.ok).toBe(true);
    expect(r.remaining).toBe(4);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0]! as unknown as [string, { method: string; headers: Record<string, string>; body: string }];
    expect(url).toBe(`${URL}/pipeline`);
    expect(init.method).toBe("POST");
    expect(init.headers.Authorization).toBe(`Bearer ${TOKEN}`);
    const body = JSON.parse(init.body) as unknown[][];
    expect(body[0]).toEqual(["INCR", "k1"]);
    expect(body[1]).toEqual(["EXPIRE", "k1", "60", "NX"]);
    expect(body[2]).toEqual(["TTL", "k1"]);
  });

  it("INCR が limit を超えたら ok=false + remaining=0", async () => {
    stubFetch([{ result: 6 }, { result: 0 }, { result: 30 }]);
    const r = await check("k2", { limit: 5, windowSec: 60 });
    expect(r.ok).toBe(false);
    expect(r.remaining).toBe(0);
  });

  it("INCR が limit 上限ぴったりなら ok=true + remaining=0", async () => {
    stubFetch([{ result: 5 }, { result: 0 }, { result: 30 }]);
    const r = await check("k3", { limit: 5, windowSec: 60 });
    expect(r.ok).toBe(true);
    expect(r.remaining).toBe(0);
  });

  it("Upstash が non-ok を返したら in-memory にフェイルオープン", async () => {
    stubFetch([], false);
    const r = await check("k-fallback", { limit: 2, windowSec: 60 });
    // in-memory での 1 件目なので ok=true, remaining = limit-1
    expect(r.ok).toBe(true);
    expect(r.remaining).toBe(1);
  });

  it("TTL=-1 (永続) でも resetAt は now 以上になる (Math.max(0, ttl) で負数を弾く)", async () => {
    stubFetch([{ result: 1 }, { result: 0 }, { result: -1 }]);
    const before = Date.now();
    const r = await check("k-ttl", { limit: 5, windowSec: 60 });
    expect(r.ok).toBe(true);
    expect(r.resetAt).toBeGreaterThanOrEqual(before);
  });

  it("TTL 要素が欠ける truncated レスポンスでも INCR の値で正しくカウントされる", async () => {
    // Codex P3: INCR は Redis 仕様で最小 1 を返すため、 0 をモックするのは不正確。
    // 実際に起こりうる truncated レスポンスは「INCR は返ったが TTL が欠けた」 ケース。
    // この場合 quota は消費済みなので remaining = limit - count = 5 - 1 = 4 となるのが正しい挙動。
    stubFetch([{ result: 1 }] as { result: number | string }[]);
    const r = await check("k-bad", { limit: 5, windowSec: 60 });
    expect(r.ok).toBe(true);
    expect(r.remaining).toBe(4);
  });
});
