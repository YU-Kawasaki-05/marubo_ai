ｄｄｄｄｄｄｄｄｄ# Database Design

本書では、Postgres（Supabase）の **テーブルスキーマ・インデックス・集計モデル** をまとめる。
目的は、DB 設計変更時に影響箇所を迅速に把握し、データの一貫性とパフォーマンスを維持すること。

## 本書で扱う内容
- テーブル定義（DDL）
- インデックス・制約
- 月次集計（monthly_summary）
- usage_counters によるクォータ/レート設計
- ER 図とリレーション

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
  updated_at timestamptz default now(),
  created_at timestamptz default now(),
  constraint allowed_email_lowercase check (email = lower(email))
);

create index if not exists idx_allowed_email_status on allowed_email(status);

-- 4) 会話
create table if not exists conversation (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references app_user(id) on delete cascade,
  subject text,
  created_at timestamptz default now()
);
create index if not exists idx_conversation_user_created on conversation(user_id, created_at desc);

-- 5) メッセージ
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

-- 6) 添付
create table if not exists attachment (
  id uuid primary key default gen_random_uuid(),
  message_id uuid not null references message(id) on delete cascade,
  storage_path text not null,  -- 'userId/convId/messageId/uuid.jpg'
  mime text,
  width int, height int, size_bytes int
);

-- 7) 月次サマリ
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
* `allowed_email` はスタッフのみ閲覧・編集できるよう、RLS で `(auth.jwt() -> 'app_metadata' ->> 'role') = 'staff'` のみ select/insert/update/delete を許可する。Service Role API（管理 UI や seed script）ではバルク登録が可能。
* `usage_counters.day` は API 層で `(now() at time zone 'Asia/Tokyo')::date` を用いて JST 基準で算出し、CHECK 制約によりマイナス値の混入を即座に検知する。
* `rate_limiter.key` には `chat:user:{user_id}` や `chat:ip:{ip}` などの識別子を格納し、`window_start` には `date_trunc('minute', now())` など固定長ウィンドウの先頭を保存する。
* API からは `select allow_request('chat:user:xxx', 10, 60);` のような Postgres 関数（例：`allow_request(p_key text, p_limit int, p_window_seconds int)`）を呼び出し、false の場合は HTTP 429 を返して処理を中断する。
* 将来的に全文検索を高速化する場合は、`message.text` や `conversation.subject` に `pg_trgm` / `tsvector` インデックスを加える余地がある。



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
app_user (1) ────< (N) conversation
conversation (1) ─< (N) message
message (1) ──────< (N) attachment

app_user (1) ────< (N) monthly_summary
app_user (1) ────< (N) usage_counters
```

* **app_user** は Supabase Auth の `auth.users.id` と `auth_uid` で 1:1 関連
* **conversation** は `user_id` で所有者を特定
* **message** は `conv_id` で会話に紐付き、`sender` で発言者（user/assistant）を区別
* **attachment** は `message_id` で特定メッセージの画像を保持
* **monthly_summary** と **usage_counters** は各ユーザーの集計・クォータ管理用

---

## データ保持と削除ポリシー

* **保持期間**：会話データは原則として **90 日間**（環境変数 `DATA_RETENTION_DAYS` で調整可能）
* **自動削除**：将来的に Cron で `created_at < now() - interval '90 days'` の会話を削除する Job を追加予定
* **添付ファイル削除**：会話削除時に `storage.objects` から該当パスのオブジェクトを削除する処理をベストエフォートで実行
* **手動削除**：管理 UI から特定会話を削除する機能を提供し、RLS により自分の会話 or スタッフ権限のみ削除可能

---

## パフォーマンス考慮事項

* **インデックス**：`conversation(user_id, created_at desc)` と `message(conv_id, created_at)` により、履歴取得クエリを高速化
* **全文検索**：将来的に `pg_trgm` や `tsvector` を `message.text` / `conversation.subject` に適用し、キーワード検索を高速化する余地あり
* **集計クエリ**：月次レポート生成時は `monthly_summary` テーブルを活用し、毎回の再集計を回避
* **Connection Pooling**：Supabase の Pooler を利用し、サーバーレス環境でのコネクション枯渇を防ぐ

---

## 関連ドキュメント

* [RLS ポリシー詳細](./rls.md)
* [API 仕様](./api.md)
* [アーキテクチャ](./architecture.md)
* [セキュリティポリシー](./security.md)
