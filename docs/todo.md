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
| **BE-08** | review | 画像添付テーブル & RLS | (実装済み) `supabase/migrations/20260226000000_be08_attachments.sql` を追加し、`attachments` テーブル（message_id, user_id, storage_path, mime_type, size_bytes, created_at）と RLS（本人 + staff）を実装。`src/shared/types/database.ts` に `attachments` 型定義を反映済み。 |
| **BE-09** | review | Storage バケット準備 | (手順書更新済み) `docs/deployment.md` に `attachments` バケット作成 / Storage policy 確認 / CORS 確認手順を追記。<br>※ 実環境への作成・設定は Supabase コンソールでの手動作業。 |
| **BE-10** | review | 画像アップロード署名 API | (実装済み) `app/api/attachments/sign/route.ts` を新規作成。認証チェック + MIME/サイズバリデーション (`src/shared/lib/attachmentValidation.ts`) + `createSignedUploadUrl` で署名 URL 発行。テスト `tests/api/attachments-sign.test.ts` で認証/バリデーション/正常系/Storage エラーを網羅。 |
| **BE-11** | review | チャット保存で添付を永続化 | (実装済み) `/api/chat` が `attachments[]` を受け付け、ユーザーメッセージの `message_id` に紐づけて `attachments` テーブルに保存。`/api/conversations/[id]` で各メッセージの `attachments` 配列を返却。添付あり/なし両パターンのテスト追加。 |
| **BE-12** | review | スタッフ会話検索 API | **Step 1**: `app/api/admin/conversations` (一覧) を実装（staff認証必須）。<br>**Step 2**: フィルタ（email/from/to/keyword）とページネーションを追加。<br>**Step 3**: `app/api/admin/conversations/[id]`（詳細）を実装。<br>テスト12件追加（認可/フィルタ/ページネーション/詳細）。 |
| **BE-13** | review | admin/grant API | **Step 1**: `app/api/admin/grant/route.ts` を実装（`requireStaff()` + `GRANT_ALLOWED_EMAILS` チェック）。<br>**Step 2**: `app_user.role` 更新 + `auth.admin.updateUserById` で `app_metadata.role` 同期。<br>**Step 3**: `audit_grant` テーブルに監査ログ記録。<br>**Step 4**: GET エンドポイント（スタッフ一覧 + 操作履歴）を実装。<br>仕様: `docs/admin/grant.md` |
| **BE-14** | review | 月次レポート生成 API | **Step 1** (review): `monthly_report` テーブルマイグレーション + 型定義 + MockQuery 対応。RLS: 生徒=自分のみ/スタッフ=全件/書込=Service Role のみ。<br>**Step 2-6** (review): `POST /api/reports/monthly` 実装（Cron/手動認証、月末判定、統計集計、LLM分析、DB保存、Resend通知）。テスト15件追加。<br>仕様: `docs/reports/monthly.md` |
| **BE-15** | review | レポート閲覧・CSV API | **Step 1** (review): `GET /api/reports/monthly` 実装（生徒=自分のみ、スタッフ=全員＋ページネーション）。`requireAuth` ヘルパー追加。<br>**Step 2** (review): `GET /api/reports/monthly/csv` 実装（スタッフのみ、text/csv＋BOM＋Content-Disposition）。<br>**Step 3** (review): `src/features/reports/toCsv.ts` ユーティリティ（CSV インジェクション防止）。テスト17件追加。 |
| **BE-16** | review | 監視・通知ユーティリティ | (実装済み) **Step 1**: `src/shared/lib/notifier.ts` を作成。S1=Resend メール即時送信、S2=console.warn、S3=console.info。5分デバウンス付き。テスト13件追加(`tests/shared/lib/notifier.test.ts`)。<br>**Step 2**: `/api/chat`(S1: LLM全経路失敗)、`/api/reports/monthly` POST(S1: レポート生成失敗) / GET(S2: 参照エラー) に通知連携。 |
| **BE-17** | review | レート制限/使用量カウンター | (実装済み) **Step 1**: `usage_counters` / `rate_limiter` テーブルのマイグレーション＋型定義追加。Mock supabase に新テーブル反映。<br>**Step 2**: `src/shared/lib/rateLimit.ts` を作成。分間レート制限（10 req/min）+ 月間クォータ（100 問/月, `MONTHLY_QUOTA` env で調整可）+ 利用カウンタ増分。`resolveAppUserId` で auth_uid→app_user.id 解決。<br>**Step 3**: `/api/chat` に統合。認証後に分間・月間チェック、`onFinish` で利用カウンタ +1。429 応答時は S2 通知。テスト16件追加(`tests/shared/lib/rateLimit.test.ts`)。 |

