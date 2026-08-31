import { NextRequest, NextResponse } from "next/server";
import { getSessionUser } from "@/lib/session";
import { createTenant } from "@/lib/tenant";
import {
  validateInvoiceSettings,
  updateTenantInvoiceSettings,
  TenantInvoiceUpdateError,
} from "@/lib/tenant-invoice-settings";

export async function POST(req: NextRequest) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  if (user.tenantId) {
    return NextResponse.json({ error: "already_in_tenant" }, { status: 409 });
  }
  const body = (await req.json().catch(() => ({}))) as { name?: string };
  const name = (body.name || "My Workspace").slice(0, 60);
  const tenantId = await createTenant({
    ownerUid: user.uid,
    ownerEmail: user.email,
    name,
  });
  return NextResponse.json({ tenantId });
}

/**
 * 自テナントの invoice 関連設定を更新する。
 * - 認証必須 + テナント所属
 * - owner / admin ロールのみ許可（member は権限不足）
 * - 検証失敗時は 400 とエラー詳細を返す
 */
export async function PATCH(req: NextRequest) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  if (!user.tenantId) {
    return NextResponse.json({ error: "no_tenant" }, { status: 400 });
  }
  if (user.role !== "owner" && user.role !== "admin") {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }

  const body = await req.json().catch(() => null);
  const { errors, updates } = validateInvoiceSettings(body);
  if (!updates) {
    return NextResponse.json({ error: "validation_failed", errors }, { status: 400 });
  }
  try {
    await updateTenantInvoiceSettings({
      tenantId: user.tenantId,
      actorUid: user.uid,
      actorEmail: user.email,
      updates,
    });
  } catch (err) {
    if (err instanceof TenantInvoiceUpdateError) {
      // canonical role 再確認で降格を検知。 Custom Claims (session cookie 14日有効) が
      // 古くなっていても確実に拒否する。
      if (err.code === "FORBIDDEN_STALE_ROLE") {
        return NextResponse.json({ error: "forbidden" }, { status: 403 });
      }
      if (err.code === "TENANT_NOT_FOUND") {
        return NextResponse.json({ error: "tenant_not_found" }, { status: 404 });
      }
    }
    throw err;
  }
  return NextResponse.json({ ok: true });
}
