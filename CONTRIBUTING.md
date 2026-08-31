# Contributing to StartKit JP

StartKit JP への貢献ありがとうございます。本ドキュメントは、不具合報告・改善提案・Pull Request の流れを説明します。

## ライセンスの前提

StartKit JP は OSS ではなく **ソース閲覧可能（Source-Available）** な商用キットです（[LICENSE.md](./LICENSE.md) 参照）。
PR を送る際、貢献者は以下に同意したものとします。

- 送付したコード・ドキュメントの著作財産権を、当プロジェクトの維持者に **無償で譲渡** すること（または同等の自由な利用を許諾すること）
- これにより、貢献部分も含めた StartKit JP 全体を有償販売することを認めること

合意できない場合は、PR を送らず Issue や Discussion での提案にとどめてください。

## 不具合報告（Issue）

GitHub Issues の "Bug" テンプレートに従って報告してください。最低限以下を含めてください。

- Next.js / Node / pnpm のバージョン
- 再現手順
- 期待する挙動 / 実際の挙動
- ログ（個人情報は伏字に）

セキュリティに関する報告は Issue ではなく [SECURITY.md](./SECURITY.md) を参照してください。

## 機能要望

GitHub Discussions に "Idea" として投稿してください。

## Pull Request

1. main から派生ブランチを切る（例: `fix/invoice-rounding`）
2. ローカルで `pnpm lint && pnpm typecheck && pnpm build` を通す
3. 変更点・動作確認手順を PR 本文に書く
4. PR テンプレートのチェックリストを埋める

レビュー観点：

- 日本の決済・税務・法令との整合性
- マルチテナント分離の安全性（Security Rules、`tenantId` 検証）
- 既存 API 形・型定義との後方互換
- 不要な依存追加を避ける

## コーディングルール

- パッケージマネージャー：**pnpm**（npm / yarn は使用しない）
- TypeScript strict、`any` 禁止（必要ならローカル型キャストで吸収）
- コメントは「なぜ」を書く。何をしているかはコードで分かるようにする
- 1 PR は 1 関心事

## コミットメッセージ

慣習：`<type>: <subject>`（type は feat / fix / docs / refactor / test / chore）。
例：`fix: invoice PDF rounding for multi-tax-rate orders`

## コード・オブ・コンダクト

[CODE_OF_CONDUCT.md](./CODE_OF_CONDUCT.md) に同意した上で参加してください。