### 3. フロントエンド実装 (FE)

ここが一番「動いている感」が出る部分です。小さく作っていきましょう。

| ID | Status | 概要 | 詳細ステップ (Step) |
|----|--------|------|------|
| **FE-01** | review | `/admin/allowlist` UI | **Step 1 (表示/検索)**: (完了) `app/admin/allowlist/page.tsx` でデータ表示と検索絞り込みを実装済み。<br>**Step 2 (更新)**: (完了) 各行にステータス変更用ドロップダウンを配置し、API (PATCH) とつなぎこんで更新できるようにした。<br>**Step 3 (UX向上)**: (一部完了) 簡易的なリロード処理で対応済み。 |
| **FE-02** | done | Allowlist hooks | (完了) `useAllowlistQuery` および `useAllowlistMutations` (create, update, importCsv) 実装済み。 |
| **FE-03** | done | CSV アップロード UI | **Step 1 (UI)**: (完了) `src/features/admin/allowlist/components/CsvImportForm.tsx` を作成。<br>**Step 2 (Parser)**: (完了) クライアントサイドでのパース実装済み（Shift_JIS対応）。<br>**Step 3 (Integration)**: (完了) API統合済み。<br>**Step 4 (Validation)**: (完了) CSVフォーマット簡易チェック実装済み。<br>**Step 5 (Doc)**: (完了) `docs/manual/csv_import.md` を作成済み。 |
| **FE-04** | done | 学生向け警告表示 | **Step 1 (RLS設定)**: (完了) `allowed_email` に `SELECT` 許可ポリシーを追加済み。<br>**Step 2 (データ取得)**: (完了) `useMyAllowlistStatus` 実装済み。<br>**Step 3 (警告UI)**: (完了) `AccountStatusBanner` 実装済み。<br>**Step 4 (配置)**: (完了) `app/layout.tsx` にバナーを配置済み。 |
| **FE-05** | review | チャット画像添付 UI | (実装済み) `useImageAttachments` フック（ファイル選択・バリデーション・署名URLアップロード・プレビュー管理）と `ImagePreviewBar` コンポーネント（サムネイル・ファイル名/サイズ表示・削除ボタン）を新規作成。`ChatInterface` に統合（📎ボタン・ドラッグ&ドロップ・エラー表示・アップロード中状態）。添付メタデータを `/api/chat` の `body.attachments` に送信。 |
| **FE-06** | review | 添付画像の表示 | (実装済み) `ChatLoader` が API レスポンスの `attachments` を抽出しメッセージ ID ごとにマップ化。`MessageBubble` に `AttachmentThumbnails` サブコンポーネントを追加（Supabase Storage 署名 URL でサムネイル描画、最大幅 320px、スケルトンローディング）。`ImageLightbox` モーダルでクリック拡大表示（Escape / 背景クリックで閉じる）。 |
| **FE-07** | review | スタッフ会話検索 UI | **Step 1**: `/admin/conversations` ページを作成（検索フィルタ + 一覧テーブル）。<br>**Step 2**: 会話詳細パネル（メッセージ＋添付情報）を表示。<br>**Step 3**: ページネーション・空状態・エラー状態を整備。<br>hooks: `useConversationsQuery`, `useConversationDetail`。components: `ConversationSearchForm`, `ConversationDetail`。 |
| **FE-08** | review | 生徒用レポートページ | **Step 1**: `/reports` ページを作成（月選択 + 記事風レポート表示）。<br>**Step 2**: `react-markdown` + `remark-gfm` で Markdown レンダリング（note/Zenn風の1カラムデザイン）。<br>**Step 3**: チャット画面から「📊 レポート」ボタンで遷移できるようにする。<br>**Step 4**: 未生成月の表示（「まだ生成されていません」）を実装。 |
| **FE-09** | review | スタッフ用レポート管理 UI | **Step 1**: `/admin/reports` ページを作成（全生徒レポート一覧 + ステータス表示）。<br>**Step 2**: 手動生成（dry-run / 本実行）ボタンを配置。<br>**Step 3**: 失敗生徒の個別再生成ボタン。<br>**Step 4**: CSV ダウンロードボタンを配置。 |
| **FE-10** | review | スタッフ権限付与 UI | **Step 1**: `/admin/grant` 画面でメール入力→権限付与。<br>**Step 2**: 現在のスタッフ一覧 + 操作履歴を表示。<br>**Step 3**: 解除ボタン・確認ダイアログ・バリデーション。<br>仕様: `docs/admin/grant.md` |

