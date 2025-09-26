# プロジェクト概要

* **目的**：生徒がテキスト/画像で質問し、AI（数式/Markdown対応）が回答。会話は保存され、塾スタッフ（管理者）が参照できる。月末にスタッフへレポート（CSV/HTML）を自動送付。
* **対象**：生徒（ログイン必須）、スタッフ（管理画面あり）
* **規模**：ユーザー約20名／月1,000問を想定（β）
* **非機能**：

  * モバイル最適化（レスポンシブ）
  * コスト制御（画像圧縮・トークン上限・月間クォータ）
  * セキュリティ（RLSで生徒は自分のデータのみ、スタッフは全件）
* **導線**：LINEリッチメニュー→外部URL（本アプリ）

---

# 技術スタック

## フロントエンド

* **Next.js 14+（App Router, TypeScript, React 18）**
* UI/状態：Tailwind CSS / Zustand（軽量状態管理）
* 表示：`react-markdown` + `remark-gfm` + `remark-math` + `rehype-katex`（LaTeX）
* 画像：`<input type="file">` + 圧縮（ブラウザの`canvas`処理 or `browser-image-compression`）
* テスト：Vitest（`jsdom`環境） + React Testing Library

## バックエンド

* **Supabase**

  * Auth（Google OAuth）
  * Postgres（RLS/ポリシー）
  * Storage（画像）
