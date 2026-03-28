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
| `CHAT_LLM_MODEL` | チャット用 LLM モデル | `gpt-4o-mini` | `gpt-5.4-mini` |
| `REPORT_LLM_MODEL` | レポート生成用 LLM モデル | `gpt-4o-mini` | `gpt-5.4` |
| `REPORT_MAX_TOKENS_OUT` | レポート出力トークン上限 | `2000` | `3000` |
| `REPORT_CHUNK_SIZE` | レポート生成チャンクサイズ（1回の Cron で処理する生徒数） | `3` | `2` |
| `REPORT_DELAY_MS` | レポート生成時の生徒間ディレイ（ms） | `5000` | `3000` |
| `MONTHLY_QUOTA` | 月間質問クォータ（生徒1人あたり） | `100` | `200` |
| `MOCK_SUPABASE` | インメモリ DB モック有効化 | 未設定（無効） | `true` |
| `CRON_SECRET` | Vercel Cron 認証トークン | Vercel が自動設定 | （手動設定不要） |
| `MAX_MESSAGE_LENGTH` | チャットメッセージ文字数上限 | `2000` | サーバーサイド検証で使用 |

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
5. **CORS について**: Supabase API はデフォルトで全オリジンを許可しており、
   Storage の署名 URL も CORS 制限を受けないため、手動設定は通常不要。
   本番で画像添付時に CORS エラーが出た場合のみ対応する。

> 運用ルール：アップロードは署名 URL 経由のみ（`attachments` バケットを public にしない）。

---

## デプロイメント

### Vercel デプロイフロー

* **Git 連携**：GitHub リポジトリと自動連携
  * **PR → Preview**：Pull Request ごとにプレビュー環境を自動デプロイ
  * **main → Production**：main ブランチへのマージで本番環境へ自動デプロイ

### Middleware（認証ガード）

* `middleware.ts` が `/chat`、`/reports`、`/admin/*` への未認証アクセスを SSR レベルでブロック
* 依存: `@supabase/ssr`（Cookie ベースのセッション管理）を追加パッケージとして使用
* 本番環境では `/chat-test` もブロック（`NODE_ENV === 'production'`）

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
* 実装で **「月末7日前〜月末」判定**（`isReportGenerationWindow()`）して月次処理のみ実行
* **チャンク分割**: 1回の Cron で `REPORT_CHUNK_SIZE`（デフォルト3）人ずつ処理し、Vercel タイムアウト（60秒）と OpenAI レートリミットを回避
* 生徒間に `REPORT_DELAY_MS`（デフォルト5秒）のディレイを挿入
* 月末7日前から毎日実行し、未生成（status != 'generated'）の生徒を順次処理
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
  → isReportGenerationWindow() で月末7日前〜月末を判定
    → ウィンドウ外: { skipped: true, reason: 'not_in_window' } を返して終了
    → ウィンドウ内:
      → 未生成の生徒を REPORT_CHUNK_SIZE 人取得
      → 1人ずつレポート生成（生徒間に REPORT_DELAY_MS ディレイ）
      → 全員生成済みなら完了通知メール
      → 未完了なら翌日の Cron で残りを処理
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

### 初回デプロイ手順（Vercel）

