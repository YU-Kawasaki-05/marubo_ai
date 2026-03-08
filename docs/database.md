# Database Design

本書では、Postgres（Supabase）の **テーブルスキーマ・インデックス・集計モデル** をまとめる。
目的は、DB 設計変更時に影響箇所を迅速に把握し、データの一貫性とパフォーマンスを維持すること。

## 本書で扱う内容
- テーブル定義（DDL）
- インデックス・制約
- 月次レポート（monthly_report）
- usage_counters によるクォータ/レート設計
- ER 図とリレーション
- データ削除ポリシー

---

## チャット履歴テーブル（新規追加案）

### `conversations`
- `id` (uuid, pk)
- `user_id` (uuid, not null) — 会話の所有者
- `title` (text, not null)
- `created_at` (timestamptz, default now)

### `messages`
- `id` (uuid, pk)
- `conversation_id` (uuid, fk -> conversations.id, not null)
- `role` (text, check in ('user','assistant'), not null)
- `content` (text, not null) — プレーンテキスト（UI側は Markdown/KaTeX 表示）
- `created_at` (timestamptz, default now)

### インデックス
- `conversations(user_id, created_at desc)`
- `messages(conversation_id, created_at asc)`

### RLS ポリシー（Supabase）
- `conversations`: `user_id = auth.uid()` で SELECT/INSERT/UPDATE/DELETE 許可。staff ロールは全件許可。
- `messages`: 親 `conversation_id` の `user_id` が `auth.uid()` のとき SELECT/INSERT 許可。staff ロールは全件許可。

### 備考
- タイトル自動生成: 先頭発話30–50文字、なければ `YYYY-MM-DD HH:mm` で補完。
- AI応答保存は `/api/chat` の `onFinish` で実行し、`conversation_id` をレスポンスに含める。

## データ削除ポリシー

原則として、**物理削除（DELETE）は行わず、ステータス変更による論理削除**を採用する。
これにより、操作ミスによるデータ消失を防ぎ、退会後の監査（不適切な利用の調査など）を可能にする。

### 1. ユーザーの退会・削除
* **手法**: `allowed_email` テーブルの `status` を `'revoked'` に更新する。
* **挙動**:
    * 対象のメールアドレスではログインできなくなる。
    * 過去の会話データ（`conversations`, `messages`）は**保持される**。
    * スタッフ画面からは「退会済み」として参照可能。

### 2. 会話の削除（ユーザー操作）
* `DELETE /api/conversations/[id]` により、生徒が不要な会話を個別に物理削除できる。
* `ON DELETE CASCADE` 制約により、`messages` → `attachments` も自動削除される。
* Storage 上の添付ファイル（`storage.objects`）はベストエフォートで削除する。
* RLS により本人の会話のみ削除可能。スタッフは全件削除可能。

### 3. データの物理削除が必要な場合
* 個人情報保護の観点から、ユーザー本人より「全データの完全消去」を強く求められた場合に限り、DB管理者が手動で物理削除を行う（運用対応）。
* その際、`on delete cascade` 制約により、ユーザーに紐づく会話・メッセージ・添付ファイルは自動的に削除される。

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

-- 3) 許可メールリスト
create table if not exists allowed_email (
  email text primary key,
  status text not null check (status in ('active','pending','revoked')),
  label text,
  invited_at timestamptz,
  expires_at timestamptz,
  notes text,
  created_by uuid references app_user(id) on delete set null,
  updated_by uuid references app_user(id) on delete set null,
  updated_at timestamptz default now(),
  created_at timestamptz default now(),
  constraint allowed_email_lowercase check (email = lower(email))
);

create index if not exists idx_allowed_email_status on allowed_email(status);

-- 監査ログ（allowlist 変更履歴）
create table if not exists audit_allowlist (
  id uuid primary key default gen_random_uuid(),
  request_id text not null,
  email text not null references allowed_email(email) on delete cascade,
  prev jsonb,
  next jsonb,
  operation text not null check (operation in ('insert','update','csv-import')),
  staff_user_id uuid not null references app_user(id) on delete cascade,
  created_at timestamptz not null default now()
);

create index if not exists idx_audit_allowlist_email_created on audit_allowlist(email, created_at desc);

-- 4) 会話
create table if not exists conversations (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null,                -- auth.uid()（Supabase Auth UUID）を直接保存。app_user への FK は張らない
  title text not null,
  created_at timestamptz not null default now()
);
create index if not exists idx_conversations_user_created on conversations(user_id, created_at desc);

-- 5) メッセージ
create table if not exists messages (
  id uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references conversations(id) on delete cascade,
  role text not null check (role in ('user','assistant')),
  content text not null,
  created_at timestamptz not null default now()
);
create index if not exists idx_messages_conversation_created on messages(conversation_id, created_at asc);

-- 6) 添付
create table if not exists attachments (
  id uuid primary key default gen_random_uuid(),
  message_id uuid not null references messages(id) on delete cascade,
  user_id uuid not null,               -- auth.uid() を保存（Storage パス生成・RLS 用）
  storage_path text not null,           -- '{user_id}/{conversation_id}/{message_id}/{uuid}.jpg'
  mime_type text,
  size_bytes int,
  created_at timestamptz not null default now()
);

