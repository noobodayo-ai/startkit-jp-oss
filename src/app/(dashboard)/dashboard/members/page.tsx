import { requireUser } from "@/lib/session";
import { canManageMembers, listMembers } from "@/lib/tenant";
import { adminDb } from "@/lib/firebase-admin";
import { InviteForm } from "./invite-form";
import { MembersList } from "./members-list";
import type { Tenant } from "@/types/firestore";

export default async function MembersPage() {
  const user = await requireUser();
  const members = await listMembers(user.tenantId);
  const tenantSnap = await adminDb().collection("tenants").doc(user.tenantId).get();
  const tenant = tenantSnap.exists ? (tenantSnap.data() as Tenant) : null;
  const ownerUid = tenant?.owner_uid ?? "";
  const canManage = canManageMembers(user.role);

  return (
    <div>
      <h1 className="text-2xl font-bold mb-6">メンバー</h1>

      {canManage && <InviteForm />}

      <section className="mt-10">
        <h2 className="font-semibold mb-3">参加中のメンバー（{members.length}）</h2>
        <MembersList
          members={members}
          ownerUid={ownerUid}
          currentUid={user.uid}
          canManage={canManage}
        />
        {!canManage && (
          <p className="mt-3 text-xs text-zinc-500">
            メンバーの追加・削除・ロール変更は Owner / Admin のみ可能です。
          </p>
        )}
      </section>
    </div>
  );
}
