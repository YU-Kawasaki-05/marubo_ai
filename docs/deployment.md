# Deployment Guide

本書では、開発・検証・本番環境における **デプロイ手順と環境変数管理** をまとめる。
目的は、環境差異によるトラブルを最小化し、運用を安全かつ再現可能にすること。

## 本書で扱う内容
- Vercel デプロイフロー
- 環境変数の一覧と役割
- Cron（23:55 JST）の運用
- CI/CD（GitHub Actions）の構成
- Supabase migration の取り扱い

---

## 環境変数

> **テンプレート**: `.env.example` をコピーして `.env.local` を作成。

### 必須 ENV 一覧

本番環境で必ず設定が必要な環境変数。

| 変数名 | 用途 | 設定場所 | 例 |
|--------|------|---------|-----|
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase プロジェクト URL | Vercel + `.env.local` | `https://xxx.supabase.co` |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Supabase anon キー | Vercel + `.env.local` | `eyJhbG...` |
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase Service Role キー（サーバー API 用） | Vercel のみ | `eyJhbG...` |
| `OPENAI_API_KEY` | OpenAI API キー（チャット用） | Vercel + `.env.local` | `sk-...` |
| `RESEND_API_KEY` | Resend API キー（S1 メール通知用） | Vercel のみ | `re_...` |
| `ADMIN_EMAILS` | S1 障害通知先（`;` 区切り） | Vercel のみ | `staff1@example.com;staff2@example.com` |
| `MAIL_FROM` | メール送信元アドレス（Resend で検証済みドメイン） | Vercel のみ | `noreply@your-domain.example` |
| `GRANT_ALLOWED_EMAILS` | スタッフ権限付与を許可するメールアドレス（`;` 区切り） | Vercel のみ | `admin@example.com` |

### 任意 ENV 一覧

未設定でもデフォルト値で動作する環境変数。

| 変数名 | 用途 | デフォルト | 例 |
|--------|------|-----------|-----|
| `REPORT_LLM_MODEL` | レポート生成用 LLM モデル | `gpt-4o-mini` | `gpt-4o` |
| `REPORT_LLM_API_KEY` | レポート用 LLM API キー | `OPENAI_API_KEY` を使用 | `sk-...` |
| `REPORT_MAX_TOKENS_OUT` | レポート出力トークン上限 | `2000` | `3000` |
| `MONTHLY_QUOTA` | 月間質問クォータ（生徒1人あたり） | `100` | `200` |
| `MOCK_SUPABASE` | インメモリ DB モック有効化 | 未設定（無効） | `true` |
| `CRON_SECRET` | Vercel Cron 認証トークン | Vercel が自動設定 | （手動設定不要） |

### 注意事項

* `SUPABASE_SERVICE_ROLE_KEY` は **サーバー API（Node.js ランタイム）でのみ使用**。Edge Runtime やクライアント側には絶対に露出させない。
* `ADMIN_EMAILS` は S1 障害メール通知の宛先。ロール付与判定には使用しない（`GRANT_ALLOWED_EMAILS` を使用）。
* `CRON_SECRET` は Vercel が自動生成・設定する。手動で設定する必要はない。ローカル開発では未設定のため Cron 認証は常にスキップされる。

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

#### 1. Supabase SQL Editor での初期セットアップ（推奨スタート手順）

1. Supabase ダッシュボードで `SQL` → `New query`
2. `supabase/migrations/20241204154500_allowlist_audit.sql` の内容をコピペして `Run`
   * `app_user` / `allowed_email` / `audit_allowlist` の 3 テーブルが作成される
   * 退会時の監査ログや `updated_by` など API が期待する列が揃う
3. `.env.local` に `NEXT_PUBLIC_SUPABASE_URL` / `NEXT_PUBLIC_SUPABASE_ANON_KEY` / `SUPABASE_SERVICE_ROLE_KEY` を設定
4. `pnpm dev` または `pnpm test` で疎通確認

#### 2. Supabase CLI + Migration での運用

1. `npm i -g supabase` で CLI を導入（初回のみ）
2. `supabase login` → `supabase init`
3. 以降、スキーマ変更は `supabase/migrations` に SQL を追加し `pnpm db:push`（ローカル）or `supabase db reset`（検証用）で同期
4. **本番適用は必ず dry-run → push の順で実施する**
   ```bash
   pnpm db:push:dry   # 差分確認（適用はしない）
   pnpm db:push       # 問題なければ本適用
   ```

> Web コンソールのみで進めたい場合は 1. の手順だけでも十分です。後から CLI に切り替える際は、既存テーブルとの差分を確認してから `supabase db diff` を実行してください。

* Seed/Import は `scripts/` 配下（例：`scripts/seed-allowlist.ts`）

#### 3. Storage（attachments バケット）手動セットアップ

> `attachments` バケット作成・Storage ポリシー・CORS は **Supabase コンソールでの手動作業**。

1. Supabase Dashboard → **Storage** → **Buckets** → **New bucket**
2. 以下で作成
   * Name: `attachments`
   * Public bucket: `OFF`（非公開）
