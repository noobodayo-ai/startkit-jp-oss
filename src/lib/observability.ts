/**
 * 軽量なエラー監視 / イベント送信ラッパー。
 *
 * SENTRY_DSN が設定されている場合のみ Sentry envelope HTTP API に POST する。
 * 未設定なら console.error / console.warn のみで no-op。
 *
 * 依存を増やさず、Edge / Node どちらでも動作する。
 * より高度な機能（スタックフレーム整形、ブレッドクラム、リリーストラッキング等）が
 * 必要になったら `@sentry/nextjs` への切替を検討。手順は docs/observability.md。
 */

interface SentryEndpoint {
  url: string;
  projectId: string;
  publicKey: string;
}

function parseDsn(dsn: string): SentryEndpoint | null {
  // https://<publicKey>@<host>/<projectId>
  const m = dsn.match(/^https:\/\/([^@]+)@([^/]+)\/(\d+)/);
  if (!m) return null;
  const [, publicKey, host, projectId] = m;
  return {
    url: `https://${host}/api/${projectId}/envelope/`,
    projectId,
    publicKey,
  };
}

function envelope(eventId: string, payload: Record<string, unknown>): string {
  const header = JSON.stringify({ event_id: eventId, sent_at: new Date().toISOString() });
  const itemHeader = JSON.stringify({ type: "event" });
  return `${header}\n${itemHeader}\n${JSON.stringify(payload)}`;
}

function randomEventId(): string {
  // 32文字16進（Sentry仕様）
  const bytes = new Uint8Array(16);
  if (typeof crypto !== "undefined" && crypto.getRandomValues) {
    crypto.getRandomValues(bytes);
  } else {
    for (let i = 0; i < 16; i++) bytes[i] = Math.floor(Math.random() * 256);
  }
  return Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");
}

export interface CaptureContext {
  tags?: Record<string, string>;
  extra?: Record<string, unknown>;
  user?: { id?: string; email?: string };
  level?: "error" | "warning" | "info";
}

export async function captureError(err: unknown, ctx?: CaptureContext): Promise<void> {
  const dsn = process.env.SENTRY_DSN;
  const message = err instanceof Error ? err.message : String(err);
  const stack = err instanceof Error ? err.stack : undefined;

  if (!dsn) {
    console.error("[observability]", message, stack, ctx);
    return;
  }

  const endpoint = parseDsn(dsn);
  if (!endpoint) {
    console.error("[observability] invalid SENTRY_DSN:", dsn);
    return;
  }

  const eventId = randomEventId();
  const event: Record<string, unknown> = {
    event_id: eventId,
    timestamp: Date.now() / 1000,
    platform: "javascript",
    level: ctx?.level ?? "error",
    environment: process.env.NODE_ENV ?? "production",
    release: process.env.NEXT_PUBLIC_APP_VERSION,
    server_name: process.env.VERCEL_URL ?? "local",
    message: { formatted: message },
    exception: {
      values: [{ type: err instanceof Error ? err.name : "Error", value: message, stacktrace: stack ? { frames: parseStack(stack) } : undefined }],
    },
    tags: ctx?.tags,
    extra: ctx?.extra,
    user: ctx?.user,
  };

  const body = envelope(eventId, event);
  const url = `${endpoint.url}?sentry_key=${endpoint.publicKey}&sentry_version=7`;

  try {
    await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/x-sentry-envelope" },
      body,
    });
  } catch (sendErr) {
    // 監視の失敗で本処理を巻き込まない
    console.error("[observability] failed to send to Sentry", sendErr);
  }
}

interface StackFrame {
  filename: string;
  lineno?: number;
  function?: string;
}

function parseStack(stack: string): StackFrame[] {
  const out: StackFrame[] = [];
  for (const line of stack.split("\n").slice(1)) {
    const withFn = line.match(/at\s+(.+?)\s+\((.+?):(\d+):\d+\)/);
    if (withFn) {
      out.push({ function: withFn[1], filename: withFn[2], lineno: Number(withFn[3]) });
      continue;
    }
    const bare = line.match(/at\s+(.+?):(\d+):\d+/);
    if (bare) {
      out.push({ filename: bare[1], lineno: Number(bare[2]) });
    }
  }
  return out;
}

export async function captureMessage(message: string, level: CaptureContext["level"] = "info", ctx?: CaptureContext): Promise<void> {
  return captureError(new Error(message), { ...ctx, level });
}
