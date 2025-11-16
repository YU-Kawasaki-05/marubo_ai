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
* **初回ログイン**：`/api/sync-user` が **Service Role** で `app_user` テーブルに upsert
  * `email` は小文字化して保存
  * `role` は常に `student` で作成/更新
* **ロール昇格**：`/api/admin/grant` など **Service Role + `x-internal-token: ${ADMIN_TASK_TOKEN}`** を要求する内部 API のみが実施
  * Supabase Auth の `app_metadata.role` と `app_user.role` を同期
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
4. Supabase が JWT を発行（初回は app_metadata.role = null）
   ↓
5. クライアントが /api/sync-user を呼び出し
   ↓
6. Service Role で app_user テーブルに upsert（role = 'student'）
   ↓
7. （必要に応じて）管理者が /api/admin/grant を実行し role = 'staff' に昇格
   ↓
8. ユーザーが再ログイン → 新しい JWT（app_metadata.role = 'staff'）を取得
```

### クライアント書き込み禁止

* **すべての DB 書き込みはサーバー API 経由**
* クライアントから Supabase への直接 INSERT/UPDATE/DELETE は RLS で拒否
* Service Role を使う API は **Node.js ランタイム強制**（`export const runtime = 'nodejs'`）

---

## Service Role の扱い

### ✅ 使用が許可される場所

* **Node.js ランタイムのサーバー API のみ**
  * `/app/api/chat/route.ts` — LLM 応答を DB に保存
  * `/app/api/sync-user/route.ts` — 初回ログイン時のユーザー作成
  * `/app/api/admin/grant/route.ts` — ロール昇格（内部トークン必須）
  * `/app/api/reports/monthly/route.ts` — 月次集計

### ❌ 使用が禁止される場所

* **クライアント側** — 絶対に NG
* **Edge Runtime** — 環境変数リークの可能性
* **`NEXT_PUBLIC_*` 環境変数** — クライアントに公開されるため NG

### Service Role 使用時の注意

* RLS を**バイパス**するため、WHERE 句で必ず `user_id` などを検証
* 意図しないデータ削除/更新を防ぐため、トランザクションと検証を徹底
* ログに Service Role 使用箇所を記録し、監査可能にする

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

* **有効期限**：60 秒（`expiresIn: 60`）
* **発行場所**：`/api/attachments/sign` — Service Role で署名
* **アップロード**：クライアントが署名 URL へ直接 PUT
* **失敗時**：1 回だけ自動再発行を試みる

### パス規約

```
{user_id}/{conversation_id}/{message_id}/{uuid}.{ext}
```

* `user_id`：所有者を明示
* RLS で自分のパス or スタッフのみ閲覧可能
* 削除時は `storage.objects` から該当パスを削除

### MIME タイプチェック

* **許可**：`image/jpeg`, `image/png`, `image/webp`
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
