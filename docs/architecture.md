# Architecture

本書では、本システムの **全体アーキテクチャ** を整理する。
目的は、開発者が「データの流れ・依存関係・権限境界」を即座に理解できる状態を作ること。

## 本書で扱う内容
- システム全体構成図
- クライアント / API / Supabase / Cron の責務
- スタック構成（Next.js、Supabase、Resend）
- 表示（Markdown/KaTeX）の仕組み
- ロール（student / staff）の権限境界
- 管理 UI の構成とフロー

---

## 機能一覧

### 生徒

* Google ログイン（Supabase Auth）
* テキスト/画像の同時送信、AI 応答（Markdown/LaTeX）
* 会話履歴一覧/詳細
* 入力チェック（画像サイズ/形式）、送信失敗の再試行

### スタッフ

* Google ログイン（管理者ロール）
* 会話検索（期間/ユーザー）
* 会話詳細閲覧
* 月次レポート受信（CSV/HTML）、**管理UIで手動リトライ**

### 共通/自動処理

* 画像アップロード（**短寿命の署名URL**）
* **DBベース**のクォータ/レート制限
* LLM 再試行/フォールバック
* **毎日 23:55 実行 → 月末判定** でレポート送信
* 重大エラー通知（Resend メール、Sentry 任意）

---

## 技術スタック

* **フロント**：Next.js 14+（App Router, TypeScript, Tailwind, Zustand）
  Markdown/LaTeX：`react-markdown` + `remark-gfm` + `remark-math` + `rehype-katex`
* **バックエンド**：Supabase（Auth/Postgres/Storage）、Next.js Route Handlers（/app/api/\*\*、 **Node.js runtime**）
* **LLM**：プライマリ + フォールバック（可能な限り別ベンダー/エンドポイント）呼び出し
* **メール**：Resend（送信ドメインは SPF/DKIM/DMARC 必須）
* **スケジュール**：Vercel Cron（毎日 23:55 JST）
* **テスト**：Vitest（`jsdom`）+ React Testing Library
* **品質**：ESLint + Prettier、TypeScript `strict: true`

---

## アーキテクチャ概要

```
[Browser]
  ├─ /chat  : 生徒UI（送信/履歴閲覧）
  ├─ /admin : スタッフUI（検索/閲覧/レポート再実行）
  └─ fetch  : /api/*
         ├─ chat            : LLM呼び出し＋保存（Service RoleでDB書込）
         ├─ attachments/sign: 署名URL発行（Storage直PUT）
         ├─ reports/monthly : 集計→CSV/HTML→メール送信（Cron/手動）
         ├─ sync-user       : 初回ログイン同期（role=student固定）
         └─ admin/grant     : 管理者ロール付与（Service Role + 内部トークン）

[Next.js on Vercel (Node runtime)] ── uses ── [Supabase]
                                          ├─ Auth (Google)
                                          ├─ Postgres (RLS)
                                          └─ Storage (attachments)

[Resend] ← レポート/障害通知
```

---

## ディレクトリ構成

> **機能単位**で実装。ルーティングは `app/`、ロジックは `src/features/**` に集約。

```
.
├─ app/
│  ├─ chat/page.tsx
│  ├─ admin/page.tsx
│  ├─ api/
│  │  ├─ chat/route.ts
│  │  ├─ attachments/sign/route.ts
│  │  ├─ reports/monthly/route.ts
│  │  ├─ sync-user/route.ts
│  │  └─ admin/
│  │      └─ grant/route.ts      # 管理者ロール付与API（Service Role + 内部トークン必須）
│  ├─ layout.tsx  # KaTeX CSSのimportをここで実施
│  └─ page.tsx / globals.css
├─ src/
│  ├─ features/
│  │  ├─ auth/           (guard.ts, getSession.ts, SignInButton.tsx)
│  │  ├─ chat/           (sendMessage.ts, compressImage.ts, quota.ts, validators.ts, UI)
│  │  ├─ conversations/  (queries.ts, UI)
│  │  ├─ admin/          (search.ts, AdminTable.tsx)
│  │  └─ reports/        (monthlySql.ts, toCsv.ts, jobs/runMonthly.ts)
│  ├─ shared/
│  │  ├─ lib/            (supabaseClient.ts, supabaseAdmin.ts, llm.ts, mailer.ts,
│  │  │                   errors.ts, errorPresenter.ts, apiHandler.ts, notifier.ts)
│  │  ├─ components/ hooks/ types/ utils/
│  └─ styles/
├─ public/                (katex assets 等)
├─ scripts/               (seed等)
├─ tests/                 (統合/E2E 任意) ※単体は同ファイル内に記述
├─ .env.example
├─ package.json
├─ vitest.config.ts
├─ tsconfig.json
├─ next.config.js
├─ vercel.json
├─ .eslintrc.cjs
└─ .prettierrc
```

