# Onboarding Guide

本書は **新規コントリビューター（人間開発者 / AI エージェントの双方）** が、このリポジトリで作業を開始する際の最短経路を示す。README で概観を掴み、本書で実務フローを把握した上で、詳細は各ドキュメントへリンクしていく。

---

## 想定読者とゴール

| 読者 | ゴール |
|------|--------|
| 人間開発者 | 1 日以内にローカル環境を構築し、基礎ドキュメントを読了して初回 PR を出せる状態になる |
| AI アシスタント | 既存ドキュメントを高速で取り込み、推論や自動修正時に必要なガードレール（RLS/セキュリティ/規約）を遵守できる状態になる |

---

## 事前要件

1. **環境**：Linux/WSL2 推奨、Node.js LTS + pnpm 9。（README「クイックスタート」を参照）
2. **サービス権限**：Supabase プロジェクト（Postgres + Auth + Storage）、Vercel、Resend のアクセス権。
3. **シークレット**：`.env.local` に Supabase／LLM／Resend キーを設定（`docs/deployment.md` にキー一覧あり）。
4. **AI 利用時の前提**：生成コードには `docs/coding-guidelines.md` 記載のファイル冒頭コメントを必ず挿入し、RLS や Service Role の扱いを本文で確認する。

---

## オンボーディングフロー（推奨順）

| Step | 目的 | 参照ドキュメント / コマンド |
|------|------|--------------------------------|
| 0. Overview | README 全体を俯瞰し、ビジネス背景と主要機能を把握 | `README.md`
| 1. Local Setup | 依存インストールと環境変数設定 | `README.md`「クイックスタート」、`docs/deployment.md`
| 2. 資格情報整備 | Supabase / Vercel / Resend を接続し、`.env.local` を埋める | `docs/deployment.md`、`docs/security.md`
| 3. データ準備 | `allowed_email` 登録と `app_user` 初期化でログインを可能にする | `docs/database.md`、`docs/rls.md`
| 4. アーキテクチャ理解 | 機能責務・RLS 境界・ディレクトリ構造を把握 | `docs/architecture.md`
| 5. コーディング規約 | TypeScript/Next.js の実装ルールと AI 生成手順を確認 | `docs/coding-guidelines.md`
| 6. 品質ゲート | テスト/リンター/型チェックを一度通し、失敗時の対処を把握 | `docs/testing.md`
| 7. 運用・障害対応 | runbook・トラブルシュート手順を把握し、通知系を確認 | `docs/operational/runbook.md`, `docs/troubleshooting.md`
| 8. 初回 PR | PR テンプレート、Conventional Commits、レビュー観点に沿って提出 | `docs/coding-guidelines.md` PR 章

---

## 実行チェックリスト

### Day 0（セットアップ）
- [ ] `pnpm i` がエラーなく完了
- [ ] `.env.local` を埋め、`pnpm dev` で `http://localhost:3000` が起動
- [ ] Supabase の `allowed_email` に自分（またはテスト用）の Gmail を `status='active'` で登録
- [ ] `/api/sync-user` で `app_user` が自動作成されることを確認

### Day 1（品質担保）
- [ ] `pnpm lint && pnpm typecheck && pnpm test` が成功
- [ ] AI 生成を行う場合、ファイル冒頭コメントに入出力/前提/依存/セキュリティ注意を記載
- [ ] PR テンプレートの「テスト結果」「影響範囲」「レビュー観点」を埋められるだけの材料が揃っている
- [ ] RLS を壊さないことを確認するため、`docs/rls.md` のテスト手順で最低 1 ケースを実行

---

## ドキュメントマップ

| トピック | 読む順番 / 目的 |
|----------|------------------|
| ビジネス・機能概要 | `README.md` → `docs/architecture.md` セクション「機能一覧」
| データベース / RLS | `docs/database.md` → `docs/rls.md` → `docs/security.md`
| 実装規約 | `docs/coding-guidelines.md`（TypeScript/AI/PR）
| テスト戦略 | `docs/testing.md`（単体・RLS・E2E）
| 運用 / インシデント | `docs/operational/runbook.md` → `docs/troubleshooting.md`
| デプロイ / CI | `docs/deployment.md`（環境変数、Vercel、Cron、GitHub Actions）

> **Tip（AI 向け）**：長文ドキュメントを取り込む際は、上表の順番で段階的に読み込み、ステップごとに要約を保持してから実装タスクに着手すると、文脈喪失を防げる。

---

## よくあるタスクへの誘導

- **許可リストをまとめて投入したい**：Supabase SQL Editor または自作スクリプトで `allowed_email` を `COPY` / `INSERT`。投入後に `docs/rls.md` の `allowed_email` テストを実行し、`status='revoked'` 切り替えで即時アクセス不能になることを確認。
- **月次レポートを手動再実行したい**：`/admin` のスタッフ UI からリトライ。障害時フローは `docs/operational/runbook.md`「月次レポート失敗」節を参照。
- **LLM エラーを再現したい**：`docs/troubleshooting.md` の LLM 429/Timeout 手順に沿って再試行。必要に応じてフォールバックエンドポイントを `.env.local` で差し替える。

---

## 初回 PR までの目安タイムライン

1. **0-2 時間**：Step0-2（README / クイックスタート / env 設定）
2. **2-4 時間**：Step3-4（DB・RLS 理解、基本 UI の動作確認）
3. **4-6 時間**：Step5-6（規約読み込み、lint/typecheck/test 完走）
4. **6 時間以降**：Step7-8（運用周りを確認し、最初の小さな PR を作成）

AI エージェントの場合も上記を順守し、各ステップがカバーされたことをメタデータとして残すとレビューしやすい。

---

## 次のアクション

1. 本書を読み終えたら、`README.md` と各リンク先ドキュメントへのショートカット（VS Code workspace, AI context など）を作成する。
2. 実タスクに入る前に、このチェックリストをベースに自己承認ノートを残し、いつでも再参照できるようにしておく。
