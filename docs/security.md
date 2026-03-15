# Security Policy

本書では、本システムに必要な **アプリケーション・インフラ・データ保護** のセキュリティ項目を整理する。
目的は、教育領域の個人情報を安全に扱い、重大インシデントの発生確率を低減することである。

## 本書で扱う内容
- RLS と JWT の役割分担
- Service Role の扱い（Node runtime 限定）
- ヘッダ（CSP/HSTS/Permissions-Policy 等）
- ストレージ（署名 URL / MIME チェック）
- メール（SPF/DKIM/DMARC）

---

## 認証システム

### Supabase Auth（Google OAuth）

* **プロバイダー**：Google OAuth 2.0
* **初回ログイン**：`/api/sync-user` が **Service Role** で `allowed_email` テーブルを照合し、`status = 'active'` のメールのみ `app_user` に upsert
  * `email` は小文字化して保存（`allowed_email` / `app_user` どちらも小文字一意）
  * `role` は常に `student` で作成/更新。許可リストに無いメールは 403 を返し、クライアントに「塾に連絡してください」と表示する
* **ロール昇格**：`/api/admin/grant` は **`requireStaff()` + `GRANT_ALLOWED_EMAILS` チェック** で認可
  * Supabase Auth の `app_metadata.role` と `app_user.role` を同期
  * 操作可能なユーザーは `GRANT_ALLOWED_EMAILS` 環境変数で2名に制限（サーバー側のみ、`NEXT_PUBLIC_*` にはしない）
* **JWT 発行**：`app_metadata.role` を含む JWT をクライアントへ発行
* **RLS 判定**：発行された JWT の `app_metadata.role` を RLS が参照し、**生徒=自分のみ / スタッフ=全件** を保証

### 認証フロー

```
1. ユーザーが Google ログインボタンをクリック
   ↓
2. Supabase Auth が Google OAuth へリダイレクト
   ↓
3. Google 認証後、Supabase へコールバック
   ↓
4. Supabase が JWT を発行
   ↓
5. クライアントが /api/sync-user を呼び出し
  ↓
6. Service Role で allowed_email を照合し、`status='active'` なら
   app_user テーブルに upsert（role = 'student'）
   + auth.admin.updateUserById で app_metadata.role = 'student' を設定
   （既存ユーザーで app_metadata.role が未設定の場合もリカバリ設定）
   ↓
7. （必要に応じて）管理者が /api/admin/grant を実行し role = 'staff' に昇格
   ↓
8. ユーザーが再ログイン → 新しい JWT（app_metadata.role = 'staff'）を取得
```

### Next.js Middleware 認証ガード

* `middleware.ts` を設置し、`/chat`、`/reports`、`/admin/*` へのリクエスト時に **Supabase セッション Cookie を SSR レベルで検証**
* 未認証の場合は `/login` に 302 リダイレクト（HTML/JS バンドルのダウンロードを防止）
* `/chat-test` は本番環境（`NODE_ENV === 'production'`）でブロック
* 依存: `@supabase/ssr`（Cookie ベースのセッション管理）
* **クライアント側の `AllowlistGuard` は二重チェック**として維持（Middleware はセッションの有無のみ確認し、allowlist ステータスやロールの詳細判定はクライアント側で行う）

### セッション有効期限管理

* `onAuthStateChange` で `TOKEN_REFRESHED`（自動トークンリフレッシュ）と `SIGNED_OUT`（セッション失効）を監視
* セッション失効時は `SessionExpiredModal` を表示し、ユーザーに再ログインを促す
* 入力中テキストの消失を防ぐため、失効検知後もモーダル表示で遷移を遅延させ、ユーザーがコピーできる猶予を設ける

### ログアウト

* 全ページ（`/chat`、`/reports`、`/admin/*`）のヘッダーまたはサイドバーに **ログアウトボタン** を配置
* `supabase.auth.signOut()` でセッションクリア → `/login` にリダイレクト
* 共有端末でのセキュリティリスクを防止

### クライアント書き込み禁止

* **すべての DB 書き込みはサーバー API 経由**
* クライアントから Supabase への直接 INSERT/UPDATE/DELETE は RLS で拒否
* Service Role を使う API は **Node.js ランタイム強制**（`export const runtime = 'nodejs'`）

---

## サーバーサイドバリデーション

### `/api/chat` の入力検証

| 検証項目 | 制限値 | エラーコード |
|---------|--------|------------|
| 添付画像枚数 | ≤ 3（`MAX_ATTACHMENTS_PER_MESSAGE`） | `TOO_MANY_ATTACHMENTS` (400) |
| メッセージ文字数 | ≤ 2000 文字 | `MESSAGE_TOO_LONG` (400) |

* クライアント側でも同一の制限を適用するが、**サーバー側で必ず再検証**
* API を直接叩くバイパスを防止し、Storage 容量の不正消費や API コストの暴走を阻止

