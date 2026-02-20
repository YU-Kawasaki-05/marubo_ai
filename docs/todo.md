# TODO / Roadmap

本書は、今後実装予定の機能や改善点を整理する **開発ロードマップ** です。
初心者でも着実に開発を進められるよう、タスクを細かいステップ（Step）に分解しています。

**進め方のコツ**:
1. 基本的に **ID順** または **Step順** に進めてください。
2. 1つのStepが終わるごとに、動作確認（`pnpm dev` や `pnpm test`）を行うと手戻りが少なくなります。
3. 詰まったら、前のStepに戻って見直すか、エラーログを確認しましょう。

---

## タスク一覧

> **Status Legend**: `todo` = 未着手, `progress` = 進行中, `blocked` = 調整待ち, `review` = 実装済みレビュー待ち, `done` = 完了

### 1. 仕様・ドキュメント整備 (SPEC)

開発の迷いをなくすための「地図」を作るフェーズです。

| ID | Status | 概要 | 詳細ステップ (Step) |
|----|--------|------|------|
| **SPEC-01** | review | 許可メール運用詳細追記 | (完了済み) `docs/security.md` に招待メール文面と監査ログ保持期間を、`docs/architecture.md` にCSV取り扱いルールを追記済み。 |
| **SPEC-02** | review | Allowlist UI/CSV 仕様確定 | (完了済み) `/admin/allowlist` のUX、バリデーション、CSV列定義などを `docs/api.md` に追記済み。 |
| **SPEC-03** | review | `/api/sync-user` メッセージ定義 | (完了済み) `pending/revoked/not-found` の表示文言を `docs/api.md` に追加済み。 |
| **SPEC-04** | review | 退会/削除ポリシー整理 | (完了済み) `docs/database.md` に論理削除方針を、`docs/operational/runbook.md` に退会処理手順を追記済み。 |
| **SPEC-05** | done | 保護者共有要件確認 | (完了) **方針決定**: 個人情報保護のため、CSVの保護者への配布・共有は行わない。<br>※ 必要な場合はスタッフが個別に連絡する運用とする。 |
| **SPEC-06** | done | Onboarding/README 更新 | (完了) `docs/onboarding.md` 作成済み。`README.md` にセットアップ手順統合済み。 |
| **SPEC-07** | done | 完成基準（受け入れ条件）の明文化 | (完了) `docs/acceptance.md` を新規作成。生徒フロー（S-01〜S-11）・スタッフフロー（T-01〜T-09）・非機能要件（N-01〜N-11）のチェックリストを定義。β版スコープ外の項目も明記。 |
| **SPEC-08** | done | 画像添付（Storage）仕様確定 | (完了) `docs/attachments.md` を新規作成。**決定事項**: 形式=JPEG/PNG/WebP、最大5MB/枚、最大3枚/メッセージ、長辺1280pxまで圧縮(JPEG品質0.8)、Storage保存1年。アップロードフロー・エラーハンドリング・UI仕様も定義。 |
| **SPEC-09** | done | スタッフ会話検索・閲覧仕様 | (完了) `docs/admin/conversations.md` を新規作成。**決定事項**: 検索条件=生徒メール(部分一致)/期間/キーワード(タイトル部分一致)、AND絞り込み。一覧=メール・タイトル・作成日・メッセージ数(20件/ページ、オフセットページネーション)。詳細=全メッセージ+添付画像+タイムスタンプ、閲覧専用。API仕様も定義。 |
| **SPEC-10** | done | 月次レポート仕様 | (完了・方針変更済み) `docs/reports/monthly.md` を全面改訂。**新方針**: メール送信から **LLM 分析による生徒個別学習レポート + Web UI 閲覧** に変更。生徒は `/reports` で自分のレポートを閲覧、スタッフは `/admin/reports` で全生徒のレポートを管理。メールは通知のみ。DBは `monthly_summary` → `monthly_report` に改名・拡張。 |
| **SPEC-11** | done | 監視/通知・レート制限方針 | (完了) `docs/operational/monitoring.md` を新規作成。**決定事項**: β版はResendメール+Vercel/Supabaseログで運用(Sentry任意)。S1=即時メール(LLM全経路失敗/DB障害/レポート失敗/認証障害)、S2=ログ+翌日確認、S3=ログのみ。5分デバウンス付き。レート制限: 月間100問/ユーザー(`MONTHLY_QUOTA`)、10リクエスト/分/ユーザー。超過時429+UIメッセージ。 |

