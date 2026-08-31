"use client";

import { Suspense, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { signInWithPopup, sendSignInLinkToEmail } from "firebase/auth";
import { getAuthClient, getGoogleProvider } from "@/lib/firebase-client";

function LoginInner() {
  const router = useRouter();
  const search = useSearchParams();
  const redirect = search.get("redirect") || "/dashboard";
  const [email, setEmail] = useState("");
  const [linkSent, setLinkSent] = useState(false);
  const [loading, setLoading] = useState<"google" | "email" | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function exchangeForSession(idToken: string) {
    const res = await fetch("/api/session", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ idToken }),
    });
    if (!res.ok) {
      const j = (await res.json().catch(() => ({}))) as { error?: string };
      throw new Error(j.error ?? "ログインに失敗しました");
    }
  }

  async function signInGoogle() {
    setError(null);
    setLoading("google");
    try {
      const auth = getAuthClient();
      const provider = getGoogleProvider();
      const cred = await signInWithPopup(auth, provider);
      const idToken = await cred.user.getIdToken();
      await exchangeForSession(idToken);
      router.push(redirect);
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Unknown error");
    } finally {
      setLoading(null);
    }
  }

  async function sendEmailLink() {
    setError(null);
    setLoading("email");
    try {
      const auth = getAuthClient();
      const url = `${window.location.origin}/login/complete?redirect=${encodeURIComponent(redirect)}`;
      await sendSignInLinkToEmail(auth, email, {
        url,
        handleCodeInApp: true,
      });
      window.localStorage.setItem("startkit_email_for_signin", email);
      setLinkSent(true);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Unknown error");
    } finally {
      setLoading(null);
    }
  }

  return (
    <div className="bg-white dark:bg-zinc-900 rounded-xl shadow-sm border border-zinc-200 dark:border-zinc-800 p-8">
      <h1 className="text-2xl font-bold mb-1">ログイン</h1>
      <p className="text-sm text-zinc-600 dark:text-zinc-400 mb-6">
        アカウントをお持ちでない方は <Link href="/signup" className="text-blue-700 dark:text-blue-300 underline">新規登録</Link>
      </p>

      <button
        onClick={signInGoogle}
        disabled={loading !== null}
        className="w-full px-4 py-3 rounded-lg border border-zinc-300 dark:border-zinc-700 text-sm font-medium hover:bg-zinc-50 dark:hover:bg-zinc-800 disabled:opacity-50"
      >
        {loading === "google" ? "ログイン中..." : "Googleでログイン"}
      </button>

      <div className="my-6 flex items-center gap-3 text-xs text-zinc-600 dark:text-zinc-400">
        <div className="flex-1 h-px bg-zinc-200 dark:bg-zinc-800" />
        <span>または</span>
        <div className="flex-1 h-px bg-zinc-200 dark:bg-zinc-800" />
      </div>

      {linkSent ? (
        <div className="p-4 rounded-lg bg-emerald-50 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-300 text-sm">
          {email} 宛にメールを送りました。メール内のリンクを開いてください。
        </div>
      ) : (
        <form
          onSubmit={(e) => {
            e.preventDefault();
            void sendEmailLink();
          }}
          className="space-y-4"
        >
          <label htmlFor="login-email" className="sr-only">メールアドレス</label>
          <input
            id="login-email"
            type="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="you@example.com"
            aria-label="メールアドレス"
            className="w-full px-3 py-2 border border-zinc-300 dark:border-zinc-700 dark:bg-zinc-800 rounded-lg"
          />
          <button
            type="submit"
            disabled={loading !== null}
            className="w-full bg-zinc-900 dark:bg-zinc-100 text-zinc-50 dark:text-zinc-900 px-4 py-3 rounded-lg font-medium disabled:opacity-50"
          >
            {loading === "email" ? "送信中..." : "メールでログインリンクを送る"}
          </button>
        </form>
      )}

      {error && <p className="mt-4 text-sm text-red-600 dark:text-red-400">{error}</p>}
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense
      fallback={
        <div className="bg-white dark:bg-zinc-900 rounded-xl border border-zinc-200 dark:border-zinc-800 p-8 text-center">
          <p className="text-sm text-zinc-500">読み込み中...</p>
        </div>
      }
    >
      <LoginInner />
    </Suspense>
  );
}