* **Next.js Route Handlers（/app/api/**）\*\*

  * 会話保存、添付署名URL、LLM呼び出し、管理者API、レポート生成
* メール送信：**Resend**
* スケジュール：**Vercel Cron**（毎月末 23:55 JST）

## 開発・テスト環境

* OS：WSL2（Ubuntu）
* Node：LTS（nvm）
* パッケージ：pnpm
* Lint/Format：ESLint + Prettier
* 型：TypeScript `strict: true`
* 監視：Sentry（任意）

---

# プロジェクト（ディレクトリ）構造（機能単位）

> “機能ごと”にソースを分け、\*\*ルーティングは`app/`、実装は`src/features/**`**へ集約**します。

```
.
├─ app/                             # ルート（Next.js App Router）
│  ├─ (public)                      # 認証不要ページ群（必要なら）
│  ├─ chat/                         # 生徒向けチャット画面（ルート）
│  │  └─ page.tsx
│  ├─ admin/                        # スタッフ向け管理画面（ルート）
│  │  └─ page.tsx
│  ├─ api/                          # Route Handlers（機能別に委譲）
│  │  ├─ chat/route.ts              # POST: メッセージ+画像→AI応答
│  │  ├─ attachments/
│  │  │  └─ sign/route.ts          # 署名URL発行
│  │  ├─ reports/
│  │  │  └─ monthly/route.ts       # 月次レポート生成/送信
│  │  └─ sync-user/route.ts         # ログイン時ユーザー同期
│  └─ layout.tsx / page.tsx / globals.css
│
├─ src/
│  ├─ features/
│  │  ├─ auth/                      # 認証/ユーザー同期/権限
│  │  │  ├─ lib/
│  │  │  │  ├─ guard.ts            # roleチェック・保護ルート
│  │  │  │  └─ getSession.ts       # サーバー側セッション取得
│  │  │  └─ ui/
│  │  │     └─ SignInButton.tsx
│  │  ├─ chat/                      # チャット機能
│  │  │  ├─ lib/
│  │  │  │  ├─ sendMessage.ts      # LLM呼び出し＋保存
│  │  │  │  ├─ compressImage.ts    # 画像圧縮
│  │  │  │  └─ quota.ts            # レート/クォータ管理
│  │  │  └─ ui/
│  │  │     ├─ ChatForm.tsx
│  │  │     └─ MessageList.tsx
│  │  ├─ conversations/             # 履歴・検索
│  │  │  ├─ lib/
│  │  │  │  └─ queries.ts          # 会話/メッセージ取得
│  │  │  └─ ui/
│  │  │     └─ ConversationList.tsx
│  │  ├─ admin/                     # 管理者機能
│  │  │  ├─ lib/
│  │  │  │  └─ search.ts           # 管理検索
│  │  │  └─ ui/
│  │  │     └─ AdminTable.tsx
│  │  └─ reports/                   # レポート
│  │     ├─ lib/
│  │     │  ├─ monthlySql.ts       # 集計SQL
│  │     │  └─ toCsv.ts            # CSV/HTML生成
│  │     └─ jobs/
│  │        └─ runMonthly.ts       # Cronから呼ぶ関数
│  ├─ shared/                       # 共有資産（機能横断）
│  │  ├─ components/                # 汎用UI（ボタン等）
│  │  ├─ hooks/                     # 共通hooks
│  │  ├─ lib/                       # supabase/LLM/メールなど
│  │  │  ├─ supabaseClient.ts
│  │  │  ├─ supabaseAdmin.ts
│  │  │  ├─ llm.ts
│  │  │  └─ mailer.ts
│  │  ├─ types/                     # 共通型定義
│  │  └─ utils/                     # 小ユーティリティ
│  └─ styles/                       # Tailwind等
│
├─ public/                          # 静的資産（katex.css 等）
├─ scripts/                         # one-offスクリプト（seed等）
├─ tests/                           # e2e/統合（任意）※単体は同一ファイル内に記述方針
├─ .env.example
├─ package.json
├─ vitest.config.ts
├─ tsconfig.json
├─ next.config.js
├─ vercel.json
├─ .eslintrc.cjs
└─ .prettierrc
```

---

# データベース設計

## モデル構成（Postgres）

```sql
-- 拡張
create extension if not exists "pgcrypto";

-- ユーザー
create table if not exists app_user (
  id uuid primary key default gen_random_uuid(),
  auth_uid uuid not null unique,               -- Supabase AuthのID
  email text not null unique,
  display_name text,
  role text not null default 'student',        -- 'student' | 'staff'
  created_at timestamptz default now()
);

-- 会話（スレッド）
create table if not exists conversation (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references app_user(id) on delete cascade,
  subject text,                                 -- 教科タグ等
  created_at timestamptz default now()
);
create index if not exists idx_conversation_user_created on conversation(user_id, created_at desc);

-- メッセージ
create table if not exists message (
  id uuid primary key default gen_random_uuid(),
  conv_id uuid not null references conversation(id) on delete cascade,
  sender text not null,                         -- 'user' | 'assistant'
  text text,
  md text,                                      -- 整形済みMarkdown（必要時）
  tokens_in int default 0,
  tokens_out int default 0,
  created_at timestamptz default now()
);
create index if not exists idx_message_conv_created on message(conv_id, created_at);

-- 添付
create table if not exists attachment (
  id uuid primary key default gen_random_uuid(),
  message_id uuid not null references message(id) on delete cascade,
  storage_path text not null,                   -- Supabase Storageのパス
  mime text,
  width int, height int, size_bytes int
);

-- 月次サマリ（ジョブで生成）
create table if not exists monthly_summary (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references app_user(id) on delete cascade,
  month text not null,                          -- 'YYYY-MM'
  questions int default 0,
  by_subject jsonb,                             -- {"英語": 20, ...}
  avg_tokens_per_q numeric,
  top_keywords text[],
  created_at timestamptz default now(),
  unique(user_id, month)
);
```

### RLS（行レベルセキュリティ）方針

* 生徒：**自分のデータのみ** select 可
* スタッフ：**全件** select 可
* 書き込み：原則本人のみ。集計テーブルはサーバー（Service Role）で操作

（ポリシー例）

```sql
alter table app_user enable row level security;
alter table conversation enable row level security;
alter table message enable row level security;
alter table attachment enable row level security;
alter table monthly_summary enable row level security;

create or replace function app_current_role()
returns text language sql stable as $$
  select role from app_user where auth_uid = auth.uid()
$$;

-- app_user
create policy app_user_select_self on app_user
for select to authenticated
using (auth_uid = auth.uid() or app_current_role() = 'staff');

-- conversation
create policy conversation_select on conversation
for select to authenticated
using (
  exists (select 1 from app_user u where u.id = conversation.user_id and u.auth_uid = auth.uid())
  or app_current_role() = 'staff'
);

-- message
create policy message_select on message
for select to authenticated
using (
  exists (
    select 1 from conversation c
    join app_user u on u.id = c.user_id
    where c.id = message.conv_id and u.auth_uid = auth.uid()
  ) or app_current_role() = 'staff'
);

-- attachment
create policy attachment_select on attachment
for select to authenticated
using (
  exists (
    select 1 from message m
    join conversation c on c.id = m.conv_id
    join app_user u on u.id = c.user_id
    where m.id = attachment.message_id and u.auth_uid = auth.uid()
  ) or app_current_role() = 'staff'
);
```

## 環境別 DB 設定

* **dev**：ローカル開発用 Supabase プロジェクト（無料枠）
* **staging**：動作確認用（本番と同構成）
* **prod**：本番。RLS/ポリシーは`staging`で検証後に反映
* **接続情報**：`NEXT_PUBLIC_SUPABASE_URL` / `NEXT_PUBLIC_SUPABASE_ANON_KEY`
  サーバー専用：`SUPABASE_SERVICE_ROLE_KEY`（Route Handlerでのみ使用）

---

# 開発ワークフロー

## セットアップ

```bash
# Node(LTS), pnpm, git は導入済みとする
git clone <repo-url>
cd <repo>

pnpm i

# 環境変数
cp .env.example .env.local
# ↑各キー（Supabase/LLM/Resendなど）を埋める
```

## 開発サーバー起動

```bash
pnpm dev
# http://localhost:3000
```

## テスト実行

```bash
pnpm test         # 一回実行
pnpm test:watch   # 監視モード
pnpm test:cov     # カバレッジ
```

## コード品質チェック

```bash
pnpm lint         # ESLint
pnpm format       # Prettier
pnpm typecheck    # TypeScript
```

## データベース操作

* 迅速に始める：**Supabase SQL Editor** で上記スキーマを適用
* 将来：**Supabase CLI**によるマイグレーション管理に移行推奨
* Seed：`scripts/seed.ts` を用意（Service Roleキーで限定実行）

---

# 認証システム

* **Supabase Auth（Google）**
* 初回ログイン時：`/api/sync-user` で `app_user` に **upsert**（email/role）
* **ロール管理**：`app_user.role` に `'student' | 'staff'`

  * スタッフはメールアドレスでホワイトリスト（`.env`の`ADMIN_EMAILS`）→初回同期時に`staff`付与
* **RLS**でアクセス制御：生徒は自分の会話のみ、スタッフは全件
* **Route保護**：`src/features/auth/lib/guard.ts` でサーバー側判定（roleチェック）
* **セッション**：`supabase-js`でクライアント/サーバー双方から利用

---

# テストガイドライン

* **方針**：**各実装ファイルと同じファイル内**にユニットテストを記述（依頼どおり）

  * `if (import.meta.vitest) { const { describe, it, expect } = import.meta.vitest; ... }`
* フロント：Reactコンポーネントは **React Testing Library**
* 関数：Zodスキーマや純関数は**入出力の例示**を厚めに
* **describeは日本語**で書く
* **pnpm run test が常にパス**することを開発の定義に含める
* **スタイル統一**：ESLint + Prettier を必須実行（pre-commit推奨）

**例（同一ファイルテスト）**：

```ts
// src/shared/utils/sum.ts
/** @file
 * 仕様：2数の合計を返す。数値以外はエラー。
 */
