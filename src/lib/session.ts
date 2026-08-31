import { cookies } from "next/headers";
import { adminAuth, isAdmin } from "./firebase-admin";
import type { TenantMemberRole } from "@/types/firestore";

const COOKIE_NAME = "startkit_session";
const MAX_AGE_SEC = 60 * 60 * 24 * 14; // 14 days

export interface SessionUser {
  uid: string;
  email: string;
  tenantId: string;
  role: TenantMemberRole | "";
  isAdmin: boolean;
  emailVerified: boolean;
}

export async function createSessionCookie(idToken: string): Promise<string> {
  return adminAuth().createSessionCookie(idToken, { expiresIn: MAX_AGE_SEC * 1000 });
}

export interface SessionCookieOptions {
  /**
   * Stripe Checkout/Customer Portal 等の外部オリジンからのリダイレクト復路で
   * セッションを維持したい場合は "none" を指定。本番(HTTPS)でのみ有効。
   * 既定の "lax" でも Safari/Chrome は通常動くが、Brave Shields や
   * 厳格な tracking protection 下では復路で cookie が落ちる事例がある。
   */
  sameSite?: "lax" | "strict" | "none";
}

export async function setSessionCookie(
  sessionCookie: string,
  options: SessionCookieOptions = {},
): Promise<void> {
  const store = await cookies();
  const isProd = process.env.NODE_ENV === "production";
  // 既定: 本番は "none"（外部リダイレクト対応）、開発は "lax"（http で none + secure は無効になるため）
  const sameSite = options.sameSite ?? (isProd ? "none" : "lax");
  // sameSite=none は secure=true 必須。本番以外で none を指定された場合は lax にフォールバック。
  const effectiveSameSite = sameSite === "none" && !isProd ? "lax" : sameSite;
  store.set(COOKIE_NAME, sessionCookie, {
    httpOnly: true,
    secure: isProd,
    sameSite: effectiveSameSite,
    maxAge: MAX_AGE_SEC,
    path: "/",
  });
}

export async function clearSessionCookie(): Promise<void> {
  const store = await cookies();
  store.delete(COOKIE_NAME);
}

export async function getSessionUser(): Promise<SessionUser | null> {
  const store = await cookies();
  const value = store.get(COOKIE_NAME)?.value;
  if (!value) return null;
  try {
    const decoded = await adminAuth().verifySessionCookie(value, true);
    return {
      uid: decoded.uid,
      email: decoded.email ?? "",
      tenantId: (decoded.tenantId as string) ?? "",
      role: (decoded.role as TenantMemberRole | undefined) ?? "",
      isAdmin: isAdmin(decoded.email),
      emailVerified: !!decoded.email_verified,
    };
  } catch {
    return null;
  }
}

export async function requireUser(): Promise<SessionUser> {
  const user = await getSessionUser();
  if (!user) throw new Error("UNAUTHORIZED");
  return user;
}

export async function requireAdmin(): Promise<SessionUser> {
  const user = await requireUser();
  if (!user.isAdmin) throw new Error("FORBIDDEN");
  return user;
}