---

## 認証システム（概要）

* **Supabase Auth（Google OAuth）**を使用
* 初回ログイン時に `/api/sync-user` で `app_user` テーブルに upsert（role は student 固定）
* スタッフへの昇格は `/api/admin/grant` で実施（内部トークン必須）
* JWT の `app_metadata.role` を RLS が参照し、権限を制御

詳細は [セキュリティポリシー](./security.md) を参照。

---

## 表示（Markdown/LaTeX）

### 使用ライブラリ

* `react-markdown`：Markdown レンダリング
* `remark-gfm`：GitHub Flavored Markdown（テーブル、取り消し線など）
* `remark-math`：数式ブロックのパース
* `rehype-katex`：KaTeX による数式レンダリング
* `rehype-sanitize`：XSS 対策のサニタイズ

### KaTeX CSS の読み込み

```tsx
// app/layout.tsx
import 'katex/dist/katex.min.css'
```

### サニタイズ設定

```ts
import rehypeSanitize, { defaultSchema } from 'rehype-sanitize'

const customSchema = {
  ...defaultSchema,
  attributes: {
    ...defaultSchema.attributes,
    span: [...(defaultSchema.attributes?.span || []), 'className'],
    div: [...(defaultSchema.attributes?.div || []), 'className'],
  },
  tagNames: [...(defaultSchema.tagNames || []), 'math', 'semantics'],
}

<ReactMarkdown
  remarkPlugins={[remarkGfm, remarkMath]}
  rehypePlugins={[[rehypeSanitize, customSchema], rehypeKatex]}
>
  {content}
</ReactMarkdown>
```

* **拒否**：`<script>`, `onerror`, `javascript:` プロトコル
* **許可**：KaTeX の `span.katex*`, `div.katex-display` など

詳細は [セキュリティポリシー](./security.md) を参照。

---

## 受け入れ基準（完成の定義）

### 機能要件

- [ ] 生徒がテキスト/画像で質問し、**Markdown/KaTeX** で崩れず表示される
- [ ] 自分の会話のみ閲覧、スタッフは**全件**（RLS 検証済み）
- [ ] **毎日 23:55 実行**で**月末のみ**レポート送信（手動リトライ可）
- [ ] LLM 障害/429 で**即時案内＋自動再試行/フォールバック**
- [ ] すべての API が **`requestId`** を返し、S1 以上は**メール通知**

### 非機能要件

- [ ] `pnpm test` / `pnpm typecheck` / `pnpm lint` / `pnpm build` が成功
- [ ] **SLO 例**：テキストのみの質問に対する p95 応答時間 3 秒以内（平常時）
- [ ] **SLO 例**：LLM API 障害時にフォールバックで救済できる割合を 80% 以上に維持
- [ ] セキュリティヘッダ（CSP, HSTS, X-Frame-Options など）が適用されている
- [ ] SPF/DKIM/DMARC が設定され、メールが迷惑フォルダに入らない

### テスト要件

- [ ] RLS テスト（学生=自分のみ、スタッフ=全件）
- [ ] レート制限テスト（上限直前=許可、超過=429）
- [ ] Markdown/LaTeX サニタイズテスト（XSS 防御＋KaTeX 表示）
- [ ] LLM フォールバックテスト（プライマリ失敗→フォールバック成功）
- [ ] E2E テスト（ログイン→質問→回答→履歴表示）

---

## 管理 UI の構成とフロー

### スタッフ用機能

* **会話検索**：期間/ユーザーでフィルタリング
* **会話詳細閲覧**：メッセージ一覧、画像表示、タイムスタンプ
* **月次レポート手動リトライ**：対象月を指定して再実行

### アクセス制御

* RLS により `auth.jwt() -> 'app_metadata' ->> 'role' = 'staff'` のみアクセス可能
* `/app/admin/page.tsx` で `requireStaff()` ガードを適用

---

## 関連ドキュメント

* [データベース設計](./database.md)
* [RLS ポリシー](./rls.md)
* [セキュリティポリシー](./security.md)
* [デプロイメント](./deployment.md)
* [テストガイドライン](./testing.md)
* [コーディングガイドライン](./coding-guidelines.md)
