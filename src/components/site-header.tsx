import Link from "next/link";
import { getSessionUser } from "@/lib/session";

export async function SiteHeader() {
  const marketingOnly = process.env.MARKETING_ONLY === "1";
  const user = marketingOnly ? null : await getSessionUser();
  const appName = process.env.NEXT_PUBLIC_APP_NAME ?? "StartKit JP";

  return (
    <header className="border-b border-zinc-200 dark:border-zinc-800 bg-white/80 dark:bg-zinc-950/80 backdrop-blur sticky top-0 z-30">
      <div className="max-w-6xl mx-auto flex items-center justify-between px-6 h-14">
        <Link href="/" className="font-bold tracking-tight">
          {appName}
        </Link>
        <nav className="flex items-center gap-6 text-sm">
          <Link href="/#features" className="hover:text-zinc-900 dark:hover:text-zinc-100 text-zinc-600 dark:text-zinc-400">
            機能
          </Link>
          <Link href="/pricing" className="hover:text-zinc-900 dark:hover:text-zinc-100 text-zinc-600 dark:text-zinc-400">
            料金
          </Link>
          <Link href="/faq" className="hover:text-zinc-900 dark:hover:text-zinc-100 text-zinc-600 dark:text-zinc-400">
            FAQ
          </Link>
          {!marketingOnly && user ? (
            <Link
              href="/dashboard"
              className="px-3 py-1.5 rounded-md bg-zinc-900 dark:bg-zinc-100 text-zinc-50 dark:text-zinc-900 text-sm"
            >
              ダッシュボード
            </Link>
          ) : null}
          {!marketingOnly && !user ? (
            <Link
              href="/login"
              className="px-3 py-1.5 rounded-md bg-zinc-900 dark:bg-zinc-100 text-zinc-50 dark:text-zinc-900 text-sm"
            >
              ログイン
            </Link>
          ) : null}
        </nav>
      </div>
    </header>
  );
}
