# API Specification

本書では、Next.js Route Handlers で実装される **API の I/O・エラー形式・認証/認可要件** をまとめる。
目的は、クライアント/サーバー間の契約を固定し、変更時の影響範囲を即座に把握できるようにすること。

## 共通仕様

| 項目 | 内容 |
|------|------|
| ベースパス | `/api/*`（Next.js App Router）。原則 `export const runtime = 'nodejs'`。例外: `/api/health` は `edge` |
| 認証 | Supabase Auth のアクセストークンを `Authorization: Bearer <token>` で送信。管理系 API は `requireStaff()` を課す（`/api/admin/grant` はさらに `GRANT_ALLOWED_EMAILS` 制限） |
| エラー形式 | `{ "requestId": string, "error": { "code": string, "message": string, "details"?: Record<string, string> } }` |
| 正常レスポンス | `{ "requestId": string, "data": ... }` 形式で統一 |
| ログ | すべての Handler が `requestId` を生成し、AppError 発生時は Resend/Sentry に通知 |

> **現状の実装状況**: `requestId` は `/api/sync-user` と `/api/admin/allowlist` に実装済み。`/api/chat` と `/api/conversations*` には未実装（TODO: 全 API への `requestId` 導入は今後のタスク）。`/api/health` は軽量監視用のため `requestId` 対象外。

---

## `/api/sync-user` — 初回同期 + ロール確認

| | 内容 |
|---|---|
| **Method** | `POST` |
| **Auth** | Supabase セッション必須（クライアントから `supabase.auth.getSession()` で取得） |
| **Runtime** | Node.js（Service Role 使用） |
| **責務** | `allowed_email` テーブルを参照し、生徒アカウントを `app_user` に upsert / ロール情報を返す |

### リクエスト

```json
{}
```

* Body は不要。`Authorization` ヘッダで現在ログイン中のユーザーを判定する。

### 正常レスポンス

```json
{
	"requestId": "sync_01h8z...",
	"data": {
		"appUserId": "e6a5-...",
		"role": "student",
		"allowedEmailStatus": "active"
	}
}
```

`role` は Supabase Auth / `app_user.role` を同期。スタッフなら `staff` が返る。

### ステータスと挙動

| 条件 | HTTP | code | クライアント挙動 |
|------|------|------|-------------------|
| `allowed_email.status = 'active'` | 200 | `OK` | ログイン続行。未登録なら `app_user` を作成 |
| `allowed_email.status = 'pending'` | 409 | `ALLOWLIST_PENDING` | UI で「まだ利用開始できません」と案内 |
| `allowed_email.status = 'revoked'` | 403 | `ALLOWLIST_REVOKED` | 退会済みメッセージ + 塾への連絡を促す |
| 該当メールなし | 403 | `ALLOWLIST_NOT_FOUND` | 不正アクセス扱い。`ADMIN_EMAILS` に通知 |

### フロント表示メッセージと問い合わせ導線

| ステータス | タイトル | 本文例 | CTA |
|------------|----------|--------|-----|
| `pending` | 「利用開始準備中です」 | `まだ入塾手続き（またはスタッフによる承認）が完了していません。手続き完了後に再度ログインしてください。` | `support@{塾ドメイン}`（`NEXT_PUBLIC_SUPPORT_EMAIL`） への `mailto:` ボタン「スタッフに連絡する」。本文末尾で `requestId` を表示し、連絡時に共有してもらう。 |
| `revoked` | 「アカウントが停止されています」 | `このメールアドレスは退会または一時停止状態です。心当たりがない場合はスタッフへご連絡ください。` | 同じく `mailto:` ボタン + 退会理由がある場合は `notes` を UI で表示して補足。 |
| `not-found` | 「許可されていないメールアドレスです」 | `登録されていない Google アカウントでログインしています。別のアカウントをお試しの上、不明点はスタッフへご連絡ください。` | `mailto:` ボタンと `/admin/form/contact` 等問い合わせフォーム（`NEXT_PUBLIC_SUPPORT_FORM_URL`）リンクを併記。 |

* CTA に使用するメールアドレス/フォーム URL は環境変数で注入し、ビルドなしに差し替えられるようにする。
* `ALLOWLIST_NOT_FOUND` を表示した際は `requestId` を UI に必ず表示し、サポート連絡時に添付してもらうことで監査ログと照合できる。

### バリデーション

* `email` は Supabase Auth から取得し、常に `lowercase(trim)` して照合。
* `/api/sync-user` の実行は 1 セッションにつき 1 回ではなく、毎回のページ読み込みで idempotent に呼んでも安全なように設計する。

---

## `/api/chat` — チャット送信 (Streaming)

