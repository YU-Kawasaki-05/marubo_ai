# 塾向けチャットボット（β） — README

> **目的**：生徒がテキスト/画像で質問し、AI（Markdown/数式対応）が回答。会話は保存され、塾スタッフが閲覧し、月末にレポート（CSV/HTML）を受け取る。
> **スタック**：**Next.js (Vercel)** + **Supabase (Postgres/Auth/Storage)** + **Resend (メール)**
> **方針**：機能単位ディレクトリ、RLS で厳密権限、Vitest（日本語 `describe`）、ESLint+Prettier、**Service Role はサーバーAPIでのみ使用**。

---

## 目次

* [プロジェクト概要](#プロジェクト概要)
* [機能一覧](#機能一覧)
* [技術スタック](#技術スタック)
* [アーキテクチャ概要](#アーキテクチャ概要)
* [ディレクトリ構成](#ディレクトリ構成)
* [環境変数](#環境変数)
* [データベース設計](#データベース設計)

  * [モデル構成](#モデル構成)
  * [RLS/ポリシー](#rlsポリシー)
  * [Storage バケット/ポリシー](#storage-バケットポリシー)
  * [クォータ/レート制限テーブル](#クォータレート制限テーブル)
  * [環境別 DB 設定](#環境別-db-設定)
* [開発ワークフロー](#開発ワークフロー)

  * [セットアップ](#セットアップ)
  * [開発サーバー起動](#開発サーバー起動)
  * [テスト/品質チェック](#テスト品質チェック)
  * [データベース操作](#データベース操作)
* [認証システム](#認証システム)
* [表示（Markdown/LaTeX）](#表示markdownlatex)
* [エラー対処設計](#エラー対処設計)
* [セキュリティ/ヘッダ](#セキュリティヘッダ)
* [デプロイメント](#デプロイメント)
* [Cron（スケジュール）](#cronスケジュール)
* [CI/CD](#cicd)
* [テストガイドライン](#テストガイドライン)
* [重要な設定ファイル（抜粋）](#重要な設定ファイル抜粋)
* [トラブルシューティング](#トラブルシューティング)
* [運用 Runbook](#運用-runbook)
* [受け入れ基準（完成の定義）](#受け入れ基準完成の定義)
* [コントリビューション](#コントリビューション)
* [コード生成規約](#コード生成規約)
* [参考リンク](#参考リンク)
* [ライセンス](#ライセンス)

---

## プロジェクト概要

* **対象**：生徒（ユーザー）、塾スタッフ（管理者）
* **導線**：LINE リッチメニュー → 本アプリ（将来 LIFF 併用可）
* **範囲（β/約20名）**

  * テキスト/画像の質問 → AI 応答（Markdown/KaTeX）
  * 会話保存・履歴
  * スタッフの会話検索/閲覧
  * 月次レポート（CSV/HTML）を管理者メール送信
* **非機能**

  * **JST（Asia/Tokyo）統一**、スマホ最適化、コスト制御（画像圧縮/トークン上限/クォータ）、監視/通知、**データ保持と削除ポリシー**

---

## 機能一覧

### 生徒

* Google ログイン（Supabase Auth）
* テキスト/画像の同時送信、AI 応答（Markdown/LaTeX）
* 会話履歴一覧/詳細
* 入力チェック（画像サイズ/形式）、送信失敗の再試行

### スタッフ

* Google ログイン（管理者ロール）
* 会話検索（期間/ユーザー）
* 会話詳細閲覧
* 月次レポート受信（CSV/HTML）、**管理UIで手動リトライ**

### 共通/自動処理

* 画像アップロード（**短寿命の署名URL**）
* **DBベース**のクォータ/レート制限
* LLM 再試行/フォールバック
* **毎日 23:55 実行 → 月末判定** でレポート送信
* 重大エラー通知（Resend メール、Sentry 任意）

---

## 技術スタック

* **フロント**：Next.js 14+（App Router, TypeScript, Tailwind, Zustand）
  Markdown/LaTeX：`react-markdown` + `remark-gfm` + `remark-math` + `rehype-katex`
* **バックエンド**：Supabase（Auth/Postgres/Storage）、Next.js Route Handlers（/app/api/\*\*、 **Node.js runtime**）
* **LLM**：プライマリ + フォールバック（可能な限り別ベンダー/エンドポイント）呼び出し
* **メール**：Resend（送信ドメインは SPF/DKIM/DMARC 必須）
* **スケジュール**：Vercel Cron（毎日 23:55 JST）
* **テスト**：Vitest（`jsdom`）+ React Testing Library
* **品質**：ESLint + Prettier、TypeScript `strict: true`

---

## アーキテクチャ概要

```
[Browser]
  ├─ /chat  : 生徒UI（送信/履歴閲覧）
  ├─ /admin : スタッフUI（検索/閲覧/レポート再実行）
  └─ fetch  : /api/*
         ├─ chat            : LLM呼び出し＋保存（Service RoleでDB書込）
         ├─ attachments/sign: 署名URL発行（Storage直PUT）
         ├─ reports/monthly : 集計→CSV/HTML→メール送信（Cron/手動）
         ├─ sync-user       : 初回ログイン同期（role=student固定）
         └─ admin/grant     : 管理者ロール付与（Service Role + 内部トークン）

[Next.js on Vercel (Node runtime)] ── uses ── [Supabase]
                                          ├─ Auth (Google)
                                          ├─ Postgres (RLS)
                                          └─ Storage (attachments)

[Resend] ← レポート/障害通知
```

---

## ディレクトリ構成

> **機能単位**で実装。ルーティングは `app/`、ロジックは `src/features/**` に集約。

```
.
├─ app/
│  ├─ chat/page.tsx
│  ├─ admin/page.tsx
│  ├─ api/
│  │  ├─ chat/route.ts
│  │  ├─ attachments/sign/route.ts
│  │  ├─ reports/monthly/route.ts
│  │  ├─ sync-user/route.ts
│  │  └─ admin/
│  │      └─ grant/route.ts      # 管理者ロール付与API（Service Role + 内部トークン必須）
│  ├─ layout.tsx  # KaTeX CSSのimportをここで実施
│  └─ page.tsx / globals.css
├─ src/
│  ├─ features/
│  │  ├─ auth/           (guard.ts, getSession.ts, SignInButton.tsx)
│  │  ├─ chat/           (sendMessage.ts, compressImage.ts, quota.ts, validators.ts, UI)
│  │  ├─ conversations/  (queries.ts, UI)
│  │  ├─ admin/          (search.ts, AdminTable.tsx)
│  │  └─ reports/        (monthlySql.ts, toCsv.ts, jobs/runMonthly.ts)
│  ├─ shared/
│  │  ├─ lib/            (supabaseClient.ts, supabaseAdmin.ts, llm.ts, mailer.ts,
│  │  │                   errors.ts, errorPresenter.ts, apiHandler.ts, notifier.ts)
│  │  ├─ components/ hooks/ types/ utils/
│  └─ styles/
├─ public/                (katex assets 等)
├─ scripts/               (seed等)
├─ tests/                 (統合/E2E 任意) ※単体は同ファイル内に記述
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

## 環境変数

```ini
# Supabase
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=            # サーバーAPIのみ利用（Edge不可）

# LLM（プライマリ）
LLM_API_KEY=
DEFAULT_MODEL=gpt-4o-mini

# LLM（フォールバック用・別ベンダー/別エンドポイント推奨）
LLM_FALLBACK_API_KEY=
FALLBACK_MODEL=gpt-4o-mini
TEMPERATURE=0.3
MAX_TOKENS_OUT=800

# App
BASE_URL=http://localhost:3000
ADMIN_EMAILS=staff1@example.com;staff2@example.com  # S1通知先（ロール判定には不使用）
DEV_ALERT_EMAILS=dev1@example.com
ADMIN_TASK_TOKEN=                                  # /api/admin/grant 等の内部タスクAPI専用トークン
MONTHLY_QUOTA=100
MAX_IMAGE_LONGEDGE=1280
APP_TIMEZONE=Asia/Tokyo

# Mail
RESEND_API_KEY=
MAIL_FROM="noreply@your-domain.example"

# Monitoring (任意)
SENTRY_DSN=
```

* `ADMIN_EMAILS`：S1 以上の重大障害をメール通知する宛先。ロール付与判定には使用しない。
* `ADMIN_TASK_TOKEN`：`/api/admin/grant` など内部タスク API で `x-internal-token` ヘッダとして送信する固定値。Service Role Key と同様に厳重管理し、クライアントへは一切渡さない。
* フォールバック用 LLM キーは可能な限り別ベンダー / 別エンドポイントとし、429 / 5xx / Timeout 時に `DEFAULT_MODEL` から `FALLBACK_MODEL` へ自動で切り替える。

---

## データベース設計

### モデル構成

```sql
create extension if not exists "pgcrypto";

-- 1) 役割enum
do $$ begin
  create type role_t as enum ('student','staff');
exception when duplicate_object then null; end $$;

-- 2) ユーザー
create table if not exists app_user (
  id uuid primary key default gen_random_uuid(),
  auth_uid uuid not null unique,
  email text not null unique,
  display_name text,
  role role_t not null default 'student',
  created_at timestamptz default now(),
  constraint email_lowercase check (email = lower(email))
);

-- 3) 会話
create table if not exists conversation (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references app_user(id) on delete cascade,
  subject text,
  created_at timestamptz default now()
);
create index if not exists idx_conversation_user_created on conversation(user_id, created_at desc);

-- 4) メッセージ
create table if not exists message (
  id uuid primary key default gen_random_uuid(),
  conv_id uuid not null references conversation(id) on delete cascade,
  sender text not null check (sender in ('user','assistant')),
  text text,
  md text,
  tokens_in int default 0,
  tokens_out int default 0,
  created_at timestamptz default now()
);
create index if not exists idx_message_conv_created on message(conv_id, created_at);

-- 5) 添付
create table if not exists attachment (
  id uuid primary key default gen_random_uuid(),
  message_id uuid not null references message(id) on delete cascade,
  storage_path text not null,  -- 'userId/convId/messageId/uuid.jpg'
  mime text,
  width int, height int, size_bytes int
);

-- 6) 月次サマリ
create table if not exists monthly_summary (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references app_user(id) on delete cascade,
  month text not null, -- 'YYYY-MM'
  questions int default 0,
  by_subject jsonb,
  avg_tokens_per_q numeric,
  top_keywords text[],
  created_at timestamptz default now(),
  unique(user_id, month)
);

-- 7) 利用カウンタ（クォータ/レート制限用）
create table if not exists usage_counters (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references app_user(id) on delete cascade,
  day date not null,              -- JST基準（(now() at time zone 'Asia/Tokyo')::date）で付与
  questions int not null default 0 check (questions >= 0),
  tokens_in int not null default 0 check (tokens_in >= 0),
  tokens_out int not null default 0 check (tokens_out >= 0),
  created_at timestamptz default now(),
  unique(user_id, day)
);
create index if not exists idx_usage_user_day on usage_counters(user_id, day desc);

-- 8) レート制限（N リクエスト / window）
create table if not exists rate_limiter (
  key text not null,
  window_start timestamptz not null,
  count int not null default 0 check (count >= 0),
  primary key (key, window_start)
);
create index if not exists idx_rate_limiter_key on rate_limiter(key);
```

* `usage_counters.day` は API 層で `(now() at time zone 'Asia/Tokyo')::date` を用いて JST 基準で算出し、CHECK 制約によりマイナス値の混入を即座に検知する。
* `rate_limiter.key` には `chat:user:{user_id}` や `chat:ip:{ip}` などの識別子を格納し、`window_start` には `date_trunc('minute', now())` など固定長ウィンドウの先頭を保存する。
* API からは `select allow_request('chat:user:xxx', 10, 60);` のような Postgres 関数（例：`allow_request(p_key text, p_limit int, p_window_seconds int)`）を呼び出し、false の場合は HTTP 429 を返して処理を中断する。
* 将来的に全文検索を高速化する場合は、`message.text` や `conversation.subject` に `pg_trgm` / `tsvector` インデックスを加える余地がある。

### RLS/ポリシー

```sql
alter table app_user        enable row level security;
alter table conversation    enable row level security;
alter table message         enable row level security;
alter table attachment      enable row level security;
alter table monthly_summary enable row level security;
alter table usage_counters  enable row level security;

-- JWT の app_metadata.role（student / staff）を参照して RLS 判定
create policy app_user_select on app_user
for select to authenticated
using (
  auth_uid = auth.uid()
  or (auth.jwt() -> 'app_metadata' ->> 'role') = 'staff'
);

create policy conversation_select on conversation
for select to authenticated
using (
  exists (
    select 1 from app_user u
    where u.id = conversation.user_id
      and u.auth_uid = auth.uid()
  )
  or (auth.jwt() -> 'app_metadata' ->> 'role') = 'staff'
);

create policy message_select on message
for select to authenticated
using (
  exists (
    select 1 from conversation c
    join app_user u on u.id = c.user_id
    where c.id = message.conv_id
      and u.auth_uid = auth.uid()
  )
  or (auth.jwt() -> 'app_metadata' ->> 'role') = 'staff'
);

create policy attachment_select on attachment
for select to authenticated
using (
  exists (
    select 1 from message m
    join conversation c on c.id = m.conv_id
    join app_user u on u.id = c.user_id
    where m.id = attachment.message_id
      and u.auth_uid = auth.uid()
  )
  or (auth.jwt() -> 'app_metadata' ->> 'role') = 'staff'
);

create policy monthly_summary_select on monthly_summary
for select to authenticated
using (
  exists (
    select 1 from app_user u
    where u.id = monthly_summary.user_id
      and u.auth_uid = auth.uid()
  )
  or (auth.jwt() -> 'app_metadata' ->> 'role') = 'staff'
);

create policy usage_counters_select on usage_counters
for select to authenticated
using (
  exists (
    select 1 from app_user u
    where u.id = usage_counters.user_id
      and u.auth_uid = auth.uid()
  )
  or (auth.jwt() -> 'app_metadata' ->> 'role') = 'staff'
);

-- 書き込みは原則 Service Role 経由（API ルートのみ）。クライアント直書き込みは禁止。
```

Supabase Auth の `app_metadata.role` は `/api/admin/grant` といった内部 API だけが更新し、JWT に `student` / `staff` を埋め込んだ状態でクライアントへ発行する。RLS は常にこの JWT を参照してスタッフ判定を行う。

### Storage バケット/ポリシー

**作成**

```sql
-- バケット作成（非公開）
select storage.create_bucket('attachments', public := false);
```

**命名規則**：`{user_id}/{conversation_id}/{message_id}/{uuid}.jpg`

**storage.objects ポリシー（selectのみ。書込は署名URL or Service Role）**

```sql
-- 自分のパス or staff は閲覧可
create policy attachments_read on storage.objects
for select to authenticated
using (
  bucket_id = 'attachments' and
  (
    -- 自分のユーザーID配下
    name like ( (select id::text from app_user where auth_uid = auth.uid()) || '/%' )
    or (auth.jwt() -> 'app_metadata' ->> 'role') = 'staff'
  )
);
```

> アップロードは**短寿命の署名URL**で直接PUT。サーバーAPI（Service Role）で署名を発行。

### クォータ/レート制限テーブル

* `usage_counters` を API で1リクエストごとに **「JSTの当日行を upsert し増分」** し、CHECK 制約で値の下振れを防ぐ。
* **月間クォータ**は `sum(questions)` を当月で集計して判定。
* `rate_limiter` テーブルは `allow_request()` 関数と組み合わせ、1分あたり N リクエストなどのレート制限を実現し、超過時は HTTP 429 を返す。

---

## 環境別 DB 設定

* `dev`：開発用 Supabase（無料枠）
* `staging`：本番同構成の検証環境
* `prod`：本番。**RLS/ポリシーは staging で検証後**に反映

---

## 開発ワークフロー

### セットアップ

```bash
# WSL (Ubuntu) 推奨
sudo apt update && sudo apt upgrade -y
sudo apt install -y curl git build-essential
curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.39.7/install.sh | bash
export NVM_DIR="$HOME/.nvm"; source "$NVM_DIR/nvm.sh"
nvm install --lts
npm i -g pnpm@9

git clone <repo-url>
cd <repo>
pnpm i
cp .env.example .env.local
```

### 開発サーバー起動

```bash
pnpm dev
# http://localhost:3000
```

### テスト/品質チェック

```bash
pnpm test         # Vitest
pnpm test:watch
pnpm test:cov
pnpm typecheck
pnpm lint
pnpm format
```

### データベース操作

* 初期は Supabase **SQL Editor** で本READMEのSQLを適用
* 将来は Supabase CLI の migration に移行推奨
* Seed は `scripts/` 配下

---

## 認証システム

* **Supabase Auth（Google）**
* 初回ログイン → `/api/sync-user` が **Service Role** で `app_user` を upsert（`email` は小文字化し、`role` は常に `student` で作成/更新）
* `staff` へのロール昇格は `/api/admin/grant` など **Service Role + `x-internal-token: ${ADMIN_TASK_TOKEN}`** を要求する内部 API のみが実施し、Supabase Auth の `app_metadata.role` と `app_user.role` を同期させる
* 発行された JWT の `app_metadata.role` を RLS が参照し、**生徒=自分のみ / スタッフ=全件** を保証
* **クライアントからの DB 書き込みは禁止**（Service Role を使うサーバー API 経由のみ）

---

## 表示（Markdown/LaTeX）

* `react-markdown` + `remark-gfm` + `remark-math` + `rehype-katex` + `rehype-sanitize`
* `rehype-sanitize` のスキーマをカスタマイズし、`<script>` / `onerror` / `javascript:` プロトコルなどは拒否しつつ、KaTeX が利用する `span.katex*` や `div.katex-display` などのクラスは許可する
* `app/layout.tsx` で **`import 'katex/dist/katex.min.css'`** を読み込み、数式表示を統一
* コードブロックは横スクロール、モバイルでの改行/折返し最適化

---

## エラー対処設計

* 例外は **`AppError` に正規化**（種別/重大度/通知先）。`withHandledErrors()` で API をラップ
* LLM 呼び出しは **15 秒程度のタイムアウト + バックオフ再試行 → フォールバックモデル**（可能な限り別ベンダー）を順に試行し、429/5xx/Timeout を吸収
* UI には初回失敗時点で「混雑中。自動再試行中…」など即時フィードバックを出し、全経路失敗時は「時間をおいて再実行してください」と案内しつつ S1 相当の通知を送る
* `rate_limiter` 関数で短時間の過負荷を検知した場合は **HTTP 429** を返し、クライアントに再試行までの待機を指示
* 重大度 S1 以上で **Resend メール通知**（`ADMIN_EMAILS` / `DEV_ALERT_EMAILS`）
* Cron は **段階保存（集計→生成→送信）**＋**手動リトライAPI**
* すべての API レスポンスに **`requestId`** を付与

（実装ファイル：`src/shared/lib/errors.ts`, `errorPresenter.ts`, `apiHandler.ts`, `llm.ts`, `notifier.ts`）

---

## セキュリティ/ヘッダ

* **Service Role Key は Node.js ランタイムのサーバー API だけで使用し、CSP/環境変数のいずれにおいてもクライアントからアクセスできないことを保証**（Edge Runtime では扱わない）。
* 本番では `Content-Security-Policy` を `default-src 'self'` ベースで定義し、必要な外部ドメインのみ `img-src` や `connect-src` に許可する。開発では `script-src` に `'unsafe-eval'` を許容してもよいが、本番では禁止する。
* 併せて `X-Content-Type-Options: nosniff`、`Strict-Transport-Security`、`Referrer-Policy: strict-origin-when-cross-origin`、`Permissions-Policy`、`X-Frame-Options: DENY` を適用する。
* Next.js では下記のように環境ごとに CSP を切り替える：

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
  "style-src 'self' 'unsafe-inline'",
  "font-src 'self'",
  "frame-ancestors 'none'",
].join('; ')

module.exports = {
  async headers() {
    return [
      {
        source: '/(.*)',
        headers: [
          { key: 'Content-Security-Policy', value: csp },
          { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          { key: 'Strict-Transport-Security', value: 'max-age=31536000; includeSubDomains; preload' },
          { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=()' },
          { key: 'X-Frame-Options', value: 'DENY' },
        ],
      },
    ]
  },
}
```

* Resend 送信ドメインには **SPF/DKIM/DMARC** を必ず設定する。

---

## デプロイメント

* **Vercel**：Git 連携（PR→Preview、main→Production）
* **ENV**：Vercel の Environment Variables に `.env.local` の値を投入
* **ランタイム**：Service Role を使う Route は **Node.js ランタイム強制**

---

## Cron（スケジュール）

* **Vercel Cron は「月末指定L」を保証しない**ため、**毎日 23:55 JST 実行**に変更
* 実装で **「今日が月末か」判定**して月次処理のみ実行

`vercel.json`：

```json
{
  "crons": [
    { "path": "/api/reports/monthly", "schedule": "55 23 * * *", "timezone": "Asia/Tokyo" }
  ]
}
```

---

## CI/CD

* GitHub Actions：Lint → TypeCheck → Test → Build
* `build` に必要な最低限の ENV（公開可のもの）を `env` に注入するか、**CI では build をスキップ**してもよい（Preview はVercel側で）
* `pnpm build` を CI で実行する場合でも、`SUPABASE_SERVICE_ROLE_KEY` や `RESEND_API_KEY` などサーバー専用シークレットは注入せず、`NEXT_PUBLIC_*` のみ許可する

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
        env:
          NEXT_PUBLIC_SUPABASE_URL: ${{ secrets.NEXT_PUBLIC_SUPABASE_URL }}
          NEXT_PUBLIC_SUPABASE_ANON_KEY: ${{ secrets.NEXT_PUBLIC_SUPABASE_ANON_KEY }}
```

---

## テストガイドライン

* **各機能に必ずユニットテスト**（Vitest）
* **実装ファイルと同じファイル**に `import.meta.vitest` で併記
* `describe` は **日本語**、境界/エラー系も含める
* 変更時は **`pnpm test` が常時パス**
* UI は React Testing Library
* **RLS テスト**：学生アカウントでは自分の会話のみ、スタッフアカウントでは全件が取得できることを Supabase クライアント or SQL で検証
* **レート制限テスト**：同一キーで上限直前までは許可され、上限を超えると HTTP 429 相当で拒否されること
* **Markdown/LaTeX サニタイズ**：`<script>` や `javascript:` プロトコルが除去されつつ、KaTeX のクラスは残り表示が崩れないこと
* **LLM フォールバック動作**：プライマリが 429/5xx/Timeout の際にフォールバックが呼ばれ、両方失敗時は UI へ適切なエラーを返す
* **E2E（任意）**：ログイン → チャット投稿（テキスト + 数式）→ レンダリング → 履歴表示までの最低限のシナリオ

---

## 重要な設定ファイル（抜粋）

**`package.json`**

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

**`vitest.config.ts`**

```ts
import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    environment: 'jsdom',
    globals: true,
    include: ['src/**/*.ts', 'src/**/*.tsx', 'app/**/*.ts', 'app/**/*.tsx'],
    coverage: { reporter: ['text', 'lcov'] }
  }
})
```

**`.eslintrc.cjs`**

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

**`.prettierrc`**

```json
{ "singleQuote": true, "semi": false, "trailingComma": "all" }
```

**`tsconfig.json`（抜粋）**

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

**`vercel.json`（Cron/JST）**

```json
{
  "crons": [
    { "path": "/api/reports/monthly", "schedule": "55 23 * * *", "timezone": "Asia/Tokyo" }
  ]
}
```

---

## トラブルシューティング

* **Google OAuth リダイレクト不一致**
  → Supabase Provider 設定のコールバックURL、Google側の許可オリジンを確認。
* **RLS 不具合（見えない/見えてはいけない）**
  → `auth.uid()` と `app_user.auth_uid` の紐付け。スタッフで全件閲覧できるか検証。
* **Storage 403/URL期限切れ**
  → 署名URL TTL、ポリシー、パス規約（`user_id/`）を確認。失敗時は1回だけ自動再発行。
* **メール迷惑判定**
  → SPF/DKIM/DMARC 必須。From表示名と本文を見直す。
* **LLM 429/Timeout**
  → バックオフ再試行/フォールバックが動作するか。短時間の連投を避ける。

---

## 運用 Runbook

1. **LLM障害**：UIで「混雑中」表示 → 自動再試行/フォールバック → 改善しなければ S1 通知（スタッフ/開発者）。
2. **月次レポート失敗**：中間結果テーブル確認 → 管理UIで対象月を指定し手動リトライ。
3. **メール不達**：Resend の Bounce/Troubleshoot → DNS（SPF/DKIM/DMARC）/From名の修正。
4. **削除/保持**：保持期間（例：90日）。会話削除時に添付の**Storageオブジェクト削除 Job**を実行（ベストエフォート）。
5. **クォータ**：`usage_counters` を監視。上限到達時は429と指示文を返す。

---

## 受け入れ基準（完成の定義）

* 生徒がテキスト/画像で質問し、**Markdown/KaTeX** で崩れず表示
* 自分の会話のみ閲覧、スタッフは**全件**（RLS 検証済み）
* **毎日 23:55 実行**で**月末のみ**レポート送信（手動リトライ可）
* LLM 障害/429 で**即時案内＋自動再試行/フォールバック**
* すべての API が **`requestId`** を返し、S1 以上は**メール通知**
* `pnpm test` / `pnpm typecheck` / `pnpm lint` / `pnpm build` が成功
* **SLO 例**：テキストのみの質問に対する p95 応答時間 3 秒以内（平常時）
* **SLO 例**：LLM API 障害時にフォールバックで救済できる割合を 80% 以上に維持

---

## コントリビューション

* ブランチ：`feat/*`, `fix/*`, `chore/*`, `docs/*`
* コミット：Conventional Commits（`feat: ...`, `fix: ...`）
* PR：スクショ/動画、テスト結果、影響範囲、RLS/コストへの影響を記載
* レビュー観点：RLS破壊、コスト暴走（トークン/画像）、UX劣化

---

## コード生成規約

### 書いておくべきこと

* 入出力、前提、例外、**副作用**（DB/外部API）、依存（ENV/モジュール）、**セキュリティ注意**（ID/RLS）

### ファイル冒頭コメント（テンプレ）

```ts
/** @file
 * 機能：チャット送信（画像+テキスト）→ LLM → 会話保存
 * 入力：FormData { text: string; image?: File }
 * 出力：{ answer: string }
 * 例外：LLM失敗=502, Storage失敗=400
 * 依存：env(LLM_API_KEY, MAX_TOKENS_OUT), supabaseAdmin, quota.ts
 * 注意：書込はService Roleのみ。userIdの出所を必ず検証（RLS考慮）。
 */
```

---

## 参考リンク

* Next.js（App Router）: [https://nextjs.org/docs](https://nextjs.org/docs)
* Supabase（Auth/DB/Storage/RLS）: [https://supabase.com/docs](https://supabase.com/docs)
* Vercel Cron: [https://vercel.com/docs/cron-jobs](https://vercel.com/docs/cron-jobs)
* Resend: [https://resend.com/docs](https://resend.com/docs)
* React Markdown: [https://github.com/remarkjs/react-markdown](https://github.com/remarkjs/react-markdown)
* KaTeX: [https://katex.org/](https://katex.org/)
* Vitest: [https://vitest.dev/](https://vitest.dev/)
* React Testing Library: [https://testing-library.com/docs/react-testing-library/intro/](https://testing-library.com/docs/react-testing-library/intro/)

---

## ライセンス

社内利用前提（教育目的）。外部公開時は適切な OSS ライセンスを別途検討。