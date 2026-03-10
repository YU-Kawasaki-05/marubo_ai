# 月次レポート仕様

本書は、毎月自動生成される **生徒個別の学習レポート** の仕様を定義する。  
LLM が各生徒のチャット履歴を分析し、学習傾向・理解度・アドバイスを記事形式で出力する。  
β 版の規模（約 20 名）に合わせた設計とする。

---

## 1. 概要

| 項目 | 内容 |
|------|------|
| **目的** | 生徒が自分の学習傾向を振り返り、スタッフが各生徒の学習状況を把握する |
| **レポート単位** | **生徒個別**（生徒 1 人につき 1 レポート/月） |
| **生成タイミング** | **毎月末 23:55 JST**（Cron で月末判定 → 対象全生徒分を一括生成） |
| **閲覧方法** | **Web UI**（生徒 → `/reports`、スタッフ → `/admin/reports`） |
| **通知** | 生成完了後、`ADMIN_EMAILS` にメールで「レポートが生成されました」と通知（本文にリンク） |
| **分析エンジン** | LLM（推論向けモデル。`REPORT_LLM_MODEL` 環境変数で指定） |

### 旧方針との差分

| 項目 | 旧方針 | 新方針 |
|------|--------|--------|
| レポート対象 | 塾全体の集計サマリー | **生徒個別**の学習分析 |
| 閲覧方法 | メール（HTML + CSV 添付） | **Web UI**（記事形式ページ） |
| 分析内容 | 数値指標のみ（会話数・質問数等） | **LLM による学習傾向分析 + アドバイス** |
| 生徒の閲覧 | 不可（スタッフのみ） | **生徒本人が自分のレポートを閲覧可能** |
| メールの役割 | レポート本体の送信 | **通知のみ**（「レポートが生成されました」） |

---

## 2. レポートの内容

### LLM 分析で生成する項目

| # | セクション | 内容 | 目安文量 |
|---|-----------|------|---------|
| 1 | **今月の学習サマリー** | 質問の傾向を要約。「数学の二次方程式に関する質問が多く…」等 | 100〜200 字 |
| 2 | **学習トピックの分布** | どの教科・分野の質問が多かったか（箇条書き） | 3〜8 項目 |
| 3 | **理解度の所見** | 質問内容から推測される理解度。「基礎は理解しているが応用に課題」等 | 100〜200 字 |
| 4 | **学習アドバイス** | 生徒へのアドバイス。「○○の分野を重点的に復習すると良いでしょう」等 | 100〜300 字 |
| 5 | **利用統計** | 数値情報：質問数・会話数・最も活発な日・利用頻度 | テーブル形式 |

### LLM に渡すコンテキスト

```
システムプロンプト:
  あなたは塾の学習アドバイザーです。
  以下は生徒の1ヶ月分のAIチャット質問履歴です。
  この履歴を分析して、以下の形式でレポートを生成してください。
  - 語調: 丁寧かつ励ましのある表現（です・ます調）
  - 対象: 中高生の生徒本人が読むことを想定
  - 個人情報: メールアドレスや本名は出力しない

ユーザーメッセージ:
  【対象期間】2026年2月
  【質問数】32件
  【会話数】15件
  
  --- 質問履歴（ユーザーメッセージのみ抜粋） ---
  [02/01 18:30] 二次方程式 x^2 + 3x + 2 = 0 の解き方を教えてください
  [02/01 18:45] 因数分解のやり方がわかりません
  [02/03 20:10] 英語の現在完了形と過去形の違いは？
  ...
```

### トークン管理

| 項目 | 値 | 備考 |
|------|-----|------|
| 入力コンテキスト上限 | 最新 200 メッセージ（ユーザー発言のみ） | 超過時は古いものを切り捨て |
| 出力トークン上限 | `REPORT_MAX_TOKENS_OUT`（デフォルト: 2000） | 環境変数で調整可能 |
| モデル | `REPORT_LLM_MODEL` 環境変数 | チャット用とは別モデルを想定 |
| API キー | `REPORT_LLM_API_KEY`（未設定時は `OPENAI_API_KEY` にフォールバック） | チャット用と共有可 |

---

## 3. UI 設計

### 3.1 生徒用レポートページ（`/reports`）

