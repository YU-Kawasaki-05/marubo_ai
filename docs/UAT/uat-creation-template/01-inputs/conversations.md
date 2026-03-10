# スタッフ会話検索・閲覧仕様

本書は、スタッフ（管理者）が全生徒の会話を検索・閲覧するための UI / API 仕様を定義する。

---

## 1. アクセス制御

- **対象ユーザー**: `app_metadata.role = 'staff'` のみ
- **ページパス**: `/admin/conversations`
- **認可チェック**: `requireStaff()` ガード。未認証/非スタッフは `/login` にリダイレクト
- **RLS**: `conversations` / `messages` テーブルの `staff_select_all` ポリシーにより全件取得可能

---

## 2. 会話一覧画面（`/admin/conversations`）

### レイアウト

```
┌─────────────────────────────────────────────────────────┐
│  管理画面         [許可メール管理]  [会話検索]  [レポート] │
├─────────────────────────────────────────────────────────┤
│                                                         │
│  ┌── 検索フィルタ ──────────────────────────────────┐   │
│  │ 生徒メール: [________________]                    │   │
│  │ 期間:       [開始日] ～ [終了日]                   │   │
│  │ キーワード:  [________________]  [🔍 検索]         │   │
│  └──────────────────────────────────────────────────┘   │
│                                                         │
│  ┌── 検索結果 ──────────────────────────────────────┐   │
│  │  生徒         タイトル            日時     件数   │   │
│  │  taro@...     二次方程式の解の...  02/15   12     │   │
│  │  hanako@...   英語の文法について   02/14    8     │   │
│  │  ...                                              │   │
│  │                        [← 前へ] [次へ →]          │   │
│  └──────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────┘
```

### 検索条件

| フィルタ | 入力形式 | 必須 | 備考 |
|---------|---------|------|------|
| **生徒メール** | テキスト入力（部分一致） | いいえ | `app_user.email ILIKE '%入力値%'` |
| **期間（開始日）** | 日付ピッカー（`YYYY-MM-DD`） | いいえ | `conversations.created_at >= 開始日` |
| **期間（終了日）** | 日付ピッカー（`YYYY-MM-DD`） | いいえ | `conversations.created_at < 終了日 + 1日`（終了日を含む） |
| **キーワード** | テキスト入力 | いいえ | 会話タイトル（`conversations.title`）に対する部分一致検索 |

- フィルタはすべて任意。未指定時は全件を新しい順に表示
- 検索は「AND 条件」で絞り込む

### 一覧表示項目

| 列 | 内容 | ソート |
|----|------|--------|
| **生徒** | `app_user.email`（ユーザーの表示名があれば `display_name` を優先） | — |
| **タイトル** | `conversations.title`（先頭 50 文字で切り詰め） | — |
| **作成日** | `conversations.created_at`（`YYYY/MM/DD HH:mm` JST 表示） | デフォルト降順 |
| **メッセージ数** | 当該会話の `messages` レコード件数 | — |

### ページネーション

- **1 ページあたり**: 20 件
- **方式**: オフセットベース（`page=1&limit=20`）
  - β 版規模ではカーソルベースほどの性能要件はないため、シンプルなオフセットを採用
- **UI**: 「← 前へ」「次へ →」ボタン + 現在ページ / 総ページ表示

### N+1 クエリ最適化（GFX-14）

メッセージ数の取得を JavaScript 側で全件取得後にカウントする方式から、**SQL の `COUNT() GROUP BY` + `OFFSET/LIMIT`** に変更。

```sql
SELECT c.id, c.title, c.created_at, c.user_id,
       COUNT(m.id) AS message_count
FROM conversations c
LEFT JOIN messages m ON m.conversation_id = c.id
WHERE ...
GROUP BY c.id
ORDER BY c.created_at DESC
OFFSET :offset LIMIT :limit
```

これにより、データ量増加時のパフォーマンス劣化を防止。

---

## 3. 会話詳細画面

一覧の行をクリックすると、同画面内（または別パネル）で会話詳細を表示する。

### 表示内容