| | 内容 |
|---|---|
| **Method** | `POST` |
| **Auth** | Supabase セッション必須（ログイン済み全ユーザーが利用可） |
| **Runtime** | Node.js (Edge Runtime ではなく Node.js を利用。※Vercel AI SDK は両対応だが各種ライブラリ互換性のため) |
| **責務** | ユーザーのメッセージ履歴を受け取り、AI の応答をストリーミング形式 (`text/event-stream`) で返す。 |
| **サーバーサイド検証** | 添付枚数 ≤ 3（`MAX_ATTACHMENTS_PER_MESSAGE`）、最新メッセージ文字数 ≤ 2000 文字。超過時は 400 エラー |

### リクエスト

```json
{
  "messages": [
    { "role": "user", "content": "こんにちは" },
    { "role": "assistant", "content": "こんにちは！何かお手伝いしましょうか？" },
    { "role": "user", "content": "数学について教えて" }
  ]
}
```

* `messages`: Vercel AI SDK の `Message` 型配列。
* 画像を含める場合、Vercel AI SDK の仕様に従い `experimental_attachments` や `content` 内の画像URLとして渡すことを想定。

### 正常レスポンス (Streaming)

```
HTTP/1.1 200 OK
Content-Type: text/event-stream
Transfer-Encoding: chunked
x-vercel-ai-ui-message-stream: v1
x-conversation-id: <uuid>
```

* Vercel AI SDK v6 の **UI Message Stream Protocol** (`toUIMessageStreamResponse()`) に従ったストリーム応答。
* クライアント側は `useChat` フックがこれを自動的にパースして状態を更新する。
* `x-conversation-id` ヘッダで保存された会話 ID を返却する。

### エラーレスポンス

ストリーム開始前のエラー（認証切れ、バリデーションエラー等）は通常の JSON エラーを返す。

```json
{
  "error": "Unauthorized"
}
```

ストリーム途中でのエラーは、ストリーム内でエラーチャンクが送信される場合がある。

---

## `/api/conversations` — 会話一覧取得（新規追加）

| | 内容 |
|---|---|
| **Method** | `GET` |
| **Auth** | Supabase セッション必須 |
| **役割** | 指定ユーザー（`auth.uid()`）の会話一覧を返す。 |
| **Query** | `limit` (default 20, max 50), `cursor` (createdAt と id を連結した文字列でページネーション) |

### レスポンス例
```json
{
  "data": [
    { "id": "conv_123", "title": "二次方程式の解の公式を教えて", "createdAt": "2026-01-26T12:00:00Z" },
    { "id": "conv_122", "title": "2026-01-26 11:40", "createdAt": "2026-01-26T11:40:00Z" }
  ],
  "nextCursor": "2026-01-26T11:40:00Z_conv_122"
}
```
> 並び順は `created_at desc` 固定。`cursor` は前回レスポンスの `nextCursor` をそのまま渡す。
>
> **実装状況**: 現在の一覧 API は `created_at`（snake_case）で返却している。`createdAt`（camelCase）への統一は TODO。

## `/api/conversations/[id]` — 会話詳細取得（新規追加）

| | 内容 |
|---|---|
| **Method** | `GET` |
| **Auth** | Supabase セッション必須 |
| **役割** | 指定会話IDのメッセージ一覧を返す。 |
| **Query** | なし（β版では全メッセージを返却。大規模化時に `limit/cursor` 追加を検討） |

### レスポンス例
```json
{
  "data": {
    "id": "conv_123",
    "title": "二次方程式の解の公式を教えて",
    "messages": [
      { "id": "m1", "role": "user", "content": "二次方程式の解の公式を教えて", "createdAt": "2026-01-26T12:00:05Z" },
      { "id": "m2", "role": "assistant", "content": "解の公式は...", "createdAt": "2026-01-26T12:00:06Z" }
    ]
  }
}
```

> 備考: `/api/chat` は onFinish で `conversations/messages` に保存し、生成した `conversationId` をクライアントへ返す仕様に拡張する（別途実装）。

### タイトル生成ルール
- 先頭のユーザー発話から先頭 30–50 文字を採用。
- 話頭が空の場合は `YYYY-MM-DD HH:mm` を採用（例: `2026-01-26 12:00`）。

## `DELETE /api/conversations/[id]` — 会話削除

| | 内容 |
|---|---|
| **Method** | `DELETE` |
| **Auth** | Supabase セッション必須。RLS により本人の会話のみ削除可能 |
| **Runtime** | Node.js |
| **責務** | 指定 ID の会話を物理削除する。`messages` と `attachments` は `ON DELETE CASCADE` で自動削除される |

### レスポンス

| 条件 | HTTP | 説明 |
|------|------|------|
| 削除成功 | 204 | No Content（ボディなし） |
| 未認証 | 401 | `UNAUTHORIZED` |
| 他人の会話を指定 | 403 | `FORBIDDEN` |
| 会話が存在しない | 404 | `NOT_FOUND` |

