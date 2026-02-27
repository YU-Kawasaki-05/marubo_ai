# CLAUDE.md — プロジェクト開発メモ

## プロジェクト概要
- 塾向け AI チャットボット（中高生対象、約20名のβ版）
- Next.js 14 App Router + Supabase (Auth/Postgres/Storage) + Vercel AI SDK v6 + TypeScript strict
- AI モデル: gpt-4o-mini（コスト重視）

## 開発ワークフロー
- **ロードマップ**: `memo/prompt/014_Prompts_forAgent.md` に PR 単位のプロンプト集（PR-01〜PR-28 + ゲート A〜D）
- **進捗管理**: `docs/todo.md` に全タスクのステータス
- **AI 実装ノート**: `docs/ai-note/` に各タスクの実装プラン・設計判断を Markdown で記録（レビュー補助用）
- **ブランチ戦略**: `feat/<task-id>-<description>` で作業 → GitHub で Rebase and Merge → ローカル片づけ
- **SSH 問題**: Claude CLI から `git push` / `git push origin --delete` は不可（ssh-agent 未共有）。リモート操作はユーザーが実行する
- **片づけ手順**: `git checkout main` → `git branch -D <branch>` (Claude側) → `git pull origin main && git push origin --delete <branch>` (ユーザー側)

## コーディング規約（`docs/coding-guidelines.md` 参照）
- ファイル冒頭に `/** @file ... */` コメント必須（機能/入出力/依存/セキュリティ）
- Conventional Commits: `feat(scope):`, `fix(scope):`, `docs:` など
- ESLint: singleQuote, no semi, trailingComma 'all', unused-imports/no-unused-imports: error
- import 順序: 外部 → 相対（hooks/utils）→ 相対（components）→ @shared/。newlines-between: always
- コンポーネント: PascalCase、ロジック: camelCase、定数: UPPER_SNAKE_CASE

## API パターン
- 新規 API: `generateRequestId()` → `getBearerToken()` → `parseJsonBody()` → ロジック → `jsonResponse()` / `errorResponse()`
- 認証: `supabase.auth.getUser(token)` でトークン検証
- Admin 操作: `getSupabaseAdminClient()` (Service Role) — Node.js ランタイム限定、クライアント側で絶対使わない
- エラー: `AppError(status, code, message, details)` クラス

## 添付画像機能（BE-08〜11 + FE-05〜06 で実装済み）

### DB
- `attachments` テーブル: `id, message_id, user_id, storage_path, mime_type, size_bytes, created_at`
- RLS: 本人 (`auth.uid() = user_id`) + staff (`app_metadata.role = 'staff'`)
- マイグレーション: `supabase/migrations/20260226000000_be08_attachments.sql`（Gate A-1 で適用済み）

### Storage
- バケット: `attachments`（非公開、`public: false`）
- パス規約: `{user_id}/{uuid}.{ext}`
- **重要**: Storage ポリシー（SELECT/INSERT）は Supabase コンソールで手動設定が必要
  - もし画像が表示されない場合、Supabase Dashboard > Storage > Policies を確認
  - 必要なポリシー: 本人の読み取り（`auth.uid()::text = (storage.foldername(name))[1]`）

### アップロードフロー
1. クライアント: ファイル選択 → バリデーション（MIME: JPEG/PNG/WebP, サイズ: 5MB以下, 枚数: 3枚以下）
2. `POST /api/attachments/sign` → 署名 URL + storagePath 取得
3. クライアント: 署名 URL に `PUT` でアップロード
4. `POST /api/chat` の `body.attachments[]` に `{ storagePath, mimeType, size }` を含めて送信
5. サーバー: `onFinish` で `attachments` テーブルに INSERT

### 表示フロー
1. `GET /api/conversations/[id]` が各メッセージに `attachments[]` を返す
2. `ChatLoader` が `attachmentsByMessageId` マップを構築
3. `MessageBubble` → `AttachmentThumbnails` が Supabase Storage の署名 URL (10分有効) でサムネイル描画
4. クリックで `ImageLightbox` モーダル（拡大表示）

### バリデーション定数（`src/shared/lib/attachmentValidation.ts`）
- `ALLOWED_MIME_TYPES`: image/jpeg, image/png, image/webp
- `MAX_FILE_SIZE_BYTES`: 5MB
- `MAX_ATTACHMENTS_PER_MESSAGE`: 3
- `SIGNED_URL_EXPIRES_IN`: 60秒（アップロード用）

## テスト
- Vitest + カスタム `MockQuery` クラス（Supabase クエリビルダーの模擬）
- `tests/api/chat-conversations.integration.test.ts`: chat保存 → 一覧 → 詳細 + 添付あり/なし
- `tests/api/attachments-sign.test.ts`: 認証/バリデーション/正常系/Storageエラー
- `tests/api/attachments-flow.integration.test.ts`: sign→chat→detail の一連フロー統合テスト（5ケース）
- `tests/api/admin/grant.test.ts`: grant/revoke + 認可/バリデーション/監査ログ（11ケース）
- テスト実行: `pnpm test`（54テスト, 10ファイル）

