# Row Level Security (RLS)

本書では、本システムにおける **Row Level Security の方針と SQL ポリシー** を整理する。
目的は「学生=自分のみ閲覧 / スタッフ=全件閲覧」という保証を、安全かつ明示的に維持することである。

## 本書で扱う内容
- RLS の基本思想
- ポリシー全文
- JWT クレームとロール判定
- Service Role の扱いと禁止事項
- よくある落とし穴とテスト方法

---

### RLS/ポリシー

```sql
alter table allowed_email   enable row level security;
alter table app_user        enable row level security;
alter table conversation    enable row level security;
alter table message         enable row level security;
alter table attachment      enable row level security;
alter table monthly_summary enable row level security;
alter table usage_counters  enable row level security;

create policy allowed_email_staff_only on allowed_email
for all to authenticated
using ((auth.jwt() -> 'app_metadata' ->> 'role') = 'staff')
with check ((auth.jwt() -> 'app_metadata' ->> 'role') = 'staff');

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

---

## JWT クレームとロール判定

Supabase Auth が発行する JWT には `app_metadata` フィールドがあり、そこに `role` を格納します。

```json
{
  "aud": "authenticated",
  "sub": "auth-user-uuid",
  "app_metadata": {
    "role": "student"  // または "staff"
  }
}
```

RLS ポリシーでは `auth.jwt() -> 'app_metadata' ->> 'role'` を参照し、`'staff'` の場合は全件アクセスを許可します。

---

## Service Role の扱いと禁止事項

### ✅ 許可される使い方

* **サーバー API（Node.js ランタイム）でのみ使用**
  * `/app/api/chat/route.ts` などで DB への書き込み
  * `/app/api/sync-user/route.ts` での初回ユーザー作成
  * `/app/api/admin/grant/route.ts` でのロール更新

### ❌ 禁止される使い方

* **クライアント側での使用** — 絶対に NG。`NEXT_PUBLIC_*` に含めない
* **Edge Runtime での使用** — 環境変数が Edge でリークする可能性があるため避ける
* **クライアント直書き込み** — すべての書き込みはサーバー API 経由にし、RLS でクライアントからの INSERT/UPDATE/DELETE は拒否

---

## よくある落とし穴

### 1. `auth_uid` と `id` の混同

* `app_user.auth_uid` は `auth.users.id` と紐付く
* `app_user.id` はアプリケーション内部の UUID
* RLS で `auth.uid()` と比較するのは `app_user.auth_uid`

### 2. スタッフロール判定が効かない

* `auth.jwt() -> 'app_metadata' ->> 'role'` が `null` になる場合、JWT が古い可能性
* `/api/admin/grant` 実行後、ユーザーは**再ログイン**が必要（JWT 再取得）

### 3. Service Role で RLS が効かない

* Service Role は **RLS をバイパス**するため、すべてのデータにアクセス可能
* サーバー API で意図しない削除/更新が起こらないよう、WHERE 句で必ず `user_id` などを検証

### 4. Storage ポリシーのパス判定ミス

* `name like 'user_id/%'` の `user_id` は **文字列**で比較する必要がある
* `(select id::text from app_user where auth_uid = auth.uid())` で UUID → text 変換を忘れない

---

## RLS テスト方法

### ユニットテスト（Vitest + Supabase Client）

```ts
import { describe, it, expect } from 'vitest'
import { createClient } from '@supabase/supabase-js'

describe('RLS: 学生は自分の会話のみ取得', () => {
  it('自分の会話は取得できる', async () => {
    const supabase = createClient(url, anonKey, {
      global: { headers: { Authorization: `Bearer ${studentJWT}` } }
    })
    const { data, error } = await supabase.from('conversation').select('*')
    expect(error).toBeNull()
    expect(data).toHaveLength(1) // 自分の会話のみ
  })

  it('他人の会話は取得できない', async () => {
    const supabase = createClient(url, anonKey, {
      global: { headers: { Authorization: `Bearer ${studentJWT}` } }
    })
    const { data } = await supabase
      .from('conversation')
      .select('*')
      .eq('user_id', 'other-user-uuid')
    expect(data).toHaveLength(0) // RLS で弾かれる
  })
})

describe('RLS: スタッフは全件取得', () => {
  it('全ユーザーの会話を取得できる', async () => {
    const supabase = createClient(url, anonKey, {
      global: { headers: { Authorization: `Bearer ${staffJWT}` } }
    })
    const { data, error } = await supabase.from('conversation').select('*')
    expect(error).toBeNull()
    expect(data.length).toBeGreaterThan(1) // 複数ユーザー分
  })
})
```

### E2E テスト（Playwright など）

1. 学生アカウントでログイン → 自分の会話のみ表示されることを確認
2. スタッフアカウントでログイン → 管理画面で全ユーザーの会話が表示されることを確認
3. 学生が他人の会話 URL に直接アクセス → 403 or 空データ

### SQL での手動検証

```sql
-- 学生ロールの JWT を使ってクエリ（Supabase Dashboard の SQL Editor で実行）
set request.jwt.claim.sub = 'student-auth-uid';
set request.jwt.claim.app_metadata.role = 'student';

select * from conversation; -- 自分の会話のみ返る

-- スタッフロールで実行
set request.jwt.claim.app_metadata.role = 'staff';

select * from conversation; -- 全会話が返る
```

---

## RLS ポリシーのデバッグ

### ログ確認

Supabase の Logs → Postgres Logs で `DETAIL: Policy` などのエラーを確認。

### `EXPLAIN` で実行計画確認

```sql
EXPLAIN (ANALYZE, BUFFERS)
SELECT * FROM conversation WHERE user_id = 'xxx';
```

RLS ポリシーが適用されているか、Index Scan が使われているかを確認。

---

## 関連ドキュメント

* [データベース設計](./database.md)
* [セキュリティポリシー](./security.md)
* [アーキテクチャ](./architecture.md)
* [テストガイドライン](./testing.md)

```

Supabase Auth の `app_metadata.role` は `/api/admin/grant` といった内部 API だけが更新し、JWT に `student` / `staff` を埋め込んだ状態でクライアントへ発行する。RLS は常にこの JWT を参照してスタッフ判定を行う。

`allowed_email` テーブルは **全操作を `staff` のみに制限**するため、`using/with check` いずれも `role = 'staff'` 判定とし、学生アカウントからの参照を完全に遮断する。スタッフ UI は `/admin/allowlist` で `requireStaff()` を通したうえで、Service Role API を叩いて更新する。