> **注意**: Storage 上の添付ファイル（`storage.objects`）の物理削除はベストエフォートで実行される。DB のカスケード削除は即時保証。

---

## `GET /api/usage` — 利用状況取得

| | 内容 |
|---|---|
| **Method** | `GET` |
| **Auth** | Supabase セッション必須 |
| **Runtime** | Node.js |
| **責務** | 当月の質問利用数・残数を返却し、クライアントでクォータ表示に利用する |

### レスポンス例

```json
{
  "data": {
    "used": 13,
    "quota": 100,
    "remaining": 87,
    "month": "2026-03"
  }
}
```

> `quota` は環境変数 `MONTHLY_QUOTA`（デフォルト 100）から取得。`used` は `usage_counters` の当月合計。

---

## `POST /api/admin/attachments/signed-url` — 管理者用署名 URL 生成

| | 内容 |
|---|---|
| **Method** | `POST` |
| **Auth** | `requireStaff()` |
| **Runtime** | Node.js |
| **責務** | Service Role で Storage の署名 URL を生成し、スタッフが生徒の添付画像を閲覧できるようにする |

### リクエスト

```json
{
  "storagePath": "user-uuid/abc123.jpg"
}
```

### レスポンス例

```json
{
  "data": {
    "signedUrl": "https://xxx.supabase.co/storage/v1/object/sign/attachments/..."
  }
}
```

> 通常の生徒用署名 URL は RLS ベースだが、スタッフは `app_metadata.role` が JWT に反映されているため Service Role で発行する。

---

## `/api/admin/allowlist` — 許可メール CRUD

| | 内容 |
|---|---|
| **Method** | `GET` / `POST` / `PATCH` |
| **Auth** | `requireStaff()` + Service Role（内部で Supabase Admin Client を使用）。追加で `x-internal-token` は不要 |
| **Runtime** | Node.js |
| **責務** | スタッフ UI（`/admin/allowlist`）から許可メールを登録・検索・更新できるようにする |

### GET `/api/admin/allowlist?status=active&search=gmail`

* クエリパラメータ
	* `status?: 'active' | 'pending' | 'revoked'` — 未指定なら全件
	* `search?: string` — `email ILIKE '%search%' OR label ILIKE '%search%'`

```json
{
	"requestId": "allowlist_01h9...",
	"data": [
		{
			"email": "student01@gmail.com",
			"status": "active",
			"label": "中3Aクラス",
			"notes": "数学強化",
			"updatedAt": "2025-10-01T12:34:56Z",
			"updatedBy": "staff-user-uuid"
		}
	]
}
```

### POST `/api/admin/allowlist`

```json
{
	"email": "student99@gmail.com",
	"status": "active",
	"label": "中3B",
	"notes": "体験入塾"
}
```

* 返信は GET と同様の 1 レコード。
* 既存メールに対して POST した場合は 409 `ALLOWLIST_EXISTS` を返す。

### PATCH `/api/admin/allowlist/:email`

* `:email` は URL エンコードした小文字メールアドレス。
* Body（すべて任意）

```json
{
	"status": "revoked",
	"label": "卒業",
	"notes": "2026/03 退塾"
}
```

* `status` の遷移ルール：
	* `pending → active`：入金確認後などに使用。
	* `active → revoked`：退会。
	* `revoked → active`：再入塾ケース。履歴を残したい場合は `notes` に理由を書く。
* レコードが無い場合は 404 `ALLOWLIST_NOT_FOUND`。

### 監査ログ

* 変更イベントは `audit_allowlist`（Supabase Logflare or Postgres テーブル）に `requestId`, `email`, `prev`, `next`, `staffUserId` を保存する。
* 90 日以上の保管を推奨。

### `/admin/allowlist` UI/UX ガイドライン

* 画面構成
	* 上部に検索ボックス + `status` 絞り込み（`all / active / pending / revoked`）。デフォルトは `active`。
	* テーブル列：`email`, `status`（色付きバッジ）, `label`, `notes`（最大 2 行まで省略表示）, `updatedAt`（相対時刻 + tooltip ISO）, `updatedBy`（displayName or email）, `requestId`（クリックでコピー）。
	* 行アクション：`編集`（モーダルで status/label/notes 変更）、`履歴`（今後の `audit_allowlist` 表示予定）。
* バリデーション
	* `email`：必須。`lowercase(trim)`、最大 320 文字、`@gmail.com`（または指定ドメイン）以外は ⚠️ として保存前に確認ダイアログを出す。
	* `status`：必須。遷移ルールは API セクションの通りで、UI 側でも制御。
	* `label`：0-64 文字。空の場合は `-` 表示。
	* `notes`：0-512 文字。`pending` の場合は必須（利用開始予定日や理由を記載してもらう）。