### 4. テスト & QA (QA)

作ったものが壊れていないか確認する作業です。

| ID | Status | 概要 | 詳細ステップ (Step) |
|----|--------|------|------|
| **QA-01** | done | RLS/Allowed Email テスト | **Step 1**: (完了) `scripts/verify-rls.ts` を作成。<br>**Step 2**: 匿名/未許可ユーザーで0件、許可ユーザーで1件のみ閲覧できることを検証済み。 |
| **QA-02** | done | API 統合テスト | **Step 1**: `/api/admin/allowlist` に対し、正常なデータを送って 200 OK が返るかテストする。<br>**Step 2**: 不正なデータ（メールアドレス形式違反など）を送って 400 Bad Request が返るかテストする。（`tests/api/admin/allowlist.test.ts` で実装済み） |
| **QA-03** | review | フロント E2E | (実装済み) `docs/e2e-manual-test-plan.md` を新規作成: 9シナリオ（生徒ログイン→質問→回答→履歴、画像添付、アクセス拒否、スタッフ許可メール管理、会話検索、月次レポート、権限付与、レポート閲覧、非機能）。受け入れ基準 S-01〜S-12 / T-01〜T-11 / N-05,07,10 を網羅。`docs/testing.md` に参照リンク追加。 |
| **QA-04** | done | チャット永続化の回帰テスト | **Step 1 (done)**: 保存→一覧→詳細のハッピーパスを API 統合テストで実装。<br>**Step 2 (done)**: トークンなし/期限切れで 401/403 になることを確認するテストを追加。 |
| **QA-05** | review | スクリプトテスト | (実装済み) `scripts/seed-allowlist.ts` に `--dry-run` フラグを追加（CSV パース+バリデーションのみ、DB 書き込みなし）。`tests/scripts/seed-allowlist.test.ts` を新規作成: parseArgs フラグ解析(6件) + サンプル CSV dry-run パース検証(7件) = 計13テスト。スクリプト冒頭に使い方ドキュメントを明記。 |
| **QA-06** | review | `/api/admin/allowlist` API テスト | (QA-02に統合) |
| **QA-07** | review | Supabase モック E2E | (実装済み) MOCK_SUPABASE を用いたテスト環境整備済み。 |
| **QA-08** | review | 画像添付の統合テスト | (実装済み) `tests/api/attachments-flow.integration.test.ts` を新規作成。署名URL取得→チャット保存→会話詳細取得の一連フローを検証。単一画像・複数画像(3枚)・添付なし・署名失敗・storagePath一貫性の5テストケースを網羅。 |
| **QA-09** | review | スタッフ会話検索テスト | (実装済み) `tests/api/admin/conversations-auth.test.ts` を新規作成。9テストケース: staff で一覧/詳細取得（複数生徒横断）、student トークンで 403、認証なしで 401、無効トークンで 401（一覧/詳細両方）。 |
| **QA-10** | review | 月次レポートテスト | (実装済み) `tests/api/reports/report-flow.integration.test.ts` を新規作成。6テストケース: staff読取でuserId返却、生徒は自分のレポートのみ取得、他生徒のレポート不可、dry-run非永続→本実行永続、単一ユーザー生成+stats検証、userId指定再生成。既存 `monthly.test.ts`(15件) + `report-read.test.ts`(17件) と合わせて計38件。 |
| **QA-11** | review | レート制限テスト | (実装済み) `tests/api/chat-rate-limit.test.ts` を新規作成（QA-12 chat 部分と合同）。5テストケース: 分間レート制限超過で429、月間クォータ超過で429、429レスポンスがJSON Content-Type、正常時200、resolveAppUserId失敗で403。`tests/shared/lib/rateLimit.test.ts`（16件）でユニットレベルも担保。 |
| **QA-12** | review | 運用・通知テスト | (実装済み) chat部分: `tests/api/chat-rate-limit.test.ts` に6テストケース追加。レート制限429でS2通知、月間クォータ429でS2通知、429でS1は発火しない、LLMエラーでS1通知、403で通知なし、正常時通知なし。reports部分: `tests/api/reports/notifier-integration.test.ts` を新規作成。8テストケース: POST生成失敗でS1通知、AppError>=500でS1通知、AppError400で通知スキップ、AppError401で通知スキップ、GET読取失敗でS2通知、staff読取AppError>=500でS2通知、401で通知スキップ、403で通知スキップ。 |
| **QA-13** | review | スタッフ権限付与テスト | **Step 1**: `GRANT_ALLOWED_EMAILS` に含まれるスタッフが付与/解除できる。<br>**Step 2**: 含まれないスタッフは 403 が返る。<br>**Step 3**: `audit_grant` にログが残ることを確認。 |
| **QA-14** | review | レポート UI テスト | (実装済み) `tests/features/admin/reports/hooks.test.tsx` を新規作成。7テストケース: `useReportsQuery` でレポート一覧取得(userId/status含む)・空月、`useReportsMutation` で生成(dryRun含む)・再生成・CSVダウンロード(blob+DOM)・student権限で403。mockFetcherでルートハンドラ直接呼び出し。 |
### 5. 運用 / DevOps (OPS)

