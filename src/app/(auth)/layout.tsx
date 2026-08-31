import Link from "next/link";

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen flex flex-col">
      <header className="px-6 h-14 flex items-center border-b border-zinc-200 dark:border-zinc-800">
        <Link href="/" className="font-bold">
          {process.env.NEXT_PUBLIC_APP_NAME ?? "StartKit JP"}
        </Link>
      </header>
      <main className="flex-1 flex items-center justify-center px-6 py-12">
        <div className="w-full max-w-md">{children}</div>
      </main>
    </div>
  );
}
