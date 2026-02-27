# BE-13: /api/admin/grant API 実装プラン

> 作成日: 2026-02-27
> ステータス: 実装済み（`feat/be-13-admin-grant` ブランチ）

## 概要

スタッフ権限の付与/解除を API として提供する。
手動 DB 操作でのロール変更から、`/api/admin/grant` による安全な操作 + 監査ログ記録に移行。
仕様は `docs/admin/grant.md` に定義済み。

## 変更ファイル一覧

| 操作 | ファイル | 目的 |
|------|---------|------|
| CREATE | `supabase/migrations/20260227000000_be13_audit_grant.sql` | audit_grant テーブル |
| MODIFY | `src/shared/types/database.ts` | AuditGrantRow 型 + Database に追加 |
| MODIFY | `src/shared/lib/supabaseAdmin.mock.ts` | audit_grant テーブル + auth.admin.updateUserById 追加 |
| CREATE | `src/shared/lib/grant.ts` | ドメインサービス（ビジネスロジック） |
| CREATE | `app/api/admin/grant/route.ts` | Route Handler (POST/GET) |
| CREATE | `tests/api/admin/grant.test.ts` | テスト（11ケース） |
| MODIFY | `docs/todo.md` | BE-13 ステータス更新 |

## 実装ステップ

### Step 1: マイグレーション SQL

`supabase/migrations/20260227000000_be13_audit_grant.sql`:

- `audit_grant` テーブル（id, request_id, operator_user_id, target_user_id, action, prev_role, new_role, created_at）
- `idx_audit_grant_target` インデックス
- RLS 有効化（ポリシーなし = Service Role のみアクセス可）

### Step 2: 型定義 (`database.ts`)

- `AuditGrantAction` = `'grant' | 'revoke'`
- `AuditGrantRow` / `AuditGrantInsert` 型を `AuditAllowlistRow` の隣に配置
- `Database['public']['Tables']` に `audit_grant` エントリを追加（Relationships 含む）

### Step 3: Mock 更新 (`supabaseAdmin.mock.ts`)

- `AuditGrantRow` を import に追加
- `TableMap` に `audit_grant: AuditGrantRow[]` を追加
- `MockSupabaseAdminClient.tables` の初期値に `audit_grant: []` を追加
- `auth` プロパティに `admin.updateUserById` メソッドを追加（成功を返すのみ）

### Step 4: ドメインサービス (`grant.ts`)

既存 `allowlist.ts` と同じ構造:

- **`assertGrantAllowed(email)`**: `GRANT_ALLOWED_EMAILS` 環境変数チェック（セミコロン区切り）
- **`executeGrant(payload, operator, requestId)`**: POST 用ロジック
  1. action / email バリデーション
  2. 自己解除防止（`action === 'revoke' && operator.email === target`）
  3. `app_user` からターゲット検索 → 404
  4. 重複チェック → 409 (`ALREADY_STAFF` / `ALREADY_STUDENT`)
  5. `app_user.role` 更新
  6. `auth.admin.updateUserById` で `app_metadata.role` 同期
  7. auth 更新失敗時は `app_user.role` ロールバック
  8. `audit_grant` にログ記録
- **`listGrantInfo()`**: GET 用ロジック
  - `app_user` から `role='staff'` を取得
  - `audit_grant` からログ取得 + `app_user` で email 解決（join 非対応のため 2 クエリ）

### Step 5: Route Handler (`app/api/admin/grant/route.ts`)

allowlist route.ts と同じパターン:

- `export const runtime = 'nodejs'`
- **GET**: `requireStaff()` → `assertGrantAllowed()` → `listGrantInfo()` → `jsonResponse()`
- **POST**: `requireStaff()` → `assertGrantAllowed()` → `parseJsonBody()` → `executeGrant()` → `jsonResponse()`
- エラーは全て `errorResponse()` でキャッチ

### Step 6: テスト (`tests/api/admin/grant.test.ts`)

`beforeEach` で `MOCK_SUPABASE=true` + `GRANT_ALLOWED_EMAILS=staff@example.com` を設定。

| # | テストケース | 期待 |
|---|------------|------|
| 1 | POST grant: student → staff | 200, newRole='staff' |
| 2 | POST revoke: staff → student | 200, newRole='student' |
| 3 | POST 非許可スタッフ | 403 GRANT_NOT_ALLOWED |
| 4 | POST 存在しないユーザー | 404 USER_NOT_FOUND |
| 5 | POST 既にスタッフ | 409 ALREADY_STAFF |
| 6 | POST 既に生徒 | 409 ALREADY_STUDENT |
| 7 | POST 自己解除 | 400 SELF_REVOKE_FORBIDDEN |
| 8 | POST 認証なし | 401 UNAUTHORIZED |
| 9 | GET スタッフ一覧 | 200, staffUsers 配列 |
| 10 | GET 非許可スタッフ | 403 GRANT_NOT_ALLOWED |
| 11 | GET 操作後の監査ログ | auditLog にエントリあり |

### Step 7: docs/todo.md 更新

BE-13 ステータスを `review` に変更。

## 検証結果

```
pnpm lint       → clean
pnpm typecheck  → clean
pnpm test       → 54 tests passed (10 files)
```

## リスク / 注意点

- `auth.admin.updateUserById` は Supabase Service Role 必須。Mock では成功レスポンスを返すのみ
- `GRANT_ALLOWED_EMAILS` 未設定時は全スタッフが拒否される（安全側に倒す）
- 本番適用時は `pnpm db:push:dry` → `pnpm db:push` で audit_grant テーブルを作成する必要あり

## 設計判断メモ

- `allowlist.ts` と同じドメインサービスパターンを採用（route handler を薄く保つ）
- auth 更新失敗時のロールバック処理を入れた（app_user.role だけ変わって auth が古いままになる状態を防止）
- GET の auditLog は join 非対応のため 2 クエリで email 解決（MockQuery の制約）