### 2. バックエンド実装 (BE)

サーバー側のロジックとデータベース周りを整備します。

| ID | Status | 概要 | 詳細ステップ (Step) |
|----|--------|------|------|
| **BE-01** | done | `allowed_email` マイグレーション適用 | (完了) **手動適用済み**: Supabase WebコンソールのSQL Editorにて、`20241204154500_allowlist_audit.sql` ベースのSQLを実行・適用済み。 |
| **BE-02** | review | `audit_allowlist` 実装 | (実装済み) `src/shared/lib/allowlist.ts` に `recordAuditLog` 関数を実装し、作成・更新・CSVインポート時に呼び出していることを確認。 |
| **BE-03** | review | `/api/admin/allowlist` 実装 | (実装済み) GET/POST/PATCH、CSV受け付け、リクエスト検証などを実装済み。 |
| **BE-04** | review | `/api/sync-user` 拡張 | (実装済み) `active` で同期、`pending/revoked` でエラー、`not-found` で拒否するロジックを実装済み。 |
| **BE-05** | review | seed/import スクリプト | (実装済み) `scripts/seed-allowlist.ts` を作成。`scripts/data/allowlist.sample.csv` からデータを読み込み、Seed Bot ユーザー経由で DB に登録/更新できることを確認。 |
| **BE-06** | review | Supabase CLI マイグレーション運用 | (実装済み) `package.json` に `db:push:dry` / `db:push` を追加し、`docs/deployment.md` に本番適用の安全手順（dry-run → push）を追記済み。 |
| **BE-07** | review | Supabase モック切替 | (実装済み) `MOCK_SUPABASE=true` でメモリモックに切り替わる仕組みを実装済み。 |
| **BE-08** | todo | 画像添付テーブル & RLS | **Step 1**: `supabase/migrations/` に `attachments` テーブルを追加（message_id, user_id, storage_path, mime_type, size, created_at）。<br>**Step 2**: RLS ポリシー（本人のみ読取/作成可）を追加。<br>**Step 3**: `src/shared/types/database.ts` を更新。 |
| **BE-09** | todo | Storage バケット準備 | **Step 1**: Supabase Storage に `attachments` バケットを作成。<br>**Step 2**: Storage RLS/CORS を設定（アップロードは署名URLのみ）。<br>**Step 3**: `docs/deployment.md` にセットアップ手順を追記。 |
| **BE-10** | todo | 画像アップロード署名 API | **Step 1**: `app/api/attachments/sign/route.ts` を新規実装（認証必須）。<br>**Step 2**: mime/サイズ/拡張子のバリデーションを追加。<br>**Step 3**: `createSignedUploadUrl` で署名URLを返す。 |
| **BE-11** | todo | チャット保存で添付を永続化 | **Step 1**: `/api/chat` のリクエストに `attachments` を受け付ける（配列）。<br>**Step 2**: `messages` と `attachments` を紐付けて保存。<br>**Step 3**: 会話詳細 API で attachments 情報を返す。 |
| **BE-12** | todo | スタッフ会話検索 API | **Step 1**: `app/api/admin/conversations` (一覧) を実装（staff認証必須）。<br>**Step 2**: フィルタ（email/user_id/期間/キーワード）とページネーションを追加。<br>**Step 3**: `app/api/admin/conversations/[id]`（詳細）を実装。 |
| **BE-13** | todo | admin/grant API | **Step 1**: `app/api/admin/grant/route.ts` を実装（`requireStaff()` + `GRANT_ALLOWED_EMAILS` チェック）。<br>**Step 2**: `app_user.role` 更新 + `auth.admin.updateUserById` で `app_metadata.role` 同期。<br>**Step 3**: `audit_grant` テーブルに監査ログ記録。<br>**Step 4**: GET エンドポイント（スタッフ一覧 + 操作履歴）を実装。<br>仕様: `docs/admin/grant.md` |
| **BE-14** | todo | 月次レポート生成 API | **Step 1**: `monthly_report` テーブルマイグレーションを作成（`monthly_summary` からの置換）。<br>**Step 2**: `POST /api/reports/monthly` を実装（Cron 認証 + 月末判定 + 全生徒ループ）。<br>**Step 3**: 生徒ごとの統計集計 + LLM 分析プロンプト作成。<br>**Step 4**: `REPORT_LLM_MODEL` / `REPORT_LLM_API_KEY` での LLM 呼び出し。<br>**Step 5**: `monthly_report` への結果保存（成功/失敗）。<br>**Step 6**: 完了通知メール送信（Resend）。<br>仕様: `docs/reports/monthly.md` |
| **BE-15** | todo | レポート閲覧・CSV API | **Step 1**: `GET /api/reports/monthly` を実装（生徒=自分のみ、スタッフ=全員）。<br>**Step 2**: `GET /api/reports/monthly/csv` を実装（スタッフのみ）。<br>**Step 3**: `src/features/reports/toCsv.ts` ユーティリティ。 |
| **BE-16** | todo | 監視・通知ユーティリティ | **Step 1**: `src/shared/lib/notifier.ts` を作成（Sentry/Resend など）。<br>**Step 2**: 重要API (`/api/chat`, `/api/reports/monthly`) の例外で通知を送る。 |
| **BE-17** | todo | レート制限/使用量カウンター | **Step 1**: `usage_counters` / `rate_limiter` テーブルを追加。<br>**Step 2**: `/api/chat` でレート制限を適用。<br>**Step 3**: レート超過時の応答とログを整備。 |

