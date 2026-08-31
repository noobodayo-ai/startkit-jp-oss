import { getLegalConfig } from "@/lib/legal-config";

export const metadata = { title: "プライバシーポリシー" };

export default function PrivacyPage() {
  const c = getLegalConfig();
  return (
    <article className="max-w-3xl mx-auto px-6 py-16 prose prose-zinc dark:prose-invert">
      <h1>{c.appName} プライバシーポリシー</h1>
      <p className="text-sm text-zinc-500">最終更新日：{c.lastUpdated}</p>

      <p>
        {c.issuerName}（以下「当社」）は、{c.appName}（以下「本サービス」）における
        ユーザーの個人情報の取扱いについて、以下のとおり定めます。本ポリシーは、個人情報の保護に関する法律
        （個人情報保護法）その他関連法令を遵守するものです。
      </p>

      <h2>1. 取得する個人情報</h2>
      <ul>
        <li>氏名、メールアドレス、所属組織名</li>
        <li>クッキー、IPアドレス、ブラウザ・OS情報</li>
        <li>サービス利用ログ、操作履歴</li>
        <li>決済に必要な情報（実際のクレジットカード番号は Stripe に直接送信され、当社サーバーには保存しません）</li>
      </ul>

      <h2>2. 利用目的</h2>
      <ul>
        <li>本サービスの提供および運営</li>
        <li>本人確認、不正利用の防止</li>
        <li>サービス改善、新機能の検討、利用統計の作成</li>
        <li>お問い合わせ・サポート対応</li>
        <li>当社からの重要なお知らせの送付</li>
        <li>法令の遵守</li>
      </ul>

      <h2>3. 第三者提供</h2>
      <p>当社は、以下の場合を除き、ユーザーの同意なく個人情報を第三者に提供しません。</p>
      <ul>
        <li>法令に基づく場合</li>
        <li>人の生命、身体または財産の保護のために必要な場合</li>
        <li>業務委託先（クラウドインフラ、決済代行、メール配信）への提供。この場合、当社は委託先に対し適切な監督を行います。</li>
      </ul>

      <h2>4. 委託先</h2>
      <ul>
        <li>Google LLC（Firebase Authentication / Firestore / Cloud Storage / Gemini API）</li>
        <li>Stripe, Inc.（決済処理）</li>
        <li>Vercel Inc.（Webホスティング）</li>
        {process.env.RESEND_API_KEY && (
          <li>Resend, Inc.（トランザクションメール配信）</li>
        )}
        {process.env.SENTRY_DSN && (
          <li>Functional Software, Inc. d/b/a Sentry（エラー監視）</li>
        )}
        {process.env.UPSTASH_REDIS_REST_URL && (
          <li>Upstash, Inc.（レート制限用 Redis）</li>
        )}
      </ul>

      <h2>5. 保有期間と削除</h2>
      <p>
        ユーザーがアカウントを削除した場合、当社は法令で保存が義務付けられる情報を除き、30日以内に個人情報を削除します。
        会計関連の記録（請求書・領収書）は法令の保存期間に従い保存します（インボイス制度に基づく保存期間 7 年）。
      </p>

      <h2>6. 開示・訂正・削除請求</h2>
      <p>
        ユーザーは、当社に対し、保有する自己の個人情報の開示・訂正・利用停止・削除を請求できます。
        請求は {c.issuerEmail} までご連絡ください。ご本人確認を行ったうえで遅滞なく対応いたします。
      </p>

      <h2>7. クッキーおよび類似技術</h2>
      <p>
        本サービスは、認証セッションの維持および利用統計の取得のために、クッキーおよびローカルストレージを使用します。
        ブラウザの設定により無効化できますが、その場合本サービスの一部機能が利用できなくなる場合があります。
      </p>

      <h2>8. 安全管理措置</h2>
      <p>
        当社は、個人情報の漏洩、滅失または毀損の防止のため、組織的・人的・物理的・技術的な安全管理措置を講じます。
        個人情報の漏洩等の事案が発生した場合は、関係法令に従い、72時間以内に個人情報保護委員会へ報告し、必要に応じてご本人に通知します。
      </p>

      <h2>9. お問い合わせ</h2>
      <p>個人情報の取扱いに関するお問い合わせは {c.issuerEmail} までお願いします。</p>
    </article>
  );
}
