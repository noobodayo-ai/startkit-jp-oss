import { describe, it, expect, vi, beforeEach } from "vitest";
import { captureError, captureMessage } from "./observability";

describe("captureError", () => {
  beforeEach(() => {
    delete process.env.SENTRY_DSN;
    vi.restoreAllMocks();
  });

  it("logs to console.error when SENTRY_DSN is missing (no-op)", async () => {
    const spy = vi.spyOn(console, "error").mockImplementation(() => undefined);
    await captureError(new Error("boom"));
    expect(spy).toHaveBeenCalled();
  });

  it("does not throw on invalid DSN", async () => {
    process.env.SENTRY_DSN = "not-a-valid-dsn";
    const spy = vi.spyOn(console, "error").mockImplementation(() => undefined);
    await expect(captureError(new Error("x"))).resolves.toBeUndefined();
    expect(spy).toHaveBeenCalled();
  });

  it("attempts envelope POST when DSN is valid", async () => {
    process.env.SENTRY_DSN = "https://abc@o123.ingest.sentry.io/456";
    const fetchSpy = vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response("", { status: 200 }),
    );
    await captureError(new Error("test"));
    expect(fetchSpy).toHaveBeenCalledTimes(1);
    const [url, init] = fetchSpy.mock.calls[0];
    expect(String(url)).toContain("https://o123.ingest.sentry.io/api/456/envelope/");
    expect((init as RequestInit).method).toBe("POST");
    expect((init as RequestInit).headers).toMatchObject({ "Content-Type": "application/x-sentry-envelope" });
    const body = (init as RequestInit & { body: string }).body;
    // envelope は 3 行 (header / item header / event)
    const lines = body.split("\n");
    expect(lines).toHaveLength(3);
    const header = JSON.parse(lines[0]!);
    expect(header.event_id).toMatch(/^[0-9a-f]{32}$/);
    const event = JSON.parse(lines[2]!) as { level: string; message: { formatted: string }; exception: { values: { type: string; value: string }[] } };
    expect(event.level).toBe("error");
    expect(event.message.formatted).toBe("test");
    expect(event.exception.values[0]!.type).toBe("Error");
    expect(event.exception.values[0]!.value).toBe("test");
  });

  it("fetch が失敗しても throw せず console.error にフォールバック", async () => {
    process.env.SENTRY_DSN = "https://abc@o123.ingest.sentry.io/456";
    vi.spyOn(globalThis, "fetch").mockRejectedValue(new Error("network down"));
    const errSpy = vi.spyOn(console, "error").mockImplementation(() => undefined);
    await expect(captureError(new Error("test"))).resolves.toBeUndefined();
    // 監視失敗用の console.error が呼ばれる (L99)
    expect(errSpy).toHaveBeenCalledWith("[observability] failed to send to Sentry", expect.any(Error));
  });

  it("ctx.tags / ctx.extra / ctx.user / ctx.level が event に乗る", async () => {
    process.env.SENTRY_DSN = "https://abc@o123.ingest.sentry.io/456";
    const fetchSpy = vi.spyOn(globalThis, "fetch").mockResolvedValue(new Response("", { status: 200 }));
    await captureError(new Error("with-ctx"), {
      tags: { module: "test" },
      extra: { foo: 1 },
      user: { id: "u-1", email: "u@ex.com" },
      level: "warning",
    });
    const body = (fetchSpy.mock.calls[0]![1] as RequestInit & { body: string }).body;
    const event = JSON.parse(body.split("\n")[2]!) as {
      level: string;
      tags: Record<string, string>;
      extra: Record<string, unknown>;
      user: { id: string; email: string };
    };
    expect(event.level).toBe("warning");
    expect(event.tags).toEqual({ module: "test" });
    expect(event.extra).toEqual({ foo: 1 });
    expect(event.user).toEqual({ id: "u-1", email: "u@ex.com" });
  });

  it("Error 以外 (string) を渡しても message に整形される", async () => {
    process.env.SENTRY_DSN = "https://abc@o123.ingest.sentry.io/456";
    const fetchSpy = vi.spyOn(globalThis, "fetch").mockResolvedValue(new Response("", { status: 200 }));
    await captureError("just-a-string");
    const body = (fetchSpy.mock.calls[0]![1] as RequestInit & { body: string }).body;
    const event = JSON.parse(body.split("\n")[2]!) as { message: { formatted: string }; exception: { values: { type: string }[] } };
    expect(event.message.formatted).toBe("just-a-string");
    expect(event.exception.values[0]!.type).toBe("Error"); // err instanceof Error ? err.name : "Error"
  });
});

describe("captureMessage", () => {
  beforeEach(() => {
    delete process.env.SENTRY_DSN;
    vi.restoreAllMocks();
  });

  it("captureError に level=info を既定で渡す", async () => {
    process.env.SENTRY_DSN = "https://abc@o123.ingest.sentry.io/456";
    const fetchSpy = vi.spyOn(globalThis, "fetch").mockResolvedValue(new Response("", { status: 200 }));
    await captureMessage("just info");
    const body = (fetchSpy.mock.calls[0]![1] as RequestInit & { body: string }).body;
    const event = JSON.parse(body.split("\n")[2]!) as { level: string; message: { formatted: string } };
    expect(event.level).toBe("info");
    expect(event.message.formatted).toBe("just info");
  });

  it("引数で level=warning を明示できる", async () => {
    process.env.SENTRY_DSN = "https://abc@o123.ingest.sentry.io/456";
    const fetchSpy = vi.spyOn(globalThis, "fetch").mockResolvedValue(new Response("", { status: 200 }));
    await captureMessage("warn me", "warning");
    const body = (fetchSpy.mock.calls[0]![1] as RequestInit & { body: string }).body;
    const event = JSON.parse(body.split("\n")[2]!) as { level: string };
    expect(event.level).toBe("warning");
  });

  it("ctx を渡すと tags 等も伝播する", async () => {
    process.env.SENTRY_DSN = "https://abc@o123.ingest.sentry.io/456";
    const fetchSpy = vi.spyOn(globalThis, "fetch").mockResolvedValue(new Response("", { status: 200 }));
    await captureMessage("with-ctx", "info", { tags: { route: "/api/foo" } });
    const body = (fetchSpy.mock.calls[0]![1] as RequestInit & { body: string }).body;
    const event = JSON.parse(body.split("\n")[2]!) as { tags: Record<string, string> };
    expect(event.tags).toEqual({ route: "/api/foo" });
  });
});
