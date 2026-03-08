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

* Google ログイン（Supabase Auth）→ ロール別ルーティング（生徒→`/chat`、スタッフ→`/admin`）
* テキスト/画像の同時送信（`<textarea>` auto-resize、Shift+Enter で改行）、AI 応答（Markdown/LaTeX）
* ストリーム中断/再送信ボタン、オフラインバナー表示
* 会話履歴一覧/詳細（モバイルはハンバーガーメニューでドロワー表示）
* 会話削除（サイドバーのゴミ箱ボタン + 確認ダイアログ）
* 月次学習レポート閲覧（`/reports`）
* 利用状況表示（ヘッダーに「残り N/100」表示、閾値で色分け）
* 入力チェック（画像サイズ/形式、メッセージ文字数 2000 文字以内）、送信失敗の再試行
* パスワードリセット（`/reset-password`）
* ログアウト機能（全ページヘッダーに配置）

### スタッフ

* Google ログイン（管理者ロール）→ `/admin` ダッシュボード（4機能へのカードリンク）
* 会話検索（期間/ユーザー）— N+1 クエリ最適化済み（SQL COUNT + GROUP BY）
* 会話詳細閲覧（添付画像のサムネイル表示対応）
* 月次レポート閲覧・手動生成・再生成・CSV ダウンロード
* スタッフ権限付与（UI から）
* ログアウト機能（全管理画面ヘッダーに配置）
* React ConfirmDialog による操作確認（`window.confirm/alert` を廃止）

### 共通/自動処理

* **Next.js Middleware** による認証ガード（未認証→`/login` リダイレクト、`/chat-test` は本番遮断）
* **Error Boundary**（`app/error.tsx`, `app/chat/error.tsx`）による graceful エラー回復
* **loading.tsx / not-found.tsx** によるローディング表示とカスタム 404
* **セッション有効期限管理**（`onAuthStateChange` + `SessionExpiredModal`）
* 画像アップロード（**短寿命の署名URL** + 期限切れ時の自動再署名）
* **DBベース**のクォータ/レート制限 + **サーバーサイドバリデーション**（添付枚数 3 枚、メッセージ 2000 文字）
* LLM 再試行/フォールバック
* **毎日 23:55 実行 → 月末判定** → LLM が生徒個別の学習レポートを生成・保存 → 通知メール送信
* 重大エラー通知（Resend メール、Sentry 任意）

### CSVファイルの取り扱い

* **保存**: サーバーやストレージには**保存しない**。
    * 理由: 個人情報（メールアドレス）を含むため、漏洩リスクを最小化するため。また、件数が数千件程度と想定され、一時保存の必要がないため。
* **処理**: クライアントから送信されたCSVデータは、メモリ上で即時にパース（解析）・検証・DB登録を行い、処理完了後に破棄する。
* **ログ**: 個人情報（メールアドレス等）を含む生データはログに出力しない。件数やエラー内容のみ記録する。

---

## 技術スタック

* **フロント**：Next.js 14+（App Router, TypeScript, Tailwind, Zustand）
  Markdown/LaTeX：`react-markdown` + `remark-gfm` + `remark-math` + `rehype-katex`
  AI Client：`Vercel AI SDK (ai)` - `useChat`フックによるステート管理とストリーミング受信
* **バックエンド**：Supabase（Auth/Postgres/Storage）、Next.js Route Handlers（/app/api/\*\*、 **Node.js runtime**）
* **LLM**：Vercel AI SDK Core (`@ai-sdk/openai`)
  プライマリ + フォールバック構成（可能な限り別ベンダー/エンドポイント）
* **メール**：Resend（送信ドメインは SPF/DKIM/DMARC 必須）
* **スケジュール**：Vercel Cron（毎日 23:55 JST）
* **テスト**：Vitest（`jsdom`）+ React Testing Library
* **品質**：ESLint + Prettier、TypeScript `strict: true`

---

## チャット永続化フロー（追加）

```
[Browser]
  ├─ POST /api/chat
  │    ├─ AI 応答をストリーミング返却
  │    └─ onFinish で Supabase (conversations/messages) に保存
  ├─ GET /api/conversations         # 一覧（created_at desc, cursor pagination）
  └─ GET /api/conversations/[id]    # 詳細（messages asc）

[Supabase]
  ├─ conversations: id, user_id, title, created_at
  └─ messages: id, conversation_id, role (user|assistant), content, created_at
     (RLS: user_id = auth.uid(), staff は全件可)
```

