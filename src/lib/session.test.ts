import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

// next/headers の cookies() を mock。 cookieValue は test ごとに差し替え可能。
let cookieValue: string | undefined = undefined;
const cookieStore = {
  set: vi.fn(),
  delete: vi.fn(),
  get: vi.fn((name: string) => (name === "startkit_session" && cookieValue !== undefined ? { value: cookieValue } : undefined)),
};
vi.mock("next/headers", () => ({
  cookies: vi.fn(async () => cookieStore),
}));

// firebase-admin の adminAuth と isAdmin の mock。
//   - createSessionCookie / verifySessionCookie は各テストで挙動を差し替える
//   - isAdmin は引数の email で判定するロジックを test 側で再現
const createSessionCookieMock = vi.fn(async (...args: unknown[]) => {
  void args;
  return "ses_cookie_xxx";
});
const verifySessionCookieMock = vi.fn();
vi.mock("./firebase-admin", () => ({
  adminAuth: () => ({
    createSessionCookie: createSessionCookieMock,
    verifySessionCookie: verifySessionCookieMock,
  }),
  isAdmin: (email: string | undefined) => email === "admin@example.com",
}));

describe("setSessionCookie sameSite policy", () => {
  beforeEach(() => {
    cookieStore.set.mockClear();
  });
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("本番では sameSite=none + secure=true が既定", async () => {
    vi.stubEnv("NODE_ENV", "production");
    const { setSessionCookie } = await import("./session");
    await setSessionCookie("test-cookie");
    const arg = cookieStore.set.mock.calls[0]! as unknown as [
      string,
      string,
      { sameSite: string; secure: boolean; httpOnly: boolean; maxAge: number; path: string },
    ];
    expect(arg[0]).toBe("startkit_session");
    expect(arg[1]).toBe("test-cookie");
    expect(arg[2].sameSite).toBe("none");
    expect(arg[2].secure).toBe(true);
    expect(arg[2].httpOnly).toBe(true);
    expect(arg[2].maxAge).toBe(60 * 60 * 24 * 14);
    expect(arg[2].path).toBe("/");
  });

  it("開発環境では sameSite=lax にフォールバックする（http で none+secure は無効なため）", async () => {
    vi.stubEnv("NODE_ENV", "development");
    const { setSessionCookie } = await import("./session");
    await setSessionCookie("test-cookie");
    const arg = cookieStore.set.mock.calls[0]! as unknown as [string, string, { sameSite: string; secure: boolean }];
    expect(arg[2].sameSite).toBe("lax");
    expect(arg[2].secure).toBe(false);
  });

  it("呼び出し側で sameSite=lax を明示できる", async () => {
    vi.stubEnv("NODE_ENV", "production");
    const { setSessionCookie } = await import("./session");
    await setSessionCookie("test-cookie", { sameSite: "lax" });
    const arg = cookieStore.set.mock.calls[0]! as unknown as [string, string, { sameSite: string }];
    expect(arg[2].sameSite).toBe("lax");
  });

  it("呼び出し側で sameSite=strict を明示できる", async () => {
    vi.stubEnv("NODE_ENV", "production");
    const { setSessionCookie } = await import("./session");
    await setSessionCookie("test-cookie", { sameSite: "strict" });
    const arg = cookieStore.set.mock.calls[0]! as unknown as [string, string, { sameSite: string }];
    expect(arg[2].sameSite).toBe("strict");
  });

  it("非本番で sameSite=none を指定しても lax にフォールバック", async () => {
    vi.stubEnv("NODE_ENV", "development");
    const { setSessionCookie } = await import("./session");
    await setSessionCookie("test-cookie", { sameSite: "none" });
    const arg = cookieStore.set.mock.calls[0]! as unknown as [string, string, { sameSite: string }];
    expect(arg[2].sameSite).toBe("lax");
  });
});

describe("createSessionCookie", () => {
  beforeEach(() => {
    createSessionCookieMock.mockClear();
  });

  it("adminAuth().createSessionCookie に idToken と 14 日 ms を渡す", async () => {
    const { createSessionCookie } = await import("./session");
    const result = await createSessionCookie("id_token_abc");
    expect(createSessionCookieMock).toHaveBeenCalledWith("id_token_abc", {
      expiresIn: 60 * 60 * 24 * 14 * 1000,
    });
    expect(result).toBe("ses_cookie_xxx");
  });
});

