# 塾向けチャットボット（β）

> **目的**：生徒がテキスト/画像で質問し、AI（Markdown/数式対応）が回答。会話は保存され、塾スタッフが閲覧し、月末にレポート（CSV/HTML）を受け取る。

**スタック**：Next.js (Vercel) + Supabase (Postgres/Auth/Storage) + Resend (メール)  
**方針**：機能単位ディレクトリ、RLS で厳密権限、Vitest（日本語 describe）、Service Role はサーバー API でのみ使用

---

## 目次

* [プロジェクト概要](#プロジェクト概要)
* [クイックスタート](#クイックスタート)
* [ドキュメント](#ドキュメント)
* [技術スタック（要約）](#技術スタック要約)
* [ディレクトリ構成（基本）](#ディレクトリ構成基本)
* [開発フロー](#開発フロー)
* [コーディング規約（要点）](#コーディング規約要点)
* [参考リンク](#参考リンク)
* [ライセンス](#ライセンス)

---

## プロジェクト概要

### 対象

* **生徒（ユーザー）**：テキスト/画像で質問、AI 応答を閲覧、履歴確認
* **塾スタッフ（管理者）**：全生徒の会話検索/閲覧、月次レポート受信

### 範囲（β/約20名）

* テキスト/画像の質問 → AI 応答（Markdown/KaTeX）
* 会話保存・履歴
* スタッフの会話検索/閲覧
* 月次レポート（CSV/HTML）を管理者メール送信

### 非機能

* **JST（Asia/Tokyo）統一**
* スマホ最適化
* コスト制御（画像圧縮/トークン上限/クォータ）
* 監視/通知
* データ保持と削除ポリシー

---

## クイックスタート

```bash
# 前提：WSL (Ubuntu) + Node.js LTS + pnpm@9

# リポジトリクローン
git clone <repo-url>
cd <repo>

# 依存関係インストール
pnpm i

# 環境変数設定
cp .env.example .env.local
# .env.local を編集して Supabase/LLM/Resend のキーを設定

# 開発サーバー起動
pnpm dev
# http://localhost:3000
```

詳細は [docs/deployment.md](./docs/deployment.md) を参照。

---

## ドキュメント

詳細な設計・運用ドキュメントは `docs/` フォルダに格納されています。

| ドキュメント | 内容 |
|------------|------|
| [architecture.md](./docs/architecture.md) | 全体アーキテクチャ、機能一覧、技術スタック、ディレクトリ構成、認証、Markdown/LaTeX、受け入れ基準 |
| [database.md](./docs/database.md) | テーブル設計、インデックス、ER 図、データ保持・削除ポリシー |
| [rls.md](./docs/rls.md) | RLS ポリシー、JWT クレーム、Service Role の扱い、テスト方法 |
| [security.md](./docs/security.md) | 認証フロー、CSP/セキュリティヘッダ、Storage セキュリティ、Markdown サニタイズ、メール（SPF/DKIM/DMARC） |
| [deployment.md](./docs/deployment.md) | 環境変数、セットアップ、Vercel デプロイ、Cron、CI/CD、Supabase Migration |
| [testing.md](./docs/testing.md) | Vitest 設定、テスト戦略、RLS テスト、レート制限テスト、E2E |
| [coding-guidelines.md](./docs/coding-guidelines.md) | TypeScript 方針、ESLint/Prettier、コード生成規約、Conventional Commits、PR テンプレート |
| [troubleshooting.md](./docs/troubleshooting.md) | OAuth リダイレクト、RLS 不具合、Storage 403、LLM 429、メール迷惑判定、クォータ超過 |
| [operational/runbook.md](./docs/operational/runbook.md) | エラー対処設計、LLM 障害対応、月次レポート失敗リトライ、インシデント対応チェックリスト |

---

## 技術スタック（要約）

* **フロント**：Next.js 14+ (App Router, TypeScript, Tailwind, Zustand)
* **バックエンド**：Supabase (Auth/Postgres/Storage)、Next.js Route Handlers (Node.js runtime)
* **LLM**：プライマリ + フォールバック（別ベンダー/エンドポイント推奨）
* **メール**：Resend（SPF/DKIM/DMARC 必須）
* **スケジュール**：Vercel Cron（毎日 23:55 JST）
* **テスト**：Vitest + React Testing Library
* **品質**：ESLint + Prettier、TypeScript `strict: true`

詳細は [docs/architecture.md](./docs/architecture.md) を参照。

---

## ディレクトリ構成（基本）

```
.
├─ app/              # Next.js App Router（ルーティング）
├─ src/
│  ├─ features/      # 機能単位（auth, chat, conversations, admin, reports）
│  └─ shared/        # 共通（lib, components, hooks, types, utils）
├─ docs/             # 設計・運用ドキュメント
├─ public/           # 静的ファイル（KaTeX assets 等）
├─ scripts/          # Seed 等
├─ tests/            # 統合/E2E（任意）
├─ .env.example
├─ package.json
├─ vitest.config.ts
├─ tsconfig.json
├─ next.config.js
└─ vercel.json
```

詳細は [docs/architecture.md](./docs/architecture.md) を参照。

---

## 開発フロー

### セットアップ

```bash
# WSL (Ubuntu) 推奨
sudo apt update && sudo apt upgrade -y
sudo apt install -y curl git build-essential

# NVM + Node.js LTS
curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.39.7/install.sh | bash
export NVM_DIR="$HOME/.nvm"; source "$NVM_DIR/nvm.sh"
nvm install --lts

# pnpm
npm i -g pnpm@9

# プロジェクト
git clone <repo-url>
cd <repo>
pnpm i
cp .env.example .env.local
```

### 開発サーバー

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

詳細は [docs/deployment.md](./docs/deployment.md) と [docs/testing.md](./docs/testing.md) を参照。

---

## コーディング規約（要点）

### TypeScript

* **strict mode**（`strict: true`）
* **明示的な型定義**（`any` 最小限）
* **パス alias**：`@features/*`, `@shared/*`

### コンポーネント

* **単一責任**（1 コンポーネント = 1 責務）
* **Props の型定義**必須

### ファイル命名

* **コンポーネント**：PascalCase（`ChatInput.tsx`）
* **ロジック**：camelCase（`sendMessage.ts`）
* **定数**：UPPER_SNAKE_CASE（`MAX_IMAGE_SIZE`）

### Conventional Commits

```
<type>(<scope>): <subject>

例：
feat(chat): 画像圧縮機能を追加
fix(admin): 会話検索のバグを修正
docs: READMEを更新
```

### PR（Pull Request）

* スクリーンショット/動画（UI 変更時）
* テスト結果、影響範囲、レビュー観点を記載

詳細は [docs/coding-guidelines.md](./docs/coding-guidelines.md) を参照。

---

## データベース

* **Postgres (Supabase)**：app_user, conversation, message, attachment, monthly_summary, usage_counters, rate_limiter
* **RLS**：学生=自分のみ、スタッフ=全件
* **Storage**：attachments バケット（署名 URL）

詳細は [docs/database.md](./docs/database.md) と [docs/rls.md](./docs/rls.md) を参照。

---

## 認証・セキュリティ

* **Supabase Auth (Google OAuth)**
* **JWT の `app_metadata.role`** で権限制御（student/staff）
* **Service Role は Node.js ランタイムのサーバー API のみで使用**
* **CSP/HSTS/X-Frame-Options** などのセキュリティヘッダ適用
* **Markdown/LaTeX のサニタイズ**（XSS 対策）

詳細は [docs/security.md](./docs/security.md) を参照。

---

## デプロイメント

* **Vercel**：Git 連携（PR → Preview、main → Production）
* **環境変数**：Vercel Dashboard で設定
* **Cron**：毎日 23:55 JST 実行 → 月末判定でレポート送信
* **CI/CD**：GitHub Actions（Lint → TypeCheck → Test → Build）

詳細は [docs/deployment.md](./docs/deployment.md) を参照。

---

## トラブルシューティング・運用

* **OAuth リダイレクト不一致**：Supabase Provider 設定と Google 側の許可オリジンを確認
* **RLS 不具合**：`auth.uid()` と `app_user.auth_uid` の紐付け確認
* **LLM 429/Timeout**：フォールバック動作確認、バックオフ再試行
* **月次レポート失敗**：中間結果テーブル確認、管理 UI で手動リトライ

詳細は [docs/troubleshooting.md](./docs/troubleshooting.md) と [docs/operational/runbook.md](./docs/operational/runbook.md) を参照。

---

## 受け入れ基準

- [ ] 生徒がテキスト/画像で質問し、Markdown/KaTeX で表示
- [ ] RLS で生徒=自分のみ、スタッフ=全件（検証済み）
- [ ] 月次レポート送信（手動リトライ可）
- [ ] LLM 障害時のフォールバック動作
- [ ] すべての API が `requestId` を返し、S1 以上はメール通知
- [ ] `pnpm test` / `pnpm typecheck` / `pnpm lint` / `pnpm build` が成功

詳細は [docs/architecture.md](./docs/architecture.md) を参照。

---

## コントリビューション

* ブランチ：`feat/*`, `fix/*`, `chore/*`, `docs/*`
* コミット：Conventional Commits
* PR：スクショ/動画、テスト結果、影響範囲、RLS/コストへの影響を記載
* レビュー観点：RLS 破壊、コスト暴走、UX 劣化

詳細は [docs/coding-guidelines.md](./docs/coding-guidelines.md) を参照。

---

## 参考リンク

* [Next.js（App Router）](https://nextjs.org/docs)
* [Supabase](https://supabase.com/docs)
* [Vercel Cron](https://vercel.com/docs/cron-jobs)
* [Resend](https://resend.com/docs)
* [React Markdown](https://github.com/remarkjs/react-markdown)
* [KaTeX](https://katex.org/)
* [Vitest](https://vitest.dev/)
* [React Testing Library](https://testing-library.com/docs/react-testing-library/intro/)

---

## ライセンス

社内利用前提（教育目的）。外部公開時は適切な OSS ライセンスを別途検討。