| ID | Status | 概要 | 詳細ステップ (Step) |
|----|--------|------|------|
| **OPS-01** | review | Migration ワークフロー整理 | (実装済み) `BE-06` と連動し、CLIコマンド（`db:push:dry` / `db:push`）と本番手順（dry-run → push）を `package.json` / `docs/deployment.md` に反映済み。 |
| **OPS-02** | done | CI 更新 | **Step 1**: (完了) `.github/workflows/test.yml` を作成し、Push時に Lint/Typecheck/Test が実行されるように構成済み。 |
| **OPS-03** | blocked | Allowlist 変更通知設計 | (ユーザー確認待ち) |
| **OPS-04** | review | README 統合反映 | (完了確認) `README.new.md` が削除され、`README.md` に統合されているか確認する。 |
| **OPS-05** | review | Resend セットアップ | (実装済み) `docs/deployment.md` に Resend セットアップセクションを追加: アカウント作成→API キー取得→DNS 検証（SPF/DKIM/DMARC）→ENV 設定→動作確認→トラブルシューティング。手動作業: Resend アカウント作成、DNS レコード追加、Vercel ENV 設定（`RESEND_API_KEY`, `ADMIN_EMAILS`, `MAIL_FROM`）。 |
| **OPS-06** | review | Vercel Cron 設定 | (実装済み) `vercel.json` を新規作成（`55 14 * * *` = 23:55 JST、UTC 指定）。Vercel Cron は GET リクエストのため、GET ハンドラに Cron 認証+月末判定+生成ロジックを追加。`docs/deployment.md` に dry-run/本実行/再生成の curl コマンド例を明記。`docs/reports/monthly.md` の vercel.json 例・Cron 認証説明を修正（UTC 指定、GET メソッド）。 |
| **OPS-07** | review | 監視・通知導入 | **Step 1** (review): `src/shared/lib/notifier.ts` を実装（BE-16 と連動）。S1/S2/S3 重大度方針 + 5分デバウンス + Resend メール送信。<br>**Step 2** (todo): `ADMIN_EMAILS` / `MAIL_FROM` を本番環境に設定（手動作業）。 |
| **OPS-08** | review | 本番環境の秘密情報管理 | (実装済み) `.env.example` を刷新: カテゴリ別コメント付き、全使用中 ENV を網羅（`MONTHLY_QUOTA`, `MOCK_SUPABASE`, `CRON_SECRET` 等を追加）。`docs/deployment.md` の ENV セクションを「必須/任意」テーブル形式に整理、設定場所・デフォルト値・注意事項を明記。 |
| **OPS-09** | todo | Supabase Redirect URL 設定（パスワードリセット用） | **手動作業**: Supabase Dashboard > Auth > URL Configuration > Redirect URLs に `https://<本番ドメイン>/reset-password` を追加する。ローカル開発では `http://localhost:3000/reset-password` も追加が必要な場合あり。GAP-15（パスワードリセット機能）で必要。 |

### 6. チャット機能実装 (CHAT)

教育用AIチャットの中核機能を実装します。