3. SQL Editor で `docs/database.md` の `### Storage バケット/ポリシー` 節にある `create policy attachments_read on storage.objects ...` を実行
4. SQL Editor で確認
   ```sql
   select id, name, public
   from storage.buckets
   where id = 'attachments';

   select policyname, cmd
   from pg_policies
   where schemaname = 'storage'
     and tablename = 'objects'
     and policyname = 'attachments_read';
   ```
5. Supabase Dashboard → **Project Settings** → **API** → CORS（Allowed Origins）で、少なくとも以下が許可されていることを確認
   * `http://localhost:3000`
   * Preview / Production のフロントエンド URL

> 運用ルール：アップロードは署名 URL 経由のみ（`attachments` バケットを public にしない）。

---

## デプロイメント

### Vercel デプロイフロー

* **Git 連携**：GitHub リポジトリと自動連携
  * **PR → Preview**：Pull Request ごとにプレビュー環境を自動デプロイ
  * **main → Production**：main ブランチへのマージで本番環境へ自動デプロイ

### ランタイム設定

* **Service Role を使う Route は Node.js ランタイム強制**

```ts
// app/api/chat/route.ts
export const runtime = 'nodejs' // Edge Runtime は使用しない
```

* Edge Runtime では環境変数のリークリスクがあるため、Service Role を扱う API では Node.js を使用

### 環境別設定

