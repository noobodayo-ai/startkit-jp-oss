// Firestore ドキュメント形状の型定義

export type Plan = "free" | "starter" | "pro" | "pro_plus" | "team" | "team_plus";

export interface Tenant {
  id: string;
  name: string;
  owner_uid: string;
  plan: Plan;
  stripe_customer_id: string;
  /**
   * v1.9.0 以降の主たる購入ステータス (買い切り mode=payment)。
   * - "": 未購入
   * - "pending": 非同期決済 (bank transfer / コンビニ) を待機中。 完了するまで access を grant しない。
   * - "paid": 支払い完了。 access grant。
   * - "refunded": 返金済み。 access revoke (plan: free に巻き戻し)。
   */
  purchase_status: "" | "pending" | "paid" | "refunded";
  /** 買い切り購入の完了時刻 (ISO8601)。未購入なら空文字。 */
  purchased_at: string;
  /**
   * 将来のメンテナンスプラン (年額サブスク) 用に温存。
   * v1.9.0 時点では未使用 (買い切り全面移行)。 1 年後のメンテプラン追加時に再利用する。
   */
  stripe_subscription_id: string;
  stripe_subscription_status: "active" | "trialing" | "past_due" | "canceled" | "";
  // インボイス制度対応：顧客側の登録番号（任意）
  invoice_registration_number: string;
  invoice_company_name: string;
  // 適格請求書 PDF の受領者ブロックに表示する追加情報（全て任意）。
  // 設定があれば PDF に表示し、空文字なら描画スキップ。
  invoice_address?: string;
  invoice_email?: string;
  invoice_tel?: string;
  created_at: string;
  updated_at: string;
}

export type TenantMemberRole = "owner" | "admin" | "member";

export interface TenantMember {
  id: string;       // uid
  email: string;
  role: TenantMemberRole;
  joined_at: string;
}

export interface Invite {
  id: string;
  tenant_id: string;
  email: string;       // 招待先メール（空ならコード招待）
  code: string;        // 8文字英数の招待コード
  role: TenantMemberRole;
  invited_by_uid: string;
  expires_at: string;
  used_at: string;
  used_by_uid: string;
  created_at: string;
}

/**
 * 適格請求書 PDF の各明細行のスナップショット。
 * 請求書は税法上 immutable であるべきため、Stripe から受け取った時点で
 * Firestore に保存し、PDF 再生成時はこのスナップショットを使う。
 *
 * tax_amount は Stripe が計算した正確な税額（円）。proration / odd-yen の line でも
 * `amount_excluding_tax * tax_rate` の再計算では精度が落ちうるため必ず別途保存する。
 * tax_rate は表示用ラベル（PDF 上の「10%」表記）と税区分のグルーピングにのみ使う。
 */
export interface InvoiceLineSnapshot {
  description: string;
  amount_excluding_tax: number; // 税抜（負値もあり得る = proration credit）
  tax_rate: number; // 例: 0.10 = 10%
  tax_amount: number; // 税額（円、負値もあり得る）
  /**
   * Stripe Tax 未使用環境で `amount` を税込価格として inclusive 分割した推定値である
   * ことを示す監査用フラグ。 Stripe 提供の正確な税額 (Stripe Tax 有効時) と区別する。
   * 税務レビュー時にこのフラグで invoice ごとの計算方式が判別できる。
   */
  tax_inferred?: boolean;
}

/** 発行時点の発行者情報スナップショット（env 変更があっても過去の請求書は不変） */
export interface InvoiceIssuerSnapshot {
  name: string;
  registration_number: string; // T+13桁
  address: string;
  email: string;
  tel?: string;
}

/** 発行時点の受領者情報スナップショット（tenant 改名・削除があっても過去の請求書は不変） */
export interface InvoiceRecipientSnapshot {
  name: string;
  registration_number?: string;
  address?: string;
  email?: string;
  tel?: string;
}

export interface Invoice {
  id: string;
  tenant_id: string;
  invoice_number: string;       // "INV-2026-0001"
  stripe_invoice_id: string;
  amount_jpy: number;            // 税込
  tax_jpy: number;
  registration_number: string;  // T+13桁、発行者の番号（issuer.registration_number と同値、上位レベルにも保持）
  issued_at: string;

  /**
   * v1.5.12 以降、PDF オンザフライ生成のために発行時点のスナップショットを保存する。
   * 既存（v1.5.11 以前）レコードは undefined のままで、その場合は amount_jpy / tax_jpy /
   * 現在の tenant / env からのフォールバックで PDF を再構築する。
   */
  line_items?: InvoiceLineSnapshot[];
  issuer?: InvoiceIssuerSnapshot;
  recipient?: InvoiceRecipientSnapshot;

  /**
   * v1.10.0 以降、 発行時点のスナップショット (issuer + recipient + line_items + 金額) を
   * 正準シリアライズした上で SHA-256 を取った tamper-evidence hash。
   * 適格請求書 PDF 生成時に再計算して不一致なら 410 + 監査ログを記録する
   * (Admin SDK 経由で誰かが invoice を書換えていないかの検知)。
   * v1.9.x 以前のレコードは undefined のままで、 その場合は検証スキップ。
   */
  content_hash?: string;

  /** v1.10.0 以降、 発行時刻 (= Firestore への書込み時刻) を ISO8601 で保存。 監査連鎖用。 */
  created_at?: string;

  /** @deprecated v1.5.11 まで使用。Storage 廃止に伴い v1.5.12 で書き込み停止。 */
  pdf_path?: string;
  /** @deprecated v1.5.3 まで使用。署名付き URL → オンザフライ生成へ移行済み。 */
  pdf_url?: string;
}