export function sum(a: number, b: number) {
  if (Number.isFinite(a) && Number.isFinite(b)) return a + b
  throw new Error('Invalid number')
}

if (import.meta.vitest) {
  const { describe, it, expect } = import.meta.vitest
  describe('sum: 足し算の基本動作', () => {
    it('2+3=5', () => {
      expect(sum(2,3)).toBe(5)
    })
    it('不正値はエラー', () => {
      expect(()=>sum(NaN,1)).toThrow()
    })
  })
}
```

---

# デプロイメント

* **Vercel**

  * Project作成 → Git連携（mainへpushで自動デプロイ）
  * **Environment Variables**：`NEXT_PUBLIC_*` とサーバー鍵を設定
  * **Cron（月末レポート）**：`vercel.json` にスケジュール設定（JST）
* **Resend**

  * APIキーを`.env`に、差出人ドメイン（SPF/DKIM）を設定すると到達率向上
* **Supabase**

  * prod/stagingに同スキーマ/RLS適用
  * Storageバケット：`attachments`（署名URLでアクセス）

---

# 重要な設定ファイル（抜粋）

### `package.json`（scripts例）

```json
{
  "scripts": {
    "dev": "next dev",
    "build": "next build",
    "start": "next start",
    "lint": "eslint .",
    "format": "prettier -w .",
    "typecheck": "tsc --noEmit",
    "test": "vitest run",
    "test:watch": "vitest",
    "test:cov": "vitest run --coverage"
  }
}
```

### `vitest.config.ts`

```ts
import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    environment: 'jsdom',  // UIテストを想定
    globals: true,
    include: ['src/**/*.ts', 'src/**/*.tsx', 'app/**/*.ts', 'app/**/*.tsx'],
    coverage: { reporter: ['text', 'lcov'] }
  }
})
```

### `.eslintrc.cjs`

```js
module.exports = {
  root: true,
  parser: '@typescript-eslint/parser',
  plugins: ['@typescript-eslint','unused-imports','import'],
  extends: ['next/core-web-vitals', 'plugin:@typescript-eslint/recommended', 'prettier'],
  rules: {
    'unused-imports/no-unused-imports': 'error',
    '@typescript-eslint/consistent-type-imports': 'warn',
    'import/order': ['warn',{ 'newlines-between':'always', 'alphabetize':{order:'asc'} }]
  }
}
```

### `.prettierrc`

```json
{ "singleQuote": true, "semi": false, "trailingComma": "all" }
```

### `tsconfig.json`（抜粋）

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "lib": ["dom", "dom.iterable", "es2022"],
    "strict": true,
    "baseUrl": ".",
    "paths": {
      "@features/*": ["src/features/*"],
      "@shared/*": ["src/shared/*"]
    }
  }
}
```

