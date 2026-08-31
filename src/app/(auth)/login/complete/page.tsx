"use client";

import { Suspense, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { getAuthClient, isSignInWithEmailLink, signInWithEmailLink } from "@/lib/firebase-client";

function LoginCompleteInner() {
  const router = useRouter();
  const search = useSearchParams();
  const redirect = search.get("redirect") || "/dashboard";
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    void (async () => {
      try {
        const auth = getAuthClient();
        if (!isSignInWithEmailLink(auth, window.location.href)) {
          setError("無効なログインリンクです");
          return;
        }
        let email = window.localStorage.getItem("startkit_email_for_signin") || "";
        if (!email) {
          email = window.prompt("メールアドレスを入力してください（確認用）") ?? "";
        }
        if (!email) {
          setError("メールアドレスが取得できませんでした");
          return;
        }
        const cred = await signInWithEmailLink(auth, email, window.location.href);
        const idToken = await cred.user.getIdToken();
        const res = await fetch("/api/session", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ idToken }),
        });
        if (!res.ok) throw new Error("セッション作成に失敗");
        window.localStorage.removeItem("startkit_email_for_signin");
        router.push(redirect);
        router.refresh();
      } catch (e) {
        setError(e instanceof Error ? e.message : "Unknown error");
      }
    })();
  }, [router, redirect]);

  return (
    <div className="bg-white dark:bg-zinc-900 rounded-xl shadow-sm border border-zinc-200 dark:border-zinc-800 p-8 text-center">
      <h1 className="text-xl font-bold mb-2">ログイン処理中...</h1>
      {error ? (
        <p className="text-sm text-red-600 dark:text-red-400">{error}</p>
      ) : (
        <p className="text-sm text-zinc-500">少しお待ちください</p>
      )}
    </div>
  );
}

export default function LoginCompletePage() {
  return (
    <Suspense
      fallback={
        <div className="bg-white dark:bg-zinc-900 rounded-xl border border-zinc-200 dark:border-zinc-800 p-8 text-center">
          <p className="text-sm text-zinc-500">読み込み中...</p>
        </div>
      }
    >
      <LoginCompleteInner />
    </Suspense>
  );
}
