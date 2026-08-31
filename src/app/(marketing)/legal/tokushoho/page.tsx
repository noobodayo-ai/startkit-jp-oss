import { getLegalConfig } from "@/lib/legal-config";

export const metadata = { title: "特定商取引法に基づく表記" };

export default function TokushohoPage() {
  const c = getLegalConfig();
  return (
    <article className="max-w-3xl mx-auto px-6 py-16 prose prose-zinc dark:prose-invert">
      <h1>特定商取引法に基づく表記</h1>
      <p className="text-sm text-zinc-500">最終更新日：{c.lastUpdated}</p>

      <table>
        <tbody>
          <tr>
            <th>販売事業者</th>
            <td>{c.issuerName}</td>
          </tr>
          <tr>
            <th>運営責任者</th>
            <td>{c.operatorName}</td>
          </tr>
          <tr>
            <th>所在地</th>
            <td>{c.issuerAddress}</td>
          </tr>
          <tr>
            <th>電話番号</th>
            <td>{c.issuerPhone}</td>
          </tr>
          <tr>
            <th>連絡先</th>
            <td>{c.issuerEmail}（メールにて受付）</td>
          </tr>
          {c.isInvoiceRegistered && (
            <tr>
              <th>適格請求書発行事業者登録番号</th>
              <td><code>{c.registrationNumber}</code></td>
            </tr>
          )}
          <tr>
            <th>販売価格</th>
            <td>各プランの料金ページに表示の価格（税込）</td>
          </tr>
          <tr>
            <th>商品代金以外の必要料金</th>
            <td>消費税は表示価格に含まれます。決済手数料は当社が負担します。</td>
          </tr>
          <tr>
            <th>支払方法</th>
            <td>クレジットカード決済（Stripe）：Visa、Mastercard、JCB、American Express、Diners Club</td>
          </tr>
          <tr>
            <th>支払時期</th>
            <td>
              買い切りプラン（Pro／Team）：契約成立時に一括課金。<br />
              任意のメンテナンスプラン（年額）：契約成立日から年次自動更新。
            </td>
          </tr>
          <tr>
            <th>役務（サービス）の提供時期</th>
            <td>決済完了後、即時アクセス可能</td>
          </tr>
          <tr>
            <th>返品・キャンセル</th>
            <td>
              リポジトリへの招待を承諾する前であれば、ご購入から 14 日以内は理由を問わず全額返金します。招待を承諾した時点で引き渡し完了となり、それ以降の返金はお受けできません。<br />
              メンテナンスプランはいつでも解約可能で、解約後の課金は発生しません。
              ただし既に支払い済みの料金は返金対象外です。
            </td>
          </tr>
          <tr>
            <th>動作環境</th>
            <td>
              最新の Google Chrome / Safari / Firefox / Edge を推奨。
              スマートフォン端末でもご利用いただけますが、一部機能は PC を推奨します。
            </td>
          </tr>
        </tbody>
      </table>

      <p>
        <strong>表示事項の請求について</strong>：上記のうち「請求があれば遅滞なく開示します」と記載した
        事項（運営責任者の氏名・所在地・電話番号）は、
        <a href={`mailto:${c.issuerEmail}`}>{c.issuerEmail}</a> 宛にご請求いただければ、
        お申込みのご判断に先立って十分な時間的余裕をもって、書面または電磁的記録により遅滞なく提供いたします。
      </p>

      <p>
        本サービス利用にあたっては、<a href="/legal/terms">利用規約</a> および
        <a href="/legal/privacy"> プライバシーポリシー</a> も併せてご確認ください。
      </p>
    </article>
  );
}