### 3. フロントエンド実装 (FE)

ここが一番「動いている感」が出る部分です。小さく作っていきましょう。

| ID | Status | 概要 | 詳細ステップ (Step) |
|----|--------|------|------|
| **FE-01** | review | `/admin/allowlist` UI | **Step 1 (表示/検索)**: (完了) `app/admin/allowlist/page.tsx` でデータ表示と検索絞り込みを実装済み。<br>**Step 2 (更新)**: (完了) 各行にステータス変更用ドロップダウンを配置し、API (PATCH) とつなぎこんで更新できるようにした。<br>**Step 3 (UX向上)**: (一部完了) 簡易的なリロード処理で対応済み。 |
| **FE-02** | done | Allowlist hooks | (完了) `useAllowlistQuery` および `useAllowlistMutations` (create, update, importCsv) 実装済み。 |
| **FE-03** | done | CSV アップロード UI | **Step 1 (UI)**: (完了) `src/features/admin/allowlist/components/CsvImportForm.tsx` を作成。<br>**Step 2 (Parser)**: (完了) クライアントサイドでのパース実装済み（Shift_JIS対応）。<br>**Step 3 (Integration)**: (完了) API統合済み。<br>**Step 4 (Validation)**: (完了) CSVフォーマット簡易チェック実装済み。<br>**Step 5 (Doc)**: (完了) `docs/manual/csv_import.md` を作成済み。 |
| **FE-04** | done | 学生向け警告表示 | **Step 1 (RLS設定)**: (完了) `allowed_email` に `SELECT` 許可ポリシーを追加済み。<br>**Step 2 (データ取得)**: (完了) `useMyAllowlistStatus` 実装済み。<br>**Step 3 (警告UI)**: (完了) `AccountStatusBanner` 実装済み。<br>**Step 4 (配置)**: (完了) `app/layout.tsx` にバナーを配置済み。 |
| **FE-05** | todo | チャット画像添付 UI | **Step 1**: `ChatInterface` にファイル選択UIを追加（画像のみ/複数可）。<br>**Step 2**: 画像プレビューと削除UIを作る。<br>**Step 3**: `/api/attachments/sign` で署名URL取得→Storageにアップロード。 |
| **FE-06** | todo | 添付画像の表示 | **Step 1**: `/api/conversations/[id]` の `attachments` を受け取りUIで表示。<br>**Step 2**: `MessageBubble` に画像レンダリングを追加（サイズ制限・拡大表示）。 |
| **FE-07** | todo | スタッフ会話検索 UI | **Step 1**: `/admin/conversations` ページを作成（一覧 + フィルタ）。<br>**Step 2**: 会話詳細（メッセージ/画像）を表示。<br>**Step 3**: ページネーション/検索結果の空状態を整備。 |
| **FE-08** | todo | 生徒用レポートページ | **Step 1**: `/reports` ページを作成（月選択 + 記事風レポート表示）。<br>**Step 2**: `react-markdown` + `remark-gfm` で Markdown レンダリング（note/Zenn風の1カラムデザイン）。<br>**Step 3**: チャット画面から「📊 レポート」ボタンで遷移できるようにする。<br>**Step 4**: 未生成月の表示（「まだ生成されていません」）を実装。 |
| **FE-09** | todo | スタッフ用レポート管理 UI | **Step 1**: `/admin/reports` ページを作成（全生徒レポート一覧 + ステータス表示）。<br>**Step 2**: 手動生成（dry-run / 本実行）ボタンを配置。<br>**Step 3**: 失敗生徒の個別再生成ボタン。<br>**Step 4**: CSV ダウンロードボタンを配置。 |
| **FE-10** | todo | スタッフ権限付与 UI | **Step 1**: `/admin/grant` 画面でメール入力→権限付与。<br>**Step 2**: 現在のスタッフ一覧 + 操作履歴を表示。<br>**Step 3**: 解除ボタン・確認ダイアログ・バリデーション。<br>仕様: `docs/admin/grant.md` |

