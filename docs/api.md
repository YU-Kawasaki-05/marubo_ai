# API Specification

本書では、Next.js Route Handlers で実装される **API の I/O・エラー形式・認証/認可要件** をまとめる。
目的は、クライアント/サーバー間の契約を固定し、変更時の影響範囲を即座に把握できるようにすること。

## 共通仕様

| 項目 | 内容 |
|------|------|
| ベースパス | `/api/*`（Next.js App Router、全エンドポイントで `export const runtime = 'nodejs'` を強制） |
| 認証 | Supabase Auth のアクセストークンを `Authorization: Bearer <token>` で送信。管理系 API は追加で `x-internal-token` or `requireStaff()` を課す |
| エラー形式 | `{ "requestId": string, "error": { "code": string, "message": string, "details"?: Record<string, string> } }` |
| 正常レスポンス | `{ "requestId": string, "data": ... }` 形式で統一 |
| ログ | すべての Handler が `requestId` を生成し、AppError 発生時は Resend/Sentry に通知 |

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

## 既存 API（抜粋）

| パス | 内容 |
|------|------|
| `POST /api/chat` | 会話 + LLM 呼び出し（Service Role 書き込み） |
| `POST /api/attachments/sign` | Storage 署名 URL を発行。`expiresIn=60s` |
| `POST /api/reports/monthly` | 月次レポート生成。Cron / 管理 UI から呼び出し |
| `POST /api/admin/grant` | 管理者ロールの付与。`x-internal-token` 必須 |

各エンドポイントの詳細は別セクションで随時更新予定。許可リスト導入に伴い、`/api/chat` なども `requestId` を共有し、インシデント時に `/api/sync-user` の記録と突き合わせられるようにする。

---

## LLM フォールバック戦略（メモ）

許可リスト追加に伴う変更は無いが、すべての API が `requestId` を共有することで、LLM エラー通知に「どの生徒が実行したか」を追跡できる。`/api/chat` の実装では `requestId` を `conversation.request_id` に書き込み、月次レポートや監査で利用する。