| 環境 | ブランチ | ENV | 用途 |
|------|---------|-----|------|
| Production | main | 本番用シークレット | 実運用 |
| Preview | feature/* | 開発用キー | PR レビュー |
| Development | ローカル | .env.local | 開発 |

---

## Cron（スケジュール）

### 月次レポート生成

* **Vercel Cron は「月末指定 L」を保証しない**ため、**毎日 23:55 JST 実行**に変更
* 実装で **「今日が月末か」判定**して月次処理のみ実行
* 月末には各生徒のチャット履歴を LLM が分析し、個別学習レポートを生成・保存
* 生成完了後、スタッフに通知メールを送信（レポート本体は UI で閲覧）

#### vercel.json

> **重要**: Vercel Cron のスケジュールは **常に UTC** で指定する。`timezone` フィールドは未サポート。

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

* `55 14 * * *` = 毎日 14:55 UTC = **23:55 JST**
* Vercel Cron は **GET リクエスト** で呼び出す（`Authorization: Bearer ${CRON_SECRET}` ヘッダ自動付与）
* `CRON_SECRET` は Vercel が自動生成・自動設定する環境変数（手動設定不要）
* User-Agent: `vercel-cron/1.0`

#### 実行フロー

```
Vercel Cron (毎日 23:55 JST)
  → GET /api/reports/monthly (Authorization: Bearer CRON_SECRET)
  → verifyCronAuth() で認証
  → isLastDayOfMonth() で月末判定
    → 月末でない場合: { skipped: true, reason: 'not_last_day' } を返して終了
    → 月末の場合: 全生徒のレポートを一括生成 → 完了通知メール
```

### 手動実行（スタッフ）

管理 UI (`/admin/reports`) から対象月を指定して実行する。内部的に `POST /api/reports/monthly` を呼び出す。

#### dry-run（DB 保存なし、LLM 呼び出しのみ）

```bash
curl -X POST https://<your-domain>/api/reports/monthly \
  -H "Authorization: Bearer <staff-session-token>" \
  -H "Content-Type: application/json" \
  -d '{"month": "2026-03", "dryRun": true}'
```

#### 本実行（全生徒一括生成）

```bash
curl -X POST https://<your-domain>/api/reports/monthly \
  -H "Authorization: Bearer <staff-session-token>" \
  -H "Content-Type: application/json" \
  -d '{"month": "2026-03"}'
```

#### 特定生徒のみ再生成

```bash
curl -X POST https://<your-domain>/api/reports/monthly \
  -H "Authorization: Bearer <staff-session-token>" \
  -H "Content-Type: application/json" \
  -d '{"month": "2026-03", "userId": "<app_user.id>"}'
```

> **注意**: スタッフの session token は Supabase Auth のログイントークン。管理 UI からの操作が推奨。

---

## CI/CD

### GitHub Actions

* **Lint → TypeCheck → Test → Build** の順で実行
* PR ごとに自動実行、main へのマージでも実行

#### .github/workflows/ci.yml

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
        with: 
          version: 9
      
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

### CI での環境変数

* **`pnpm build` を CI で実行する場合**：
  * `SUPABASE_SERVICE_ROLE_KEY` や `RESEND_API_KEY` などサーバー専用シークレットは注入しない
  * `NEXT_PUBLIC_*` のみ許可
* **CI では build をスキップ**してもよい（Preview は Vercel 側で自動ビルド）

### デプロイ前のチェックリスト

- [ ] すべてのテストが通過（`pnpm test`）
- [ ] TypeScript エラーがない（`pnpm typecheck`）
- [ ] Lint エラーがない（`pnpm lint`）
- [ ] 環境変数が Vercel に正しく設定されている
- [ ] Supabase の RLS ポリシーが staging で検証済み
- [ ] Resend の DNS 設定（SPF/DKIM/DMARC）が完了

---

## Supabase Migration

### 現在の運用

* Supabase Dashboard の SQL Editor で手動実行
* DDL は README または `docs/database.md` に記載

### 将来の推奨運用

* **Supabase CLI** を使った migration 管理

```bash
# Supabase CLI のインストール
npm i -g supabase

# プロジェクトの初期化
supabase init

# マイグレーションファイル作成
supabase migration new create_app_user_table

# 本番適用（安全手順）
pnpm db:push:dry
pnpm db:push

# リモートとローカルの同期
supabase db pull
```

### マイグレーションファイルの管理

* `supabase/migrations/` にバージョン管理
* Git で履歴を追跡
* staging → production の順で適用

---

## ロールバック手順

### Vercel デプロイのロールバック

1. Vercel Dashboard → Deployments
2. 前回の安定版デプロイを選択
3. 「Promote to Production」をクリック

### データベース変更のロールバック

1. Supabase Dashboard → SQL Editor
2. ロールバック用 SQL を実行（事前に用意）
3. アプリケーションを再デプロイ

---

## モニタリング

### Vercel Analytics

* **リアルタイムアクセス解析**
* **パフォーマンス指標**（Core Web Vitals）

### Supabase Logs

* **Postgres Logs**：スロークエリ、RLS エラー
* **API Logs**：認証エラー、Storage エラー

### Resend Dashboard

* メール送信状況、Bounce、Complaint の確認
* 詳細は下記「Resend セットアップ」セクションを参照

### Sentry（任意）

* エラートラッキング
* パフォーマンス監視
* リリースごとのエラー率追跡

---

## Resend セットアップ

S1 重大障害時のメール通知および月次レポート生成完了通知に [Resend](https://resend.com/) を使用する。

### 1. アカウント作成と API キー取得

1. [resend.com](https://resend.com/) でアカウントを作成
2. ダッシュボード → **API Keys** → **Create API Key**
   * Name: `marubo-ai-production`（任意）
   * Permission: `Full access`（送信のみなら `Sending access` でも可）
3. 生成された API キー（`re_...`）を Vercel の環境変数 `RESEND_API_KEY` に設定

### 2. 送信ドメイン検証（DNS 設定）

> **独自ドメインなしでもテスト可能**: Resend のデフォルト送信元 `onboarding@resend.dev` で開発・テストが可能。本番運用前に独自ドメインを設定する。

1. Resend ダッシュボード → **Domains** → **Add Domain**
2. 使用するドメイン（例: `your-domain.example`）を入力
3. 表示された DNS レコードをドメインの DNS 管理画面に追加:
   * **SPF**: `v=spf1 include:amazonses.com ~all` 相当の TXT レコード
   * **DKIM**: Resend が指示する CNAME レコード（3 件）
   * **DMARC**: `v=DMARC1; p=none;` の TXT レコード（推奨）
4. Resend ダッシュボードで **Verify** をクリック（DNS 伝播に最大 72 時間）
5. ステータスが **Verified** になったら完了

```bash
# DNS 設定確認コマンド
dig TXT your-domain.example          # SPF
dig CNAME resend._domainkey.your-domain.example  # DKIM
dig TXT _dmarc.your-domain.example   # DMARC
```

### 3. 環境変数の設定

Vercel Dashboard → **Settings** → **Environment Variables** で以下を設定:

| 変数 | 値 | 環境 |
|------|-----|------|
| `RESEND_API_KEY` | `re_...`（Step 1 で取得） | Production |
| `ADMIN_EMAILS` | 通知先メール（`;` 区切り） | Production |
| `MAIL_FROM` | `noreply@your-domain.example`（Step 2 で検証済みドメイン） | Production |

### 4. 動作確認

デプロイ後、以下で通知メールが届くことを確認:

1. **S1 通知テスト**: 意図的にサーバーエラーを発生させるか、Vercel Logs で `[notifier][S1]` ログを確認
2. **Resend Dashboard**: Emails タブで送信履歴・配信ステータスを確認
3. **Bounce/Complaint**: Resend Dashboard で不達がないことを確認

### トラブルシューティング

| 症状 | 原因 | 対処 |
|------|------|------|
| メールが届かない | `RESEND_API_KEY` 未設定 | Vercel 環境変数を確認。ログに `RESEND_API_KEY or ADMIN_EMAILS not set` が出る |
| メールが迷惑メールに入る | DNS 未検証 | SPF/DKIM/DMARC レコードを確認（`dig` コマンドで検証） |
| Resend API 403 | API キーの権限不足 or ドメイン未検証 | Resend ダッシュボードでキー権限とドメインステータスを確認 |
| `MAIL_FROM` エラー | 送信元ドメインが未検証 | Resend で Verified 済みのドメインを使用する |

---

## 関連ドキュメント

* [セキュリティポリシー](./security.md)
* [データベース設計](./database.md)
* [運用 Runbook](./operational/runbook.md)
* [トラブルシューティング](./troubleshooting.md)