### 4. テスト & QA (QA)

作ったものが壊れていないか確認する作業です。

| ID | Status | 概要 | 詳細ステップ (Step) |
|----|--------|------|------|
| **QA-01** | done | RLS/Allowed Email テスト | **Step 1**: (完了) `scripts/verify-rls.ts` を作成。<br>**Step 2**: 匿名/未許可ユーザーで0件、許可ユーザーで1件のみ閲覧できることを検証済み。 |
| **QA-02** | done | API 統合テスト | **Step 1**: `/api/admin/allowlist` に対し、正常なデータを送って 200 OK が返るかテストする。<br>**Step 2**: 不正なデータ（メールアドレス形式違反など）を送って 400 Bad Request が返るかテストする。（`tests/api/admin/allowlist.test.ts` で実装済み） |
| **QA-03** | todo | フロント E2E | (Playwright等の導入が必要なため、後回しでも可) 手動で「スタッフで追加 → 生徒でログイン」の流れを確認する手順書を作るだけでもOK。 |
| **QA-04** | done | チャット永続化の回帰テスト | **Step 1 (done)**: 保存→一覧→詳細のハッピーパスを API 統合テストで実装。<br>**Step 2 (done)**: トークンなし/期限切れで 401/403 になることを確認するテストを追加。 |
| **QA-05** | todo | スクリプトテスト | `scripts/seed-allowlist.ts` を `--dry-run` (書き込まないモード) で実行し、エラーが出ないか確認する。 |
| **QA-06** | review | `/api/admin/allowlist` API テスト | (QA-02に統合) |
| **QA-07** | review | Supabase モック E2E | (実装済み) MOCK_SUPABASE を用いたテスト環境整備済み。 |
| **QA-08** | todo | 画像添付の統合テスト | **Step 1**: 署名URL取得→Storageアップロード→`/api/chat` 保存までの流れをテスト。<br>**Step 2**: 画像が `/api/conversations/[id]` に含まれることを確認。 |
| **QA-09** | todo | スタッフ会話検索テスト | **Step 1**: staff 権限で一覧/詳細が取れる。<br>**Step 2**: 生徒ユーザーではアクセス不可 (403/401)。 |
| **QA-10** | todo | 月次レポートテスト | **Step 1**: dry-run で統計集計・ LLM モック応答・ Markdown 生成を確認。<br>**Step 2**: `monthly_report` への保存を検証。<br>**Step 3**: 生徒用 API で自分のレポートのみ取得できることを確認（RLS）。 |
| **QA-11** | todo | レート制限テスト | **Step 1**: 連続リクエストで 429 が返る。<br>**Step 2**: 制限解除タイミングを確認。 |
| **QA-12** | todo | 運用・通知テスト | **Step 1**: 強制エラーで notifier が発火する。<br>**Step 2**: 監視ログが残ることを確認。 |
| **QA-13** | todo | スタッフ権限付与テスト | **Step 1**: `GRANT_ALLOWED_EMAILS` に含まれるスタッフが付与/解除できる。<br>**Step 2**: 含まれないスタッフは 403 が返る。<br>**Step 3**: `audit_grant` にログが残ることを確認。 |
| **QA-14** | todo | レポート UI テスト | **Step 1**: 生徒で `/reports` にアクセスし、自分のレポートが Markdown 表示される。<br>**Step 2**: スタッフで `/admin/reports` にアクセスし、全生徒のレポート一覧が表示される。<br>**Step 3**: CSV ダウンロードが正しい形式で取得できる。 |
### 5. 運用 / DevOps (OPS)