**アクセス**: 認証済み生徒。RLS により自分のレポートのみ閲覧可能。

**画面構成**:

```
┌──────────────────────────────────────────────────────┐
│  Marubo AI        [チャット]  [レポート]  [ログアウト] │
├──────────────────────────────────────────────────────┤
│                                                      │
│  📊 学習レポート                                      │
│                                                      │
│  ┌── 月選択 ──────────────────────────────────────┐  │
│  │  [2026年2月 ▾]                                  │  │
│  └────────────────────────────────────────────────┘  │
│                                                      │
│  ┌── レポート本文（記事風表示）────────────────────┐  │
│  │                                                │  │
│  │  ## 今月の学習サマリー                          │  │
│  │  2月はAIチャットを積極的に活用し、合計32件の     │  │
│  │  質問をされました。特に数学の二次方程式...       │  │
│  │                                                │  │
│  │  ## 学習トピックの分布                          │  │
│  │  - 数学（二次方程式・因数分解）: 18件            │  │
│  │  - 英語（文法・現在完了形）: 8件                 │  │
│  │  - 理科（化学反応式）: 6件                      │  │
│  │                                                │  │
│  │  ## 理解度の所見                                │  │
│  │  数学では基礎的な計算は正確にできていますが、    │  │
│  │  文章題への応用にやや課題が見られます...          │  │
│  │                                                │  │
│  │  ## アドバイス                                   │  │
│  │  二次方程式の文章題を中心に練習することを         │  │
│  │  おすすめします...                               │  │
│  │                                                │  │
│  │  ## 利用統計                                    │  │
│  │  | 項目       | 値          |                   │  │
│  │  |-----------|-------------|                   │  │
│  │  | 質問数     | 32件        |                   │  │
│  │  | 会話数     | 15件        |                   │  │
│  │  | 最活発日   | 2/12 (8件)  |                   │  │
│  │  | 利用日数   | 18日        |                   │  │
│  │                                                │  │
│  └────────────────────────────────────────────────┘  │
└──────────────────────────────────────────────────────┘
```

**デザイン方針**:
- **note / Zenn の記事風**: 中央寄せの 1 カラム、十分な余白、読みやすいフォントサイズ
- **Markdown レンダリング**: レポート本文は Markdown で保存し、`react-markdown` + `remark-gfm` で描画
- レポートが未生成の月は「この月のレポートはまだ生成されていません」と表示

**チャット画面からの導線**:
- チャット画面のヘッダーまたはサイドバーに「📊 レポート」ボタンを配置
- クリックで `/reports` に遷移

### 3.2 スタッフ用レポートページ（`/admin/reports`）

**アクセス**: `requireStaff()` ガード。全生徒のレポートを閲覧可能。

**画面構成**:

```
┌──────────────────────────────────────────────────────┐
│  管理画面    [許可メール] [会話検索] [レポート] [権限]  │
├──────────────────────────────────────────────────────┤
│                                                      │
│  📊 月次レポート管理                                  │
│                                                      │
│  ┌── フィルタ ────────────────────────────────────┐  │
│  │ 対象月: [2026年2月 ▾]  生徒: [________]        │  │
│  │                         [🔍 検索] [▶ 手動生成]  │  │
│  └────────────────────────────────────────────────┘  │
│                                                      │
│  ┌── レポート一覧 ────────────────────────────────┐  │
│  │  生徒           ステータス   生成日時    操作   │  │
│  │  taro@...       ✅ 生成済み  02/28 23:58 [閲覧] │  │
│  │  hanako@...     ✅ 生成済み  02/28 23:59 [閲覧] │  │
│  │  jiro@...       ❌ 失敗      02/28 23:59 [再生成]│  │
│  │  ...                                            │  │
│  └────────────────────────────────────────────────┘  │
│                                                      │
│  ┌── レポート詳細（選択時）────────────────────────┐  │
│  │  （生徒用と同じ記事風表示）                      │  │
│  │  + CSV ダウンロードボタン                        │  │
│  └────────────────────────────────────────────────┘  │
└──────────────────────────────────────────────────────┘
```

