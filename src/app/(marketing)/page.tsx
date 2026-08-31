import Link from "next/link";

// このページは差し替え前提のプレースホルダーです。
// あなたのプロダクトの言葉に書き換えてください。
const features = [
  {
    title: "Firebase Auth + Google SSO",
    desc: "HttpOnly セッション Cookie とサーバー側検証まで実装済み。ログイン・新規登録画面も同梱。",
  },
  {
    title: "マルチテナント（Custom Claims）",
    desc: "招待コード方式のテナント分離。Firestore Security Rules でテナントを跨いだ読み書きを塞いでいます。",
  },
  {
    title: "日本法準拠の法令ページ",
    desc: "特商法表記・プライバシーポリシー・利用規約。env に事業者情報を入れるだけで自社の内容になります。",
  },
];

export default function Home() {
  const appName = process.env.NEXT_PUBLIC_APP_NAME ?? "StartKit JP";

  return (
    <div className="max-w-6xl mx-auto px-6">
      <section className="py-20 md:py-28 text-center">
        <h1 className="text-4xl md:text-5xl font-bold tracking-tight">
          {appName} へようこそ
        </h1>
        <p className="mt-5 text-lg text-zinc-600 dark:text-zinc-400 max-w-2xl mx-auto">
          日本市場向け SaaS の土台。認証・マルチテナント・法令ページまで動く状態から始められます。
        </p>
        <div className="mt-8 flex items-center justify-center gap-3">
          <Link
            href="/signup"
            className="px-5 py-2.5 rounded-md bg-zinc-900 dark:bg-zinc-100 text-zinc-50 dark:text-zinc-900 font-medium"
          >
            無料で始める
          </Link>
          <Link
            href="/pricing"
            className="px-5 py-2.5 rounded-md border border-zinc-300 dark:border-zinc-700"
          >
            料金を見る
          </Link>
        </div>
      </section>

      <section id="features" className="pb-20 grid gap-6 md:grid-cols-3">
        {features.map((f) => (
          <div
            key={f.title}
            className="rounded-lg border border-zinc-200 dark:border-zinc-800 p-6"
          >
            <h2 className="font-semibold">{f.title}</h2>
            <p className="mt-2 text-sm text-zinc-600 dark:text-zinc-400">{f.desc}</p>
          </div>
        ))}
      </section>
    </div>
  );
}
