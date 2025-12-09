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
3. 以降、スキーマ変更は `supabase/migrations` に SQL を追加し `supabase db push`（ローカル）or `supabase db reset`（検証用）で同期
4. CI 等で `pnpm db:migrate`（`supabase db push` をラップ）すれば環境差異を抑制可能

> Web コンソールのみで進めたい場合は 1. の手順だけでも十分です。後から CLI に切り替える際は、既存テーブルとの差分を確認してから `supabase db diff` を実行してください。

* Seed/Import は `scripts/` 配下（例：`scripts/seed-allowlist.ts`）

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

### 月次レポート送信

* **Vercel Cron は「月末指定 L」を保証しない**ため、**毎日 23:55 JST 実行**に変更
* 実装で **「今日が月末か」判定**して月次処理のみ実行

#### vercel.json

```json
{
  "crons": [
    { 
      "path": "/api/reports/monthly", 
      "schedule": "55 23 * * *", 
      "timezone": "Asia/Tokyo" 
    }
  ]
}
```

#### 実装例（月末判定）

```ts
// app/api/reports/monthly/route.ts
import { isLastDayOfMonth } from '@shared/utils/date'

export async function GET(req: Request) {
  const today = new Date()
  if (!isLastDayOfMonth(today)) {
    return Response.json({ message: '月末ではないためスキップ' })
  }
  
  // 月次レポート生成・送信処理
  // ...
}
```

### 手動リトライ

* 管理 UI から対象月を指定して手動実行可能
* `/app/admin` に「レポート再実行」ボタンを配置
* 内部的に `/api/reports/monthly?month=2025-01` のように呼び出し

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

# マイグレーション適用
supabase db push

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

### Sentry（任意）

* エラートラッキング
* パフォーマンス監視
* リリースごとのエラー率追跡

---

## 関連ドキュメント

* [セキュリティポリシー](./security.md)
* [データベース設計](./database.md)
* [運用 Runbook](./operational/runbook.md)
* [トラブルシューティング](./troubleshooting.md)
