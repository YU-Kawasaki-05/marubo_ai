# スタッフ権限付与仕様

本書は、スタッフ権限（`role = 'staff'`）の付与・運用方針を定義する。

---

## 1. 方針

| 項目 | 内容 |
|------|------|
| **付与方法** | 管理画面（`/admin/grant`）から UI で付与 |
| **付与可能者** | **2 名のみ**（下記の GRANT_ALLOWED_EMAILS に登録されたスタッフ） |
| **監査ログ** | 付与・解除操作は `audit_grant` テーブルに記録する |
| **旧方式との違い** | `x-internal-token` による API 直叩きから、**UI + 付与可能者制限** に移行 |

### 付与可能者

| メールアドレス | 役割 |
|--------------|------|
| `maru.juku.maru@gmail.com` | 管理者（塾長） |
| `yuu.kw5.sea@gmail.com` | テスト用・運用補助 |

付与可能者は環境変数 `GRANT_ALLOWED_EMAILS` で管理する（`;` 区切り）。  
この環境変数に含まれていないスタッフは、権限付与 UI にアクセスできない。

---

## 2. UI 設計（`/admin/grant`）

### アクセス制御

- `requireStaff()` でスタッフ認証
- さらに `GRANT_ALLOWED_EMAILS` に含まれるスタッフのみ操作可能
- 非該当のスタッフがアクセスした場合は「この操作を行う権限がありません」と表示

### 画面構成

```
┌──────────────────────────────────────────────────────┐
│  管理画面    [許可メール] [会話検索] [レポート] [権限]  │
├──────────────────────────────────────────────────────┤
│                                                      │
│  🔑 スタッフ権限管理                                  │
│                                                      │
│  ┌── 権限付与 ────────────────────────────────────┐  │
│  │ メールアドレス: [________________________]      │  │
│  │                              [✅ 付与する]      │  │
│  └────────────────────────────────────────────────┘  │
│                                                      │
│  ┌── 現在のスタッフ一覧 ──────────────────────────┐  │
│  │  メール             付与日        操作         │  │
│  │  maru.juku...       2026/01/15   (付与者)     │  │
│  │  yuu.kw5...         2026/01/15   (付与者)     │  │
│  │  staff3@...         2026/02/10   [解除]       │  │
│  └────────────────────────────────────────────────┘  │
│                                                      │
│  ┌── 操作履歴 ────────────────────────────────────┐  │
│  │  日時         操作者       対象       操作     │  │
│  │  02/10 14:00  maru.juku.. staff3@..  付与     │  │
│  │  01/15 10:00  (初期設定)  yuu.kw5..  付与     │  │
│  └────────────────────────────────────────────────┘  │
└──────────────────────────────────────────────────────┘
```

### UI の動作

1. **メールアドレスを入力** → 「付与する」をクリック
2. **確認ダイアログ**: 「`staff3@example.com` にスタッフ権限を付与しますか？」
3. **成功時**: トーストで「付与しました。対象ユーザーは再ログインが必要です」と表示
4. **解除**: 一覧の「解除」ボタンで `student` に戻す。付与可能者自身は解除不可

### バリデーション

- メールアドレスが `app_user` に存在すること（存在しない場合はエラー）
- `allowed_email` に `status = 'active'` で登録されていること
- すでに `staff` の場合は「すでにスタッフです」と表示

---

## 3. API 仕様

### `POST /api/admin/grant` — 権限付与

| 項目 | 内容 |
|------|------|
| **Auth** | `requireStaff()` + `GRANT_ALLOWED_EMAILS` チェック |
| **Runtime** | Node.js |

**リクエスト**:

```json
{
  "email": "staff3@example.com",
  "action": "grant"
}
```

| パラメータ | 型 | 必須 | 説明 |
|-----------|-----|------|------|
| `email` | string | はい | 対象ユーザーのメールアドレス |
| `action` | `"grant"` \| `"revoke"` | はい | `grant`: staff に昇格、`revoke`: student に降格 |