**スタッフ限定機能**:
- **手動生成**: 対象月を指定して全生徒 or 特定生徒のレポートを生成（dry-run 対応）
- **再生成**: 失敗したレポートの個別再生成
- **CSV ダウンロード**: 全生徒の利用統計を CSV でダウンロード
- **全生徒一覧**: 当月のレポート生成状況を一覧表示

---

## 4. 実行の仕組み

### Vercel Cron

```
[Cron 23:55 JST] → GET /api/reports/monthly (Authorization: Bearer CRON_SECRET)
  → 「今日は月末か？」を判定
  → 月末なら：
    1. 当月アクティブな全生徒を取得
    2. 生徒ごとにチャット履歴を取得
    3. LLM に分析を依頼（順次処理。並列はレート制限リスクあり）
    4. 結果を monthly_report テーブルに保存
    5. 完了通知メールをスタッフに送信
```

### vercel.json

> Vercel Cron のスケジュールは常に UTC。`55 14 * * *` = 23:55 JST。

```json
{
  "crons": [
    {
      "path": "/api/reports/monthly",
      "schedule": "55 14 * * *"
    }
  ]
}
```

### Cron 認証

- Vercel Cron は `Authorization: Bearer ${CRON_SECRET}` ヘッダを自動付与する（`CRON_SECRET` は Vercel が自動設定）
- API 側で `verifyCronAuth()` が Authorization ヘッダを検証
- Cron は GET リクエストで呼び出す。手動実行（POST）時は `requireStaff()` による認証

### 生成フロー（詳細）

```
POST /api/reports/monthly
  ├── 認証チェック（Cron or requireStaff）
  ├── 月末判定（手動実行時はスキップ）
  ├── 当月アクティブ生徒リストを取得
  │     SELECT DISTINCT user_id FROM conversations 
  │     WHERE created_at >= month_start AND created_at < month_end
  ├── for each 生徒:
  │     ├── チャット履歴取得（ユーザーメッセージ、最新200件）
  │     ├── 利用統計を集計（質問数/会話数/最活発日/利用日数）
  │     ├── LLM にプロンプト送信 → 分析テキスト受信
  │     ├── monthly_report テーブルに upsert
  │     └── 失敗時: エラーログ + status='failed' で保存、次の生徒に進む
  ├── 全生徒完了後、通知メール送信（ADMIN_EMAILS）
  └── レスポンス返却
```

### LLM 呼び出しの注意点

- **順次処理**: レート制限を避けるため、生徒ごとに直列で処理
- **タイムアウト**: Vercel Functions のタイムアウト（Pro: 60 秒、Hobby: 10 秒）に注意
  - β 版（20 名）: 1 生徒あたり 5〜10 秒 → 全体 100〜200 秒 → **分割実行が必要**
- **分割戦略**: 1 回の Cron で全員を処理しきれない場合、`monthly_report` の `status` を見て未処理の生徒から再開する。Cron は毎日実行されるので、月末に生成が途中で止まっても翌日に再開される

---

## 5. メール通知

レポートの本体は UI で閲覧する。メールは **通知のみ** とする。

### 通知メールテンプレート

```
件名: 【Marubo AI】2026年2月 月次レポートが生成されました

━━━━━━━━━━━━━━━━━━━━━━━━━━
  Marubo AI 月次レポート通知 — 2026年2月
━━━━━━━━━━━━━━━━━━━━━━━━━━

📊 レポート生成完了

  対象月:      2026年2月
  生成件数:    18 / 18 名
  失敗件数:    0 件

  レポートは管理画面からご確認いただけます:
  https://marubo-ai.vercel.app/admin/reports?month=2026-02

━━━━━━━━━━━━━━━━━━━━━━━━━━
※ このメールは Marubo AI から自動送信されています。
```

- HTML + テキストフォールバック
- 失敗件数が 1 件以上の場合、管理画面で再生成を促すメッセージを追加

### CSV ダウンロード

従来のメール添付 CSV は廃止し、**スタッフ用管理画面にダウンロードボタン**を配置する。

**CSV 内容**（従来と同等 + 拡張）:

| 列 | 内容 |
|----|------|
| `email` | 生徒のメールアドレス |
| `display_name` | 表示名 |
| `conversations` | 当月の会話数 |
| `questions` | 当月の質問数 |
| `first_activity` | 当月最初のメッセージ日時 |
| `last_activity` | 当月最後のメッセージ日時 |
| `report_status` | レポート生成ステータス（`generated` / `failed` / `no_data`） |