-- 7) 月次レポート（LLM 分析結果 + 利用統計）
create table if not exists monthly_report (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references app_user(id) on delete cascade,
  month text not null,               -- 'YYYY-MM'
  status text not null default 'pending'
    check (status in ('pending', 'generating', 'generated', 'failed')),
  content text,                      -- LLM 生成の Markdown テキスト（レポート本文）
  stats jsonb,                       -- 利用統計（questions, conversations, activeDays, mostActiveDay 等）
  llm_model text,                    -- 使用した LLM モデル名
  llm_tokens_in int default 0,       -- 入力トークン数（コスト追跡用）
  llm_tokens_out int default 0,      -- 出力トークン数（コスト追跡用）
  error_message text,                -- 失敗時のエラーメッセージ
  generated_at timestamptz,          -- 生成完了日時
  created_at timestamptz default now(),
  unique(user_id, month)
);

create index if not exists idx_monthly_report_month on monthly_report(month);
create index if not exists idx_monthly_report_user_month on monthly_report(user_id, month);

-- 8) 利用カウンタ（クォータ/レート制限用）
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

-- 9) レート制限（N リクエスト / window）
create table if not exists rate_limiter (
  key text not null,
  window_start timestamptz not null,
  count int not null default 0 check (count >= 0),
  primary key (key, window_start)
);
create index if not exists idx_rate_limiter_key on rate_limiter(key);
```

* `allowed_email.status` は `active`（利用可）/`pending`（まだ利用不可）/`revoked`（退会済み）の 3 値で管理する。`/app/api/sync-user` は `active` のみユーザー作成を許可し、それ以外は 403 を返して UI に「塾に連絡してください」のメッセージを表示する。
* `allowed_email` はスタッフのみ編集可。SELECT は「スタッフ=全件」「生徒=自分のメールのみ」の二重ポリシー（`20260113000000_fe04_self_read.sql` で適用済み）。これにより生徒はログイン後に自分の許可状態を確認でき、`AccountStatusBanner` で表示される。Service Role API（管理 UI や seed script）ではバルク登録が可能。
* 変更履歴は `audit_allowlist` に `prev`/`next`/`operation`/`request_id`/`staff_user_id` を保存し、少なくとも 90 日以上保持する。
* `usage_counters.day` は API 層で `(now() at time zone 'Asia/Tokyo')::date` を用いて JST 基準で算出し、CHECK 制約によりマイナス値の混入を即座に検知する。
* `rate_limiter.key` には `chat:user:{user_id}` や `chat:ip:{ip}` などの識別子を格納し、`window_start` には `date_trunc('minute', now())` など固定長ウィンドウの先頭を保存する。
* API からは `select allow_request('chat:user:xxx', 10, 60);` のような Postgres 関数（例：`allow_request(p_key text, p_limit int, p_window_seconds int)`）を呼び出し、false の場合は HTTP 429 を返して処理を中断する。
* 将来的に全文検索を高速化する場合は、`messages.content` や `conversations.title` に `pg_trgm` / `tsvector` インデックスを加える余地がある。



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

## ER 図とリレーション

```
auth.users (1) ──── user_id ────< (N) conversations
conversations (1) ─< (N) messages
messages (1) ──────< (N) attachments

app_user (1) ────< (N) monthly_report
app_user (1) ────< (N) usage_counters
```

* **conversations.user_id** は `auth.uid()`（Supabase Auth UUID）を直接保存。`app_user` への FK は張らず、RLS は `user_id = auth.uid()` で直接比較する。`app_user` との紐付けが必要な管理系クエリでは `app_user.auth_uid = conversations.user_id` で JOIN する
* **messages** は `conversation_id` で会話に紐付き、`role`（`user` / `assistant`）で発言者を区別
* **attachments** は `message_id` で特定メッセージの画像を保持
* **monthly_report** は各ユーザーの月次レポート（LLM 分析テキスト + 統計）を保持。`user_id` は `app_user.id` を参照
* **usage_counters** はクォータ/レート制限管理用。`user_id` は `app_user.id` を参照

---

## データ保持と削除ポリシー

* **保持期間**：会話データは原則として **90 日間**（環境変数 `DATA_RETENTION_DAYS` で調整可能）
* **自動削除**：将来的に Cron で `created_at < now() - interval '90 days'` の会話を削除する Job を追加予定
* **添付ファイル削除**：会話削除時に `storage.objects` から該当パスのオブジェクトを削除する処理をベストエフォートで実行
* **手動削除**：チャット画面のサイドバーからゴミ箱アイコンで会話を削除可能（`DELETE /api/conversations/[id]`）。RLS により自分の会話 or スタッフ権限のみ削除可能

---

## パフォーマンス考慮事項

* **インデックス**：`conversations(user_id, created_at desc)` と `messages(conversation_id, created_at asc)` により、履歴取得クエリを高速化
* **全文検索**：将来的に `pg_trgm` や `tsvector` を `messages.content` / `conversations.title` に適用し、キーワード検索を高速化する余地あり
* **集計クエリ**：月次レポート生成時は `monthly_report.stats` に統計を JSON で保存し、再集計を回避。LLM 分析テキストは `content` カラムに Markdown で保存
* **Connection Pooling**：Supabase の Pooler を利用し、サーバーレス環境でのコネクション枯渇を防ぐ

---

## 関連ドキュメント

* [RLS ポリシー詳細](./rls.md)
* [API 仕様](./api.md)
* [アーキテクチャ](./architecture.md)
* [セキュリティポリシー](./security.md)