**処理フロー**:

1. `requireStaff()` で認証チェック
2. 操作者のメールが `GRANT_ALLOWED_EMAILS` に含まれるか確認 → 含まれない場合 403
3. `app_user` テーブルで対象メールのユーザーを検索 → 存在しない場合 404
4. `app_user.role` を更新（Service Role）
5. Supabase Auth の `app_metadata.role` を更新（`admin.updateUserById`）
6. `audit_grant` テーブルに監査ログを記録
7. レスポンス返却

**レスポンス**:

```json
{
  "requestId": "grant_01h9...",
  "data": {
    "email": "staff3@example.com",
    "previousRole": "student",
    "newRole": "staff",
    "note": "対象ユーザーは再ログインが必要です"
  }
}
```

**エラー**:

| HTTP | code | 説明 |
|------|------|------|
| 403 | `GRANT_NOT_ALLOWED` | 操作者が `GRANT_ALLOWED_EMAILS` に含まれていない |
| 404 | `USER_NOT_FOUND` | 対象メールの `app_user` が存在しない |
| 409 | `ALREADY_STAFF` / `ALREADY_STUDENT` | すでに対象ロールである |

### `GET /api/admin/grant` — スタッフ一覧・操作履歴

| 項目 | 内容 |
|------|------|
| **Auth** | `requireStaff()` + `GRANT_ALLOWED_EMAILS` チェック |

**レスポンス**:

```json
{
  "requestId": "grant_list_01h9...",
  "data": {
    "staffUsers": [
      {
        "email": "maru.juku.maru@gmail.com",
        "displayName": null,
        "role": "staff",
        "grantedAt": "2026-01-15T10:00:00Z"
      }
    ],
    "auditLog": [
      {
        "id": "audit_123",
        "operatorEmail": "maru.juku.maru@gmail.com",
        "targetEmail": "staff3@example.com",
        "action": "grant",
        "createdAt": "2026-02-10T14:00:00Z"
      }
    ]
  }
}
```

---

## 4. データベース設計

### `audit_grant` テーブル

```sql
create table if not exists audit_grant (
  id uuid primary key default gen_random_uuid(),
  request_id text not null,
  operator_user_id uuid not null references app_user(id) on delete cascade,
  target_user_id uuid not null references app_user(id) on delete cascade,
  action text not null check (action in ('grant', 'revoke')),
  prev_role text not null,
  new_role text not null,
  created_at timestamptz not null default now()
);

create index if not exists idx_audit_grant_target on audit_grant(target_user_id, created_at desc);
```

### RLS

```sql
alter table audit_grant enable row level security;

-- GRANT_ALLOWED_EMAILS に含まれるスタッフのみ閲覧可（実装上は Service Role で取得）
-- クライアントからの直接アクセスは不要
```

---

## 5. 環境変数

| 変数 | 用途 | 例 |
|------|------|-----|
| `GRANT_ALLOWED_EMAILS` | 権限付与が可能なスタッフのメールアドレス（`;` 区切り） | `maru.juku.maru@gmail.com;yuu.kw5.sea@gmail.com` |

---

## 6. セキュリティ上の注意

- `GRANT_ALLOWED_EMAILS` は **サーバーサイドのみ** で参照する（`NEXT_PUBLIC_` にしない）
- 権限付与後、対象ユーザーは **再ログインが必要**（JWT に新しい `app_metadata.role` が反映されるため）
- 付与可能者自身のロールを `student` に降格する操作は禁止する（ロック保護）
- すべての操作が `audit_grant` に記録されるため、不正な操作は追跡可能

---

## 関連ドキュメント

- [セキュリティポリシー](../security.md)（認証フロー、Service Role）
- [RLS ポリシー](../rls.md)（ロール判定）
- [API 仕様](../api.md)
- [TODO / Roadmap](../todo.md)（BE-13, FE-09）