| ID | Status | 概要 | 詳細ステップ (Step) |
|----|--------|------|------|
| **CHAT-01** | done | 技術選定 & セットアップ | **Step 1**: (完了) Vercel AI SDK (`ai`), `openai` SDK をインストール済み。<br>**Step 2**: (完了) 環境変数 (`OPENAI_API_KEY`) を `.env.local` に設定済み。 |
| **CHAT-02** | done | バックエンド API 実装 | **Step 1**: (完了) `/app/api/chat/route.ts` を作成済み。<br>**Step 2**: (完了) `streamText` を用いてOpenAIへのストリーミングリクエストを実装済み。<br>**Step 3**: (完了) システムプロンプトを設定済み。 |
| **CHAT-03** | done | チャット UI 実装 | **Step 1**: (完了) `src/features/chat/components/ChatInterface.tsx` を作成し、`useChat` でメッセージ送受信を行えるようにする。<br>**Step 1.5 (Fix done)**: (完了) Supabase認証トークンを `useChat` に正しく渡すため、コンポーネントを分割してトークン取得後に初期化するように修正済み。<br>**Step 1.6 (Fix done)**: (完了) `toDataStreamResponse` のプロトコル不一致を修正済み。<br>**Step 1.7 (Fix done)**: (完了) Data Stream Protocol使用時、`message.content`が空になる問題を修正 (`MessageBubble`で`parts`からテキスト復元)。<br>**Step 2 (UI)**: (完了) メッセージ表示コンポーネント作成 (`MessageBubble`)。<br>**Step 3 (Markdown)**: (完了) `react-markdown` を導入し、太字やリストを表示できるようにする。<br>**Step 4 (Math)**: (完了) `remark-math`, `rehype-katex` を導入し、数式 ($...$) をきれいに表示できるようにする。<br>**Step 5 (Style)**: (完了) `MemoizedMarkdown` で AIの応答エリアに適切なスタイル（背景色、余白）を適用済み。 |
| **CHAT-04** | progress | 画面統合 | **Step 1 (done)**: `/app/chat/page.tsx` を AllowlistGuard 付きで配置する。<br>**Step 2 (todo)**: チャット画面で自動スクロール（新メッセージ受信時に最下部へ）。 |
| **CHAT-05** | progress | チャット永続化 & 履歴UI | **Blocker解消**: DB パスワード受領済み。<br>**Step 1 (done)**: Supabase スキーマ適用を確認（`db push` 済み）。<br>**Step 2 (done)**: `/api/chat` に onFinish 保存処理を追加し、`conversationId` をヘッダで返す。<br>**Step 3 (done)**: `/api/conversations` (GET 一覧) を実装（limit/cursor、`created_at desc`）。<br>**Step 4 (done)**: `/api/conversations/[id]` (GET 詳細) を実装（messages 昇順）。<br>**Step 5 (done)**: フロント サイドバー最小版を実装（一覧取得→クリックで詳細表示、最新会話で選択更新）。<br>&nbsp;&nbsp;**Step 5-1 (done)**: `ConversationSidebar.tsx` 新規作成（一覧fetch、表示、もっと読む、ハイライト）。<br>&nbsp;&nbsp;**Step 5-2 (done)**: `ChatInterface.tsx` を3層構成に改修（`ChatSession` / `ChatLoader` / `ChatInterface`）。<br>&nbsp;&nbsp;**Step 5-3 (done)**: `app/chat/page.tsx` を2カラムレイアウトに変更。`layout.tsx` で metadata 分離。<br>&nbsp;&nbsp;**Step 5-4 (done)**: APIレスポンス形式に合わせて `ConversationSidebar` の解析を `{ data: [...] }` に修正。<br>&nbsp;&nbsp;**Step 5-5 (done)**: `ChatLoader` で `{ data: { messages: [...] } }` を UIMessage に変換（`parts` 付与）。<br>&nbsp;&nbsp;**Step 5-6 (done)**: サイドバー幅指定の重複を整理。<br>&nbsp;&nbsp;**Step 5-7 (done)**: `tsc --noEmit` 通過＆ブラウザで一覧/詳細/新規作成の動作確認。<br>**Step 6 (done)**: 保存→一覧→詳細の統合テストを1件追加。 |
| **CHAT-06** | done | 画像添付チャット | **Step 1 (done)**: `SPEC-08` 確定済み（`docs/attachments.md`）。JPEG/PNG/WebP、5MB/枚、3枚/メッセージ、1280px圧縮。<br>**Step 2 (done)**: `BE-08`(attachments テーブル+RLS), `BE-09`(Storage バケット手順), `BE-10`(署名URL API), `BE-11`(チャット保存で添付永続化) と `FE-05`(画像添付 UI), `FE-06`(添付画像表示+ライトボックス) をすべて実装済み。<br>**Step 3 (done)**: `QA-08` で署名→チャット保存→会話詳細の統合テスト 5 ケースを通過。 |

