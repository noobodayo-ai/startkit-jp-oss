# Contributing to StartKit JP (OSS)

StartKit JP OSS 版への貢献ありがとうございます。本ドキュメントは、不具合報告・改善提案・Pull Request の流れを説明します。

## ライセンスの前提

このリポジトリは **MIT ライセンス**です（[LICENSE.md](./LICENSE.md) 参照）。
Pull Request を送った時点で、その貢献も MIT で提供されたものとして扱います。CLA や著作権譲渡は求めません。

MIT なので、メンテナが有償版（StartKit JP Pro / Team）に貢献部分を取り込むことがあります。
これは MIT が許諾する範囲の利用ですが、明示しておきます。合意できない場合は、
PR を送らず Issue や Discussion での提案にとどめてください。

なお、Stripe 決済・適格請求書ひな形の PDF 発行・管理画面・Gemini ラッパー・メール送信は
このリポジトリには含まれておらず、有償版のみに存在します。それらに関する PR は受け取れません。

## 不具合報告（Issue）

最低限以下を含めてください。

- Next.js / Node / pnpm のバージョン
- 再現手順
- 期待する挙動 / 実際の挙動
- ログ（個人情報は伏字に）

セキュリティに関する報告は Issue ではなく [SECURITY.md](./SECURITY.md) を参照してください。

## 機能要望

GitHub Discussions に "Idea" として投稿してください。

## Pull Request

1. main から派生ブランチを切る（例: `fix/session-cookie-maxage`）
2. ローカルで `pnpm lint && pnpm typecheck && pnpm test && pnpm build` を通す
3. 変更点・動作確認手順を PR 本文に書く

レビュー観点：

- マルチテナント分離の安全性（Security Rules、`tenantId` 検証）
- 日本の法令テンプレート（特商法 / プラポリ / 利用規約）との整合性
- 既存 API 形・型定義との後方互換
- 不要な依存追加を避ける
- **HTTP の契約は型に出ない。** フォームの送信先・メソッド・リダイレクトを変えた PR は、
  ビルドが通ることではなく実際に動かした手順を書いてください

## コーディングルール

- パッケージマネージャー：**pnpm**（npm / yarn は使用しない）
- TypeScript strict、`any` 禁止（必要ならローカル型キャストで吸収）
- コメントは「なぜ」を書く。何をしているかはコードで分かるようにする
- 1 PR は 1 関心事

## コミットメッセージ

慣習：`<type>: <subject>`（type は feat / fix / docs / refactor / test / chore）。
例：`fix: clear session cookie on logout`

## コード・オブ・コンダクト

[CODE_OF_CONDUCT.md](./CODE_OF_CONDUCT.md) に同意した上で参加してください。
