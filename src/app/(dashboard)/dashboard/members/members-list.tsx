"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import type { TenantMember, TenantMemberRole } from "@/types/firestore";

interface Props {
  members: TenantMember[];
  ownerUid: string;
  currentUid: string;
  canManage: boolean;
}

const ROLES: TenantMemberRole[] = ["admin", "member"];

export function MembersList({ members, ownerUid, currentUid, canManage }: Props) {
  const router = useRouter();
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [, startTransition] = useTransition();

  async function handleRoleChange(uid: string, newRole: TenantMemberRole) {
    setBusy(uid);
    setError(null);
    try {
      const res = await fetch(`/api/members/${uid}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ role: newRole }),
      });
      if (!res.ok) {
        const j = (await res.json().catch(() => ({}))) as { error?: string };
        throw new Error(j.error ?? "role change failed");
      }
      startTransition(() => router.refresh());
    } catch (e) {
      setError(e instanceof Error ? e.message : "Unknown error");
    } finally {
      setBusy(null);
    }
  }

  async function handleRemove(uid: string, email: string) {
    if (!confirm(`${email} をテナントから削除しますか？`)) return;
    setBusy(uid);
    setError(null);
    try {
      const res = await fetch(`/api/members/${uid}`, { method: "DELETE" });
      if (!res.ok) {
        const j = (await res.json().catch(() => ({}))) as { error?: string };
        throw new Error(j.error ?? "remove failed");
      }
      startTransition(() => router.refresh());
    } catch (e) {
      setError(e instanceof Error ? e.message : "Unknown error");
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className="bg-white dark:bg-zinc-900 rounded-xl border border-zinc-200 dark:border-zinc-800 overflow-hidden">
      {members.map((m) => {
        const isOwner = m.id === ownerUid;
        const isSelf = m.id === currentUid;
        const disabled = busy === m.id;
        return (
          <div
            key={m.id}
            className="flex items-center justify-between px-5 py-3 border-b border-zinc-200 dark:border-zinc-800 last:border-b-0 gap-3"
          >
            <div className="min-w-0 flex-1">
              <div className="text-sm truncate">{m.email}</div>
              <div className="text-xs text-zinc-500">{m.joined_at?.slice(0, 10)}</div>
            </div>
            {isOwner ? (
              <span className="text-xs px-2 py-1 rounded-full bg-amber-100 text-amber-800 dark:bg-amber-900 dark:text-amber-200">
                owner
              </span>
            ) : canManage && !isSelf ? (
              <>
                <select
                  value={m.role}
                  onChange={(e) => handleRoleChange(m.id, e.target.value as TenantMemberRole)}
                  disabled={disabled}
                  className="text-xs px-2 py-1 rounded-md border border-zinc-300 dark:border-zinc-700 dark:bg-zinc-800 disabled:opacity-50"
                >
                  {ROLES.map((r) => (
                    <option key={r} value={r}>
                      {r}
                    </option>
                  ))}
                </select>
                <button
                  onClick={() => handleRemove(m.id, m.email)}
                  disabled={disabled}
                  className="text-xs px-2 py-1 rounded-md text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-950 disabled:opacity-50"
                >
                  削除
                </button>
              </>
            ) : (
              <span className="text-xs px-2 py-1 rounded-full bg-zinc-100 dark:bg-zinc-800">{m.role}</span>
            )}
          </div>
        );
      })}
      {error && <p className="px-5 py-3 text-sm text-red-600 dark:text-red-400">{error}</p>}
    </div>
  );
}