### 7. Gap Fix（GFX）— 未決定事項の修正

`docs/AI-Generated01/03_gap_analysis_and_proposals.md` で洗い出された GAP-01〜GAP-27 を修正するタスク群。
プロンプト集は `docs/AI-Generated01/04_fix_gap_commands.md` を参照。

#### Sprint 1: 認証・セキュリティ基盤

| ID | Status | 対応 GAP | 概要 | 詳細 |
|----|--------|---------|------|------|
| **GFX-01** | done | GAP-01 | ログイン後ロール別ルーティング | `app/login/page.tsx` で `/api/sync-user` のレスポンス（role, allowedEmailStatus）に応じて生徒→`/chat`、スタッフ→`/admin/allowlist` にルーティング。pending は待機画面、revoked/not-found はエラー表示。 |
| **GFX-02** | done | GAP-02 + GAP-11 | Middleware 認証ガード + /chat-test 本番非公開化 | `middleware.ts` を新規作成。`@supabase/ssr` で Supabase セッション cookie を検証し、未認証ユーザーを `/login` にリダイレクト。本番環境で `/chat-test` を遮断。 |
| **GFX-03** | done | GAP-03 | ログアウト機能 | 全ページ（`/chat`, `/reports`, `/admin/*`）のヘッダーにログアウトボタンを追加。`supabase.auth.signOut()` → `/login` にリダイレクト。共通フック `useLogout` を実装。 |
| **GFX-04** | done | GAP-14 | Error Boundary 追加 | `app/error.tsx`（ルートレベル）と `app/chat/error.tsx`（チャット専用）を作成。再試行ボタン + ホームリンク付き。開発環境のみエラー詳細を表示。 |

#### Sprint 2: UX 安定化

| ID | Status | 対応 GAP | 概要 | 詳細 |
|----|--------|---------|------|------|
| **GFX-05** | done | GAP-04 | セッション有効期限管理 | `onAuthStateChange` の `SIGNED_OUT` / `TOKEN_REFRESHED` イベントを適切にハンドリング。セッション切れ時にモーダル表示。`SessionExpiredModal` コンポーネント追加。 |
| **GFX-06** | done | GAP-05 | ネットワークエラー/オフライン対応 | `useNetworkStatus` フック + `OfflineBanner` コンポーネント。ChatInterface の `onError` を改善し、`alert()` からインライン表示に変更。 |
| **GFX-07** | done | GAP-16 | モバイル会話サイドバー対応 | `app/chat/page.tsx` にハンバーガーメニューボタン + ドロワー表示を追加。会話選択時にドロワー自動閉じ。デスクトップ表示はそのまま維持。 |
| **GFX-08** | done | GAP-25 | loading.tsx / not-found.tsx 追加 | `app/loading.tsx`（グローバルスピナー）、`app/not-found.tsx`（カスタム404）、`app/chat/loading.tsx`（スケルトン UI）を作成。 |

#### Sprint 3: プロダクト品質向上

| ID | Status | 対応 GAP | 概要 | 詳細 |
|----|--------|---------|------|------|
| **GFX-09** | done | GAP-06 | React ConfirmDialog 化 | `src/shared/components/ConfirmDialog.tsx` を作成。管理画面（`/admin/grant`, `/admin/reports`, `/admin/allowlist`）の `window.confirm/alert` を全て置換。Escape キー対応。 |
| **GFX-10** | done | GAP-07 | 会話削除機能 | `DELETE /api/conversations/[id]` API を実装（RLS で本人のみ）。ConversationSidebar にゴミ箱アイコン + 確認ダイアログ付き削除ボタン。CASCADE DELETE で messages/attachments も削除。 |
| **GFX-11** | done | GAP-10 | /admin ダッシュボード化 | `app/admin/page.tsx` をカードリンクのダッシュボードに全面書き替え。許可リスト管理・権限管理・会話検索・レポート管理の4枚。レスポンシブ対応。 |
| **GFX-12** | done | GAP-15 | パスワードリセット機能 | `app/login/page.tsx` に「パスワードを忘れた方」リンク追加。`app/reset-password/page.tsx` を新規作成（`PASSWORD_RECOVERY` イベント検知 + `updateUser` でパスワード更新）。 |