---

## 6. API 仕様

### `POST /api/reports/monthly` — レポート一括生成

| 項目 | 内容 |
|------|------|
| **Auth** | Cron: `CRON_SECRET` / 手動: `requireStaff()` |
| **Runtime** | Node.js |

**リクエストボディ（手動実行時）**:

```json
{
  "month": "2026-02",
  "userId": "optional-specific-user-id",
  "dryRun": false
}
```

| パラメータ | 型 | 必須 | 説明 |
|-----------|-----|------|------|
| `month` | string (`YYYY-MM`) | はい（手動時） | 対象月 |
| `userId` | string (uuid) | いいえ | 指定すると特定生徒のみ生成 |
| `dryRun` | boolean | いいえ | `true`: LLM 呼び出しのみ、DB 保存しない。デフォルト `false` |

**レスポンス**:

```json
{
  "requestId": "report_01h9...",
  "data": {
    "month": "2026-02",
    "dryRun": false,
    "results": {
      "total": 18,
      "generated": 17,
      "failed": 1,
      "skipped": 0
    },
    "notificationSent": true
  }
}
```

### `GET /api/reports/monthly` — レポート一覧取得

| 項目 | 内容 |
|------|------|
| **Auth** | Supabase セッション（生徒: 自分のみ、スタッフ: 全員） |
| **Runtime** | Node.js |

**クエリパラメータ**:

| パラメータ | 型 | デフォルト | 説明 |
|-----------|-----|-----------|------|
| `month` | string (`YYYY-MM`) | 当月 | 対象月 |
| `userId` | string (uuid) | — | スタッフのみ使用可。特定生徒のレポート |
| `page` | number | 1 | ページ番号（スタッフ用一覧） |
| `limit` | number | 20 | 1 ページあたり件数 |

**レスポンス（生徒）**:

```json
{
  "requestId": "report_get_01h9...",
  "data": {
    "report": {
      "id": "rpt_123",
      "month": "2026-02",
      "status": "generated",
      "content": "## 今月の学習サマリー\n2月は...",
      "stats": {
        "questions": 32,
        "conversations": 15,
        "activeDays": 18,
        "mostActiveDay": "2026-02-12"
      },
      "generatedAt": "2026-02-28T23:58:00Z"
    }
  }
}
```

**レスポンス（スタッフ一覧）**:

```json
{
  "requestId": "report_list_01h9...",
  "data": {
    "reports": [
      {
        "id": "rpt_123",
        "month": "2026-02",
        "status": "generated",
        "generatedAt": "2026-02-28T23:58:00Z",
        "user": { "email": "taro@example.com", "displayName": "太郎" },
        "stats": { "questions": 32, "conversations": 15 }
      }
    ],
    "pagination": { "page": 1, "limit": 20, "total": 18, "totalPages": 1 }
  }
}
```

### `GET /api/reports/monthly/csv` — CSV ダウンロード

| 項目 | 内容 |
|------|------|
| **Auth** | `requireStaff()` |
| **Runtime** | Node.js |

**クエリパラメータ**: `month` (必須)

**レスポンス**: `Content-Type: text/csv` / `Content-Disposition: attachment; filename="marubo_ai_report_2026-02.csv"`

---

## 7. データベース設計

### `monthly_report` テーブル（`monthly_summary` を改名・拡張）

旧 `monthly_summary`（数値集計のみ）を `monthly_report`（LLM 分析テキスト + 統計）に改訂する。

```sql
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
```

### RLS ポリシー

```sql
alter table monthly_report enable row level security;

-- 生徒: 自分のレポートのみ閲覧可
-- スタッフ: 全件閲覧可
create policy monthly_report_select on monthly_report
for select to authenticated
using (
  exists (
    select 1 from app_user u
    where u.id = monthly_report.user_id
      and u.auth_uid = auth.uid()
  )
  or (auth.jwt() -> 'app_metadata' ->> 'role') = 'staff'
);

-- 書き込みは Service Role のみ（API 経由）
```

---

## 8. 集計 SQL（参考実装）

