"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  signInWithPopup,
  createUserWithEmailAndPassword,
} from "firebase/auth";
import { getAuthClient, getGoogleProvider } from "@/lib/firebase-client";

export default function SignupPage() {
  const router = useRouter();
  const [tenantName, setTenantName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function createTenantAndLogin(idToken: string) {
    const sess = await fetch("/api/session", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ idToken }),
    });
    if (!sess.ok) throw new Error("セッション作成に失敗");
    const tenant = await fetch("/api/tenants", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: tenantName || "My Workspace" }),
    });
    if (!tenant.ok) {
      const j = (await tenant.json().catch(() => ({}))) as { error?: string };
      throw new Error(j.error ?? "テナント作成に失敗");
    }
    // Custom Claims を反映させるためトークン強制リフレッシュ
    const auth = getAuthClient();
    if (auth.currentUser) await auth.currentUser.getIdToken(true);
  }

  async function signUpGoogle() {
    setLoading(true);
    setError(null);
    try {
      const auth = getAuthClient();
      const cred = await signInWithPopup(auth, getGoogleProvider());
      const idToken = await cred.user.getIdToken();
      await createTenantAndLogin(idToken);
      router.push("/dashboard");
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Unknown error");
    } finally {
      setLoading(false);
    }
  }

  async function signUpEmail() {
    setLoading(true);
    setError(null);
    try {
      const auth = getAuthClient();
      const cred = await createUserWithEmailAndPassword(auth, email, password);
      const idToken = await cred.user.getIdToken();
      await createTenantAndLogin(idToken);
      router.push("/dashboard");
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Unknown error");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="bg-white dark:bg-zinc-900 rounded-xl shadow-sm border border-zinc-200 dark:border-zinc-800 p-8">
      <h1 className="text-2xl font-bold mb-1">新規登録</h1>
      <p className="text-sm text-zinc-600 dark:text-zinc-400 mb-6">
        既にアカウントをお持ちの方は <Link href="/login" className="text-blue-700 dark:text-blue-300 underline">ログイン</Link>
      </p>

      <label htmlFor="signup-tenant-name" className="sr-only">ワークスペース名</label>
      <input
        id="signup-tenant-name"
        type="text"
        value={tenantName}
        onChange={(e) => setTenantName(e.target.value)}
        placeholder="ワークスペース名（任意）"
        aria-label="ワークスペース名"
        className="w-full mb-4 px-3 py-2 border border-zinc-300 dark:border-zinc-700 dark:bg-zinc-800 rounded-lg text-sm"
      />

      <button
        onClick={signUpGoogle}
        disabled={loading}
        className="w-full mb-4 px-4 py-3 rounded-lg border border-zinc-300 dark:border-zinc-700 text-sm font-medium hover:bg-zinc-50 dark:hover:bg-zinc-800 disabled:opacity-50"
      >
        Googleで登録
      </button>

      <div className="my-4 flex items-center gap-3 text-xs text-zinc-600 dark:text-zinc-400">
        <div className="flex-1 h-px bg-zinc-200 dark:bg-zinc-800" />
        <span>または</span>
        <div className="flex-1 h-px bg-zinc-200 dark:bg-zinc-800" />
      </div>

      <form
        onSubmit={(e) => {
          e.preventDefault();
          void signUpEmail();
        }}
        className="space-y-3"
      >
        <label htmlFor="signup-email" className="sr-only">メールアドレス</label>
        <input
          id="signup-email"
          type="email"
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="you@example.com"
          aria-label="メールアドレス"
          className="w-full px-3 py-2 border border-zinc-300 dark:border-zinc-700 dark:bg-zinc-800 rounded-lg"
        />
        <label htmlFor="signup-password" className="sr-only">パスワード</label>
        <input
          id="signup-password"
          type="password"
          required
          minLength={8}
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          placeholder="パスワード（8文字以上）"
          aria-label="パスワード（8文字以上）"
          className="w-full px-3 py-2 border border-zinc-300 dark:border-zinc-700 dark:bg-zinc-800 rounded-lg"
        />
        <button
          type="submit"
          disabled={loading}
          className="w-full bg-zinc-900 dark:bg-zinc-100 text-zinc-50 dark:text-zinc-900 px-4 py-3 rounded-lg font-medium disabled:opacity-50"
        >
          {loading ? "登録中..." : "登録する"}
        </button>
      </form>

      {error && <p className="mt-4 text-sm text-red-600 dark:text-red-400">{error}</p>}
    </div>
  );
}
