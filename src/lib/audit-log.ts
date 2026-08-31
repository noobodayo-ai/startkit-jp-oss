/**
 * 監査ログ：テナントごとの管理操作を tenants/{tid}/audit_logs に記録。
 *
 * Team プランの実体的な差別化として、admin の重要操作（招待発行・メンバー削除・
 * プラン変更・請求書発行など）を時系列で残せるようにする。
 *
 * 失敗時にも本処理を巻き込まないよう、catch して captureError に流す。
 */

import { adminDb } from "./firebase-admin";
import { captureError } from "./observability";

export type AuditAction =
  | "tenant.create"
  | "tenant.update"
  | "tenant.invoice_settings.update"
  | "invite.create"
  | "invite.accept"
  | "member.remove"
  | "member.role_change"
  | "plan.change"
  | "invoice.issue"
  | "invoice.tamper_detected"
  | "stripe.checkout_completed"
  | "stripe.subscription_canceled"
  | "stripe.charge_refunded";

export interface AuditLogEntry {
  action: AuditAction;
  actor_uid: string;
  actor_email?: string;
  target_uid?: string;
  target_email?: string;
  metadata?: Record<string, unknown>;
  ip?: string;
}

export async function recordAudit(tenantId: string, entry: AuditLogEntry): Promise<void> {
  try {
    await adminDb()
      .collection("tenants")
      .doc(tenantId)
      .collection("audit_logs")
      .add({
        ...entry,
        created_at: new Date().toISOString(),
      });
  } catch (e) {
    // 監査の失敗で業務処理を止めない
    await captureError(e, {
      tags: { module: "audit-log", tenant_id: tenantId, action: entry.action },
    });
  }
}

export async function listAuditLogs(
  tenantId: string,
  limit = 50,
): Promise<(AuditLogEntry & { id: string; created_at: string })[]> {
  const snap = await adminDb()
    .collection("tenants")
    .doc(tenantId)
    .collection("audit_logs")
    .orderBy("created_at", "desc")
    .limit(limit)
    .get();
  return snap.docs.map((d) => ({
    id: d.id,
    ...(d.data() as AuditLogEntry & { created_at: string }),
  }));
}