| 項目 | 内容 |
|------|------|
| **会話タイトル** | `conversations.title` |
| **生徒情報** | メールアドレス + 表示名 |
| **作成日時** | `YYYY/MM/DD HH:mm` JST |
| **メッセージ一覧** | 時系列昇順で全メッセージを表示 |

### メッセージの表示

| 項目 | 表示 |
|------|------|
| **ユーザーメッセージ** | プレーンテキスト（右寄せ、青系背景） |
| **AI メッセージ** | Markdown + KaTeX レンダリング（左寄せ、灰系背景） |
| **添付画像** | `AttachmentThumbnails` コンポーネントでサムネイル表示（最大幅 320px）。クリックで拡大。署名 URL は `POST /api/admin/attachments/signed-url`（Service Role）で生成（GFX-18） |
| **タイムスタンプ** | 各メッセージに `HH:mm` を小さく表示 |

### 閲覧専用

- スタッフは会話の**閲覧のみ**。メッセージの編集・削除はできない
- 必要に応じて、将来的に「フラグ付け」「メモ追加」機能を検討（β 版対象外）

---

## 4. API 仕様

### `GET /api/admin/conversations` — 会話一覧検索

| 項目 | 内容 |
|------|------|
| **Auth** | `requireStaff()` |
| **Runtime** | Node.js |

**クエリパラメータ**:

| パラメータ | 型 | デフォルト | 説明 |
|-----------|-----|-----------|------|
| `email` | string | — | 生徒メールの部分一致 |
| `from` | string (ISO date) | — | 期間の開始日 |
| `to` | string (ISO date) | — | 期間の終了日 |
| `keyword` | string | — | タイトル部分一致 |
| `page` | number | 1 | ページ番号 |
| `limit` | number | 20 | 1 ページあたりの件数（最大 50） |

**レスポンス**:

```json
{
  "requestId": "admin_conv_01h9...",
  "data": {
    "conversations": [
      {
        "id": "conv_123",
        "title": "二次方程式の解の公式を教えて",
        "createdAt": "2026-02-15T12:00:00Z",
        "messageCount": 12,
        "user": {
          "email": "taro@example.com",
          "displayName": "太郎"
        }
      }
    ],
    "pagination": {
      "page": 1,
      "limit": 20,
      "total": 142,
      "totalPages": 8
    }
  }
}
```

### `GET /api/admin/conversations/[id]` — 会話詳細

| 項目 | 内容 |
|------|------|
| **Auth** | `requireStaff()` |
| **Runtime** | Node.js |

**レスポンス**:

```json
{
  "requestId": "admin_conv_detail_01h9...",
  "data": {
    "id": "conv_123",
    "title": "二次方程式の解の公式を教えて",
    "createdAt": "2026-02-15T12:00:00Z",
    "user": {
      "email": "taro@example.com",
      "displayName": "太郎"
    },
    "messages": [
      {
        "id": "m1",
        "role": "user",
        "content": "二次方程式の解の公式を教えて",
        "createdAt": "2026-02-15T12:00:05Z",
        "attachments": []
      },
      {
        "id": "m2",
        "role": "assistant",
        "content": "二次方程式 $ax^2 + bx + c = 0$ の解の公式は...",
        "createdAt": "2026-02-15T12:00:08Z",
        "attachments": []
      }
    ]
  }
}
```

---

## 5. 将来の拡張候補（β 版対象外）

- **全文検索**: メッセージ本文のキーワード検索（`pg_trgm` / `tsvector`）
- **エクスポート**: 検索結果の CSV ダウンロード
- **フラグ/メモ**: 特定会話にスタッフがメモを残す機能
- **リアルタイム通知**: 新しい会話が始まったときの通知

---

## 関連ドキュメント

- [API 仕様](./api.md)
- [RLS ポリシー](./rls.md)（staff の全件閲覧ポリシー）
- [アーキテクチャ](./architecture.md)（管理 UI の構成とフロー）
- [TODO / Roadmap](./todo.md)（SPEC-09, BE-12, FE-07）