* タイトルは先頭発話30–50文字。無ければ日時を採用。
* フロントはサイドバーで一覧を表示し、選択した会話を `/api/conversations/[id]` で読み込む。

---

## アーキテクチャ概要

```
[Browser]
  ├─ middleware.ts : Supabase セッション cookie 検証（@supabase/ssr）
  │                 未認証→/login リダイレクト、/chat-test 本番遮断
  ├─ /login       : ログイン → /api/sync-user → ロール別ルーティング
  ├─ /reset-password: パスワードリセット（PASSWORD_RECOVERY イベント）
  ├─ /chat        : 生徒UI（送信/履歴閲覧/モバイルドロワー/利用状況表示）
  ├─ /reports     : 生徒用学習レポート閲覧
  ├─ /admin       : スタッフ ダッシュボード（4機能へのカードリンク）
  └─ fetch  : /api/*
         ├─ chat            : LLM呼び出し＋保存（Service RoleでDB書込、添付枚数/文字数検証）
         ├─ conversations/[id] DELETE : 会話削除（CASCADE: messages/attachments）
         ├─ attachments/sign: 署名URL発行（Storage直PUT）
         ├─ usage           : 当月利用状況取得（usage_counters 集計）
         ├─ reports/monthly : LLM分析→レポート生成・保存（Cron/手動）、一覧取得、CSVダウンロード
         ├─ sync-user       : 初回ログイン同期（role=student固定）
         ├─ admin/grant     : 管理者ロール付与（requireStaff() + GRANT_ALLOWED_EMAILS）
         └─ admin/attachments/signed-url : 管理者用画像署名URL（Service Role）

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
├─ middleware.ts                       # 認証ガード（@supabase/ssr）+ /chat-test 本番遮断
├─ app/
│  ├─ error.tsx                       # ルートレベル Error Boundary
│  ├─ loading.tsx                     # グローバルローディング UI
│  ├─ not-found.tsx                   # カスタム 404 ページ
│  ├─ login/page.tsx                  # ログイン + パスワードリセット導線
│  ├─ reset-password/page.tsx         # パスワード再設定
│  ├─ chat/
│  │  ├─ page.tsx                     # チャット画面（モバイルドロワー対応）
│  │  ├─ error.tsx                    # チャット専用 Error Boundary
│  │  └─ loading.tsx                  # チャットスケルトン UI
│  ├─ reports/page.tsx                # 生徒用学習レポート閲覧
│  ├─ admin/
│  │  ├─ page.tsx                     # ダッシュボード（4機能カードリンク）
│  │  ├─ error.tsx                    # 管理画面 Error Boundary（任意）
│  │  ├─ allowlist/page.tsx           # 許可メール管理
│  │  ├─ conversations/page.tsx       # 会話検索・閲覧
│  │  ├─ reports/page.tsx             # スタッフ用レポート管理
│  │  └─ grant/page.tsx               # スタッフ権限付与
│  ├─ api/
│  │  ├─ chat/route.ts                # 添付枚数/文字数サーバー検証付き
│  │  ├─ conversations/[id]/route.ts  # GET + DELETE（CASCADE）
│  │  ├─ attachments/sign/route.ts
│  │  ├─ usage/route.ts              # 当月利用状況（GET）
│  │  ├─ reports/monthly/route.ts
│  │  ├─ reports/monthly/csv/route.ts
│  │  ├─ sync-user/route.ts
│  │  └─ admin/
│  │      ├─ grant/route.ts
│  │      ├─ allowlist/route.ts
│  │      ├─ conversations/route.ts   # 会話一覧検索（N+1最適化済み）
│  │      ├─ conversations/[id]/route.ts
│  │      └─ attachments/signed-url/route.ts  # 管理者用画像署名
│  ├─ layout.tsx  # KaTeX CSSのimportをここで実施
│  └─ page.tsx / globals.css
├─ src/
│  ├─ features/
│  │  ├─ auth/           (guard.ts, getSession.ts, SignInButton.tsx)
│  │  ├─ chat/           (sendMessage.ts, compressImage.ts, quota.ts, validators.ts, UI)
│  │  ├─ conversations/  (queries.ts, UI)
│  │  ├─ admin/
│  │  │  ├─ search/      (AdminTable.tsx など会話検索)
│  │  │  └─ allowlist/   (AllowedEmailTable.tsx, useAllowlistMutations.ts)
│  │  └─ reports/        (generateReport.ts, reportPrompt.ts, toCsv.ts, jobs/runMonthly.ts)
│  ├─ shared/
│  │  ├─ lib/            (supabaseClient.ts, supabaseAdmin.ts, llm.ts, mailer.ts,
│  │  │                   errors.ts, errorPresenter.ts, apiHandler.ts, notifier.ts)
│  │  ├─ components/     (ConfirmDialog.tsx, SessionExpiredModal.tsx, OfflineBanner.tsx)
│  │  ├─ hooks/          (useLogout.ts, useNetworkStatus.ts)
│  │  ├─ types/ utils/
│  └─ styles/
├─ supabase/            (Supabase 用マイグレーション SQL。SQL Editor/CLI どちらでも利用可能)
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
* 初回ログイン時に `/api/sync-user` で `allowed_email` テーブル（`status = 'active'`）を参照し、許可されているメールかをチェック → OK なら `app_user` に upsert（role は student 固定）
* スタッフへの昇格は `/api/admin/grant` で実施（`requireStaff()` + `GRANT_ALLOWED_EMAILS` 制限）
* JWT の `app_metadata.role` を RLS が参照し、権限を制御

詳細は [セキュリティポリシー](./security.md) を参照。

### 生徒オンボーディングの流れ

1. **スタッフが許可リストを登録**：`allowed_email` テーブル（将来的には `/admin/allowlist` UI）に Gmail アドレスを `status='active'` で追加。退会時は `revoked` に変更すると即座にログイン不可になる。
2. **生徒が Google ログイン**：Supabase Auth が JWT を発行し、Next.js クライアントが `/api/sync-user` を叩く。
3. **サーバー側チェック**：Route Handler が Service Role で `allowed_email` を照合。存在しなければ HTTP 403 / `pending` の場合は 409 を返し、フロントで「まだ利用開始できません」と案内。
4. **app_user 作成**：許可されていれば `app_user` に upsert。以後は RLS により本人データのみ閲覧可。
5. **権限変更**：必要に応じて `/api/admin/grant` で `staff` に昇格。許可リスト自体は `staff` しか閲覧できない。

> **季節トラフィックへの備え**：許可リストは CSV/Spreadsheet からバッチ登録できる seed スクリプト（例：`pnpm tsx scripts/seed-allowlist.ts spreadsheet.csv`）を用意すると、受験期の一括登録に対応しやすい。

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
- [ ] **毎日 23:55 実行**で**月末のみ**生徒個別レポート生成（手動リトライ可）
- [ ] LLM 障害/429 で**即時案内＋自動再試行/フォールバック**
- [ ] エラーレスポンスを返す API に **`requestId`** が含まれ、S1 以上は**メール通知**

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
* **月次レポート管理**（`/admin/reports`）：全生徒のレポート閲覧・手動生成・再生成・CSV ダウンロード
* **スタッフ権限付与**（`/admin/grant`）：指定メールのユーザーを `staff` に昇格（付与可能者 2 名限定）
* **許可メール管理（/admin/allowlist）**：`allowed_email` の登録/状態変更/CSV インポート。`status` ごとに色分けし、変更履歴を `audit_allowlist` に記録

### アクセス制御

* **Middleware 認証ガード**（`middleware.ts`）: `/chat`, `/reports`, `/admin/*` への未認証アクセスを `/login` にリダイレクト
* **AllowlistGuard**（クライアント側）: 二重チェックとして維持。`status !== 'active'` の場合はホームにリダイレクト
* RLS により `auth.jwt() -> 'app_metadata' ->> 'role' = 'staff'` のみアクセス可能
* `/app/admin/page.tsx` で `requireStaff()` ガードを適用
* **ログアウト**: 全ページヘッダーに配置。`supabase.auth.signOut()` → `/login` にリダイレクト

---

## 関連ドキュメント

* [データベース設計](./database.md)
* [RLS ポリシー](./rls.md)
* [セキュリティポリシー](./security.md)
* [デプロイメント](./deployment.md)
* [テストガイドライン](./testing.md)
* [コーディングガイドライン](./coding-guidelines.md)