* フィードバック
	* POST/PATCH/CSV 完了時はトーストに `requestId` を表示し、ユーザーがコピーできるようにする。
	* エラー時は API の `error.code` に応じたメッセージ（`ALLOWLIST_EXISTS`, `ALLOWLIST_NOT_FOUND`, `CSV_VALIDATION_ERROR` など）を表示。

### CSV インポート仕様

| 列 | 必須 | 型/制約 | 説明 |
|----|------|---------|------|
| `email` | ✅ | 文字列 / trim + lowercase / 320 文字以内 | allowlist 対象の Google アドレス。小文字へ正規化して比較 |
| `status` | ✅ | `active` / `pending` / `revoked` | 未指定は `pending` と解釈。UI では select で選ばせる |
| `label` | ⛔️（任意） | 0-64 文字 | クラス名や期 |
| `notes` | ⛔️（任意） | 0-512 文字 | 連絡事項。CSV ではダブルクオートで囲み、改行は不可 |

* 文字コードは UTF-8、1 行目にヘッダ必須。
* 1 ファイル 500 行以内。超える場合は複数回に分ける。
* UI はアップロード後にプレビューを表示し、行ごとの検証結果（OK / Warning / Error）を表示する。Error 行がある場合は全体をコミットせず、修正して再アップロードさせる。

### 重複時の挙動

* **CSV 内重複**：同じ `email` が複数回出現した場合は 400 `CSV_DUPLICATED_IN_FILE` を返し、該当行番号を `details` に含める。UI はその行を赤で表示。
* **DB 既存レコードとの重複**：
	* `mode = 'insert'`（デフォルト）では 409 `ALLOWLIST_EXISTS`。
	* `mode = 'upsert'` を CSV モーダルで選択した場合は `status/label/notes` を上書きし、`updatedBy` を現在のスタッフに設定。レスポンスの `data` には upsert された件数を返す。
* 並列実行を考慮し、サーバー側でも `lower(email)` 一意制約で二重登録を防ぎ、違反時は 409 を UI に伝える。

---

## 全 API 一覧

> ✅ = 実装済み、🚧 = 未実装（仕様確定済み）

| パス | メソッド | 状態 | 内容 |
|------|---------|------|------|
| `/api/health` | GET | ✅ | ヘルスチェック（Edge Runtime） |
| `/api/sync-user` | POST | ✅ | 初回ログイン同期 + ロール確認 |
| `/api/chat` | POST | ✅ | 会話 + LLM 呼び出し（Service Role 書き込み）+ 添付枚数/文字数サーバー検証 |
| `/api/conversations` | GET | ✅ | 会話一覧取得 |
| `/api/conversations/[id]` | GET | ✅ | 会話詳細取得 |
| `/api/conversations/[id]` | DELETE | ✅ | 会話削除（CASCADE DELETE で messages/attachments も削除） |
| `/api/usage` | GET | ✅ | 当月の利用状況（used/quota/remaining）を返却 |
| `/api/admin/allowlist` | GET/POST/PATCH | ✅ | 許可メール CRUD |
| `/api/attachments/sign` | POST | ✅ | Storage 署名 URL を発行。`expiresIn=60s` |
| `/api/admin/attachments/signed-url` | POST | ✅ | スタッフ用添付画像署名 URL（Service Role） |
| `/api/reports/monthly` | POST | ✅ | 月次レポート一括生成（Cron / 管理 UI）。詳細は `docs/reports/monthly.md` |
| `/api/reports/monthly` | GET | ✅ | レポート一覧取得（生徒=自分のみ、スタッフ=全員）。詳細は `docs/reports/monthly.md` |
| `/api/reports/monthly/csv` | GET | ✅ | 全生徒の利用統計 CSV ダウンロード（スタッフのみ） |
| `/api/admin/grant` | POST | ✅ | スタッフ権限の付与/解除。`GRANT_ALLOWED_EMAILS` 制限。詳細は `docs/admin/grant.md` |
| `/api/admin/grant` | GET | ✅ | スタッフ一覧・操作履歴（`GRANT_ALLOWED_EMAILS` 制限） |
| `/api/admin/conversations` | GET | ✅ | 全生徒の会話一覧検索（スタッフのみ）。詳細は `docs/admin/conversations.md` |
| `/api/admin/conversations/[id]` | GET | ✅ | 会話詳細取得（スタッフのみ） |

各エンドポイントの詳細は対応する仕様ドキュメントを参照。

---

## LLM フォールバック戦略（メモ）

`requestId` を全 API に導入することで、LLM エラー通知に「どの生徒が実行したか」を追跡できる。将来的に `conversations` テーブルに `request_id` 列を追加し、月次レポートや監査で利用することも検討。