describe("clearSessionCookie", () => {
  beforeEach(() => {
    cookieStore.delete.mockClear();
  });

  it("startkit_session を削除する", async () => {
    const { clearSessionCookie } = await import("./session");
    await clearSessionCookie();
    expect(cookieStore.delete).toHaveBeenCalledWith("startkit_session");
  });
});

describe("getSessionUser", () => {
  beforeEach(() => {
    cookieValue = undefined;
    verifySessionCookieMock.mockReset();
    cookieStore.get.mockClear();
  });

  it("cookie 未設定なら null を返す", async () => {
    const { getSessionUser } = await import("./session");
    expect(await getSessionUser()).toBeNull();
    expect(verifySessionCookieMock).not.toHaveBeenCalled();
  });

  it("verifySessionCookie が成功すると decoded から SessionUser を組み立てる", async () => {
    cookieValue = "valid-session";
    verifySessionCookieMock.mockResolvedValueOnce({
      uid: "uid-1",
      email: "user@example.com",
      tenantId: "tenant-1",
      role: "admin",
      email_verified: true,
    });
    const { getSessionUser } = await import("./session");
    const user = await getSessionUser();
    expect(user).toEqual({
      uid: "uid-1",
      email: "user@example.com",
      tenantId: "tenant-1",
      role: "admin",
      isAdmin: false,
      emailVerified: true,
    });
    // verifySessionCookie の第2引数は checkRevoked=true で呼ばれている
    expect(verifySessionCookieMock).toHaveBeenCalledWith("valid-session", true);
  });

  it("decoded.email が admin email なら isAdmin=true", async () => {
    cookieValue = "valid-session";
    verifySessionCookieMock.mockResolvedValueOnce({
      uid: "uid-admin",
      email: "admin@example.com",
      tenantId: "tenant-1",
      role: "owner",
      email_verified: true,
    });
    const { getSessionUser } = await import("./session");
    expect((await getSessionUser())?.isAdmin).toBe(true);
  });

  it("decoded のオプショナルフィールドが欠けていても安全なデフォルトに落ちる", async () => {
    cookieValue = "valid-session";
    verifySessionCookieMock.mockResolvedValueOnce({
      uid: "uid-2",
      // email / tenantId / role / email_verified が全部欠落
    });
    const { getSessionUser } = await import("./session");
    expect(await getSessionUser()).toEqual({
      uid: "uid-2",
      email: "",
      tenantId: "",
      role: "",
      isAdmin: false,
      emailVerified: false,
    });
  });

  it("verifySessionCookie が throw (期限切れ / 不正 cookie) しても null を返す", async () => {
    cookieValue = "expired-session";
    verifySessionCookieMock.mockRejectedValueOnce(new Error("auth/session-cookie-expired"));
    const { getSessionUser } = await import("./session");
    expect(await getSessionUser()).toBeNull();
  });
});

describe("requireUser", () => {
  beforeEach(() => {
    cookieValue = undefined;
    verifySessionCookieMock.mockReset();
  });

  it("セッションなしなら UNAUTHORIZED を throw", async () => {
    const { requireUser } = await import("./session");
    await expect(requireUser()).rejects.toThrow("UNAUTHORIZED");
  });

  it("セッションあれば user を返す", async () => {
    cookieValue = "valid";
    verifySessionCookieMock.mockResolvedValueOnce({ uid: "u", email: "u@ex.com", tenantId: "t" });
    const { requireUser } = await import("./session");
    const user = await requireUser();
    expect(user.uid).toBe("u");
  });
});

describe("requireAdmin", () => {
  beforeEach(() => {
    cookieValue = undefined;
    verifySessionCookieMock.mockReset();
  });

  it("セッションなしなら UNAUTHORIZED を throw", async () => {
    const { requireAdmin } = await import("./session");
    await expect(requireAdmin()).rejects.toThrow("UNAUTHORIZED");
  });

  it("セッションあり + admin でない場合は FORBIDDEN を throw", async () => {
    cookieValue = "valid";
    verifySessionCookieMock.mockResolvedValueOnce({ uid: "u", email: "user@example.com", tenantId: "t" });
    const { requireAdmin } = await import("./session");
    await expect(requireAdmin()).rejects.toThrow("FORBIDDEN");
  });

  it("セッションあり + admin なら user を返す", async () => {
    cookieValue = "valid";
    verifySessionCookieMock.mockResolvedValueOnce({
      uid: "u-admin",
      email: "admin@example.com",
      tenantId: "t",
    });
    const { requireAdmin } = await import("./session");
    const user = await requireAdmin();
    expect(user.isAdmin).toBe(true);
    expect(user.uid).toBe("u-admin");
  });
});