#### Sprint 4: パフォーマンス・セキュリティ堅牢化

| ID | Status | 対応 GAP | 概要 | 詳細 |
|----|--------|---------|------|------|
| **GFX-13** | done | GAP-08 | 署名 URL 期限切れ時の自動再取得 | `MessageBubble.tsx` の `AttachmentThumbnails` に `onError` ハンドラ追加。期限切れ検知時に Supabase Storage の `createSignedUrl` で自動再署名（1回リトライ）。 |
| **GFX-14** | done | GAP-13 | 会話検索 N+1 クエリ最適化 | `GET /api/admin/conversations` で PostgreSQL `COUNT() GROUP BY` + `OFFSET/LIMIT` に変更。JS 側の全件取得→スライスを排除。 |
| **GFX-15** | done | GAP-17 + GAP-26 | サーバーサイドバリデーション強化 | `POST /api/chat` で `attachments.length <= MAX_ATTACHMENTS_PER_MESSAGE`（3枚）と最新メッセージの文字数（2000文字以内）をサーバー側で検証。超過時は 400。 |
| **GFX-16** | done | GAP-18 | 生徒向け利用状況表示 | `GET /api/usage` エンドポイントを追加（当月の `usage_counters` 集計）。チャット画面ヘッダーに「残り 87/100」表示。残り20%で黄色、5%で赤色。 |
| **GFX-17** | done | GAP-22 | チャット入力 textarea 化 | `ChatInterface.tsx` の `<input>` を `<textarea>` に変更。`rows=1` + JS auto-resize + `max-height` スクロール。Shift+Enter で改行、Enter で送信。 |
| **GFX-18** | done | GAP-21 | 管理画面の添付画像表示 | `ConversationDetail` に `AttachmentThumbnails` を統合。`/api/admin/attachments/signed-url` エンドポイントを追加（Service Role で署名）。 |

#### UAT 発見 Hotfix / Critical

| ID | Status | 対応 GAP | 概要 | 詳細 |
|----|--------|---------|------|------|
| **GFX-27** | done | GAP-10 (残作業) | スタッフリダイレクト先修正 | `app/login/page.tsx` で `router.push('/admin')` に修正（`/admin/allowlist` → `/admin`）。1 行変更。 |
| **GFX-28** | done | (新規) | UsageBadge リアルタイム更新 | `onMessageComplete` コールバックで `usageRefreshKey` をインクリメントし、AI 応答完了後に使用量表示を再取得。 |
| **GFX-29** | done | (新規) | 会話継続・メッセージ永続化・時系列修正 | `sendMessage` の `body.conversationId` で既存会話に追記。`messages` テーブルに `seq BIGSERIAL` 列追加で時系列保証。オーナーチェック付き。 |
| **GFX-30** | done | (新規) | HEIC/HEIF 画像のクライアント変換 | `heic2any` で iPhone の HEIC/HEIF 画像をクライアント側で JPEG に自動変換。`CONVERTIBLE_MIME_TYPES` / `INPUT_ACCEPT_TYPES` 定数追加。変換中インジケータ表示。 |
| **GFX-31** | done | (新規) | Image-to-LLM パイプライン | `chat/route.ts` で添付画像の署名 URL を取得し、`streamText` の messages に `ImagePart` として追加。gpt-4o-mini Vision で画像認識回答。 |
| **GFX-32** | done | (新規) | Supabase Storage 設定 | `attachments` バケット作成 + SELECT/INSERT ポリシー設定のマイグレーション SQL。スタッフ全件読み取りポリシー含む。 |
| **GFX-33** | done | (新規) | 画像のみ送信対応 | テキストなし + 画像のみ送信時の messages/attachments DB 保存修正。送信直後のサムネイル即時表示（`localAttachments`）。「構造化データを受信中...」フォールバック改善。 |
| **GFX-34** | todo | (新規) | 会話 ID の URL 管理 | `?c=xxx` searchParams で会話 ID を URL に反映。リロード耐性・新規チャットボタン・自動リロード解消。詳細: `docs/AI-Generated01/04_fix_gap_commands.md` |

---

必要な情報や優先度が変わった場合は、このファイルで随時アップデートしてください。
