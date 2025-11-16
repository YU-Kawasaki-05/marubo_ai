# 塾向けチャットボット（β） — README (入口ガイド)

> 生徒がテキスト/画像で質問し、LLM（Markdown/KaTeX対応）が回答する塾向けヘルプデスク。Next.js 14 + Supabase + Resend で構築し、RLS・レート制限・フォールバックを備えた β 版です。

---

## TL;DR

- **対象**：生徒は LINE から遷移して質問、スタッフは Web 管理画面から履歴検索・月次レポートを入手。
- **主要技術**：Next.js (App Router, Node runtime)、Supabase (Auth/Postgres/Storage)、Resend、LLM プライマリ/フォールバック呼び分け、`react-markdown` + `remark-*` + `rehype-katex` + `rehype-sanitize`。
- **信頼性**：JWT ベース RLS、Service Role はサーバー API のみ、Postgres テーブルでクォータ/レート制限、429/5xx 時は自動再試行→フォールバック、重大度 S1 はメール通知。
- **スケジュール**：Vercel Cron が JST 23:55 に `/api/reports/monthly` を起動し、月末のみ本処理を実行。
- **フルドキュメント**：詳細設計は `docs/**/*.md` へ分割済み。従来の全文版 README は `docs/archive/README.full.md` に保存しています。

---

## コア機能

### 生徒向け
- Google ログイン（Supabase Auth）
- テキスト + 画像同時送信、Markdown/KaTeX 表示
- 会話履歴の閲覧と再送

### スタッフ向け
- Google ログイン + `staff` ロール付与済み JWT
- 会話検索（期間/ユーザー）、詳細閲覧
- 月次レポート（CSV/HTML）受信と UI からの再実行

### バックグラウンド/自動処理
- 署名付き URL 経由の添付アップロード
- `usage_counters` + `rate_limiter` による JST 基準クォータ/レート制限
- LLM プライマリ→フォールバック呼び分け、失敗時メッセージと通知
- Cron + 手動リトライ API でレポート生成、重大エラーは Resend で通知

---

## クイックスタート

### 1. リポジトリを取得
```bash
pnpm i
```
※ Node.js LTS + pnpm 9 を想定。WSL(Ubuntu) なら `nvm install --lts` → `pnpm i -g pnpm@9`。

### 2. 依存関係と環境変数
- `.env.example` を `.env.local` にコピーして値を埋める
- Supabase の URL/Key、LLM API キー、`ADMIN_TASK_TOKEN`、`ADMIN_EMAILS`、Resend API キーなどを設定

### 3. 開発サーバー
```bash
pnpm dev
# http://localhost:3000
```
Node runtime（Edge不可）の API から Supabase Service Role を利用します。

### 4. テスト & 品質チェック
```bash
pnpm lint
pnpm typecheck
pnpm test
```
Vitest (`jsdom`) + React Testing Library。`import.meta.vitest` で同一ファイルにユニットテストを併記します。

### 5. データベース初期化
- Supabase SQL Editor で `docs/db-schema.md` の SQL を適用
- Storage バケット `attachments` を private で作成し、README と同じルール/ポリシーを反映

### 6. デプロイ/運用チェック
- Vercel で Node.js runtime を強制 (`runtime: 'nodejs'`)、Service Role Key を Edge Runtime に渡さない
- `vercel.json` の Cron（JST 23:55）を有効化
- Resend ドメインの SPF/DKIM/DMARC、CSP/セキュリティヘッダを `next.config.js` で設定

---

## ドキュメントマップ
- アーキテクチャ/機能詳細 → `docs/architecture.md`
- DB 設計・RLS・ストレージ → `docs/db-schema.md`
- 環境変数・設定ファイル抜粋 → `docs/config.md`
- 認証/セキュリティ/デプロイ/バックエンド → `docs/backend.md`
- テスト戦略・運用 Runbook・受け入れ基準 → `docs/testing-and-ops.md`
- 従来の全文 README（参考保管） → `docs/archive/README.full.md`

---

## 設計ハイライト
- **RLS とロール管理**：初回ログインは `/api/sync-user` が `student` 固定で upsert。`/api/admin/grant`（Service Role + `x-internal-token`）のみが `staff` を付与し、JWT `app_metadata.role` を参照して RLS を判定。
- **Markdown/LaTeX レンダリング**：`react-markdown` + `remark-gfm` + `remark-math` + `rehype-katex` + `rehype-sanitize`。サニタイズスキーマをカスタマイズし、KaTeX クラスのみ許可。
- **レート制限とクォータ**：`usage_counters`（JST 当日行に upsert）と `rate_limiter` テーブルで統一管理し、超過時は HTTP 429 を返す。
- **LLM フォールバック戦略**：429/5xx/Timeout 時にバックオフ再試行 → `LLM_FALLBACK_API_KEY` + `FALLBACK_MODEL`（可能な限り別ベンダー）へ切り替え。失敗時は UI で案内し Resend で通知。
- **観測性/運用**：すべての API レスポンスに `requestId` を付与し、S1 以上は `ADMIN_EMAILS` / `DEV_ALERT_EMAILS` へメール通知。Cron は段階保存 + 手動リトライ API を提供。

---

## ディレクトリ概観
```
.
├─ app/              # 画面と API Route (Node runtime)
├─ src/features/     # 機能単位の UI/ロジック
├─ src/shared/       # 共通ライブラリ（supabaseAdmin, llm, errors など）
├─ docs/             # 分割した設計ドキュメント
├─ scripts/          # DB seed 等
└─ tests/            # 任意の統合/E2E
```
詳細なツリーやファイル一覧は `docs/architecture.md` を参照してください。

---

## 環境変数の覚書
- `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`：クライアント用。Service Role Key (`SUPABASE_SERVICE_ROLE_KEY`) はサーバー API だけで保持。
- `LLM_API_KEY` / `DEFAULT_MODEL` と `LLM_FALLBACK_API_KEY` / `FALLBACK_MODEL`：429/5xx/Timeout 時の自動切り替えに使用。
- `ADMIN_EMAILS`, `DEV_ALERT_EMAILS`：重大度 S1/S2 通知先。
- `ADMIN_TASK_TOKEN`：`/api/admin/grant` 等の内部 API 用固定トークン。クライアントへは一切渡さない。
- `MONTHLY_QUOTA`, `MAX_IMAGE_LONGEDGE`, `APP_TIMEZONE`：クォータや変換処理の閾値。
その他の詳細・フォーマット例は `docs/config.md` を確認してください。

---

## リリース前チェック
- `pnpm lint && pnpm typecheck && pnpm test && pnpm build` が成功しているか
- Supabase RLS：学生アカウントで他人の会話が見えない / スタッフで全件取得できるか
- LLM フォールバック：プライマリ障害時にフォールバックが呼ばれ、失敗時は UI/通知が適切か
- Cron / 手動リトライ：`/api/reports/monthly` が JST 23:55 実行かつ月末判定が正しいか
- Resend 送信ドメインの SPF/DKIM/DMARC、CSP/ヘッダ設定が最新か

---

## ライセンス

社内利用前提（教育目的）。外部公開時は適切な OSS ライセンスを別途検討してください。
