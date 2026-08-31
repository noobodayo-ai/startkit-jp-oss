/**
 * テナント関連のサーバーサイドユーティリティ。
 *
 * - Custom Claims (tenantId, role) を Firebase Auth ユーザーに付与
 * - 招待コード生成・受け入れ
 * - テナント新規作成（Owner登録）
 */

import { randomUUID } from "node:crypto";
import { FieldValue } from "firebase-admin/firestore";
import { adminAuth, adminDb } from "./firebase-admin";
import { recordAudit } from "./audit-log";
import type { Invite, Tenant, TenantMember, TenantMemberRole } from "@/types/firestore";

const TENANT_COLLECTION = "tenants";
const INVITES_COLLECTION = "invites";

/**
 * 招待で付与してよいロール。owner は招待経由で渡せない
 * （changeMemberRole の CANNOT_PROMOTE_TO_OWNER と同じ制約を招待経路にも適用する）。
 */
export const INVITABLE_ROLES: readonly TenantMemberRole[] = ["member", "admin"];

function randCode(len = 8): string {
  // 英大文字 + 数字、混同しやすい O/0/I/1 を除外
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let s = "";
  for (let i = 0; i < len; i++) {
    s += alphabet[Math.floor(Math.random() * alphabet.length)];
  }
  return s;
}

/**
 * 新規テナントを作成し、作成者をOwnerとして登録、Custom Claimsを更新。
 */
export async function createTenant(args: {
  ownerUid: string;
  ownerEmail: string;
  name: string;
}): Promise<string> {
  const db = adminDb();
  const tenantId = randomUUID();
  const now = new Date().toISOString();

  const tenant: Tenant = {
    id: tenantId,
    name: args.name,
    owner_uid: args.ownerUid,
    plan: "free",
    stripe_customer_id: "",
    purchase_status: "",
    purchased_at: "",
    stripe_subscription_id: "",
    stripe_subscription_status: "",
    invoice_registration_number: "",
    invoice_company_name: "",
    created_at: now,
    updated_at: now,
  };
  await db.collection(TENANT_COLLECTION).doc(tenantId).set(tenant);

  const member: TenantMember = {
    id: args.ownerUid,
    email: args.ownerEmail,
    role: "owner",
    joined_at: now,
  };
  await db
    .collection(TENANT_COLLECTION)
    .doc(tenantId)
    .collection("members")
    .doc(args.ownerUid)
    .set(member);

  await adminAuth().setCustomUserClaims(args.ownerUid, {
    tenantId,
    role: "owner" satisfies TenantMemberRole,
  });

  await recordAudit(tenantId, {
    action: "tenant.create",
    actor_uid: args.ownerUid,
    actor_email: args.ownerEmail,
    metadata: { name: args.name },
  });

  return tenantId;
}

/**
 * 招待を作成する。指定メール宛にコードを発行（メール送信は呼び出し側）。
 */
export async function createInvite(args: {
  tenantId: string;
  email?: string;
  role: TenantMemberRole;
  invitedByUid: string;
  ttlDays?: number;
}): Promise<Invite> {
  if (!INVITABLE_ROLES.includes(args.role)) throw new Error("INVALID_INVITE_ROLE");

  const db = adminDb();
  const ttl = args.ttlDays ?? 7;
  const now = new Date();
  const expires = new Date(now.getTime() + ttl * 86400 * 1000);
  const id = randomUUID();
  const invite: Invite = {
    id,
    tenant_id: args.tenantId,
    email: args.email ?? "",
    code: randCode(8),
    role: args.role,
    invited_by_uid: args.invitedByUid,
    expires_at: expires.toISOString(),
    used_at: "",
    used_by_uid: "",
    created_at: now.toISOString(),
  };
  await db.collection(INVITES_COLLECTION).doc(id).set(invite);

  await recordAudit(args.tenantId, {
    action: "invite.create",
    actor_uid: args.invitedByUid,
    target_email: args.email,
    metadata: { role: args.role, code: invite.code, expires_at: invite.expires_at },
  });

  return invite;
}

/**
 * 招待コードを使ってユーザーをテナントに参加させる。
 * 成功時に Custom Claims を更新する。
 */