1. **Vercel にプロジェクトを接続する**
   - [vercel.com](https://vercel.com) にログイン
   - 「Add New...」 > 「Project」 > GitHub リポジトリを選択
   - Framework Preset: `Next.js`（自動検出される）
   - Root Directory: `.`（デフォルト）
   - 「Deploy」はまだ押さない → 先に環境変数を設定

2. **Vercel に環境変数を設定する**
   - プロジェクト設定 > **Settings** > **Environment Variables**
   - 以下を1つずつ追加（Environment: Production にチェック）:

   | 変数名 | 値の取得先 |
   |--------|-----------|
   | `NEXT_PUBLIC_SUPABASE_URL` | Supabase Dashboard > Settings > API > Project URL |
   | `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Supabase Dashboard > Settings > API > anon public |
   | `SUPABASE_SERVICE_ROLE_KEY` | Supabase Dashboard > Settings > API > service_role secret |
   | `OPENAI_API_KEY` | OpenAI Dashboard > API Keys |
   | `CHAT_LLM_MODEL` | `gpt-5.4-mini`（β版予定） |
   | `REPORT_LLM_MODEL` | `gpt-5.4`（β版予定） |
   | `GRANT_ALLOWED_EMAILS` | スタッフ権限付与を許可するメールアドレス（`;` 区切り） |
   | `RESEND_API_KEY` | Resend Dashboard > API Keys（未設定でも動作するがメール通知なし） |
   | `ADMIN_EMAILS` | 障害通知先メール（`;` 区切り） |
   | `MAIL_FROM` | Resend で検証済みドメインの送信元アドレス |

   > `CRON_SECRET` は Vercel が自動生成するため手動設定不要。

3. **デプロイを実行する**
   - 「Deploy」をクリック、または main ブランチに push
   - ビルドログで `✓ Ready` が表示されれば成功

4. **本番ドメインを確認する**
   - Vercel Dashboard > プロジェクト > Settings > Domains でドメインを確認
   - 例: `marubo-ai.vercel.app`（カスタムドメイン設定も可能）

### デプロイ後の必須設定

デプロイ完了後、外部サービス側で本番ドメインを設定する必要がある。

#### A. Supabase — Redirect URL の更新
1. Supabase Dashboard > **Authentication** > **URL Configuration**
2. **Site URL** を本番ドメインに変更（例: `https://marubo-ai.vercel.app`）
3. **Redirect URLs** に本番ドメインのワイルドカードを追加:
   - `https://marubo-ai.vercel.app/**`
   - `http://localhost:3000/**`（開発用、残しておく）

#### B. Supabase — Storage CORS（通常は設定不要）
Supabase API はデフォルトで全オリジンを許可。Storage の署名 URL も CORS 制限を受けない。
本番で画像添付時に CORS エラーが出た場合のみ Supabase サポートに問い合わせる。

#### C. Google Cloud Console — 本番ドメインの追加
1. Google Cloud Console > **APIとサービス** > **認証情報**
2. OAuth 2.0 クライアント ID をクリック
3. **承認済みの JavaScript 生成元** に追加:
   - `https://marubo-ai.vercel.app`
4. 「保存」をクリック

> 詳細手順: `docs/AI-Generated01/05_google_oauth_setup_guide.md` の「本番デプロイ時のチェックリスト」参照

### Supabase DB マイグレーション一覧

初回デプロイ前に、以下のマイグレーションがすべて適用済みであることを確認する。
Supabase SQL Editor で `SELECT * FROM supabase_migrations.schema_migrations ORDER BY version;` を実行し、
すべてのバージョンが含まれていることを確認。

| # | ファイル | 内容 |
|---|---------|------|
| 1 | `20241204154500_allowlist_audit.sql` | app_user, allowed_email, audit_allowlist テーブル |
| 2 | `20260113000000_fe04_self_read.sql` | allowed_email の RLS ポリシー |
| 3 | `20260127_chat_history.sql` | conversations, messages テーブル |
| 4 | `20260226000000_be08_attachments.sql` | attachments テーブル + RLS |
| 5 | `20260227000000_be13_audit_grant.sql` | audit_grant テーブル + RLS |
| 6 | `20260228000000_be14_monthly_report.sql` | 月次レポートテーブル |
| 7 | `20260302000000_be17_rate_limit.sql` | usage_counters, rate_limiter テーブル |
| 8 | `20260314000000_gfx29_message_seq.sql` | messages に seq 列追加 |
| 9 | `20260315000000_storage_attachments_bucket.sql` | Storage バケット + ポリシー |
| 10 | `20260328000000_gfx42_initial_role.sql` | allowed_email に initial_role 列追加 |

未適用のマイグレーションがある場合:
```bash
npx supabase db push --linked --include-all
```

### デプロイ前のチェックリスト

**コード品質:**
- [ ] すべてのテストが通過（`pnpm test`）
- [ ] TypeScript エラーがない（`pnpm typecheck`）
- [ ] Lint エラーがない（`pnpm lint`）

**Vercel:**
- [ ] 環境変数がすべて設定されている（上記の表を参照）

**Supabase:**
- [ ] 全マイグレーションが適用済み（上記の表を参照）
- [ ] Storage `attachments` バケットが作成済み（非公開、5MB制限）
- [ ] RLS ポリシーが設定済み

**Google OAuth:**
- [ ] OAuth 同意画面が「本番」ステータス
- [ ] 本番ドメインが JavaScript 生成元に追加済み

**Resend（メール通知が必要な場合）:**
- [ ] DNS 設定（SPF/DKIM/DMARC）が完了
- [ ] `RESEND_API_KEY`, `ADMIN_EMAILS`, `MAIL_FROM` が Vercel に設定済み

**データ:**
- [ ] `/admin/allowlist` にβ版ユーザーが登録済み
- [ ] スタッフ用メールが `initial_role = 'staff'` で登録済み
- [ ] `GRANT_ALLOWED_EMAILS` にスタッフ権限付与者のメールが設定済み

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
