/**
 * 法令テンプレートに差し込む事業者情報。
 * .env から取得し、テンプレート側で安全に展開する。
 */

/**
 * 特商法11条ただし書き・省令10条により、販売業者の氏名・住所・電話番号
 * （省令8条1号）は「請求があれば遅滞なく提供する旨」を広告に表示し、かつ
 * 実際に遅滞なく提供できる措置を講じていれば省略できる。
 * env 未設定時のフォールバックはこの省略パターンを採る。
 */
const ON_REQUEST = "請求があれば遅滞なく開示します";

// 各項目のフォールバックは ?? ではなく || を使う。
// 販売サイトのビルドでは .env.production.local から .env.local の値を
// 打ち消す必要があり、その手段が「空文字を設定する」しかないため
// （コメントアウトでは .env.local 側の値がそのまま残る）。

/** env 未設定時に埋まるダミーの登録番号。これが出ている＝まだ登録していない。 */
const UNREGISTERED = "T0000000000000";

export interface LegalConfig {
  appName: string;
  appUrl: string;
  issuerName: string;
  /**
   * 運営責任者の氏名。屋号は特商法11条の「氏名（名称）」を満たさないため、
   * issuerName に屋号を入れる場合はこちらに氏名を持たせるか、
   * 省略パターン（請求時開示）を採る必要がある。
   */
  operatorName: string;
  issuerAddress: string;
  issuerPhone: string;
  issuerEmail: string;
  registrationNumber: string;
  /**
   * 適格請求書発行事業者として登録済みか。
   * false のときに「当社は適格請求書発行事業者です」と表示したり、
   * ダミーの T 番号を掲載したりすると、消費税法57条の5が禁じる
   * 適格請求書類似書類等の交付にあたるおそれがあるため、表示側で必ず分岐する。
   */
  isInvoiceRegistered: boolean;
  lastUpdated: string;
}

export function getLegalConfig(): LegalConfig {
  return {
    appName: process.env.NEXT_PUBLIC_APP_NAME || "本サービス",
    appUrl: process.env.NEXT_PUBLIC_APP_URL || "https://example.com",
    issuerName: process.env.INVOICE_ISSUER_NAME || ON_REQUEST,
    operatorName: process.env.INVOICE_ISSUER_OPERATOR || ON_REQUEST,
    issuerAddress: process.env.INVOICE_ISSUER_ADDRESS || ON_REQUEST,
    issuerPhone: process.env.INVOICE_ISSUER_TEL || ON_REQUEST,
    issuerEmail: process.env.INVOICE_ISSUER_EMAIL || "support@example.com",
    registrationNumber:
      process.env.INVOICE_ISSUER_REGISTRATION_NUMBER || UNREGISTERED,
    isInvoiceRegistered: Boolean(
      process.env.INVOICE_ISSUER_REGISTRATION_NUMBER &&
        process.env.INVOICE_ISSUER_REGISTRATION_NUMBER !== UNREGISTERED,
    ),
    lastUpdated: "2026-08-05",
  };
}
