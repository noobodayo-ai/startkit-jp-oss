# StartKit JP (OSS)

**日本市場向け SaaS の土台。認証・マルチテナント・日本法準拠の法令ページまで動く状態で始められる Next.js + Firebase ボイラープレートです。**

Firebase Spark（無料枠）だけで動きます。月額固定費 0 円から自分の SaaS を立ち上げられます。

MIT ライセンスなので、商用プロダクトにそのまま組み込めます。

---

## 5分で動かす

```bash
git clone https://github.com/noobodayo-ai/startkit-jp-oss.git my-saas
cd my-saas
pnpm install
cp .env.example .env.local   # Firebase の値を入れる
pnpm dev
```

Firebase コンソールで **Authentication（Google プロバイダ）** と **Firestore** を有効化し、
`.env.local` に値を入れれば `http://localhost:3000` でサインアップまで通ります。

Security Rules の反映:

```bash
firebase deploy --only firestore:rules,firestore:indexes
```

---

## 入っているもの

| | |
|---|---|
| 認証 | Firebase Auth + Google SSO、HttpOnly セッション Cookie、サーバー側検証 |
| マルチテナント | Custom Claims によるテナント分離、招待コード方式、メンバー管理画面 |
| Security Rules | テナントを跨いだ読み書きを塞ぐ Firestore Rules + インデックス定義 |
| 法令ページ | 特商法表記 / プライバシーポリシー / 利用規約（env に事業者情報を入れるだけ） |
| 横断 | CSRF ミドルウェア、監査ログ、レート制限、i18n（ja/en）、Sentry フック |
| 画面 | LP / 料金 / FAQ / ログイン / 新規登録 / ダッシュボード（すべて差し替え前提の雛形） |
| テスト | vitest のユニットテスト同梱 |

## 入っていないもの

お金を受け取る部分と運営側のツールは有料版（[StartKit JP Pro](https://startkit-jp-marketing.nagilabo.workers.dev)）に入っています。

- Stripe 日本円決済 + 消費税自動計算（買い切り / サブスク両対応）
- 適格請求書ひな形の PDF 発行（T番号・改ざん検出つき）と CSV エクスポート
- 運営者向け管理画面（顧客一覧・売上ダッシュボード・請求書検索）
- Gemini API ラッパー（モデル自動探索 + 複数キーフォールバック）と RAG 雛形
- トランザクションメール送信

**この OSS 版だけで、認証と課金以外の SaaS の器は完成します。** 課金は自分で書いてもいいし、
書く時間を買いたければ Pro を検討してください。

---

## 実装の解説記事

このリポジトリから切り出した実装の解説です。

- [Firestore で改ざん検出のハッシュを同じドキュメントに保存してはいけない](https://qiita.com/nagilabo/items/b17fe1b5857df0532872)
- [Firebase Storage をやめて無料枠に収めたら、過去の請求書が書き換わるようになった](https://qiita.com/nagilabo/items/e1efee92437e9f03b6c6)
- [pdf-lib で日本語の Variable フォントをサブセット埋め込みすると漢字が消える](https://qiita.com/nagilabo/items/f385d8b9c2c0082fc84c)

---

## 免責

法令ページは日本法を前提としたテンプレートです。そのまま使えることを保証するものではありません。
実際の公開前に、貴社の顧問弁護士・税理士にご確認ください。

## ライセンス

MIT。詳細は [LICENSE.md](./LICENSE.md) を参照してください。