| ID | Status | 概要 | 詳細ステップ (Step) |
|----|--------|------|------|
| **OPS-01** | review | Migration ワークフロー整理 | (実装済み) `BE-06` と連動し、CLIコマンド（`db:push:dry` / `db:push`）と本番手順（dry-run → push）を `package.json` / `docs/deployment.md` に反映済み。 |
| **OPS-02** | done | CI 更新 | **Step 1**: (完了) `.github/workflows/test.yml` を作成し、Push時に Lint/Typecheck/Test が実行されるように構成済み。 |
| **OPS-03** | blocked | Allowlist 変更通知設計 | (ユーザー確認待ち) |
| **OPS-04** | review | README 統合反映 | (完了確認) `README.new.md` が削除され、`README.md` に統合されているか確認する。 |
| **OPS-05** | todo | Resend セットアップ | **Step 1**: 送信ドメイン/送信元アドレスを確定。<br>**Step 2**: `RESEND_API_KEY` を本番/開発に設定。<br>**Step 3**: `docs/deployment.md` に手順を追記。 |
| **OPS-06** | todo | Vercel Cron 設定 | **Step 1**: `vercel.json` に Cron 設定を追加（`55 23 * * *` / `Asia/Tokyo`）。<br>**Step 2**: dry-run はクエリパラメータ `?dryRun=true` で切替。通常 Cron は本実行。手動リトライ時に dry-run 選択可。<br>**※ 月末に LLM 分析を実行するため、Vercel Functions のタイムアウトに注意（分割実行戦略は `docs/reports/monthly.md` 参照）**。仕様は `docs/reports/monthly.md` に記載済み。 |
| **OPS-07** | todo | 監視・通知導入 | **方針確定済み**: β版は Resend メール + Vercel/Supabase ログ。Sentry は任意（将来推奨）。仕様は `docs/operational/monitoring.md` に記載済み。<br>**Step 1**: `src/shared/lib/notifier.ts` を実装（BE-16 と連動）。<br>**Step 2**: `ADMIN_EMAILS` / `MAIL_FROM` を本番環境に設定。 |
| **OPS-08** | todo | 本番環境の秘密情報管理 | **Step 1**: `.env.example` に不足分を追記（`REPORT_LLM_MODEL`, `REPORT_LLM_API_KEY`, `REPORT_MAX_TOKENS_OUT`, `GRANT_ALLOWED_EMAILS` を含む）。<br>**Step 2**: `docs/deployment.md` に必須env一覧を整理。 |

### 6. チャット機能実装 (CHAT)

教育用AIチャットの中核機能を実装します。

