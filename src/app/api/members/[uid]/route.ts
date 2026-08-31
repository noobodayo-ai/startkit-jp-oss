import { NextRequest, NextResponse } from "next/server";
import { requireUser } from "@/lib/session";
import { canManageMembers, changeMemberRole, removeMember } from "@/lib/tenant";
import { captureError } from "@/lib/observability";
import type { TenantMemberRole } from "@/types/firestore";

type Params = { params: Promise<{ uid: string }> };

export async function DELETE(_req: NextRequest, { params }: Params) {
  try {
    const user = await requireUser();
    if (!user.tenantId) return NextResponse.json({ error: "no_tenant" }, { status: 400 });
    if (!canManageMembers(user.role))
      return NextResponse.json({ error: "forbidden" }, { status: 403 });
    if (user.uid === (await params).uid)
      return NextResponse.json({ error: "cannot_remove_self" }, { status: 400 });

    const { uid: targetUid } = await params;
    await removeMember({
      tenantId: user.tenantId,
      targetUid,
      actorUid: user.uid,
      actorEmail: user.email,
    });
    return NextResponse.json({ ok: true });
  } catch (e) {
    await captureError(e, { tags: { route: "DELETE /api/members/[uid]" } });
    const msg = e instanceof Error ? e.message : "failed";
    const status = msg === "CANNOT_REMOVE_OWNER" || msg === "MEMBER_NOT_FOUND" ? 400 : 500;
    return NextResponse.json({ error: msg }, { status });
  }
}

const ALLOWED_ROLES: TenantMemberRole[] = ["admin", "member"];

export async function PATCH(req: NextRequest, { params }: Params) {
  try {
    const user = await requireUser();
    if (!user.tenantId) return NextResponse.json({ error: "no_tenant" }, { status: 400 });
    if (!canManageMembers(user.role))
      return NextResponse.json({ error: "forbidden" }, { status: 403 });

    const body = (await req.json()) as { role?: string };
    if (!body.role || !ALLOWED_ROLES.includes(body.role as TenantMemberRole)) {
      return NextResponse.json({ error: "invalid_role" }, { status: 400 });
    }

    const { uid: targetUid } = await params;
    if (user.uid === targetUid)
      return NextResponse.json({ error: "cannot_change_self" }, { status: 400 });

    await changeMemberRole({
      tenantId: user.tenantId,
      targetUid,
      newRole: body.role as TenantMemberRole,
      actorUid: user.uid,
      actorEmail: user.email,
    });
    return NextResponse.json({ ok: true });
  } catch (e) {
    await captureError(e, { tags: { route: "PATCH /api/members/[uid]" } });
    const msg = e instanceof Error ? e.message : "failed";
    const status = ["CANNOT_CHANGE_OWNER", "CANNOT_PROMOTE_TO_OWNER", "MEMBER_NOT_FOUND"].includes(msg)
      ? 400
      : 500;
    return NextResponse.json({ error: msg }, { status });
  }
}