## 画像添付機能 — 実装済みファイル一覧（トラブルシュート用）

## 各 PR の変更詳細（トラブルシュート用）

### PR-07 (FE-05): ChatInterface 画像添付 UI
- `src/features/chat/hooks/useImageAttachments.ts` — ファイル選択・バリデーション・署名URLアップロード・プレビュー管理
- `src/features/chat/components/ImagePreviewBar.tsx` — サムネイル・ファイル名/サイズ表示・削除ボタン
- `src/features/chat/components/ChatInterface.tsx` — 📎ボタン・ドラッグ&ドロップ・エラー表示・アップロード中状態・`body.attachments` 送信

### PR-08 (FE-06): 添付画像表示
- `src/features/chat/components/ImageLightbox.tsx` — 拡大モーダル（Escape/背景クリックで閉じる）
- `src/features/chat/components/MessageBubble.tsx` — `AttachmentThumbnails` サブコンポーネント追加、Supabase Storage 署名 URL でサムネイル描画（max 320px）
- `src/features/chat/components/ChatInterface.tsx` — `ChatLoader` が API の `attachments` を抽出し `attachmentsByMessageId` マップで `MessageBubble` に受け渡し
- **注意**: Storage ポリシー未設定だと `createSignedUrl` が失敗し画像表示不可

### PR-09B (QA-08): 画像添付フロー統合テスト
- `tests/api/attachments-flow.integration.test.ts` — DB + Storage 統合モック、5テストケース
- MockQuery に `storage.from().createSignedUploadUrl()` モックを統合
- テストケース: 単一画像、複数画像(3枚)、添付なし、署名失敗、storagePath一貫性

### PR-10 (BE-13): admin/grant API
- `supabase/migrations/20260227000000_be13_audit_grant.sql` — audit_grant テーブル + RLS
- `src/shared/types/database.ts` — `AuditGrantRow` / `AuditGrantInsert` 型追加
- `src/shared/lib/grant.ts` — `assertGrantAllowed` / `executeGrant` / `listGrantInfo`
- `app/api/admin/grant/route.ts` — POST（grant/revoke）+ GET（スタッフ一覧・監査ログ）
- `src/shared/lib/supabaseAdmin.mock.ts` — `audit_grant` テーブル + `auth.admin.updateUserById` モック
- `tests/api/admin/grant.test.ts` — 11テストケース
- 実装プラン: `docs/ai-note/be-13-admin-grant-plan.md`

### CHAT-06: 完了整合チェック（ドキュメント更新のみ）
- `docs/todo.md` — CHAT-06 ステータスを `done` に更新（Step 2: BE-08~11+FE-05~06 完了、Step 3: QA-08 完了）
- `docs/troubleshooting.md` — Storage パス規約を `{user_id}/{uuid}.{ext}` に修正、既知制約テーブル追加（形式/サイズ/枚数/署名URL有効期限/再試行/保持期間）
- `docs/testing.md` — 画像添付テストセクション追加（自動テスト3ファイル一覧 + 手動確認8項目）

## 完了した PR 一覧（全体）
| PR | タスク | 内容 |
|----|--------|------|
| PR-04 | BE-08/09 | attachments テーブル + RLS + Storage バケット手順書 |
| Gate A-1 | — | `pnpm db:push` で attachments マイグレーション適用 |
| PR-05 | BE-10 | `POST /api/attachments/sign` 署名 URL API |
| PR-06 | BE-11 | `/api/chat` 添付永続化 + `/api/conversations/[id]` 添付返却 |
| PR-07 | FE-05 | ChatInterface 画像添付 UI（選択/プレビュー/アップロード） |
| PR-08 | FE-06 | MessageBubble 添付画像表示 + ImageLightbox 拡大表示 |
| PR-09B | QA-08 | 画像添付フロー統合テスト（sign→chat→detail、5ケース） |
| PR-09 | CHAT-06 | 画像添付機能の完了整合チェック（ドキュメント更新のみ） |
| PR-10 | BE-13 | `/api/admin/grant` POST/GET + audit_grant テーブル + テスト11件 |

## 次の作業候補（`memo/prompt/014_Prompts_forAgent.md` 参照）
- PR-11以降: 会話検索、月次レポートなど

## 既知の問題・注意点
- `docs/situation/001_20260215.md` が unstaged deleted として常に表示される（スコープ外、無視してよい）
- Storage ポリシー未設定だと画像表示が失敗する（Supabase コンソールで要確認）
- 署名 URL は有効期限あり（表示用10分、アップロード用60秒）。長時間放置で期限切れ
- `pnpm build` は Supabase 環境変数が必要（CI/ローカルでは NEXT_PUBLIC_SUPABASE_URL 等が必要）
