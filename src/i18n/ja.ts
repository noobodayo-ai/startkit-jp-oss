/**
 * 日本語辞書。Marketing 系ページの文言を網羅する。
 * 値はそのまま React に流すため、HTML ではなくプレーンテキスト or 単純な改行のみ。
 */

export const ja = {
  marketing: {
    hero: {
      kicker: "Japan-localized SaaS Starter Kit",
      title1: "日本市場向け SaaS を、",
      title2: "5 分で立ち上げる。",
      lead:
        "Stripe 日本円・適格請求書ひな形の PDF・特商法テンプレ・マルチテナント・Gemini ラッパーまで。海外スターターでは届かない日本対応の細部を、最初から組み込んだ Next.js + Firebase + Stripe ボイラープレート。",
      ctaBuy: "Pro ¥19,800 を購入",
      ctaDemo: "デモを見る",
      ctaOss: "OSS版を見る（無料）",
      guarantee: "買い切り・1年無料アップデート・引き渡し前なら14日以内返金",
    },
    compare: {
      title: "あなたはこの 28〜52 時間を、毎案件で再発明していませんか？",
      sub: "時給 ¥3,000 換算なら ¥84,000〜¥156,000 相当の作業。",
      colTask: "課題",
      colSelf: "自前実装",
      colKit: "StartKit JP",
      total: "合計",
    },
    features: {
      title: "同梱機能",
    },
  },
  pricing: {
    title: "料金",
    sub: "すべて買い切り・1年間の無料アップデート付き",
    note: "表示は税込価格。サブスクではありません。",
    faqTitle: "よくある質問",
  },
};

export type Dict = typeof ja;