```sql
-- 生徒の当月利用統計
SELECT
  COUNT(DISTINCT c.id) AS conversations,
  COUNT(CASE WHEN m.role = 'user' THEN 1 END) AS questions,
  COUNT(DISTINCT (m.created_at AT TIME ZONE 'Asia/Tokyo')::date)
    FILTER (WHERE m.role = 'user') AS active_days,
  MIN(m.created_at) AS first_activity,
  MAX(m.created_at) AS last_activity
FROM conversations c
JOIN messages m ON m.conversation_id = c.id
WHERE c.user_id = :user_id
  AND c.created_at >= :month_start
  AND c.created_at <  :month_end;

-- 最も活発な日
SELECT
  (m.created_at AT TIME ZONE 'Asia/Tokyo')::date AS day,
  COUNT(*) AS question_count
FROM messages m
JOIN conversations c ON c.id = m.conversation_id
WHERE c.user_id = :user_id
  AND m.role = 'user'
  AND m.created_at >= :month_start
  AND m.created_at <  :month_end
GROUP BY day
ORDER BY question_count DESC
LIMIT 1;

-- ユーザーメッセージ抜粋（LLM 入力用、最新 200 件）
SELECT
  m.created_at,
  m.content
FROM messages m
JOIN conversations c ON c.id = m.conversation_id
WHERE c.user_id = :user_id
  AND m.role = 'user'
  AND m.created_at >= :month_start
  AND m.created_at <  :month_end
ORDER BY m.created_at ASC
LIMIT 200;
```

> 日時の範囲は JST 基準で当月 1 日 00:00:00 〜 翌月 1 日 00:00:00 とする。

---

## 9. エラーハンドリング

| エラー | 対応 |
|--------|------|
| LLM API 失敗（特定生徒） | `status='failed'` + `error_message` を記録。次の生徒に進む。手動で再生成可能 |
| LLM API 全面障害 | S1 通知。残りの生徒をスキップ。翌日の Cron で `status != 'generated'` の生徒から再開 |
| 集計 SQL 失敗 | S1 通知。エラーをログに記録。リトライ可能 |
| Vercel タイムアウト | `status='generating'` のままの生徒が残る。次回 Cron で再開 |
| Resend 通知メール失敗 | S2 通知（ログ記録）。レポート自体は生成済みなので問題なし |
| 対象月にデータがない | `status='generated'` + `content` に「今月は質問がありませんでした」を保存 |

---

## 10. 環境変数

| 変数 | 用途 | 例 |
|------|------|-----|
| `REPORT_LLM_MODEL` | レポート生成用 LLM モデル | `gpt-4o`, `claude-sonnet-4-20250514` 等 |
| `REPORT_LLM_API_KEY` | レポート用 LLM API キー（未設定時は `OPENAI_API_KEY` にフォールバック） | `sk-xxxx` |
| `REPORT_MAX_TOKENS_OUT` | レポート出力トークン上限 | `2000` |
| `ADMIN_EMAILS` | 通知メール送信先（`;` 区切り） | `staff1@example.com;staff2@example.com` |
| `MAIL_FROM` | 送信元アドレス | `"noreply@your-domain.example"` |
| `RESEND_API_KEY` | Resend API キー | `re_xxxx` |
| `CRON_SECRET` | Vercel Cron の認証トークン | 自動設定 |
| `APP_TIMEZONE` | タイムゾーン | `Asia/Tokyo` |

---

## 11. 将来の拡張候補（β 版対象外）

- **教科別の詳細分析**: 教科ごとのサブレポート
- **推移グラフ**: 月ごとの学習量推移を可視化
- **保護者向け共有**: レポートの限定公開リンク
- **塾全体サマリー**: 全生徒の集計レポート（スタッフ向け）
- **レポートのカスタマイズ**: スタッフがプロンプトをカスタマイズ

---

## 関連ドキュメント

- [デプロイメント](../deployment.md)（Cron 設定、環境変数）
- [データベース設計](../database.md)（`monthly_report` テーブル）
- [運用 Runbook](../operational/runbook.md)（レポート失敗時のリトライ）
- [TODO / Roadmap](../todo.md)（SPEC-10, BE-14〜15, FE-08）
