import { adminDb } from "@/lib/firebase-admin";
import { requireUser } from "@/lib/session";
import type { Tenant } from "@/types/firestore";

export default async function DashboardHome() {
  const user = await requireUser();
  const snap = await adminDb().collection("tenants").doc(user.tenantId).get();
  const tenant = snap.exists ? (snap.data() as Tenant) : null;

  return (
    <div>
      <h1 className="text-2xl font-bold mb-2">ダッシュボード</h1>
      <p className="text-zinc-500 mb-8">ようこそ、{user.email} さん</p>

      <section className="grid md:grid-cols-3 gap-4 mb-10">
        <Card label="ワークスペース">{tenant?.name ?? "-"}</Card>
        <Card label="プラン">{tenant?.plan ?? "free"}</Card>
        <Card label="ロール">{user.isAdmin ? "Admin (運営者)" : "Owner / Member"}</Card>
      </section>

      <section className="bg-white dark:bg-zinc-900 rounded-xl border border-zinc-200 dark:border-zinc-800 p-6">
        <h2 className="font-semibold mb-2">はじめに</h2>
        <ol className="space-y-1 text-sm text-zinc-600 dark:text-zinc-400 list-decimal pl-5">
          <li>メンバーを招待する → メンバー画面から招待コード生成</li>
          <li>プランをアップグレードする → 請求画面で Stripe Checkout</li>
          <li>自分のアプリ機能を追加する → /dashboard/* に追加</li>
        </ol>
      </section>
    </div>
  );
}

function Card({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="bg-white dark:bg-zinc-900 rounded-xl border border-zinc-200 dark:border-zinc-800 p-5">
      <div className="text-xs text-zinc-500 uppercase tracking-wider mb-1">{label}</div>
      <div className="text-lg font-medium">{children}</div>
    </div>
  );
}
