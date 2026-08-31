/**
 * 軽量 i18n。next-intl 等の依存追加なしで動く。
 *
 * - サーバー側で headers().get("accept-language") を読んでロケールを決定
 * - クライアント側ロジックは持たず、Server Component から `getDict()` を呼ぶ前提
 * - SSG ページでも request headers が読めるよう、各 page で動的レンダリングが必要
 */

import { headers } from "next/headers";
import { ja } from "./ja";
import { en } from "./en";

export type Locale = "ja" | "en";

export function pickLocale(acceptLanguage: string | null | undefined): Locale {
  if (!acceptLanguage) return "ja";
  // Accept-Language の最初に出てくる言語タグだけ見る簡易実装
  const langs = acceptLanguage.split(",").map((s) => s.trim().toLowerCase());
  for (const l of langs) {
    if (l.startsWith("ja")) return "ja";
    if (l.startsWith("en")) return "en";
  }
  return "ja";
}

export async function getLocale(): Promise<Locale> {
  const h = await headers();
  // 明示指定が cookie や ?lang= で来た場合はそれを優先（将来拡張用）
  return pickLocale(h.get("accept-language"));
}

export function getDictFor(locale: Locale) {
  return locale === "en" ? en : ja;
}

export async function getDict() {
  const locale = await getLocale();
  return getDictFor(locale);
}

export { ja, en };