### `vercel.json`（Cron・JST）

```json
{
  "crons": [
    { "path": "/api/reports/monthly", "schedule": "55 23 L * *", "timezone": "Asia/Tokyo" }
  ]
}
```

### `.env.example`

```ini
# Supabase
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=

# LLM
LLM_API_KEY=
DEFAULT_MODEL=gpt-4o-mini
TEMPERATURE=0.3
MAX_TOKENS_OUT=800

# App
BASE_URL=http://localhost:3000
ADMIN_EMAILS=staff1@example.com;staff2@example.com
MONTHLY_QUOTA=100
MAX_IMAGE_LONGEDGE=1280

# Mail
RESEND_API_KEY=
MAIL_FROM="noreply@your-domain.example"
```

---

# トラブルシューティング

## よくある問題

* **Google OAuthのリダイレクト不一致**
  → Google Cloud側のAuthorized redirectに **`https://<supabase>.supabase.co/auth/v1/callback`** を追加。ローカルは `http://localhost:3000` を**許可オリジン**に。
* **RLSでデータが見えない/見えてはいけないものが見える**
  → 該当テーブルのポリシーを点検。`auth.uid()` と `app_user.auth_uid` の紐付けを確認。スタッフでログインして正しく全件が見えるか検証。
* **Storageアクセス403**
  → 署名URLの有効期限切れ／ストレージポリシー不足。まずはサーバーで署名URLを発行し直す。
