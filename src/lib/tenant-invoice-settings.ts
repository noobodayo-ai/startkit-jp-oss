/**
 * テナントの請求書(invoice)関連設定の更新ユーティリティ。
 *
 * 適格請求書の受領者ブロックに表示される項目：
 *   - invoice_company_name: 正式社名（発行先の名称、 ワークスペース表示名と独立）
 *   - invoice_registration_number: 適格請求書発行事業者 登録番号（T+13桁）
 *   - invoice_address / invoice_email / invoice_tel: 住所・連絡先（任意）
 *
 * バリデーション方針：
 *   - サーバ側で厳密にチェックして Firestore に書き込む
 *   - 空文字は「未設定」 として保存し、 PDF 上は描画スキップされる
 *   - registration_number は T + 13 数字（インボイス制度の仕様）
 *   - 文字列長は XSS 防御と Firestore コスト抑制のため上限を設ける
 */

import { adminDb } from "./firebase-admin";
import { recordAudit } from "./audit-log";
import type { Tenant } from "@/types/firestore";

/** 編集可能な invoice 関連フィールドだけ抽出した型 */
export interface InvoiceSettingsInput {
  invoice_company_name?: string;
  invoice_registration_number?: string;
  invoice_address?: string;
  invoice_email?: string;
  invoice_tel?: string;
}

export type InvoiceSettings = Required<InvoiceSettingsInput>;

const MAX_NAME = 80;
const MAX_ADDRESS = 200;
const MAX_EMAIL = 200;
const MAX_TEL = 40;

const TRN_RE = /^T\d{13}$/;
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const TEL_RE = /^[0-9+\-() ]{8,40}$/;

export interface ValidationError {
  field: keyof InvoiceSettingsInput;
  message: string;
}

/**
 * 入力値を検証し、 サニタイズした正規化済みオブジェクトとエラー一覧を返す。
 * エラーが 1 件でもあれば updates は undefined。
 */
export function validateInvoiceSettings(input: unknown): {
  errors: ValidationError[];
  updates?: InvoiceSettings;
} {
  const errors: ValidationError[] = [];
  if (!input || typeof input !== "object") {
    return { errors: [{ field: "invoice_company_name", message: "invalid payload" }] };
  }
  const raw = input as Record<string, unknown>;
  const str = (k: keyof InvoiceSettingsInput, max: number): string => {
    const v = raw[k];
    if (v === undefined || v === null) return "";
    if (typeof v !== "string") {
      errors.push({ field: k, message: "文字列で入力してください" });
      return "";
    }
    const trimmed = v.trim();
    if (trimmed.length > max) {
      errors.push({ field: k, message: `${max}文字以内で入力してください` });
      return trimmed.slice(0, max);
    }
    return trimmed;
  };

  const company = str("invoice_company_name", MAX_NAME);
  const trn = str("invoice_registration_number", 14);
  const address = str("invoice_address", MAX_ADDRESS);
  const email = str("invoice_email", MAX_EMAIL);
  const tel = str("invoice_tel", MAX_TEL);

  if (trn && !TRN_RE.test(trn)) {
    errors.push({
      field: "invoice_registration_number",
      message: "登録番号は T + 13桁の数字 で入力してください（例: T1234567890123）",
    });
  }
  if (email && !EMAIL_RE.test(email)) {
    errors.push({
      field: "invoice_email",
      message: "メールアドレスの形式が正しくありません",
    });
  }
  if (tel && !TEL_RE.test(tel)) {
    errors.push({
      field: "invoice_tel",
      message: "電話番号は数字・ハイフン・+・括弧・空白のみ 8〜40 文字で入力してください",
    });
  }

  if (errors.length > 0) return { errors };
  return {
    errors,
    updates: {
      invoice_company_name: company,
      invoice_registration_number: trn,
      invoice_address: address,
      invoice_email: email,
      invoice_tel: tel,
    },
  };
}

/** updateTenantInvoiceSettings のエラー種別 */
export type UpdateInvoiceSettingsError =
  | "TENANT_NOT_FOUND"
  | "FORBIDDEN_STALE_ROLE";

export class TenantInvoiceUpdateError extends Error {
  constructor(public code: UpdateInvoiceSettingsError) {
    super(code);
    this.name = "TenantInvoiceUpdateError";
  }
}

/**
 * Tenant ドキュメントの invoice 関連フィールドを更新する。
 *
 * セキュリティ:
 *   1. テナントドキュメントの存在を確認 (無ければ TENANT_NOT_FOUND)
 *      → merge:true での「不完全な Tenant ドキュメント自動生成」を防ぐ
 *   2. tenants/{tenantId}/members/{actorUid} を Firestore から再読みして
 *      canonical な role が owner/admin のいずれかであることを確認
 *      → Custom Claims (session cookie 14 日有効) が古く、 実際には降格済みの
 *      ユーザーが書き込めてしまう問題を防ぐ
 *   3. update() で部分更新 (set merge ではなく)
 */
export async function updateTenantInvoiceSettings(args: {
  tenantId: string;
  actorUid: string;
  actorEmail: string;
  updates: InvoiceSettings;
}): Promise<void> {
  const db = adminDb();
  const tenantRef = db.collection("tenants").doc(args.tenantId);
  const memberRef = tenantRef.collection("members").doc(args.actorUid);

  const [tenantSnap, memberSnap] = await Promise.all([tenantRef.get(), memberRef.get()]);
  if (!tenantSnap.exists) {
    throw new TenantInvoiceUpdateError("TENANT_NOT_FOUND");
  }
  const canonicalRole = memberSnap.exists
    ? (memberSnap.data() as { role?: string }).role
    : undefined;
  if (canonicalRole !== "owner" && canonicalRole !== "admin") {
    throw new TenantInvoiceUpdateError("FORBIDDEN_STALE_ROLE");
  }

  await tenantRef.update({
    ...args.updates,
    updated_at: new Date().toISOString(),
  });
  await recordAudit(args.tenantId, {
    action: "tenant.invoice_settings.update",
    actor_uid: args.actorUid,
    actor_email: args.actorEmail,
    metadata: {
      // 機密度低い項目のみ audit log に残す。 住所・メール・TEL は記録しない (個人情報配慮)。
      has_registration_number: args.updates.invoice_registration_number !== "",
      has_company_name: args.updates.invoice_company_name !== "",
    },
  });
}

/**
 * Tenant から invoice 設定だけ抽出して返す。フォーム初期値用。
 */
export function extractInvoiceSettings(tenant: Tenant | null): InvoiceSettings {
  return {
    invoice_company_name: tenant?.invoice_company_name ?? "",
    invoice_registration_number: tenant?.invoice_registration_number ?? "",
    invoice_address: tenant?.invoice_address ?? "",
    invoice_email: tenant?.invoice_email ?? "",
    invoice_tel: tenant?.invoice_tel ?? "",
  };
}