---

## Service Role の扱い

### ✅ 使用が許可される場所

* **Node.js ランタイムのサーバー API のみ**
  * `/app/api/chat/route.ts` — LLM 応答を DB に保存
  * `/app/api/sync-user/route.ts` — 初回ログイン時の許可リスト照合 + ユーザー作成
  * `/app/api/admin/grant/route.ts` — ロール昇格（`requireStaff()` + `GRANT_ALLOWED_EMAILS` 制限）
  * `/app/api/admin/allowlist/route.ts` — 許可メールリスト CRUD（staff UI から呼び出す）
  * `/app/api/reports/monthly/route.ts` — 月次レポート生成（LLM 分析 + DB 保存）
  * `/app/api/admin/attachments/signed-url/route.ts` — スタッフ用添付画像署名 URL 生成

### ❌ 使用が禁止される場所

* **クライアント側** — 絶対に NG
* **Edge Runtime** — 環境変数リークの可能性
* **`NEXT_PUBLIC_*` 環境変数** — クライアントに公開されるため NG

### Service Role 使用時の注意

* RLS を**バイパス**するため、WHERE 句で必ず `user_id` などを検証
* 意図しないデータ削除/更新を防ぐため、トランザクションと検証を徹底
* ログに Service Role 使用箇所を記録し、監査可能にする

---

## 許可メールリスト（allowed_email）

### ステータスと運用

| status    | 役割 | /api/sync-user の動作 | スタッフ UI での表示 |
|-----------|------|------------------------|----------------------|
| `active`  | 利用可能 | `app_user` に upsert しログイン完了 | 緑バッジ | 
| `pending` | 連絡待ち／利用開始前 | HTTP 409 を返し、画面で「まだ利用開始できません」メッセージを表示 | 黄バッジ + 備考必須 |
| `revoked` | 退会 / 一時停止 | HTTP 403 を返し、ログインできない | 赤バッジ | 

* すべてのメールアドレスは小文字で保存する（`allowed_email_lowercase` 制約）。
* 退会処理は `status='revoked'` に変更するだけで即時にログインを抑止できる。
* 受験期など大量更新時は `scripts/seed-allowlist.ts <csv>` を走らせてバルク upsert する。

### RLS ポリシー

* **select/insert/update/delete** は `staff` ロールのみ許可。
* `/app/api/admin/allowlist/route.ts` では Service Role を使うため、必ず `where email ilike any($1)` など絞り込みを行い不正更新を防ぐ。
* ログには `requestId`, `staffUserId`, `operation`（add/activate/revoke/import）を残し、最低 90 日保管する。

### 招待メール運用

生徒を招待する際は、以下の文面テンプレートを使用し、フィッシング詐欺等と誤認されないよう配慮する。
メール送信はシステムから自動送信ではなく、塾の公式メールアドレスから手動（または一斉配信ツール）で送る運用とする。

**件名**: 【重要】AIチャットアプリ「Marubo AI」の利用登録について

**本文**:
```text
生徒の皆様

いつもご利用ありがとうございます。
学習支援AIチャットアプリ「Marubo AI」の利用準備が整いました。

以下の手順でログインを行ってください。

1. アプリURLにアクセス: https://marubo-ai.vercel.app
2. 「Googleでログイン」ボタンを押す
3. 塾に届け出ているGoogleアカウント（このメールを受信しているアドレス）を選択

※ 注意事項
- 許可されたメールアドレス以外ではログインできません。
- エラーが出る場合は、スタッフまでお知らせください。
```

### 管理 UI の要件

* `/admin/allowlist` は `requireStaff()` を通過したユーザーのみ表示し、`allowed_email` の一覧/編集/検索を提供する。
* 変更はすべて `/api/admin/allowlist` API 経由で行い、UI 側ではメールアドレスの正規化（trim + lowercase）を行う。
* CSV インポート/エクスポートは任意だが、アップロード時は 500 行以内に分割し、1 リクエストでトランザクション処理する。

---

## セキュリティヘッダ

### Content-Security-Policy (CSP)

```js
// next.config.js
const isDev = process.env.NODE_ENV !== 'production'

const IMG = ["'self'", 'https://*.supabase.co']
const CONNECT = ["'self'", 'https://*.supabase.co']

const csp = [
  "default-src 'self'",
  "base-uri 'none'",
  "object-src 'none'",
  isDev
    ? "script-src 'self' 'unsafe-eval' 'unsafe-inline'"
    : "script-src 'self'",
  `img-src ${IMG.join(' ')}`,
  `connect-src ${CONNECT.join(' ')}`,
  "style-src 'self' 'unsafe-inline'",  // KaTeX の inline style 許可
  "font-src 'self'",
  "frame-ancestors 'none'",
].join('; ')
```

