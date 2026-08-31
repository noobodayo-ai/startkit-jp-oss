// 差し替え前提のプレースホルダーです。
const faqs = [
  {
    q: "無料プランはありますか？",
    a: "はい。クレジットカードの登録なしでお試しいただけます。",
  },
  {
    q: "解約はいつでもできますか？",
    a: "ダッシュボードからいつでも解約できます。日割り返金の有無はプランによります。",
  },
  {
    q: "チームで使えますか？",
    a: "招待リンクからメンバーを追加できます。テナントごとにデータは分離されています。",
  },
  {
    q: "サポートはどこで受けられますか？",
    a: "特定商取引法に基づく表記に記載のメールアドレスまでご連絡ください。",
  },
];

export default function FaqPage() {
  return (
    <div className="max-w-3xl mx-auto px-6 py-16">
      <h1 className="text-3xl font-bold tracking-tight">よくある質問</h1>
      <dl className="mt-10 space-y-8">
        {faqs.map((f) => (
          <div key={f.q}>
            <dt className="font-semibold">{f.q}</dt>
            <dd className="mt-2 text-zinc-600 dark:text-zinc-400">{f.a}</dd>
          </div>
        ))}
      </dl>
    </div>
  );
}