| ID | Status | 概要 | 詳細ステップ (Step) |
|----|--------|------|------|
| **CHAT-01** | done | 技術選定 & セットアップ | **Step 1**: (完了) Vercel AI SDK (`ai`), `openai` SDK をインストール済み。<br>**Step 2**: (完了) 環境変数 (`OPENAI_API_KEY`) を `.env.local` に設定済み。 |
| **CHAT-02** | done | バックエンド API 実装 | **Step 1**: (完了) `/app/api/chat/route.ts` を作成済み。<br>**Step 2**: (完了) `streamText` を用いてOpenAIへのストリーミングリクエストを実装済み。<br>**Step 3**: (完了) システムプロンプトを設定済み。 |
| **CHAT-03** | done | チャット UI 実装 | **Step 1**: (完了) `src/features/chat/components/ChatInterface.tsx` を作成し、`useChat` でメッセージ送受信を行えるようにする。<br>**Step 1.5 (Fix done)**: (完了) Supabase認証トークンを `useChat` に正しく渡すため、コンポーネントを分割してトークン取得後に初期化するように修正済み。<br>**Step 1.6 (Fix done)**: (完了) `toDataStreamResponse` のプロトコル不一致を修正済み。<br>**Step 1.7 (Fix done)**: (完了) Data Stream Protocol使用時、`message.content`が空になる問題を修正 (`MessageBubble`で`parts`からテキスト復元)。<br>**Step 2 (UI)**: (完了) メッセージ表示コンポーネント作成 (`MessageBubble`)。<br>**Step 3 (Markdown)**: (完了) `react-markdown` を導入し、太字やリストを表示できるようにする。<br>**Step 4 (Math)**: (完了) `remark-math`, `rehype-katex` を導入し、数式 ($...$) をきれいに表示できるようにする。<br>**Step 5 (Style)**: (完了) `MemoizedMarkdown` で AIの応答エリアに適切なスタイル（背景色、余白）を適用済み。 |
| **CHAT-04** | progress | 画面統合 | **Step 1 (done)**: `/app/chat/page.tsx` を AllowlistGuard 付きで配置する。<br>**Step 2 (todo)**: チャット画面で自動スクロール（新メッセージ受信時に最下部へ）。 |
| **CHAT-05** | progress | チャット永続化 & 履歴UI | **Blocker解消**: DB パスワード受領済み。<br>**Step 1 (done)**: Supabase スキーマ適用を確認（`db push` 済み）。<br>**Step 2 (done)**: `/api/chat` に onFinish 保存処理を追加し、`conversationId` をヘッダで返す。<br>**Step 3 (done)**: `/api/conversations` (GET 一覧) を実装（limit/cursor、`created_at desc`）。<br>**Step 4 (done)**: `/api/conversations/[id]` (GET 詳細) を実装（messages 昇順）。<br>**Step 5 (done)**: フロント サイドバー最小版を実装（一覧取得→クリックで詳細表示、最新会話で選択更新）。<br>&nbsp;&nbsp;**Step 5-1 (done)**: `ConversationSidebar.tsx` 新規作成（一覧fetch、表示、もっと読む、ハイライト）。<br>&nbsp;&nbsp;**Step 5-2 (done)**: `ChatInterface.tsx` を3層構成に改修（`ChatSession` / `ChatLoader` / `ChatInterface`）。<br>&nbsp;&nbsp;**Step 5-3 (done)**: `app/chat/page.tsx` を2カラムレイアウトに変更。`layout.tsx` で metadata 分離。<br>&nbsp;&nbsp;**Step 5-4 (done)**: APIレスポンス形式に合わせて `ConversationSidebar` の解析を `{ data: [...] }` に修正。<br>&nbsp;&nbsp;**Step 5-5 (done)**: `ChatLoader` で `{ data: { messages: [...] } }` を UIMessage に変換（`parts` 付与）。<br>&nbsp;&nbsp;**Step 5-6 (done)**: サイドバー幅指定の重複を整理。<br>&nbsp;&nbsp;**Step 5-7 (done)**: `tsc --noEmit` 通過＆ブラウザで一覧/詳細/新規作成の動作確認。<br>**Step 6 (done)**: 保存→一覧→詳細の統合テストを1件追加。 |
| **CHAT-06** | todo | 画像添付チャット | **Step 1 (done)**: `SPEC-08` 確定済み（`docs/attachments.md`）。JPEG/PNG/WebP、5MB/枚、3枚/メッセージ、1280px圧縮。<br>**Step 2**: `BE-08〜BE-11` と `FE-05〜FE-06` を実装。<br>**Step 3**: `QA-08` で統合テストを通す。 |

---

必要な情報や優先度が変わった場合は、このファイルで随時アップデートしてください。