export async function acceptInvite(args: {
  code: string;
  uid: string;
  email: string;
}): Promise<{ tenantId: string; role: TenantMemberRole }> {
  const db = adminDb();
  const snap = await db
    .collection(INVITES_COLLECTION)
    .where("code", "==", args.code)
    .limit(1)
    .get();
  if (snap.empty) throw new Error("INVITE_NOT_FOUND");

  const doc = snap.docs[0];
  const invite = doc.data() as Invite;
  if (invite.used_at) throw new Error("INVITE_USED");
  if (new Date(invite.expires_at).getTime() < Date.now()) throw new Error("INVITE_EXPIRED");
  if (invite.email && invite.email.toLowerCase() !== args.email.toLowerCase()) {
    throw new Error("INVITE_EMAIL_MISMATCH");
  }

  const member: TenantMember = {
    id: args.uid,
    email: args.email,
    role: invite.role,
    joined_at: new Date().toISOString(),
  };
  await db
    .collection(TENANT_COLLECTION)
    .doc(invite.tenant_id)
    .collection("members")
    .doc(args.uid)
    .set(member);

  await doc.ref.update({
    used_at: FieldValue.serverTimestamp(),
    used_by_uid: args.uid,
  });

  await adminAuth().setCustomUserClaims(args.uid, {
    tenantId: invite.tenant_id,
    role: invite.role,
  });

  await recordAudit(invite.tenant_id, {
    action: "invite.accept",
    actor_uid: args.uid,
    actor_email: args.email,
    metadata: { role: invite.role, invite_id: invite.id },
  });

  return { tenantId: invite.tenant_id, role: invite.role };
}

/**
 * テナント内のメンバー一覧を取得（管理画面用）。
 */
export async function listMembers(tenantId: string): Promise<TenantMember[]> {
  const db = adminDb();
  const snap = await db
    .collection(TENANT_COLLECTION)
    .doc(tenantId)
    .collection("members")
    .get();
  return snap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<TenantMember, "id">) }));
}

/**
 * メンバーを削除する。Owner は削除不可。
 * Custom Claims からも tenant 情報を削除し、招待されるまで参加できない状態にする。
 */
export async function removeMember(args: {
  tenantId: string;
  targetUid: string;
  actorUid: string;
  actorEmail: string;
}): Promise<void> {
  const db = adminDb();
  const tenantSnap = await db.collection(TENANT_COLLECTION).doc(args.tenantId).get();
  if (!tenantSnap.exists) throw new Error("TENANT_NOT_FOUND");
  const tenant = tenantSnap.data() as Tenant;
  if (tenant.owner_uid === args.targetUid) throw new Error("CANNOT_REMOVE_OWNER");

  const memberRef = db
    .collection(TENANT_COLLECTION)
    .doc(args.tenantId)
    .collection("members")
    .doc(args.targetUid);
  const memberSnap = await memberRef.get();
  if (!memberSnap.exists) throw new Error("MEMBER_NOT_FOUND");
  const target = memberSnap.data() as TenantMember;

  await memberRef.delete();
  // Custom Claims をクリア（同テナントへの再アクセス防止）
  await adminAuth().setCustomUserClaims(args.targetUid, { tenantId: "", role: "" });
  // Custom Claims の更新だけでは発行済みセッション Cookie（最大14日）が失効しない。
  // revoke しないと除名後もアクセスが継続する。session.ts の verifySessionCookie(_, true) と対で機能する。
  await adminAuth().revokeRefreshTokens(args.targetUid);

  await recordAudit(args.tenantId, {
    action: "member.remove",
    actor_uid: args.actorUid,
    actor_email: args.actorEmail,
    target_uid: args.targetUid,
    target_email: target.email,
    metadata: { previous_role: target.role },
  });
}

/**
 * メンバーの role を変更する。Owner の role 変更は不可。
 */
export async function changeMemberRole(args: {
  tenantId: string;
  targetUid: string;
  newRole: TenantMemberRole;
  actorUid: string;
  actorEmail: string;
}): Promise<void> {
  const db = adminDb();
  if (args.newRole === "owner") throw new Error("CANNOT_PROMOTE_TO_OWNER");

  const tenantSnap = await db.collection(TENANT_COLLECTION).doc(args.tenantId).get();
  if (!tenantSnap.exists) throw new Error("TENANT_NOT_FOUND");
  const tenant = tenantSnap.data() as Tenant;
  if (tenant.owner_uid === args.targetUid) throw new Error("CANNOT_CHANGE_OWNER");

  const memberRef = db
    .collection(TENANT_COLLECTION)
    .doc(args.tenantId)
    .collection("members")
    .doc(args.targetUid);
  const memberSnap = await memberRef.get();
  if (!memberSnap.exists) throw new Error("MEMBER_NOT_FOUND");
  const target = memberSnap.data() as TenantMember;
  if (target.role === args.newRole) return;

  await memberRef.update({ role: args.newRole });
  await adminAuth().setCustomUserClaims(args.targetUid, {
    tenantId: args.tenantId,
    role: args.newRole,
  });
  // 降格が即時に効くよう既存セッションを失効させる（旧 role を焼き込んだ Cookie の無効化）。
  await adminAuth().revokeRefreshTokens(args.targetUid);

  await recordAudit(args.tenantId, {
    action: "member.role_change",
    actor_uid: args.actorUid,
    actor_email: args.actorEmail,
    target_uid: args.targetUid,
    target_email: target.email,
    metadata: { from: target.role, to: args.newRole },
  });
}

export function canManageMembers(role: TenantMemberRole | ""): boolean {
  return role === "owner" || role === "admin";
}