* **開発環境**：`'unsafe-eval'` を許可（HMR のため）
* **本番環境**：`'unsafe-eval'` を禁止し、外部スクリプトも拒否
* **`img-src`**：Supabase Storage のドメインのみ許可
* **`connect-src`**：Supabase API のドメインのみ許可

### その他のセキュリティヘッダ

```js
// next.config.js
module.exports = {
  async headers() {
    return [
      {
        source: '/(.*)',
        headers: [
          { key: 'Content-Security-Policy', value: csp },
          { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          { 
            key: 'Strict-Transport-Security', 
            value: 'max-age=31536000; includeSubDomains; preload' 
          },
          { 
            key: 'Permissions-Policy', 
            value: 'camera=(), microphone=(), geolocation=()' 
          },
          { key: 'X-Frame-Options', value: 'DENY' },
        ],
      },
    ]
  },
}
```

---

## ストレージセキュリティ

### 署名 URL（短寿命）

* **有効期限**：アップロード用 60 秒 / 表示用 600 秒（10 分）
* **発行場所**：`/api/attachments/sign`（生徒用）/ `/api/admin/attachments/signed-url`（スタッフ用）— Service Role で署名
* **アップロード**：クライアントが署名 URL へ直接 PUT
* **失敗時**：1 回だけ自動再発行を試みる
* **自動リフレッシュ**: `AttachmentThumbnails` コンポーネントの `onError` ハンドラで署名 URL 失効を検知し、1 回だけ自動再署名を試行（GFX-13 で実装）

### パス規約

```
{user_id}/{conversation_id}/{message_id}/{uuid}.{ext}
```

* `user_id`：所有者を明示
* RLS で自分のパス or スタッフのみ閲覧可能
* 削除時は `storage.objects` から該当パスを削除

### MIME タイプチェック

* **許可**：`image/jpeg`, `image/png`, `image/webp`
* **自動変換（クライアント側）**：`image/heic`, `image/heif` → JPEG に変換後アップロード
* **拒否**：実行可能ファイル（`.exe`, `.sh` など）、スクリプト（`.js`, `.html` など）
* アップロード前にクライアント側でチェックし、サーバー側でも再検証

---

## Markdown/LaTeX のサニタイズ

### rehype-sanitize によるフィルタリング

* **拒否**：`<script>`, `onerror`, `javascript:` プロトコル
* **許可**：KaTeX が使用する `span.katex*`, `div.katex-display` などのクラス
* **スキーマカスタマイズ**：`rehype-sanitize` のデフォルトスキーマに KaTeX 用のクラスとタグを追加

### 実装例

```ts
import rehypeSanitize, { defaultSchema } from 'rehype-sanitize'

const customSchema = {
  ...defaultSchema,
  attributes: {
    ...defaultSchema.attributes,
    span: [...(defaultSchema.attributes?.span || []), 'className'],
    div: [...(defaultSchema.attributes?.div || []), 'className'],
  },
  tagNames: [...(defaultSchema.tagNames || []), 'math', 'semantics'],
}

<ReactMarkdown
  rehypePlugins={[[rehypeSanitize, customSchema]]}
>
  {content}
</ReactMarkdown>
```

---

## メールセキュリティ（SPF/DKIM/DMARC）

### Resend 送信ドメイン設定

**必須設定**：

* **SPF**：`v=spf1 include:_spf.resend.com ~all`
* **DKIM**：Resend が提供する公開鍵を DNS に追加
* **DMARC**：`v=DMARC1; p=quarantine; rua=mailto:dmarc@your-domain.example`

### From アドレス

* **From**：`noreply@your-domain.example`（必ず検証済みドメインを使用）
* **Reply-To**：必要に応じて管理者メールアドレスを設定

### 迷惑メール対策

* **件名**：明確で短い（「[塾名] 月次レポート」など）
* **本文**：HTML でリンクを多用しない
* **署名**：会社情報を明記

---

## 環境変数の管理

### Vercel Environment Variables

* **Production**：本番用のシークレット
* **Preview**：PR ごとのプレビュー環境（開発用キー）
* **Development**：ローカル開発（`.env.local`）

### シークレット保護

* **Service Role Key**：Production のみ。Preview/Development は別の開発用キー
* **Admin Task Token**：ランダム生成した 32 文字以上の文字列
* **LLM API Key**：本番用と開発用を分ける

---

## 監視とインシデント対応

### Sentry（任意）

* エラー発生時の自動通知
* スタックトレース・リクエスト情報の記録
* パフォーマンス監視

### Resend によるメール通知

* **S1 以上**：`ADMIN_EMAILS` へ即座に通知
* **開発環境**：`DEV_ALERT_EMAILS` へ通知
* **通知内容**：エラー種別、`requestId`、影響範囲

---

## 関連ドキュメント

* [RLS ポリシー](./rls.md)
* [データベース設計](./database.md)
* [アーキテクチャ](./architecture.md)
* [デプロイメント](./deployment.md)
