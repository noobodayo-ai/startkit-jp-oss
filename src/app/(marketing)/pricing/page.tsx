import Link from "next/link";

// 価格・プラン名は差し替え前提のプレースホルダーです。
// 決済を実装するには Stripe 連携（日本円 + 消費税 + 適格請求書 PDF）が必要です。
const plans = [
  {
    name: "Free",
    price: "¥0",
    note: "個人利用",
    features: ["メンバー 1名", "基本機能", "コミュニティサポート"],
    cta: "はじめる",
  },
  {
    name: "Pro",
    price: "¥1,980",
    note: "月額・税込",
    features: ["メンバー 5名", "全機能", "メールサポート"],
    cta: "はじめる",
    highlight: true,
  },
  {
    name: "Business",
    price: "お問い合わせ",
    note: "",
    features: ["メンバー 無制限", "SLA", "優先サポート"],
    cta: "問い合わせる",
  },
];

export default function PricingPage() {
  return (
    <div className="max-w-6xl mx-auto px-6 py-16">
      <h1 className="text-3xl font-bold tracking-tight text-center">料金プラン</h1>
      <p className="mt-3 text-center text-zinc-600 dark:text-zinc-400">
        自分のプロダクトに合わせて書き換えてください。
      </p>

      <div className="mt-12 grid gap-6 md:grid-cols-3">
        {plans.map((p) => (
          <div
            key={p.name}
            className={`rounded-lg border p-6 flex flex-col ${
              p.highlight
                ? "border-zinc-900 dark:border-zinc-100"
                : "border-zinc-200 dark:border-zinc-800"
            }`}
          >
            <h2 className="font-semibold">{p.name}</h2>
            <p className="mt-3 text-3xl font-bold">{p.price}</p>
            {p.note ? <p className="text-xs text-zinc-500">{p.note}</p> : null}
            <ul className="mt-5 space-y-2 text-sm text-zinc-600 dark:text-zinc-400 flex-1">
              {p.features.map((f) => (
                <li key={f}>・{f}</li>
              ))}
            </ul>
            <Link
              href="/signup"
              className="mt-6 text-center px-4 py-2 rounded-md bg-zinc-900 dark:bg-zinc-100 text-zinc-50 dark:text-zinc-900 text-sm"
            >
              {p.cta}
            </Link>
          </div>
        ))}
      </div>
    </div>
  );
}