* **メールが迷惑判定**
  → 送信ドメインのSPF/DKIM/DMARCを整備。From名や本文も見直す。

## デバッグコマンド

```bash
# ビルド検証
pnpm typecheck && pnpm lint && pnpm build

# ルートハンドラのログ（開発）
pnpm dev  # devサーバーのログを観察

# Supabase：RLS検証はSQL Editorで "auth.uid()" を指定してSELECTテスト
```

---

# CI/CD

**GitHub Actions（例）**

* mainにPR → Lint/Typecheck/Test → OKでVercel（Preview）
* mainにマージ → Vercel（Production）

`.github/workflows/ci.yml`（例）：

```yaml
name: CI
on:
  pull_request:
  push:
    branches: [main]

jobs:
  build-test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: pnpm/action-setup@v3
        with: { version: 9 }
      - uses: actions/setup-node@v4
        with:
          node-version: 'lts/*'
          cache: 'pnpm'
      - run: pnpm i --frozen-lockfile
      - run: pnpm typecheck
      - run: pnpm lint
      - run: pnpm test
      - run: pnpm build
```

> デプロイはVercelのGit連携（推奨）。必要ならVercel CLIを使った自動化も可。

---

# コントリビューション

* **ブランチ**：`feat/*`, `fix/*`, `chore/*`, `docs/*`
* **コミット規約（Conventional Commits）**：`feat: ...`, `fix: ...`, `refactor: ...`, `test: ...`
* **PRルール**：スクショ/動画、テスト結果、影響範囲、ロール/RLSへの影響を記載
* **レビュー観点**：RLS破壊、コスト暴走（トークン/画像）、UX退化がないか

---

# コード生成規約

## 書いておく必要のあること

* **入出力（引数/戻り値）**、前提条件、例外、**副作用（DB書込・外部API）**
* 依存（利用する他モジュール、環境変数）
* セキュリティ観点（RLSに関係するID扱い、roleチェック）

## コメント（各ファイル冒頭に日本語で仕様記述）

**テンプレ例：**

```ts
/** @file
 * 機能：チャット送信（画像+テキスト）→ LLM呼び出し → 会話保存
 * 入力：FormData { text: string; image?: File }
 * 出力：{ answer: string }
 * 例外：LLM失敗時はHTTP 502、Storage失敗時は400
 * 依存：env(LMM_API_KEY, MAX_TOKENS_OUT), supabaseAdmin, quota.ts
 * 注意：RLSのため保存はService Role経由。userIdの出所を必ず検証
 */
```

---

# テスト（実施要件の再確認）

* **各機能に対して必ずユニットテスト**（Vitest / `describe`は日本語）
* **実装と同一ファイルにテストを併記**（`import.meta.vitest`ブロック）
* 変更時は\*\*`pnpm run test`がパス\*\*することを必ず確認
* **コードスタイル統一**：ESLint + Prettier（CIで検証）
* UIは**主要フローのハッピーパス**＋最低限のエラーパスを自動化

---

# 参考リンク

* Next.js（App Router）：[https://nextjs.org/docs](https://nextjs.org/docs)
* Supabase（Auth/DB/Storage/RLS）：[https://supabase.com/docs](https://supabase.com/docs)
* Vercel Cron：[https://vercel.com/docs/cron-jobs](https://vercel.com/docs/cron-jobs)
* Resend（メールAPI）：[https://resend.com/docs](https://resend.com/docs)
* React Markdown：[https://github.com/remarkjs/react-markdown](https://github.com/remarkjs/react-markdown)
* KaTeX：[https://katex.org/](https://katex.org/)
* Vitest：[https://vitest.dev/](https://vitest.dev/)
* React Testing Library：[https://testing-library.com/docs/react-testing-library/intro/](https://testing-library.com/docs/react-testing-library/intro/)

