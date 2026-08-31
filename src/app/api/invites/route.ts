import { NextRequest, NextResponse } from "next/server";
import { requireUser } from "@/lib/session";
import { createInvite, acceptInvite, canManageMembers, INVITABLE_ROLES } from "@/lib/tenant";
import { check, rateLimitHeaders } from "@/lib/rate-limit";
import type { TenantMemberRole } from "@/types/firestore";

const INVITE_CREATE_LIMIT = { limit: 20, windowSec: 60 * 60 }; // 1時間あたり20件
const INVITE_ACCEPT_LIMIT = { limit: 10, windowSec: 60 * 10 }; // 10分あたり10回

export async function POST(req: NextRequest) {
  const user = await requireUser().catch(() => null);
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  if (!user.tenantId) return NextResponse.json({ error: "no_tenant" }, { status: 400 });
  // 招待の発行は owner/admin のみ。これが無いと member が role=owner の招待を作って
  // 自分で受諾し、テナントを乗っ取れる（/api/members/[uid] と同じ認可に揃える）。
  if (!canManageMembers(user.role))
    return NextResponse.json({ error: "forbidden" }, { status: 403 });

  const rl = await check(`invite:create:${user.tenantId}`, INVITE_CREATE_LIMIT);
  if (!rl.ok) {
    return NextResponse.json(
      { error: "rate_limited" },
      { status: 429, headers: rateLimitHeaders(rl, INVITE_CREATE_LIMIT.limit) },
    );
  }

  const body = (await req.json()) as {
    email?: string;
    role?: TenantMemberRole;
  };
  const role = body.role ?? "member";
  if (!INVITABLE_ROLES.includes(role))
    return NextResponse.json({ error: "invalid_role" }, { status: 400 });

  const invite = await createInvite({
    tenantId: user.tenantId,
    email: body.email,
    role,
    invitedByUid: user.uid,
  });
  return NextResponse.json(
    { code: invite.code, expiresAt: invite.expires_at },
    { headers: rateLimitHeaders(rl, INVITE_CREATE_LIMIT.limit) },
  );
}

export async function PUT(req: NextRequest) {
  // 招待コードを使ってテナント参加
  const user = await requireUser().catch(() => null);
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const rl = await check(`invite:accept:${user.uid}`, INVITE_ACCEPT_LIMIT);
  if (!rl.ok) {
    return NextResponse.json(
      { error: "rate_limited" },
      { status: 429, headers: rateLimitHeaders(rl, INVITE_ACCEPT_LIMIT.limit) },
    );
  }

  const { code } = (await req.json()) as { code?: string };
  if (!code) return NextResponse.json({ error: "code required" }, { status: 400 });
  try {
    const result = await acceptInvite({ code, uid: user.uid, email: user.email });
    return NextResponse.json(result);
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "failed" },
      { status: 400 },
    );
  }
}
