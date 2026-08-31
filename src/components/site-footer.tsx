import Link from "next/link";
import { getLegalConfig } from "@/lib/legal-config";

export function SiteFooter() {
  const year = new Date().getFullYear();
  // 決済事業者の審査では「サイト上の事業者名が申請したビジネス名と一致すること」を
  // 見られる。法務ページだけでなくフッターにも出しておく。
  const { issuerName } = getLegalConfig();
  return (
    <footer className="border-t border-zinc-200 dark:border-zinc-800 bg-zinc-100/50 dark:bg-zinc-900/50">
      <div className="max-w-6xl mx-auto px-6 py-8 grid gap-6 md:grid-cols-3 text-sm">
        <div>
          <p className="font-semibold mb-2">{process.env.NEXT_PUBLIC_APP_NAME ?? "StartKit JP"}</p>
          <p className="text-zinc-600 dark:text-zinc-400">
            日本市場向けSaaSボイラープレート。
          </p>
          <p className="text-zinc-500 text-xs mt-2">運営：{issuerName}</p>
        </div>
        <div className="grid grid-cols-2 gap-2">
          <Link href="/legal/terms" className="text-zinc-600 dark:text-zinc-400 hover:underline">利用規約</Link>
          <Link href="/legal/privacy" className="text-zinc-600 dark:text-zinc-400 hover:underline">プライバシーポリシー</Link>
          <Link href="/legal/tokushoho" className="text-zinc-600 dark:text-zinc-400 hover:underline">特定商取引法表記</Link>
          <Link href="/faq" className="text-zinc-600 dark:text-zinc-400 hover:underline">FAQ</Link>
        </div>
        <div className="text-zinc-500 text-xs md:text-right">
          © {year} All rights reserved.
        </div>
      </div>
    </footer>
  );
}
