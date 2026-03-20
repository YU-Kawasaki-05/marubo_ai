# Gap Fix Agent 向け PR プロンプト集（GFX-01〜GFX-25）

このファイルは、`docs/AI-Generated01/03_gap_analysis_and_proposals.md` で洗い出された
**GAP-01〜GAP-27 の 27 件**を修正するための PR 単位のプロンプト集です。
既存の `memo/prompt/014_Prompts_forAgent.md` と同じフォーマット・品質基準に準拠しています。

前提: `CLAUDE.md` を参照して作業すること。

---

## 0. 使い方（必読）

1. 下の `GFX-xx` を **スプリント順** に選ぶ。
2. コードブロック内をそのまま Agent に渡す。
3. Agent の PR をレビューする。
4. 「人間作業ゲート」がある場合は手動で実施。
5. 次の `GFX-xx` に進む。

---

## 0.5 プロンプト採点チェック（渡す前に 30 秒で確認）

- [ ] 1PR で完結するスコープになっている（機能を混ぜていない）
- [ ] `Scope` に「変更 OK」と「変更 NG」が両方ある
- [ ] `Acceptance Criteria` が機械判定できる文章になっている
- [ ] 実行コマンド（`pnpm lint/typecheck/test`）が含まれている
- [ ] 外部サービス・ENV で詰まった時の停止条件がある
- [ ] PR 本文の報告フォーマット（What/Why/How to test）が指定されている

---

## 0.6 並列実行ガイド

基本方針:
- **依存のない PR だけ**並列実行する（最大 2〜3 本推奨）。
- 同じファイル（特に `ChatInterface.tsx`、`/api/chat/route.ts`、`app/chat/page.tsx`）を触る PR 同士は並列しない。

### Sprint 1: 認証・セキュリティ基盤（高優先度）
- **すべて並列可**: `GFX-01`, `GFX-02`, `GFX-03`, `GFX-04`
  - 変更ファイルの重複がほぼない
  - ただし `GFX-03` は `app/chat/page.tsx` を変更するため、Sprint 2 の `GFX-07` とは直列

### Sprint 2: UX 安定化（高優先度）
- **直列必須**: `GFX-05` → `GFX-06` → `GFX-07`（すべて `ChatInterface.tsx` or `app/chat/page.tsx` を変更）
- **並列 OK**: `GFX-08` は新規ファイル追加のみ → Sprint 2 の他と並列可

### Sprint 3: プロダクト品質向上（中優先度）
- **すべて並列可**: `GFX-09`, `GFX-10`, `GFX-11`, `GFX-12`
  - GFX-09（ConfirmDialog）を先にマージすると GFX-10〜12 がダイアログを使える
  - ただし GFX-10〜12 は `window.confirm` をそのまま使っても問題ないため並列可

### Sprint 4: パフォーマンス・セキュリティ堅牢化（中優先度）
- **並列可**: `GFX-13`, `GFX-14`, `GFX-15`, `GFX-16`
- **直列**: `GFX-17` は `ChatInterface.tsx` を変更するため Sprint 2 完了後に実施
- **並列可**: `GFX-18` は `ConversationDetail.tsx` のみ変更

### Backlog（低優先度）
- **並列非推奨**: `GFX-19` と `GFX-15`（どちらも `/api/chat` 変更） → `GFX-15` 完了後に `GFX-19`
- **並列非推奨**: `GFX-25` と Sprint 2 の ChatInterface 変更 → Sprint 2 完了後に `GFX-25`
- **並列 OK**: `GFX-20`, `GFX-21`, `GFX-22`, `GFX-23`, `GFX-24` は互いに独立

---

## 0.7 GAP → GFX 対応表

| GFX | 対応 GAP | 概要 | スプリント |
|-----|---------|------|-----------|
| GFX-01 | GAP-01 | ログイン後ロール別ルーティング | Sprint 1 |
| GFX-02 | GAP-02 + GAP-11 | Middleware 認証ガード + /chat-test 本番非公開 | Sprint 1 |
| GFX-03 | GAP-03 | ログアウト機能 | Sprint 1 |
| GFX-04 | GAP-14 | Error Boundary 追加 | Sprint 1 |
| GFX-05 | GAP-04 | セッション有効期限管理 | Sprint 2 |
| GFX-06 | GAP-05 | ネットワークエラー/オフライン対応 | Sprint 2 |
| GFX-07 | GAP-16 | モバイル会話サイドバー対応 | Sprint 2 |
| GFX-08 | GAP-25 | loading.tsx / not-found.tsx 追加 | Sprint 2 |
| GFX-09 | GAP-06 | React ConfirmDialog 化 | Sprint 3 |
| GFX-10 | GAP-07 | 会話削除機能 | Sprint 3 |
| GFX-11 | GAP-10 | /admin ダッシュボード化 | Sprint 3 |
| GFX-12 | GAP-15 | パスワードリセット機能 | Sprint 3 |
| GFX-13 | GAP-08 | 署名 URL 期限切れ時の自動再取得 | Sprint 4 |
| GFX-14 | GAP-13 | 会話検索 N+1 クエリ最適化 | Sprint 4 |
| GFX-15 | GAP-17 + GAP-26 | サーバーサイドバリデーション強化 | Sprint 4 |
| GFX-16 | GAP-18 | 生徒向け利用状況表示 | Sprint 4 |
| GFX-17 | GAP-22 | チャット入力 textarea 化 | Sprint 4 |
| GFX-18 | GAP-21 | 管理画面の添付画像表示 | Sprint 4 |
| GFX-19 | GAP-09 | 会話タイトル LLM 自動生成 | Backlog |
| GFX-20 | GAP-12 | CSV 文字コード自動検出強化 | Backlog |
| GFX-21 | GAP-19 | 一括操作プログレス表示 | Backlog |
| GFX-22 | GAP-20 | AccountStatusBanner 無駄なクエリ抑制 | Backlog |
| GFX-23 | GAP-23 | 署名 URL API レート制限 | Backlog |
| GFX-24 | GAP-24 | 生成済みレポート再生成対応 | Backlog |
| GFX-25 | GAP-27 | ストリーム中断/キャンセル機能 | Backlog |
| GFX-26 | GAP-28 | スタッフ用レポート閲覧パネル実装 | Backlog |
| GFX-27 | GAP-10 (残作業) | スタッフログイン後のリダイレクト先修正 | Hotfix |
| GFX-28 | (新規) | UsageBadge のリアルタイム更新 | Hotfix |
| GFX-29 | (新規) | 会話継続・メッセージ保存・時系列の修正 | Critical |
| GFX-30 | (新規) | HEIC/HEIF 画像のクライアント変換対応 | Sprint 5 |
| GFX-31 | (新規) | 添付画像を AI（Vision）に渡すパイプライン実装 | Critical |
| GFX-32 | (新規) | Supabase Storage バケット・ポリシー設定（人間作業） | Gate H |
| GFX-33 | (新規) | 画像添付メッセージの保存・表示修正（テキストなし送信対応） | Critical |
| GFX-34 | (新規) | 会話 ID の URL 管理と画面遷移の安定化 | 実装済み (PR #76/#77) |
| GFX-35 | (新規) | sync-user で生徒の app_metadata.role 自動設定 | 実装済み (PR #78) |
| GFX-36 | (新規) | 許可メール一覧の検索・フィルタ即時リロード解消 | 実装済み (PR #79) |
| GFX-37 | (新規) | 許可メール一覧に生徒の個別登録フォーム追加 | 実装済み (PR #80/#81/#82) |
| GFX-38 | (新規) | Google OAuth ログインの導入 | 実装済み |
| GFX-39 | (新規) | CSV インポートのファイル選択キャンセル機能 | 実装済み (PR #83) |
| GFX-40 | (新規) | ロール別ナビゲーション（スタッフに管理画面リンク） | 実装済み (PR #84) |

---

## 1. 人間作業ゲート

### ゲート E（Sprint 1 完了後 — 認証フロー検証）
- ログイン → 生徒は `/chat`、スタッフは `/admin/allowlist` にリダイレクトされることを確認。
- 未認証で `/chat`, `/admin/*` にアクセスすると `/login` にリダイレクトされることを確認。
- 本番環境で `/chat-test` が 404 or リダイレクトされることを確認。
- ログアウトボタンが動作し、セッションがクリアされることを確認。
- Error Boundary が適切に表示されることを確認（意図的にエラーを発生させてテスト）。

### ゲート F（Sprint 2 完了後 — UX 検証）
- モバイル端末（または Chrome DevTools）でハンバーガーメニューから会話履歴にアクセスできることを確認。
- ネットワーク切断時にオフラインバナーが表示されることを確認。
- セッション期限切れ時にモーダルが表示されることを確認。
- 各ページで loading.tsx と not-found.tsx が適切に動作することを確認。

### ゲート G（最終受け入れ）
- `pnpm lint && pnpm typecheck && pnpm test` 実行。
- 生徒/スタッフの主要フローを手動確認。

---

## 2. 全 PR 共通の追記ブロック（毎回プロンプト末尾に入れる）

```text
If blocked:
- 外部サービス/ENV/Secrets が必要で失敗する場合、値を推測して追加しない。
- 代わりに、どのコマンドで何が不足しているかを PR 本文に明記して停止する。

Quality bar:
- 変更は最小限。既存の実装パターン・命名・型定義に合わせる。
- スコープ外の修正は行わない。必要なら「次PR提案」としてPR本文に記載する。
- ファイル冒頭に `/** @file ... */` コメントを付与する（既存規約準拠）。

PR report format (必須):
1) What (何を変えたか)
2) Why (なぜ必要か — 対応する GAP-xx を明記)
3) How to test (実行コマンドと結果)
4) Risks / Follow-ups
5) Human action required (手動作業の有無)

Self-review (3行):
- 1PRスコープを守れているか
- Doneが機械判定可能か
- ENV/外部依存で詰まりそうな点がないか

Validation commands:
- 基本: `pnpm lint` / `pnpm typecheck` / `pnpm test`
- 可能なら: `pnpm build`（失敗時は、Secretsを推測せず不足ENVをPR本文へ記載）
```

---

## 3. PR プロンプト一覧

---

### Sprint 1: 認証・セキュリティ基盤

---

## GFX-01: GAP-01（ログイン後ロール別ルーティング）

```text
[Task Title]
GAP-01: ログイン後にロールと許可ステータスに応じてルーティングを分岐する

Goal
- ログイン成功後、ユーザーのロール（staff/student）と許可ステータス（active/pending）に応じて
  適切なページにリダイレクトする。現在は全ユーザーが `/admin/allowlist` に飛ぶ問題を修正する。

Context
- 参照: docs/AI-Generated01/03_gap_analysis_and_proposals.md (GAP-01)
- 現在の実装: `app/login/page.tsx` L31 で `router.push('/admin/allowlist')` がハードコードされている
- `/api/sync-user` は POST レスポンスで `{ role, allowedEmailStatus }` を返却済み

Scope
- 変更OK:
  - app/login/page.tsx（ログイン成功後に /api/sync-user を呼び、レスポンスの role と
    allowedEmailStatus に応じてルーティング先を決定）
- 変更NG:
  - /api/sync-user のレスポンス形式変更（既に role, allowedEmailStatus を返している）
  - 他ページの認証ロジック

Implementation Hints
- handleLogin 内で `supabase.auth.signInWithPassword` 成功後に:
  1. `const session = await supabase.auth.getSession()` でトークンを取得
  2. `POST /api/sync-user` を `Authorization: Bearer ${token}` で呼び出し
  3. レスポンスの `data.role` と `data.allowedEmailStatus` で分岐:
     - `role === 'staff'` → `/admin/allowlist`
     - `role === 'student'` && `allowedEmailStatus === 'active'` → `/chat`
     - `allowedEmailStatus === 'pending'` → 画面上に「管理者の承認をお待ちください」と表示
     - その他（revoked, not-found）→ エラーメッセージを表示
  4. sync-user 呼び出し失敗時はフォールバックとして `/chat` にリダイレクト

Acceptance Criteria (Done)
- [ ] staff ユーザーのログイン後に `/admin/allowlist` にリダイレクトされる
- [ ] active な student ユーザーのログイン後に `/chat` にリダイレクトされる
- [ ] pending なユーザーのログイン後に待機メッセージが表示される
- [ ] revoked / not-found なユーザーにはエラーメッセージが表示される
- [ ] sync-user 失敗時はフォールバックルーティングが動作する
- [ ] `pnpm lint` / `pnpm typecheck` / `pnpm test` が通る
```

---

## GFX-02: GAP-02 + GAP-11（Middleware 認証ガード + /chat-test 本番非公開化）

```text
[Task Title]
GAP-02 + GAP-11: Next.js Middleware による認証ガードと /chat-test の本番非公開化

Goal
- 未認証ユーザーが保護ページ（/chat, /reports, /admin/*）の HTML/JS バンドルをダウンロード
  できないよう、サーバーサイドで認証ガードを追加する。
- /chat-test ページを本番環境（NODE_ENV=production）で遮断する。

Context
- 参照: docs/AI-Generated01/03_gap_analysis_and_proposals.md (GAP-02, GAP-11)
- 現在の実装: middleware.ts が存在しない。認証はクライアントサイド（AllowlistGuard）と
  API ルートハンドラ内のみ
- /chat-test は認証なしでアクセス可能な開発用ページ

Scope
- 変更OK:
  - middleware.ts（新規作成）
  - 必要に応じて next.config.js（middleware matcher 設定）
  - package.json（@supabase/ssr の追加が必要な場合）
- 変更NG:
  - 既存のクライアントサイド認証ロジック（AllowlistGuard は二重チェックとして維持）
  - API ルートの認証ロジック

Implementation Hints
- `middleware.ts` をプロジェクトルートに作成（Next.js App Router の規約）
- Supabase セッション cookie の検証には `@supabase/ssr` パッケージの
  `createServerClient` を使用する（Supabase のドキュメント参照）
- もし `@supabase/ssr` が未インストールなら `pnpm add @supabase/ssr` で追加
- matcher config:
  ```
  export const config = {
    matcher: ['/chat/:path*', '/reports/:path*', '/admin/:path*', '/chat-test/:path*']
  }
  ```
- /chat-test の本番遮断: `process.env.NODE_ENV === 'production'` の場合に
  NextResponse.rewrite で 404 を返すか、NextResponse.redirect で `/login` にリダイレクト
- 未認証ユーザー: セッション cookie がない or 無効な場合は `/login` に 302 リダイレクト
- ログインページ（/login）自体は matcher に含めない（無限リダイレクト防止）
- 注意: Edge Runtime で動作する middleware なので、Node.js 専用の API
  （getSupabaseAdminClient 等）は使用不可

Acceptance Criteria (Done)
- [ ] middleware.ts が作成されている
- [ ] 未認証で /chat にアクセスすると /login にリダイレクトされる
- [ ] 未認証で /admin/allowlist にアクセスすると /login にリダイレクトされる
- [ ] 未認証で /reports にアクセスすると /login にリダイレクトされる
- [ ] 認証済みユーザーは /chat, /admin/*, /reports に正常アクセスできる
- [ ] 本番環境（NODE_ENV=production）で /chat-test にアクセスすると遮断される
- [ ] 開発環境では /chat-test に引き続きアクセスできる
- [ ] /login, /api/*, / (ホーム) は middleware の対象外である
- [ ] `pnpm lint` / `pnpm typecheck` / `pnpm test` が通る
```

---

## GFX-03: GAP-03（ログアウト機能）

```text
[Task Title]
GAP-03: ログアウトボタンの実装

Goal
- ユーザーが明示的にログアウトできる機能を提供する。現在は supabase.auth.signOut() の
  呼び出し箇所がなく、ユーザーがログアウトする手段がない。

Context
- 参照: docs/AI-Generated01/03_gap_analysis_and_proposals.md (GAP-03)
- 現在の実装:
  - `app/chat/page.tsx` のヘッダーに「レポート」と「✕ 閉じる」リンクはあるが、ログアウトリンクはない
  - `app/reports/page.tsx` にも「チャットへ戻る」リンクはあるが、ログアウトリンクはない
  - 管理画面（/admin/*）にもログアウト導線なし

Scope
- 変更OK:
  - app/chat/page.tsx（ヘッダーにログアウトボタン追加）
  - app/reports/page.tsx（ヘッダーにログアウトリンク追加）
  - app/admin/allowlist/page.tsx（ヘッダーにログアウトリンク追加）
  - app/admin/grant/page.tsx, app/admin/conversations/page.tsx, app/admin/reports/page.tsx
    （ヘッダーにログアウトリンク追加 — 既存のヘッダー部分のみ）
  - 必要なら共通のログアウトハンドラユーティリティ
- 変更NG:
  - 認証ロジック全体の変更
  - AllowlistGuard の挙動変更

Implementation Hints
- ログアウト処理:
  1. `const supabase = getSupabaseBrowserClient()`
  2. `await supabase.auth.signOut()`
  3. `router.push('/login')`
- チャット画面ヘッダー（app/chat/page.tsx L54-75）の `<div className="flex items-center gap-4">` 内に
  ログアウトボタンを追加
- レポート画面ヘッダー（app/reports/page.tsx L81）付近にログアウトリンクを追加
- 管理画面の各ページヘッダー（「戻る」リンクの横）にログアウトリンクを追加
- 共通ロジックが多い場合は `src/shared/hooks/useLogout.ts` としてフック化してもよい
- ログアウト処理中は isLoading でボタンを disabled にする
- 操作の確認ダイアログは不要（ログアウトは安全な操作）

Acceptance Criteria (Done)
- [ ] チャット画面（/chat）のヘッダーにログアウトボタンが表示される
- [ ] レポート画面（/reports）にログアウトリンクが表示される
- [ ] 管理画面（/admin/*）の少なくとも1ページにログアウトリンクが表示される
- [ ] ログアウトボタン押下で supabase.auth.signOut() が呼ばれ、/login にリダイレクトされる
- [ ] `pnpm lint` / `pnpm typecheck` / `pnpm test` が通る
```

---

## GFX-04: GAP-14（React Error Boundary 追加）

```text
[Task Title]
GAP-14: Next.js Error Boundary（error.tsx）の追加

Goal
- コンポーネントのレンダリングエラーが画面全体を白画面にする問題を防止する。
  Next.js App Router の error.tsx 規約を活用し、graceful なエラー回復 UI を提供する。

Context
- 参照: docs/AI-Generated01/03_gap_analysis_and_proposals.md (GAP-14)
- 現在の実装: app/error.tsx, app/chat/error.tsx 等が存在しない
- 1つのコンポーネントエラー（例: Markdown レンダリング失敗）で画面全体がクラッシュする

Scope
- 変更OK:
  - app/error.tsx（新規 — ルートレベル Error Boundary）
  - app/chat/error.tsx（新規 — チャット画面専用 Error Boundary）
  - app/admin/error.tsx（新規 — 管理画面専用 Error Boundary、任意）
- 変更NG:
  - 既存コンポーネントのロジック変更
  - 外部エラー監視サービス（Sentry 等）の導入（将来対応）

Implementation Hints
- Next.js App Router の error.tsx は `'use client'` ディレクティブが必須
- Props: `{ error: Error & { digest?: string }, reset: () => void }`
- app/error.tsx: 汎用的な「エラーが発生しました」UI + 「再試行」ボタン + 「ホームに戻る」リンク
- app/chat/error.tsx: チャット専用のエラーUI + 「再試行」ボタン + 「チャット一覧に戻る」リンク
- エラーメッセージ本文は `process.env.NODE_ENV === 'development'` の場合のみ表示
  （本番ではスタックトレースを見せない）
- console.error(error) は両方に追加する（将来の Sentry 導入ポイント）
- Tailwind CSS で既存のデザインシステムに合わせたスタイリング

Acceptance Criteria (Done)
- [ ] app/error.tsx が作成されている（'use client' + reset 関数対応）
- [ ] app/chat/error.tsx が作成されている
- [ ] エラー画面に「再試行」ボタンと「ホームに戻る」リンクが表示される
- [ ] 開発環境のみエラー詳細が表示される（本番では非表示）
- [ ] `pnpm lint` / `pnpm typecheck` / `pnpm test` が通る
```

> **人間作業ゲート E**: Sprint 1 の GFX-01〜04 マージ後、ゲート E（認証フロー検証）を実施。

---

### Sprint 2: UX 安定化

---

## GFX-05: GAP-04（セッション有効期限管理）

```text
[Task Title]
GAP-04: セッション有効期限の適切な管理と期限切れ時の UI 対応

Goal
- トークンの有効期限切れ時にユーザーに通知し、安全に再ログインを促す。
  チャット中のセッション切れでデータが失われないよう保護する。

Context
- 参照: docs/AI-Generated01/03_gap_analysis_and_proposals.md (GAP-04)
- 現在の実装:
  - app/chat/page.tsx で supabase.auth.onAuthStateChange を監視しているが、
    SIGNED_OUT イベント時の明示的なハンドリングがない（token が null になるだけ）
  - ChatInterface.tsx L408 でも onAuthStateChange を監視しているが同様
  - 長時間操作なしでトークンが失効すると、次の API 呼び出しで突然 401 エラーが発生する

Scope
- 変更OK:
  - app/chat/page.tsx（onAuthStateChange の SIGNED_OUT ハンドリング強化）
  - 必要なら src/shared/components/SessionExpiredModal.tsx（新規 — セッション期限切れモーダル）
- 変更NG:
  - ChatInterface.tsx 内部の大規模な変更（最小限の props 追加は可）
  - API ルートの認証ロジック

Implementation Hints
- app/chat/page.tsx の onAuthStateChange コールバック（L28）を拡張:
  - `event === 'SIGNED_OUT'` の場合: モーダルを表示 → 確認後に `/login` にリダイレクト
  - `event === 'TOKEN_REFRESHED'` の場合: token を更新（既存の動作を明示的にする）
- セッション期限切れモーダル: 「セッションが切れました。再ログインしてください」
  + 「ログイン画面へ」ボタン（背景クリックでは閉じない）
- オプション: 入力中のテキストがある場合、localStorage に退避してからリダイレクト
  （フォールバック実装、複雑すぎる場合は省略可）
- モーダルは React の useState で表示/非表示を管理する簡素な実装でよい
  （shadcn/ui や Headless UI は不要 — tailwind + div で十分）

Acceptance Criteria (Done)
- [ ] onAuthStateChange の SIGNED_OUT イベントでモーダルが表示される
- [ ] モーダルから「ログイン画面へ」ボタンで /login に遷移できる
- [ ] TOKEN_REFRESHED イベントで token が正しく更新される
- [ ] `pnpm lint` / `pnpm typecheck` / `pnpm test` が通る
```

---

## GFX-06: GAP-05（ネットワークエラー/オフライン対応）

```text
[Task Title]
GAP-05: チャット画面のオフライン検知とネットワークエラー対応

Goal
- ネットワーク切断時にユーザーに通知し、送信失敗時のメッセージ消失を防止する。
  学校の Wi-Fi 等、不安定な環境での利用体験を改善する。

Context
- 参照: docs/AI-Generated01/03_gap_analysis_and_proposals.md (GAP-05)
- 現在の実装: ネットワーク切断時の処理が未実装。ストリーミング中に接続が切れた場合の
  リカバリ機能がない

Scope
- 変更OK:
  - src/features/chat/hooks/useNetworkStatus.ts（新規 — ネットワーク状態監視フック）
  - src/features/chat/components/OfflineBanner.tsx（新規 — オフラインバナー）
  - src/features/chat/components/ChatInterface.tsx（バナー表示、送信失敗時リトライ表示の統合）
- 変更NG:
  - API ルートの変更
  - ConversationSidebar の変更

Implementation Hints
- useNetworkStatus フック:
  - `navigator.onLine` で初期値を取得
  - `window.addEventListener('online', ...)` と `window.addEventListener('offline', ...)` で監視
  - `{ isOnline: boolean }` を返す
- OfflineBanner: 「インターネット接続がありません」の黄色バナー
  （ChatInterface.tsx の先頭、メッセージエリアの上に表示）
- ChatInterface.tsx の ChatSession コンポーネント内:
  - useChat の onError コールバック（現在は alert）を改善:
    1. ネットワークエラー（TypeError: Failed to fetch）の場合は
       「ネットワークに接続できません。接続を確認して再送信してください」と表示
    2. 429 の場合は既存のレート制限メッセージを表示
    3. その他のエラーは既存の動作を維持
  - 送信失敗時: メッセージを state に保持し、リトライボタンを表示（オプション）
- 実装の複雑度を抑えるため、localStorage へのメッセージ退避は省略可
  （リトライボタン表示だけでも大きな改善）

Acceptance Criteria (Done)
- [ ] useNetworkStatus フックが実装されている
- [ ] オフライン時にバナーが表示される
- [ ] オンライン復帰時にバナーが消える
- [ ] 送信エラー時に alert ではなくインラインメッセージが表示される
- [ ] `pnpm lint` / `pnpm typecheck` / `pnpm test` が通る
```

---

## GFX-07: GAP-16（モバイル会話サイドバー対応）

```text
[Task Title]
GAP-16: モバイルでの会話サイドバー（ハンバーガーメニュー/ドロワー）実装

Goal
- モバイルデバイスで会話履歴にアクセスできるようにする。現在は `hidden md:flex` で
  非表示になっており、代替 UI がないため過去の会話に切り替えられない。

Context
- 参照: docs/AI-Generated01/03_gap_analysis_and_proposals.md (GAP-16)
- 現在の実装:
  - app/chat/page.tsx L79: `<aside className="hidden md:flex ...">` でデスクトップのみ表示
  - ConversationSidebar コンポーネント自体はモバイル対応不要（親が制御）

Scope
- 変更OK:
  - app/chat/page.tsx（ハンバーガーボタン追加、ドロワーの開閉状態管理、オーバーレイ表示）
- 変更NG:
  - ConversationSidebar 本体の変更（props は既存のまま）
  - ChatInterface の変更
  - デスクトップ表示の変更

Implementation Hints
- app/chat/page.tsx のヘッダー（L54-75）にハンバーガーメニューボタンを追加:
  - `md:hidden` で表示（デスクトップでは非表示）
  - 三本線アイコン（SVG で実装）
- `const [isSidebarOpen, setIsSidebarOpen] = useState(false)` で開閉管理
- ドロワーの実装:
  - 固定位置（`fixed inset-0 z-40`）のオーバーレイ（半透明背景）+ サイドパネル
  - サイドパネル: `fixed left-0 top-0 h-full w-72 bg-white shadow-xl z-50`
  - オーバーレイクリックで閉じる
  - ConversationSidebar の onSelect コールバック内で `setIsSidebarOpen(false)` も呼ぶ
  - トランジション: `transform transition-transform duration-200`
    （開: `translate-x-0`、閉: `-translate-x-full`）
- デスクトップの既存サイドバー（L79-86）はそのまま維持
- 会話選択時にドロワーを自動で閉じるため、handleSelect を拡張:
  ```
  const handleSelect = (id: string) => {
    setSelectedId(id)
    setIsSidebarOpen(false)
  }
  ```

Acceptance Criteria (Done)
- [ ] モバイル表示（< md）でヘッダーにハンバーガーメニューボタンが表示される
- [ ] ボタン押下でサイドバーがドロワーとして表示される
- [ ] 会話選択でドロワーが閉じ、選択した会話が表示される
- [ ] 背景オーバーレイクリックでドロワーが閉じる
- [ ] デスクトップ表示（>= md）は既存動作と同一（ハンバーガー非表示、サイドバー常時表示）
- [ ] `pnpm lint` / `pnpm typecheck` / `pnpm test` が通る
```

---

## GFX-08: GAP-25（loading.tsx / not-found.tsx 追加）

```text
[Task Title]
GAP-25: Next.js loading.tsx と not-found.tsx の追加

Goal
- ページ遷移時のローディング表示と、存在しない URL へのアクセス時のカスタム 404 ページを
  提供する。現在はデフォルトの Next.js 動作のみ。

Context
- 参照: docs/AI-Generated01/03_gap_analysis_and_proposals.md (GAP-25)
- 現在の実装: app/loading.tsx, app/not-found.tsx が存在しない

Scope
- 変更OK:
  - app/loading.tsx（新規 — グローバルローディング UI）
  - app/not-found.tsx（新規 — カスタム 404 ページ）
  - app/chat/loading.tsx（新規 — チャット画面専用ローディング UI、任意）
- 変更NG:
  - 既存ページの変更
  - サーバーサイドロジック

Implementation Hints
- app/loading.tsx:
  - 中央寄せのスピナー + 「読み込み中...」テキスト
  - Tailwind CSS: `flex min-h-screen items-center justify-center`
  - スピナーは CSS アニメーション（`animate-spin`）で実装
- app/not-found.tsx:
  - 「ページが見つかりません」タイトル + 説明文
  - 「ホームに戻る」リンク（`<Link href="/">`）
  - Tailwind CSS: 既存ページと統一感のあるデザイン（bg-slate-50 ベース）
- app/chat/loading.tsx（任意）:
  - メッセージ一覧のスケルトン UI（灰色のプレースホルダーブロック）
  - ヘッダーのスケルトン + メッセージバブルのスケルトン x 3

Acceptance Criteria (Done)
- [ ] app/loading.tsx が作成されている（スピナー表示）
- [ ] app/not-found.tsx が作成されている（カスタム 404 + ホームリンク）
- [ ] 存在しない URL にアクセスするとカスタム 404 が表示される
- [ ] `pnpm lint` / `pnpm typecheck` / `pnpm test` が通る
```

> **人間作業ゲート F**: Sprint 2 の GFX-05〜08 マージ後、ゲート F（UX 検証）を実施。

---

### Sprint 3: プロダクト品質向上

---

## GFX-09: GAP-06（React ConfirmDialog 化）

```text
[Task Title]
GAP-06: window.confirm/alert を React モーダルコンポーネントに置き換え

Goal
- すべての window.confirm() / window.alert() を React ベースのモーダルダイアログに
  置き換え、プロダクト品質と一貫性を向上させる。

Context
- 参照: docs/AI-Generated01/03_gap_analysis_and_proposals.md (GAP-06)
- 現在 window.confirm/alert を使用している箇所:
  - app/admin/grant/page.tsx: L74（付与確認）, L91（解除確認）
  - app/admin/reports/page.tsx: L92（Dry Run 確認）, L109（一括生成確認）, L127（再生成確認）
  - app/admin/allowlist/page.tsx: L186（ステータス変更確認、confirm 関数直接呼び出し）
  - 各所の alert() によるエラー表示・結果表示

Scope
- 変更OK:
  - src/shared/components/ConfirmDialog.tsx（新規 — 汎用確認ダイアログ）
  - src/shared/components/AlertDialog.tsx（新規 — 汎用通知ダイアログ、任意）
  - app/admin/grant/page.tsx（window.confirm → ConfirmDialog）
  - app/admin/reports/page.tsx（window.confirm/alert → ConfirmDialog/AlertDialog）
  - app/admin/allowlist/page.tsx（confirm → ConfirmDialog）
- 変更NG:
  - API ロジック
  - ChatInterface（alert は別途 GAP-05 で対応済み想定）

Implementation Hints
- ConfirmDialog コンポーネント:
  - Props: `{ open, title, message, confirmLabel?, cancelLabel?, variant?, onConfirm, onCancel, loading? }`
  - variant: 'default' | 'destructive'（destructive の場合は確認ボタンが赤色）
  - モーダル背景: `fixed inset-0 z-50 bg-black/30` + 中央配置のパネル
  - キーボード対応: Escape で閉じる
  - Tailwind CSS で既存デザインシステムに合わせる
  - ライブラリは不要（div + useState で十分）
- AlertDialog（任意、ConfirmDialog の cancelLabel を非表示にして代用も可）:
  - 結果表示用（「生成完了」等）。OK ボタンのみ
- 各管理画面での使用パターン:
  ```tsx
  const [confirmState, setConfirmState] = useState<{ open: boolean; action: () => void }>({...})
  // window.confirm → setConfirmState({ open: true, action: async () => { ... } })
  // <ConfirmDialog ... onConfirm={confirmState.action} />
  ```
- useConfirm カスタムフックとして共通化してもよい（Promise ベース）

Acceptance Criteria (Done)
- [ ] ConfirmDialog コンポーネントが作成されている
- [ ] app/admin/grant/page.tsx の window.confirm が ConfirmDialog に置き換わっている
- [ ] app/admin/reports/page.tsx の window.confirm/alert が置き換わっている
- [ ] app/admin/allowlist/page.tsx の confirm が置き換わっている
- [ ] window.confirm / window.alert の呼び出しが管理画面のコードからなくなっている
- [ ] Escape キーでダイアログが閉じる
- [ ] `pnpm lint` / `pnpm typecheck` / `pnpm test` が通る
```

---

## GFX-10: GAP-07（会話削除機能）

```text
[Task Title]
GAP-07: 会話の削除 API と UI の実装

Goal
- ユーザーが不要な会話を削除できる機能を提供する。サイドバーが長くなる問題を解消し、
  データ削除要求への対応基盤を作る。

Context
- 参照: docs/AI-Generated01/03_gap_analysis_and_proposals.md (GAP-07)
- 現在の実装:
  - DELETE /api/conversations/[id] は未実装
  - ConversationSidebar に削除 UI なし
  - conversations テーブルの RLS は user_id = auth.uid() で本人のみアクセス可
  - messages テーブルは conversations.id に FK で紐づいている

Scope
- 変更OK:
  - app/api/conversations/[id]/route.ts（DELETE ハンドラ追加）
  - src/features/chat/components/ConversationSidebar.tsx（削除ボタン追加）
  - tests/**（DELETE API のテスト追加）
- 変更NG:
  - DB スキーマ変更（CASCADE DELETE は既存の FK 設定に依存）
  - ChatInterface の変更

Implementation Hints
- DELETE API:
  1. `getBearerToken(req)` → `supabase.auth.getUser(token)` で認証
  2. conversations テーブルから対象レコードを取得し、`user_id === user.id` を確認
  3. messages を先に削除（FK 制約）→ attachments も（message_id 経由）→ conversations を削除
     または、DB 側で ON DELETE CASCADE が設定されている場合は conversations のみ DELETE で OK
  4. 成功時は `204 No Content` を返す
  5. 本人以外のアクセスは `403 Forbidden`
- ConversationSidebar:
  - 各会話項目にゴミ箱アイコンボタンを追加（ホバー時のみ表示: `opacity-0 group-hover:opacity-100`）
  - 確認ダイアログ（window.confirm でよい、GFX-09 後なら ConfirmDialog 使用）
  - 削除成功後はローカル state から該当会話を除去し、selectedId が該当 ID なら空文字にリセット
- CASCADE の確認:
  - 既存の migration ファイルで messages テーブルの FK 定義を確認すること
  - CASCADE がない場合は、API 側で messages → attachments → conversations の順に明示的に DELETE

Acceptance Criteria (Done)
- [ ] DELETE /api/conversations/[id] が実装されている
- [ ] 本人の会話のみ削除可能（他ユーザーの会話は 403）
- [ ] 未認証は 401
- [ ] 削除時に関連する messages, attachments も削除される
- [ ] ConversationSidebar に削除ボタンが表示される
- [ ] 削除後にサイドバーが更新される
- [ ] テストが追加されている
- [ ] `pnpm lint` / `pnpm typecheck` / `pnpm test` が通る
```

---

## GFX-11: GAP-10（/admin ダッシュボード化）

```text
[Task Title]
GAP-10: /admin ページをナビゲーションダッシュボードとして実装

Goal
- 現在プレースホルダーの /admin ページを、管理機能へのハブとして機能させる。
  カードリンクで各管理画面に遷移できるようにする。

Context
- 参照: docs/AI-Generated01/03_gap_analysis_and_proposals.md (GAP-10)
- 現在の実装: app/admin/page.tsx は「スタッフ管理 UI（準備中）」のプレースホルダーのみ

Scope
- 変更OK:
  - app/admin/page.tsx（ダッシュボード UI に全面書き替え）
- 変更NG:
  - 各管理サブページ（/admin/allowlist, /admin/grant 等）の変更
  - API の追加（統計 API は将来対応、このPRではハードコードまたは省略）

Implementation Hints
- ダッシュボードのカードリンク一覧:
  1. 許可リスト管理 → /admin/allowlist（アイコン: メール or リスト）
  2. 権限管理 → /admin/grant（アイコン: 盾 or 鍵）
  3. 会話検索 → /admin/conversations（アイコン: 検索 or 吹き出し）
  4. レポート管理 → /admin/reports（アイコン: グラフ or 書類）
- 各カード: タイトル + 簡易説明 + リンク
- Tailwind CSS: grid レイアウト（`grid grid-cols-1 md:grid-cols-2 gap-4`）
- ヘッダー: 「管理ダッシュボード」+ ログアウトリンク
  （GFX-03 で追加済みの場合はそのパターンに合わせる）
- 統計サマリー（アクティブユーザー数等）は将来対応として TODO コメントのみ残す
  （API 呼び出しが必要になるため、このPRでは実装しない）
- 認証ガード: クライアントサイドで token チェック（既存の admin ページと同じパターン）

Acceptance Criteria (Done)
- [ ] /admin にアクセスすると4つの管理機能へのカードリンクが表示される
- [ ] 各カードリンクから対応する管理画面に遷移できる
- [ ] レスポンシブ対応（モバイル: 1列、デスクトップ: 2列）
- [ ] `pnpm lint` / `pnpm typecheck` / `pnpm test` が通る
```

---

## GFX-12: GAP-15（パスワードリセット機能）

```text
[Task Title]
GAP-15: パスワードリセットフローの実装

Goal
- パスワードを忘れたユーザーがメール経由で自力でパスワードを再設定できるようにする。
  現在は管理者に連絡するしか手段がない。

Context
- 参照: docs/AI-Generated01/03_gap_analysis_and_proposals.md (GAP-15)
- 現在の実装: ログイン画面にパスワードリセットの導線がない
- Supabase Auth の `resetPasswordForEmail` と `updateUser` を活用

Scope
- 変更OK:
  - app/login/page.tsx（「パスワードを忘れた方」リンク追加）
  - app/reset-password/page.tsx（新規 — パスワード再設定画面）
- 変更NG:
  - 認証基盤の変更
  - Supabase Auth の設定変更（メールテンプレートはデフォルトのまま）

Implementation Hints
- ログイン画面（app/login/page.tsx）:
  - ログインボタンの下、新規登録の上あたりに「パスワードを忘れた方」リンクを追加
  - クリックで表示を切り替え（別ページ遷移でもよい）、メール入力 + 「リセットメール送信」ボタン
  - `supabase.auth.resetPasswordForEmail(email, { redirectTo: `${location.origin}/reset-password` })`
  - 送信成功メッセージ: 「パスワードリセットメールを送信しました。メールのリンクからパスワードを再設定してください。」
- app/reset-password/page.tsx:
  - Supabase のリセットリンクからリダイレクトされるページ
  - URL に含まれるトークン（Supabase が自動処理）でセッションが復元される
  - `supabase.auth.onAuthStateChange` で `PASSWORD_RECOVERY` イベントを検知
  - 新しいパスワードを入力するフォーム（パスワード + 確認入力）
  - `supabase.auth.updateUser({ password: newPassword })` で更新
  - 成功後 `/login` にリダイレクト
- 注意: Supabase のリダイレクト URL 設定（Supabase Dashboard > Auth > URL Configuration
  > Redirect URLs）に `/reset-password` を追加する必要がある場合あり（PR 本文に明記）

Acceptance Criteria (Done)
- [ ] ログイン画面に「パスワードを忘れた方」リンクが表示される
- [ ] メール入力 + 送信でリセットメールが送信される
- [ ] /reset-password ページが作成されている（パスワード再設定フォーム）
- [ ] パスワード更新成功後に /login にリダイレクトされる
- [ ] `pnpm lint` / `pnpm typecheck` / `pnpm test` が通る
- [ ] PR 本文に Supabase Redirect URL 設定の手動作業を記載
```

---

### Sprint 4: パフォーマンス・セキュリティ堅牢化

---

## GFX-13: GAP-08（署名 URL 期限切れ時の自動再取得）

```text
[Task Title]
GAP-08: 添付画像の署名 URL 期限切れ時に自動で再署名を試行する

Goal
- チャット画面を長時間開いたままにした場合に、署名 URL（有効期限 10 分）が期限切れに
  なった画像を自動で再取得し、壊れた画像の表示を防止する。

Context
- 参照: docs/AI-Generated01/03_gap_analysis_and_proposals.md (GAP-08)
- 現在の実装:
  - MessageBubble.tsx の AttachmentThumbnails サブコンポーネントで署名 URL を取得
  - 署名 URL の有効期限は 10 分（Supabase Storage の createSignedUrl で取得）
  - 期限切れ後は画像が壊れて表示される

Scope
- 変更OK:
  - src/features/chat/components/MessageBubble.tsx（AttachmentThumbnails 内の
    画像 onError ハンドラ追加 + 再署名ロジック）
- 変更NG:
  - API ルートの変更
  - 署名 URL の有効期限の変更

Implementation Hints
- AttachmentThumbnails 内の画像表示部分に `onError` ハンドラを追加:
  1. `onError` 発火時に再署名を試行（既存の `createSignedUrl` ロジックを再実行）
  2. 再署名成功時は state を更新して画像を再表示
  3. 再署名失敗時（ストレージ側の問題等）は「画像を読み込めませんでした」のプレースホルダーを表示
- 無限リトライ防止: 各画像ごとにリトライ回数を管理し、最大 2 回まで
  （`retryCount` を useRef or useState で管理）
- パフォーマンス考慮:
  - 画面外の画像まで再署名しないよう、onError が発火した画像のみ処理
  - 一度に大量の再署名が発生しないよう、debounce や sequential processing を検討
    （ただし通常は数枚程度のため、シンプルな実装でよい）

Acceptance Criteria (Done)
- [ ] 署名 URL 期限切れ時に自動で再署名が試行される
- [ ] 再署名成功時に画像が正しく再表示される
- [ ] 再署名失敗時にプレースホルダーが表示される（壊れた画像アイコンではない）
- [ ] 無限リトライが発生しない（最大 2 回）
- [ ] `pnpm lint` / `pnpm typecheck` / `pnpm test` が通る
```

---

## GFX-14: GAP-13（会話検索 N+1 クエリ最適化）

```text
[Task Title]
GAP-13: 管理画面の会話検索 API を SQL レベルでの集計に最適化

Goal
- /api/admin/conversations で会話ごとのメッセージ数をカウントする処理を、
  JavaScript での全件取得 + スライスから、SQL の COUNT + GROUP BY + OFFSET/LIMIT に変更する。

Context
- 参照: docs/AI-Generated01/03_gap_analysis_and_proposals.md (GAP-13)
- 現在の実装:
  - app/api/admin/conversations/route.ts（または src/shared/lib/adminConversations.ts）で
    全件取得後に JavaScript でスライスしている可能性
  - データ量が増えるとレスポンスタイムが悪化する

Scope
- 変更OK:
  - app/api/admin/conversations/route.ts
  - src/shared/lib/adminConversations.ts（存在する場合）
  - 関連テスト
- 変更NG:
  - DB スキーマ変更（非正規化カラム追加は行わない、このPRではクエリ最適化のみ）
  - フロントエンド UI

Implementation Hints
- Supabase の PostgREST クエリで実現可能な範囲で最適化:
  - `conversations` テーブルに対して、`messages(count)` の選択で件数を取得
  - Supabase クライアントの `.select('*, messages(count)')` パターンが使える場合はそれを活用
  - または RPC（Supabase function）で SQL を直接実行:
    `SELECT c.*, COUNT(m.id) as message_count FROM conversations c LEFT JOIN messages m ...`
- ページネーション: `.range(offset, offset + limit - 1)` でサーバーサイドページネーション
- `total` のカウントは `.select('*', { count: 'exact' })` で取得
- 既存のレスポンス形式（conversations + pagination）を維持すること

Acceptance Criteria (Done)
- [ ] 会話一覧のメッセージ数がサーバーサイドで集計されている（JS での全件取得をやめた）
- [ ] ページネーションがサーバーサイドで処理されている
- [ ] 既存のレスポンス形式が維持されている（フロントエンドに影響なし）
- [ ] テストが通る
- [ ] `pnpm lint` / `pnpm typecheck` / `pnpm test` が通る
```

---

## GFX-15: GAP-17 + GAP-26（サーバーサイドバリデーション強化）

```text
[Task Title]
GAP-17 + GAP-26: /api/chat に添付枚数制限とメッセージ文字数制限をサーバーサイドで追加

Goal
- クライアントサイドのみで検証されている添付画像枚数と、未制限のメッセージ文字数を
  サーバーサイドでも検証し、API の不正利用を防止する。

Context
- 参照: docs/AI-Generated01/03_gap_analysis_and_proposals.md (GAP-17, GAP-26)
- 現在の実装:
  - 添付枚数: クライアントで3枚制限（src/shared/lib/attachmentValidation.ts の
    MAX_ATTACHMENTS_PER_MESSAGE = 3）だが、サーバーでは検証なし
  - 文字数: クライアント・サーバー両方で制限なし。極端に長いテキストで
    OpenAI API のトークン制限到達やコスト増大のリスク

Scope
- 変更OK:
  - app/api/chat/route.ts（attachments.length と最新メッセージ文字数のバリデーション追加）
  - src/shared/lib/attachmentValidation.ts（MAX_MESSAGE_LENGTH 定数の追加）
  - src/features/chat/components/ChatInterface.tsx（文字数カウンター表示、任意）
  - tests/**（バリデーションテスト追加）
- 変更NG:
  - レート制限ロジックの変更
  - 添付画像のアップロードフローの変更

Implementation Hints
- サーバーサイド（app/api/chat/route.ts）:
  - L86 付近（requestBody 取得後）にバリデーション追加:
    ```
    if (attachmentInputs.length > MAX_ATTACHMENTS_PER_MESSAGE) {
      return new Response(JSON.stringify({ error: '添付画像は3枚までです' }), { status: 400 })
    }
    if (userText && userText.length > MAX_MESSAGE_LENGTH) {
      return new Response(JSON.stringify({ error: 'メッセージが長すぎます（2000文字以内）' }), { status: 400 })
    }
    ```
  - MAX_MESSAGE_LENGTH = 2000（attachmentValidation.ts に追加）
  - import { MAX_ATTACHMENTS_PER_MESSAGE } from '@shared/lib/attachmentValidation'
- クライアントサイド（ChatInterface.tsx、任意）:
  - 入力欄の下に「x / 2000」文字数カウンターを表示（2000 文字に近づいたら色を変える）
  - 2000 文字超過時は送信ボタンを disabled にする
- テスト:
  - 添付 4 枚で 400 エラーのテスト
  - 2001 文字のメッセージで 400 エラーのテスト
  - 正常範囲（3 枚以下、2000 文字以下）は既存テストでカバー

Acceptance Criteria (Done)
- [ ] 添付 4 枚以上で /api/chat が 400 を返す
- [ ] 2000 文字超のメッセージで /api/chat が 400 を返す
- [ ] MAX_MESSAGE_LENGTH 定数が attachmentValidation.ts に追加されている
- [ ] バリデーションのテストが追加されている
- [ ] `pnpm lint` / `pnpm typecheck` / `pnpm test` が通る
```

---

## GFX-16: GAP-18（生徒向け利用状況表示）

```text
[Task Title]
GAP-18: 生徒の月間利用状況（残り質問数）を表示する

Goal
- 生徒が自分の月間利用状況（残りの質問数）を確認できるようにし、
  クォータ（100 問/月）に突然到達して困惑する問題を防止する。

Context
- 参照: docs/AI-Generated01/03_gap_analysis_and_proposals.md (GAP-18)
- 現在の実装:
  - レート制限・クォータ管理は src/shared/lib/rateLimit.ts で実装済み
  - usage_counters テーブルに月間利用数が記録されている
  - 月間クォータは 100（環境変数 MONTHLY_QUOTA で設定可能）
  - 生徒が残り質問数を確認する手段がない

Scope
- 変更OK:
  - app/api/usage/route.ts（新規 — 利用状況取得 API）
  - src/features/chat/components/UsageBadge.tsx（新規 — 残り質問数バッジ）
  - app/chat/page.tsx（ヘッダーに UsageBadge を追加）
- 変更NG:
  - レート制限ロジックの変更
  - クォータ値の変更
  - 管理画面の変更

Implementation Hints
- GET /api/usage API:
  1. `getBearerToken` → `supabase.auth.getUser` で認証
  2. `resolveAppUserId` で app_user ID を取得
  3. usage_counters テーブルから当月のレコードを取得
     - `rateLimit.ts` の `getJstMonth()` を使って当月の YYYY-MM を算出
     - SELECT: `app_user_id`, `month`, `question_count`
  4. レスポンス: `{ used: number, limit: number, remaining: number }`
     - `used = row.question_count ?? 0`
     - `limit = MONTHLY_QUOTA（環境変数またはデフォルト 100）`
     - `remaining = limit - used`
- UsageBadge コンポーネント:
  - token を受け取り、/api/usage を fetch
  - 表示: 「残り 87/100」（コンパクトなバッジ）
  - 残り 20% 以下（20 問以下）: 黄色
  - 残り 5% 以下（5 問以下）: 赤色
  - それ以外: 通常色（グレーまたは緑）
- app/chat/page.tsx のヘッダー（L54-75）内に配置
  - `<UsageBadge token={token} />` を「レポート」リンクの左に追加

Acceptance Criteria (Done)
- [ ] GET /api/usage が実装されている（認証必須）
- [ ] チャット画面のヘッダーに残り質問数バッジが表示される
- [ ] 残り質問数に応じて色が変わる（通常/黄/赤）
- [ ] `pnpm lint` / `pnpm typecheck` / `pnpm test` が通る
```

---

## GFX-17: GAP-22（チャット入力 textarea 化）

```text
[Task Title]
GAP-22: チャット入力欄を textarea に変更し、自動リサイズと Shift+Enter 改行に対応

Goal
- 長文の質問（数学の問題文等）を入力しやすくするため、1行の input を
  複数行対応の textarea に変更する。

Context
- 参照: docs/AI-Generated01/03_gap_analysis_and_proposals.md (GAP-22)
- 現在の実装:
  - ChatInterface.tsx L268: `<input>` タグで1行のみ
  - 長い質問の入力が困難

Scope
- 変更OK:
  - src/features/chat/components/ChatInterface.tsx（input → textarea 変更、
    イベントハンドラ調整）
- 変更NG:
  - API ロジック
  - メッセージ送信ロジック（sendMessage の呼び出し方は変えない）

Implementation Hints
- `<input>` を `<textarea>` に変更:
  - `rows={1}` で初期高さは1行
  - CSS: `resize: none`（手動リサイズ禁止）、`overflow-y: hidden`（初期状態）
  - max-height: `max-h-32`（約5行分、超えるとスクロール → `overflow-y: auto`）
- 自動リサイズ:
  - `onChange` イベント内で `textarea.style.height = 'auto'` →
    `textarea.style.height = textarea.scrollHeight + 'px'`
  - または useRef + useEffect で scrollHeight を監視
- キーボード操作:
  - `Enter` キー: メッセージ送信（`onKeyDown` で `e.key === 'Enter' && !e.shiftKey` の場合に
    `e.preventDefault()` して `onSubmit` 呼び出し）
  - `Shift+Enter`: 改行（ブラウザデフォルト動作のまま）
- handleInputChange の型を `React.ChangeEvent<HTMLTextAreaElement>` に変更

Acceptance Criteria (Done)
- [ ] 入力欄が textarea に変更されている
- [ ] 入力内容に応じて高さが自動調整される
- [ ] max-height を超えた場合はスクロールバーが表示される
- [ ] Enter で送信、Shift+Enter で改行できる
- [ ] 既存のスタイル・レイアウトと調和している
- [ ] `pnpm lint` / `pnpm typecheck` / `pnpm test` が通る
```

---

## GFX-18: GAP-21（管理画面の添付画像表示）

```text
[Task Title]
GAP-21: 管理画面の会話詳細パネルで添付画像のサムネイル表示を実装

Goal
- スタッフが会話詳細パネルで生徒の添付画像を直接確認できるようにする。
  現在はメタデータ（storagePath, mimeType, sizeBytes）のみ表示。

Context
- 参照: docs/AI-Generated01/03_gap_analysis_and_proposals.md (GAP-21)
- 現在の実装:
  - /api/admin/conversations/[id] が添付メタデータを返却済み
  - ConversationDetail コンポーネントがメタデータをテキスト表示
  - 画像を見るには Supabase ダッシュボードに直接アクセスが必要

Scope
- 変更OK:
  - app/api/admin/attachments/signed-url/route.ts（新規 — 管理者用署名 URL 生成 API）
  - src/features/admin/conversations/components/ConversationDetail.tsx
    （添付画像サムネイル表示の追加）
- 変更NG:
  - Storage RLS ポリシーの変更
  - 生徒向けチャット画面の変更

Implementation Hints
- 管理者用署名 URL API:
  1. `requireStaff(req)` で認証（スタッフのみ）
  2. リクエストボディ: `{ storagePath: string }`
  3. `getSupabaseAdminClient()` で Service Role を使って署名 URL を生成
     （RLS をバイパスして任意のユーザーのファイルにアクセス可能）
  4. `supabaseAdmin.storage.from('attachments').createSignedUrl(storagePath, 600)`
     （10 分有効）
  5. レスポンス: `{ signedUrl: string }`
- ConversationDetail:
  - 各メッセージの添付メタデータ（storagePath）に対して署名 URL API を呼び出し
  - サムネイル画像を表示（max-width: 200px）
  - クリックで拡大表示（ImageLightbox を再利用可能）
  - 署名 URL 取得失敗時はメタデータのみ表示（フォールバック）

Acceptance Criteria (Done)
- [ ] POST /api/admin/attachments/signed-url が実装されている（staff のみ）
- [ ] ConversationDetail で添付画像のサムネイルが表示される
- [ ] サムネイルクリックで拡大表示できる
- [ ] `pnpm lint` / `pnpm typecheck` / `pnpm test` が通る
```

---

### Backlog: 低優先度

---

## GFX-19: GAP-09（会話タイトル LLM 自動生成）

```text
[Task Title]
GAP-09: 会話タイトルを LLM（gpt-4o-mini）で自動生成する

Goal
- 会話の最初のやり取りから LLM で短いタイトルを自動生成し、サイドバーの視認性を向上させる。
  現在はユーザーの最初のメッセージの先頭50文字を切り出しているだけ。

Context
- 参照: docs/AI-Generated01/03_gap_analysis_and_proposals.md (GAP-09)
- 現在の実装: app/api/chat/route.ts L99-109 の makeTitle() でユーザーメッセージの先頭50文字を使用

Scope
- 変更OK:
  - app/api/chat/route.ts（onFinish 内でタイトル生成ロジック追加）
- 変更NG:
  - 会話保存のメインフロー（タイトル生成は非同期で行う）
  - 他の API

Implementation Hints
- onFinish コールバック（L118）内で、会話保存後に非同期でタイトル生成:
  1. `await generateText({ model: openai('gpt-4o-mini'), prompt: ... })` で短いタイトルを生成
  2. プロンプト例: 「以下のユーザーの質問とAIの回答から、20文字以内の短い会話タイトルを
     生成してください。タイトルのみを出力してください。
     ユーザー: ${userText}
     AI: ${assistantText.slice(0, 200)}」
  3. 生成されたタイトルで conversations テーブルを UPDATE
  4. 生成失敗時はフォールバックとして現行の先頭切り出しを使用（既に INSERT 済みのため問題なし）
- コスト考慮: gpt-4o-mini の短いプロンプトで 20 文字程度の出力 → ごく低コスト
- 非同期で行うため、レスポンスタイムには影響しない（`void` で呼び出し）
- try-catch で囲み、失敗しても既存タイトルが残る（データ消失リスクなし）

Acceptance Criteria (Done)
- [ ] 新規会話のタイトルが LLM で自動生成される
- [ ] 生成されたタイトルが 20 文字以内である
- [ ] LLM 生成失敗時はフォールバックタイトル（先頭50文字切り出し）が使用される
- [ ] メインのチャットレスポンスに遅延が発生しない（非同期実行）
- [ ] `pnpm lint` / `pnpm typecheck` / `pnpm test` が通る
```

---

## GFX-20: GAP-12（CSV 文字コード自動検出強化）

```text
[Task Title]
GAP-12: CSV インポートの文字コード自動検出を encoding-japanese ライブラリで強化

Goal
- EUC-JP や ISO-2022-JP など、UTF-8/Shift_JIS 以外の文字コードの CSV ファイルも
  正しくインポートできるようにする。

Context
- 参照: docs/AI-Generated01/03_gap_analysis_and_proposals.md (GAP-12)
- 現在の実装: CsvImportForm.tsx で UTF-8 パース失敗時に Shift_JIS にフォールバック

Scope
- 変更OK:
  - src/features/admin/allowlist/components/CsvImportForm.tsx（文字コード検出の強化）
  - package.json（encoding-japanese の追加）
- 変更NG:
  - CSV パース後の import ロジック（API 側）

Implementation Hints
- `pnpm add encoding-japanese` でライブラリを追加
- CsvImportForm.tsx のファイル読み込み部分を改修:
  1. FileReader で ArrayBuffer として読み込み
  2. `Encoding.detect(arrayBuffer)` で文字コードを検出
  3. `Encoding.convert(arrayBuffer, { to: 'UNICODE', from: detectedEncoding })` で変換
  4. 変換結果を文字列として CSV パースに渡す
- BOM 付き UTF-8 の処理: 先頭の BOM（0xEF 0xBB 0xBF）を除去
- オプション: ユーザーに検出した文字コードを表示し、手動で変更できるドロップダウンを追加

Acceptance Criteria (Done)
- [ ] encoding-japanese が追加されている
- [ ] UTF-8, Shift_JIS, EUC-JP の CSV が正しく読み込める
- [ ] BOM 付き UTF-8 が正しく処理される
- [ ] `pnpm lint` / `pnpm typecheck` / `pnpm test` が通る
```

---

## GFX-21: GAP-19（一括操作プログレス表示）

```text
[Task Title]
GAP-19: 管理画面の一括操作にプログレス/結果表示を追加し、window.location.reload() を削除

Goal
- CSV インポートやレポート生成の結果を UI 上で即座に表示し、
  window.location.reload() による全画面リロードを排除する。

Context
- 参照: docs/AI-Generated01/03_gap_analysis_and_proposals.md (GAP-19)
- 現在 window.location.reload() を使用:
  - app/admin/allowlist/page.tsx L133, L155
  - app/admin/reports/page.tsx L117, L137

Scope
- 変更OK:
  - app/admin/allowlist/page.tsx（reload → state 更新 or refetch）
  - app/admin/reports/page.tsx（reload → state 更新 or refetch）
  - 必要なら関連フック（useAllowlistQuery, useReportsQuery のリフレッシュ関数追加）
- 変更NG:
  - API の変更

Implementation Hints
- 方針: `window.location.reload()` を `refetch()` 関数に置き換える
- useAllowlistQuery / useReportsQuery に `refetch` 関数を追加:
  - 内部の fetch を再実行する関数を返す
  - 例: `const { data, loading, error, refetch } = useAllowlistQuery({...})`
- 操作結果の表示:
  - 現在 alert() で表示している結果（「生成完了 成功: ...」等）をインラインメッセージに変更
  - 成功: 緑色のトーストまたはバナー（自動消去 5 秒）
  - 失敗: 赤色のエラーメッセージ（手動で閉じる）
- 操作中のボタン表示は既にある程度実装済み（disabled + 「処理中...」等）

Acceptance Criteria (Done)
- [ ] window.location.reload() がすべて refetch に置き換わっている
- [ ] 操作結果がインラインメッセージで表示される
- [ ] 既存の disabled / スピナー表示が維持されている
- [ ] `pnpm lint` / `pnpm typecheck` / `pnpm test` が通る
```

---

## GFX-22: GAP-20（AccountStatusBanner 無駄なクエリ抑制）

```text
[Task Title]
GAP-20: AccountStatusBanner で未ログイン時の無駄な DB クエリを抑制

Goal
- 未ログイン状態で AccountStatusBanner が Supabase クエリを実行する問題を修正する。

Context
- 参照: docs/AI-Generated01/03_gap_analysis_and_proposals.md (GAP-20)
- 現在の実装:
  - AccountStatusBanner はルートレイアウト（app/layout.tsx）に配置
  - 内部で useMyAllowlistStatus フックを使用
  - useMyAllowlistStatus 内の fetchStatus で supabase.auth.getSession() をチェックし、
    session がない場合は loading を false にして終了（クエリは実行しない）
  - ただし getSession() 自体はログインページでも毎回実行される

Scope
- 変更OK:
  - src/features/allowlist/components/AccountStatusBanner.tsx
  - src/features/allowlist/hooks/useMyAllowlistStatus.ts（必要に応じて）
- 変更NG:
  - app/layout.tsx の構造

Implementation Hints
- 実際には useMyAllowlistStatus.ts L29 で session がない場合は DB クエリをスキップしている
  ため、大きな問題ではない可能性がある
- ただし、getSession() 呼び出し自体を最適化できる:
  1. AccountStatusBanner 内で先にセッション有無をチェックし、
     session がない場合はコンポーネント自体を null return する（フック呼び出しをスキップ）
  2. または useMyAllowlistStatus フック内で早期 return を強化
- 注意: React Hooks の呼び出し順序ルール（条件付きフック呼び出し不可）に注意
  - 解決策 A: フック内で early return（既存パターン）
  - 解決策 B: AccountStatusBanner を 2 層に分けて、外側で session 有無を判定し、
    ある場合のみ内側（フック使用）をマウント

Acceptance Criteria (Done)
- [ ] 未ログイン状態で不要なクエリが実行されない
- [ ] ログイン状態の動作が維持される（pending/revoked/not-found バナー表示）
- [ ] React Hooks のルール違反がない
- [ ] `pnpm lint` / `pnpm typecheck` / `pnpm test` が通る
```

---

## GFX-23: GAP-23（署名 URL API レート制限）

```text
[Task Title]
GAP-23: POST /api/attachments/sign にレート制限を追加

Goal
- 署名 URL 生成 API の連続呼び出しによる Supabase Storage への過度な負荷を防止する。

Context
- 参照: docs/AI-Generated01/03_gap_analysis_and_proposals.md (GAP-23)
- 現在の実装:
  - POST /api/attachments/sign にレート制限がない
  - /api/chat には checkMinuteRate() が適用済み

Scope
- 変更OK:
  - app/api/attachments/sign/route.ts（レート制限チェック追加）
- 変更NG:
  - レート制限ロジック本体（rateLimit.ts）の変更
  - 署名 URL 生成ロジックの変更

Implementation Hints
- /api/chat と同様のパターンで checkMinuteRate() を適用
- ただし、添付画像の署名は1メッセージで最大3回呼ばれるため、
  /api/chat よりは緩い制限が適切（例: 20回/分）
- 実装方法:
  1. 既存の checkMinuteRate を直接使う（10回/分の制限が共通で適用される）
  2. または、添付専用のレート制限関数を追加（rateLimit.ts に checkAttachmentRate 等）
- 最小限の実装: 既存の checkMinuteRate をそのまま使う
  （別カウンターにする場合は次 PR で対応）

Acceptance Criteria (Done)
- [ ] /api/attachments/sign にレート制限が適用されている
- [ ] 制限超過時に 429 が返る
- [ ] 正常利用（1メッセージで3枚まで）は制限に引っかからない
- [ ] `pnpm lint` / `pnpm typecheck` / `pnpm test` が通る
```

---

## GFX-24: GAP-24（生成済みレポート再生成対応）

```text
[Task Title]
GAP-24: 全ステータスのレポートに「再生成」ボタンを表示

Goal
- 生成済み（generated）のレポートも再生成できるようにし、LLM の回答品質が
  低いレポートを差し替えられるようにする。

Context
- 参照: docs/AI-Generated01/03_gap_analysis_and_proposals.md (GAP-24)
- 現在の実装:
  - app/admin/reports/page.tsx L298: `{report.status === 'failed' && (` で
    failed の場合のみ再生成ボタンを表示

Scope
- 変更OK:
  - app/admin/reports/page.tsx（再生成ボタンの表示条件変更）
- 変更NG:
  - 再生成 API ロジック

Implementation Hints
- L298 の条件を変更:
  - `report.status === 'failed'` →
    `report.status === 'failed' || report.status === 'generated'`
  - generated の場合は確認ダイアログで「既に生成済みのレポートを上書きしますか？」と警告
  - GFX-09 完了後なら ConfirmDialog を使用、未完了なら window.confirm でよい
- ボタンのラベル:
  - failed: 「再生成」
  - generated: 「再生成」（または「再生成（上書き）」）

Acceptance Criteria (Done)
- [ ] generated ステータスのレポートにも「再生成」ボタンが表示される
- [ ] generated のレポート再生成時に確認ダイアログが表示される
- [ ] failed のレポート再生成は既存動作と同じ
- [ ] `pnpm lint` / `pnpm typecheck` / `pnpm test` が通る
```

---

## GFX-25: GAP-27（ストリーム中断/キャンセル機能）

```text
[Task Title]
GAP-27: AI 応答ストリーミング中に中断（キャンセル）ボタンを表示

Goal
- ユーザーが誤った質問を送信した場合等に、AI の回答生成を途中で停止できるようにする。

Context
- 参照: docs/AI-Generated01/03_gap_analysis_and_proposals.md (GAP-27)
- 現在の実装:
  - ChatInterface.tsx でストリーミング中は「AIが考え中...」アニメーションを表示
  - 中断する手段がなく、最後まで生成される
  - Vercel AI SDK v6 の useChat は stop 関数を提供している可能性あり

Scope
- 変更OK:
  - src/features/chat/components/ChatInterface.tsx（停止ボタン追加、stop/abort 呼び出し）
- 変更NG:
  - API 側の変更
  - useChat フックの仕様変更

Implementation Hints
- Vercel AI SDK v6 の useChat が返す `stop` 関数を確認:
  - `const { messages, sendMessage, status, setMessages, stop } = useChat({...})`
  - `stop` が利用可能なら、ストリーミング中に呼び出す
  - 利用不可の場合は AbortController を使って手動で中断する必要がある
- UI:
  - `status === 'streaming'` の場合に「AIが考え中...」の横（または代わりに）
    「停止」ボタンを表示
  - ボタンスタイル: 赤系のコンパクトなボタン（`bg-red-100 text-red-700`）
  - 停止後: ストリーミングが中断され、それまでの部分回答がメッセージに残る
- 停止後のメッセージ表示:
  - Vercel AI SDK が自動で部分回答を保持する場合はそのまま
  - 必要に応じて「（回答が中断されました）」のサフィックスを追加

Acceptance Criteria (Done)
- [ ] ストリーミング中に「停止」ボタンが表示される
- [ ] ボタン押下でストリーミングが中断される
- [ ] 中断までの部分回答が表示される
- [ ] 中断後に新しいメッセージを送信できる
- [ ] `pnpm lint` / `pnpm typecheck` / `pnpm test` が通る
```

---

## GFX-26: GAP-28（スタッフ用レポート閲覧パネル実装）

```text
[Task Title]
GAP-28: スタッフ用管理画面にレポート本文の閲覧パネルを実装する

Goal
- スタッフが /admin/reports の一覧テーブルから個別レポートの本文（LLM 生成 Markdown）を
  直接閲覧できるようにする。仕様書（docs/reports/monthly.md §3.2）に記載された
  「レポート詳細パネル」と「[閲覧]ボタン」が未実装のため追加する。

Context
- 参照: docs/reports/monthly.md §3.2（スタッフ用レポートページ仕様）
- 現在の実装:
  - app/admin/reports/page.tsx: 一覧テーブルに「再生成」ボタンはあるが「閲覧」ボタンがない
  - src/shared/lib/reportRead.ts の getStaffReportList() は一覧用のため content を返していない
  - src/features/reports/components/ReportContent.tsx: 生徒用レポート表示コンポーネントは
    既に実装済み（react-markdown + remark-gfm で記事風表示）
  - GET /api/reports/monthly はスタッフ用一覧を返すが、個別レポートの content 取得手段がない

Scope
- 変更OK:
  - src/shared/lib/reportRead.ts（スタッフが個別レポートの content を取得する関数を追加）
  - app/api/reports/monthly/route.ts（GET のスタッフ用処理に userId 指定時の単一レポート返却を追加）
  - app/admin/reports/page.tsx（「閲覧」ボタン追加 + レポート詳細パネルの表示）
  - tests/**（新規関数のテスト追加）
- 変更NG:
  - 生徒用レポートページ（app/reports/page.tsx）の変更
  - ReportContent コンポーネント本体のレイアウト変更
  - DB スキーマ変更
  - POST（生成）側のロジック変更

Implementation Hints
- API 拡張:
  - GET /api/reports/monthly?month=YYYY-MM&userId=xxx をスタッフが呼んだ場合、
    getStaffReportList は既に userId フィルタに対応している
  - ただし content を含んでいないため、reportRead.ts に個別取得関数を追加:
    ```ts
    export async function getStaffReportDetail(
      month: string, userId: string
    ): Promise<{ report: { id, month, status, content, stats, generatedAt, user } | null }>
    ```
  - monthly_report テーブルから user_id + month で 1 件取得し content を含めて返却
  - route.ts の GET スタッフ分岐で userId が指定されている場合に detail を返すよう拡張
- フロントエンド:
  - 一覧テーブルの各行（report.status === 'generated' の場合）に「閲覧」ボタンを追加
  - ボタン押下で selectedReportUserId を state に設定
  - selectedReportUserId が設定されている場合、テーブルの下に詳細パネルを表示:
    1. GET /api/reports/monthly?month=YYYY-MM&userId=xxx を fetch
    2. 取得した report を ReportContent コンポーネントに渡して記事風表示
    3. パネル上部に「閉じる」ボタンと生徒のメール/表示名を表示
  - ReportContent は既存のものをそのまま import して使用
    （src/features/reports/components/ReportContent.tsx）
  - レポート選択の切り替え時は前の詳細を閉じて新しいものを表示
- 「閲覧」ボタンの配置:
  - 既存の「再生成」ボタンの左に配置
  - generated: 「閲覧」+「再生成」の 2 ボタン
  - failed: 「再生成」のみ（content がないため閲覧不可）
  - generating / pending: ボタンなし（既存動作維持）

Acceptance Criteria (Done)
- [ ] reportRead.ts に getStaffReportDetail 関数が追加されている
- [ ] GET /api/reports/monthly でスタッフが userId 指定時に content 付きの単一レポートを取得できる
- [ ] /admin/reports の一覧テーブルで generated のレポートに「閲覧」ボタンが表示される
- [ ] 「閲覧」ボタン押下でテーブル下部にレポート詳細パネル（記事風 Markdown 表示）が表示される
- [ ] 詳細パネルに生徒のメール/表示名が表示される
- [ ] 詳細パネルの「閉じる」ボタンで非表示にできる
- [ ] ReportContent コンポーネントが再利用されている（生徒用と同一の表示品質）
- [ ] テストが追加されている
- [ ] `pnpm lint` / `pnpm typecheck` / `pnpm test` が通る
```

---

## GFX-27: GAP-10 残作業（スタッフログイン後のリダイレクト先修正）

```text
[Task Title]
GAP-10 残作業: スタッフログイン後のリダイレクト先を /admin/allowlist → /admin に修正

Goal
- GFX-11 で /admin ダッシュボード（4 カードリンク）を実装済みだが、
  ログイン後のルーティング先が /admin/allowlist のまま更新されていない。
  設計書（architecture.md, acceptance.md T-12）および UAT 仕様書（TC_A_002）は
  スタッフログイン後に /admin（ダッシュボード）へリダイレクトされることを期待している。
  この取りこぼしを修正する。

Context
- 参照: architecture.md（「スタッフ→/admin」）, acceptance.md T-12, UAT仕様書 TC_A_002
- 現在のコード: app/login/page.tsx:70 → router.push('/admin/allowlist')
- GFX-11 で app/admin/page.tsx（ダッシュボード）は作成済み
- ファイルヘッダコメント（login/page.tsx:5）にも '/admin/allowlist' と記載されている

Scope
- 変更OK:
  - app/login/page.tsx（router.push の引数 + ファイルヘッダコメント）
- 変更NG:
  - app/admin/page.tsx（ダッシュボード自体は変更不要）
  - ミドルウェアやその他の認証フロー

Steps
1. app/login/page.tsx:70 の `router.push('/admin/allowlist')` を `router.push('/admin')` に変更
2. app/login/page.tsx:5 のファイルヘッダコメントを `staff → /admin` に修正
3. 既存テストがあれば修正（ルーティング先の文字列を検証しているテストがないか確認）

Acceptance Criteria (Done)
- [ ] app/login/page.tsx でスタッフログイン時に router.push('/admin') が呼ばれる
- [ ] ファイルヘッダコメントが '/admin' に更新されている
- [ ] `pnpm lint` / `pnpm typecheck` / `pnpm test` が通る
```

---

## GFX-28: UsageBadge のリアルタイム更新（チャット送信後に残り質問数が反映されない）

```text
[Task Title]
UsageBadge: チャット送信後に残り質問数をリアルタイム更新する

Goal
- 生徒がチャットを送信した後、ヘッダーの「残り X/Y」バッジがページリロードなしで
  更新されるようにする。現状は UsageBadge がマウント時に 1 回だけ /api/usage を
  fetch しており、POST /api/chat 完了後に再取得するトリガーがない。

Context
- UsageBadge.tsx:38-40 の useEffect は [fetchUsage] のみを依存配列に持ち、初回のみ実行
- app/api/chat/route.ts:190 の onFinish で incrementUsage() を呼び DB は正しく更新される
- しかしフロントエンド側に再取得の通知がないため画面に反映されない
- F5 リロードすれば正しい値が表示される（DB 側の問題ではなくフロント側の問題）
- UAT 仕様書 TC_B_010 で「質問送信後に残り質問数が 1 減っている」が期待されている

Scope
- 変更OK:
  - src/features/chat/components/UsageBadge.tsx（refresh トリガー追加）
  - src/features/chat/components/ChatInterface.tsx（送信完了時のコールバック通知）
  - app/chat/page.tsx（UsageBadge と ChatInterface の接続）
- 変更NG:
  - app/api/chat/route.ts（バックエンドの incrementUsage ロジックは正常）
  - app/api/usage/route.ts（API 自体は正常）
  - src/shared/lib/rateLimit.ts（DB 更新ロジックは正常）

Implementation Hints
- 方針 A（推奨: コールバック方式）:
  1. UsageBadge に refresh() を公開する方法:
     - UsageBadge に `refreshKey` (number) props を追加
     - useEffect の依存配列に refreshKey を含め、変わるたびに /api/usage を再 fetch
  2. ChatInterface に `onMessageComplete` コールバック props を追加
     - AI ストリーム完了後（onFinish 相当のタイミング）にコールバックを呼ぶ
     - 注意: incrementUsage は onFinish（サーバー側）で実行されるので、
       クライアント側の完了検知と若干のタイミング差がある。
       ストリーム終了後に 500ms〜1s の遅延を入れてから fetch すると確実
  3. app/chat/page.tsx で接続:
     ```tsx
     const [usageRefreshKey, setUsageRefreshKey] = useState(0)
     <UsageBadge token={token} refreshKey={usageRefreshKey} />
     <ChatInterface
       onMessageComplete={() => setTimeout(() => setUsageRefreshKey(k => k + 1), 1000)}
     />
     ```
- 方針 B（ポーリング方式 — シンプルだが非推奨）:
  - UsageBadge 内に setInterval(fetchUsage, 30000) を追加
  - 30秒ごとに自動更新 → 不要なリクエストが発生するためコスト面で非推奨

Acceptance Criteria (Done)
- [ ] チャット送信 → AI 応答完了後、ページリロードなしで UsageBadge の数値が更新される
- [ ] 初回マウント時の表示は従来通り正常に動作する
- [ ] 不要なポーリングや過剰な API コールが発生しない
- [ ] `pnpm lint` / `pnpm typecheck` / `pnpm test` が通る
```

---

## GFX-29: 会話継続・メッセージ保存・時系列の修正（3 症状の統合修正）

```text
[Task Title]
チャットの会話継続・メッセージ永続化・時系列表示を正しく機能させる

Goal
- 同一会話で 2 通目以降のメッセージを送信しても新しい会話が作成されず、
  既存の会話にメッセージが追記されるようにする。
- リロード後も会話内のすべてのメッセージが正しい時系列で表示されるようにする。
- UAT 仕様書 TC_B_001〜TC_B_003（連続チャットの基本動作）を満たす。

Background — 報告された 3 つの症状
1. 毎回新しい会話が作られる（同一会話で連続質問できない）
2. リロードすると最新のユーザーメッセージ + AI 応答の 1 ペアしか表示されない
3. メッセージの時系列が逆転する（AI 応答がユーザーメッセージより上に表示）

Root Cause Analysis — 3 つの根本原因

■ 原因 A: サーバーが常に新しい会話を作成する
  場所: app/api/chat/route.ts:112
  コード: const conversationId = crypto.randomUUID()
  問題: リクエストから既存の conversationId を受け取るロジックがない。
        毎回 crypto.randomUUID() で新規 ID を生成し、onFinish で
        conversations テーブルに INSERT する。クライアントが既存の
        会話内でメッセージを送信しても、サーバーは別の会話として保存する。

■ 原因 B: クライアントが conversationId をサーバーに送信していない
  場所: src/features/chat/components/ChatInterface.tsx:185-194
  コード: await sendMessage({ text: userMessage }, { headers: {...}, body: ... })
  問題: ChatSession コンポーネントは props で conversationId を受け取っているが、
        sendMessage の body にそれを含めていない。
        AI SDK v6 の sendMessage の第 2 引数 options.body はリクエスト body に
        マージされる（node_modules/ai/dist/index.mjs:11681-11688 で確認済み）
        ため、body: { conversationId } を渡せばサーバーで取得できるが、
        現在はそうなっていない。

■ 原因 C: メッセージの時系列が保証されない
  場所: app/api/chat/route.ts:157-174, supabase/migrations/20260127_chat_history.sql
  問題: user メッセージと assistant メッセージを同一バッチで INSERT しており、
        明示的な created_at を渡していない。PostgreSQL の DEFAULT now() は
        同一トランザクション内で同一値を返すため、両メッセージが同じタイムスタンプ
        になる。その結果、ORDER BY created_at ASC の tie-break が UUID の
        辞書順に依存し、user が assistant より後に来る場合がある。

Context — 調査で確認した技術的詳細

- AI SDK v6 の sendMessage options.body:
  HttpChatTransport.sendMessages (ai/dist/index.mjs:11681-11688) で
  body = { ...resolvedBody, ...options.body, id, messages, trigger, messageId }
  としてマージされるため、sendMessage の body に含めたフィールドは
  サーバーの req.json() で取得できる。

- 現在の onFinish の処理順序 (route.ts:139-216):
  1. conversations.insert（毎回新規 INSERT）
  2. messages.insert（最新 user + assistant の 1 ペアだけ）
  3. attachments.insert（添付がある場合）
  4. incrementUsage
  5. タイトル LLM 生成（非同期 void）
  → 既存会話に追記する場合、1 はスキップし 2 だけ実行すべき。

- messages テーブルのスキーマ (20260127_chat_history.sql):
  created_at timestamptz not null default now()
  インデックス: idx_messages_conversation_created_at (conversation_id, created_at asc)
  → 順序保証のための列（seq SERIAL 等）は存在しない。

- GET /api/conversations/[id] のクエリ:
  .order('created_at', { ascending: true })
  .order('id', { ascending: true })
  → Supabase SDK では 2 つの .order() は PRIMARY + SECONDARY ソートとして
    正しく動作するが、created_at が同一の場合 UUID の辞書順は
    生成順を反映しないため意味のある tie-break にならない。

- app/chat/page.tsx の selectedId 管理:
  初期値は '' → 最初のメッセージ送信後、onConversationCreated コールバックで
  selectedId が設定される → ChatInterface に conversationId として渡される。
  2 通目以降は selectedId が空でないので conversationId は利用可能。
  ただし ChatSession がその conversationId を sendMessage に渡していない。

Scope
- 変更OK:
  - app/api/chat/route.ts（conversationId の受け取り + 条件分岐保存ロジック + 明示的 created_at）
  - src/features/chat/components/ChatInterface.tsx（sendMessage body に conversationId を追加）
  - supabase/migrations/（新規: messages テーブルに seq 列追加マイグレーション）
  - app/api/conversations/[id]/route.ts（ORDER BY を seq に変更）
  - tests/**（変更に伴うテスト修正・追加）
- 変更NG:
  - AI SDK 内部（node_modules）の変更
  - useChat フックの API エンドポイント変更（/api/chat のまま）
  - app/chat/page.tsx（selectedId 管理は現状で正しく動作している）
  - conversations テーブルのスキーマ（会話自体の構造は変更不要）

Implementation — Step-by-Step

Step 1: クライアント — conversationId をサーバーに送信する
  ファイル: src/features/chat/components/ChatInterface.tsx
  場所: ChatSession の onSubmit 内、sendMessage の呼び出し (L185-194)

  変更前:
    await sendMessage({
      text: userMessage,
    }, {
      headers: { 'Authorization': `Bearer ${token}` },
      body: attachmentMeta.length > 0
        ? { attachments: attachmentMeta }
        : undefined,
    })

  変更後:
    const bodyPayload: Record<string, unknown> = {}
    if (conversationId) {
      bodyPayload.conversationId = conversationId
    }
    if (attachmentMeta.length > 0) {
      bodyPayload.attachments = attachmentMeta
    }
    await sendMessage({
      text: userMessage,
    }, {
      headers: { 'Authorization': `Bearer ${token}` },
      body: Object.keys(bodyPayload).length > 0 ? bodyPayload : undefined,
    })

  注意: AI SDK v6 は options.body をリクエスト body にマージする。
        conversationId はサーバー側で requestBody.conversationId として取得可能。

Step 2: サーバー — 既存会話への追記をサポートする
  ファイル: app/api/chat/route.ts

  2a. requestBody の型に conversationId を追加 (L84-89):
    const requestBody = (await req.json()) as {
      messages?: UIMessageWithLegacyContent[]
      attachments?: AttachmentInput[]
      conversationId?: string  // ← 追加
    }

  2b. conversationId の決定ロジックを変更 (L112):
    変更前:
      const conversationId = crypto.randomUUID()
    変更後:
      const isNewConversation = !requestBody.conversationId
      const conversationId = requestBody.conversationId ?? crypto.randomUUID()

  2c. onFinish 内の保存ロジックを条件分岐 (L150-155):
    変更前:
      await supabaseAdmin.from('conversations').insert({
        id: conversationId,
        user_id: user.id,
        title: makeTitle(),
      })
    変更後:
      if (isNewConversation) {
        await supabaseAdmin.from('conversations').insert({
          id: conversationId,
          user_id: user.id,
          title: makeTitle(),
        })
      }

  2d. セキュリティ: conversationId が渡された場合、そのオーナーが
      リクエストユーザーであることを検証する（他人の会話に追記を防止）:
    if (!isNewConversation) {
      const { data: conv } = await supabaseAdmin
        .from('conversations')
        .select('user_id')
        .eq('id', conversationId)
        .single()
      if (!conv || conv.user_id !== user.id) {
        return new Response(
          JSON.stringify({ error: '会話が見つかりません' }),
          { status: 404, headers: { 'Content-Type': 'application/json' } },
        )
      }
    }
    このチェックは onFinish の外（レスポンス開始前の L112 付近）で行うこと。
    onFinish 内ではストリーミングが始まった後なのでエラーレスポンスを返せない。

  2e. タイトル LLM 生成は新規会話のみに限定:
    変更前: if (userText && assistantText) { void (async () => { ... })() }
    変更後: if (isNewConversation && userText && assistantText) { ... }

Step 3: メッセージの時系列を保証する
  3 つのサブステップで対応する。

  3a. マイグレーション: messages テーブルに seq 列を追加
    ファイル: supabase/migrations/YYYYMMDD000000_gfx29_message_seq.sql（新規）
    内容:
      ALTER TABLE messages ADD COLUMN seq BIGSERIAL;
      CREATE INDEX idx_messages_conversation_seq
        ON messages(conversation_id, seq ASC);
    BIGSERIAL は INSERT 順に自動採番されるため、
    同一バッチの INSERT でも user → assistant の順序が保証される。

  3b. サーバー: messages INSERT を個別に実行して seq の順序を保証
    ファイル: app/api/chat/route.ts (L157-174)
    変更前:
      const rows = []
      if (userText) { rows.push({...user...}) }
      rows.push({...assistant...})
      await supabaseAdmin.from('messages').insert(rows)
    変更後:
      // user メッセージを先に INSERT（seq が先に採番される）
      if (userText) {
        await supabaseAdmin.from('messages').insert({
          id: userMessageId,
          conversation_id: conversationId,
          role: 'user',
          content: userText,
        })
      }
      // assistant メッセージを後に INSERT（seq が user + 1 になる）
      await supabaseAdmin.from('messages').insert({
        id: crypto.randomUUID(),
        conversation_id: conversationId,
        role: 'assistant',
        content: assistantText,
      })
    注意: バッチ INSERT を 2 回の個別 INSERT に分割することで、
          BIGSERIAL の採番順が保証される。
          パフォーマンス影響は軽微（同一 onFinish 内の 2 クエリ）。

  3c. GET API: ORDER BY を seq に変更
    ファイル: app/api/conversations/[id]/route.ts
    変更前:
      .order('created_at', { ascending: true })
      .order('id', { ascending: true })
    変更後:
      .order('seq', { ascending: true })
    select に 'seq' を追加するかはオプション（クライアントに返す必要はない）。

Step 4: テスト修正・追加
  - tests/api/chat-conversations.integration.test.ts:
    MockQuery の messages INSERT モックに seq 列対応を追加
  - 新規テストケース:
    - 既存会話へのメッセージ追記が動作する
    - 追記時に conversations テーブルに新規行が作られない
    - 他人の conversationId を送信した場合 404 が返る
    - messages の seq 順が user → assistant になる

Risks / Follow-ups
- 既存データへの影響: seq 列追加は BIGSERIAL のため既存行にも自動採番される。
  ただし既存行の seq 順序は INSERT 順（≒ id 生成順）になるため、
  既存の同一タイムスタンプ問題は解決しない。
  → 既存データの修復が必要な場合は別途対応（β版 20 名規模なので手動修復可能）。
- conversationId の偽装防止: Step 2d のオーナーチェックで対応済み。
  ただし UUID の推測は困難なため、実質的なリスクは低い。
- AI SDK v6 の body マージ仕様への依存: options.body が
  リクエスト body にマージされることを index.mjs:11681-11688 で確認済み。
  SDK のメジャーバージョンアップ時に再確認が必要。

Acceptance Criteria (Done)
- [ ] 同一会話で 2 通目以降のメッセージが同じ会話に追記される
- [ ] リロード後、会話内のすべてのメッセージが表示される（1 ペアだけではない）
- [ ] メッセージが正しい時系列で表示される（user → assistant の順）
- [ ] 新規会話は従来通り新しい conversation レコードが作成される
- [ ] 他人の conversationId を送信した場合 404 が返る（セキュリティ）
- [ ] タイトル LLM 生成は新規会話のときのみ実行される
- [ ] messages テーブルに seq 列が追加されている
- [ ] GET /api/conversations/[id] が seq 順でメッセージを返す
- [ ] テストが追加・修正されている
- [ ] `pnpm lint` / `pnpm typecheck` / `pnpm test` が通る
```

---

## GFX-30: HEIC/HEIF 画像のクライアント変換対応（iPhone ユーザー対応）

```text
[Task Title]
iPhone からの HEIC/HEIF 画像添付をクライアント側で JPEG に変換して対応する

Goal
- iPhone のカメラロールから直接添付された HEIC/HEIF 画像を、
  アップロード前にブラウザ内で JPEG に変換し、既存フローに乗せる。
- サーバー側・Storage・表示側の変更は不要とする（クライアント完結）。
- 日本のβ版ユーザー（中高生）の大半が iPhone ユーザーであるため、
  HEIC 非対応は画像添付機能の利用率を大きく下げるリスクがある。

Background — なぜ必要か
- iPhone はデフォルトで HEIF/HEIC 形式で写真を保存（iOS 11〜、2017年〜）
- 現在の ALLOWED_MIME_TYPES は image/jpeg, image/png, image/webp のみ
  → HEIC を添付すると「対応している画像形式は JPEG / PNG / WebP です。」エラー
- Safari(iOS) のファイルピッカーは HEIC を自動変換する場合もあるが、
  環境やバージョンにより HEIC のまま渡されるケースがある
- Chrome デスクトップは HEIC を <img> で表示できないため、
  スタッフの管理画面でも閲覧不可になる
- クライアント側で JPEG に変換すれば、Storage には常に JPEG が入り、
  サーバー・表示側の変更が不要になる

Context — 現在の実装の詳細

■ ファイル選択〜バリデーション:
  src/features/chat/hooks/useImageAttachments.ts の addFiles() (L64-100)
  → FileList を受け取り、validateFile() で MIME + サイズをチェック
  → ALLOWED_MIME_TYPES に含まれないファイルは拒否してエラー表示

■ accept 属性:
  useImageAttachments が返す accept = ALLOWED_MIME_TYPES.join(',')
  → 'image/jpeg,image/png,image/webp'
  → iPhone のファイルピッカーで HEIC ファイルが選択対象外になる場合がある

■ バリデーション定数:
  src/shared/lib/attachmentValidation.ts (L12-16)
  → ALLOWED_MIME_TYPES = ['image/jpeg', 'image/png', 'image/webp']

■ サーバー側バリデーション:
  app/api/attachments/sign/route.ts (L72)
  → assertAllowedMimeType(mimeType) で HEIC を拒否
  → クライアント側で変換済みなら mimeType は 'image/jpeg' として送信されるため変更不要

■ プレビュー表示:
  ImagePreviewBar.tsx (L35-39)
  → URL.createObjectURL(file) でプレビュー生成
  → HEIC の場合、Safari では表示可能だが Chrome では表示不可
  → 変換後の File/Blob で createObjectURL すれば全ブラウザで表示可能

Scope
- 変更OK:
  - package.json（heic2any ライブラリ追加）
  - src/shared/lib/attachmentValidation.ts（HEIC_MIME_TYPES 定数を追加）
  - src/features/chat/hooks/useImageAttachments.ts（HEIC 検知→変換→従来フローに合流）
  - src/features/chat/components/ImagePreviewBar.tsx（変換中インジケータ追加）
  - src/features/chat/components/ChatInterface.tsx（accept 属性の更新のみ）
  - tests/**（変換ロジックのテスト追加）
- 変更NG:
  - app/api/attachments/sign/route.ts（サーバー側バリデーションは変更不要）
  - app/api/chat/route.ts（チャット API は変更不要）
  - src/features/chat/components/MessageBubble.tsx（表示側は変更不要）
  - Storage の設定（JPEG として保存されるので変更不要）

Implementation — Step-by-Step

Step 1: heic2any ライブラリを追加する
  コマンド: pnpm add heic2any
  補足:
    - heic2any は約 200KB（gzip 後）。チャットページでのみ使用される
    - TypeScript 型定義は同梱されている
    - dynamic import で遅延読み込みし、非 HEIC ユーザーには影響なし

Step 2: attachmentValidation.ts に HEIC 関連の定数を追加する
  ファイル: src/shared/lib/attachmentValidation.ts

  追加内容:
    /** クライアント側で JPEG に変換する MIME タイプ（iPhone HEIC/HEIF） */
    export const CONVERTIBLE_MIME_TYPES = [
      'image/heic',
      'image/heif',
    ] as const

    /** ファイルピッカーの accept 属性に使う文字列（ALLOWED + CONVERTIBLE） */
    export const INPUT_ACCEPT_TYPES = [
      ...ALLOWED_MIME_TYPES,
      ...CONVERTIBLE_MIME_TYPES,
    ].join(',')

    /** HEIC→JPEG 変換時の品質（0〜1） */
    export const HEIC_CONVERSION_QUALITY = 0.85

  注意:
    - ALLOWED_MIME_TYPES 自体は変更しない（サーバー側バリデーションに使われているため）
    - CONVERTIBLE_MIME_TYPES は「変換対象として検知するための定数」
    - INPUT_ACCEPT_TYPES はファイルピッカーの accept 属性用

Step 3: useImageAttachments.ts の addFiles を改修する
  ファイル: src/features/chat/hooks/useImageAttachments.ts

  3a. HEIC 変換関数を追加:
    /** HEIC/HEIF ファイルを JPEG に変換する */
    async function convertHeicToJpeg(file: File): Promise<File> {
      const heic2any = (await import('heic2any')).default
      const blob = await heic2any({
        blob: file,
        toType: 'image/jpeg',
        quality: HEIC_CONVERSION_QUALITY,
      })
      // heic2any は Blob | Blob[] を返す（マルチフレームの場合配列）
      const resultBlob = Array.isArray(blob) ? blob[0] : blob
      // 元のファイル名の拡張子を .jpg に変更
      const newName = file.name.replace(/\.hei[cf]$/i, '.jpg')
      return new File([resultBlob], newName, { type: 'image/jpeg' })
    }

  3b. addFiles の型と変換ロジック:
    現在の addFiles は同期的に setItems を呼んでいるが、
    HEIC 変換は非同期（heic2any が Promise を返す）のため、
    addFiles を async 化するか、変換中の状態管理が必要。

    推奨アプローチ:
    1. addFiles 内で HEIC ファイルを検知
    2. HEIC ファイルには status: 'converting' を設定して items に追加
       （プレビュー URL は空のプレースホルダー）
    3. 変換を非同期で実行
    4. 変換完了後に items の該当エントリを更新
       （file を変換後の File に差し替え、previewUrl を生成、status を 'pending' に変更）
    5. 変換失敗時は status: 'error' に設定

    AttachmentItem の status に 'converting' を追加:
      status: 'converting' | 'pending' | 'uploading' | 'done' | 'error'

  3c. validateFile の変更:
    HEIC/HEIF の場合はバリデーションをスキップ（変換後に再検証する）:
      function validateFile(file: File): string | null {
        const isConvertible = (CONVERTIBLE_MIME_TYPES as readonly string[]).includes(file.type)
        if (!isConvertible && !(ALLOWED_MIME_TYPES as readonly string[]).includes(file.type)) {
          return '対応している画像形式は JPEG / PNG / WebP です。'
        }
        // HEIC の場合、変換後にサイズが増える可能性があるため、
        // 元ファイルのサイズチェックは緩和する（変換後に再チェック）
        if (!isConvertible && file.size > MAX_FILE_SIZE_BYTES) {
          return '画像は 1 枚あたり 5MB 以下にしてください。'
        }
        return null
      }

  3d. 変換後のサイズチェック:
    HEIC は高圧縮のため、JPEG 変換後にサイズが増える場合がある。
    変換後に MAX_FILE_SIZE_BYTES を超える場合は:
      - status: 'error', error: '変換後のサイズが 5MB を超えました。'
      - ユーザーに通知してスキップ

  3e. accept 属性の更新:
    ACCEPT 定数を INPUT_ACCEPT_TYPES に変更:
      変更前: const ACCEPT = ALLOWED_MIME_TYPES.join(',')
      変更後: import { INPUT_ACCEPT_TYPES } from '@shared/lib/attachmentValidation'
              // accept プロパティで INPUT_ACCEPT_TYPES を返す

Step 4: ImagePreviewBar.tsx に変換中インジケータを追加する
  ファイル: src/features/chat/components/ImagePreviewBar.tsx

  status === 'converting' の場合のオーバーレイを追加:
    {item.status === 'converting' && (
      <div className="absolute inset-0 bg-blue-500/40 flex items-center justify-center">
        <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
        <span className="text-white text-[9px] ml-1">変換中</span>
      </div>
    )}

  変換中はプレビュー画像がまだないため、プレースホルダーを表示:
    {item.previewUrl ? (
      <img src={item.previewUrl} alt={item.file.name} className="w-full h-full object-cover" />
    ) : (
      <div className="w-full h-full flex items-center justify-center bg-gray-100">
        <span className="text-gray-400 text-xs">HEIC</span>
      </div>
    )}

Step 5: ChatInterface.tsx の送信制御を更新する
  ファイル: src/features/chat/components/ChatInterface.tsx

  変換中（status === 'converting' のアイテムがある間）は送信ボタンを無効化:
    - useImageAttachments の戻り値に isConverting を追加
    - disabled 条件に isConverting を追加

Step 6: テストを追加する
  新規テストファイル: tests/hooks/useImageAttachments.test.ts（または既存テストに追加）

  テストケース:
    - HEIC ファイルが addFiles に渡された場合、status が 'converting' → 'pending' に遷移する
    - 変換後のファイルの MIME が 'image/jpeg' になっている
    - 変換後のファイル名が .jpg で終わっている
    - 変換後のサイズが 5MB を超える場合、status が 'error' になる
    - 非 HEIC ファイル（JPEG 等）は従来通り即座に 'pending' になる
    - heic2any の import 失敗時（ネットワークエラー等）にエラーハンドリングされる

  注意: heic2any は実際の HEIC バイナリが必要なため、
        ユニットテストではモック化する:
    vi.mock('heic2any', () => ({
      default: vi.fn().mockResolvedValue(new Blob(['fake'], { type: 'image/jpeg' })),
    }))

Risks / Follow-ups

- heic2any のバンドルサイズ（約 200KB gzip）:
  dynamic import で遅延読み込みするため、初回の HEIC 添付時のみロードされる。
  非 HEIC ユーザーには影響なし。
  将来的に気になる場合は Web Worker で変換する最適化が可能。

- HEIC 変換の処理時間:
  1〜3 秒程度（画像サイズによる）。'converting' ステータスの UI で
  ユーザーに待機を明示する。

- マルチフレーム HEIC（Live Photos）:
  heic2any はデフォルトで最初のフレームのみ変換する。
  Live Photos の動画部分は無視される。意図通り。

- iOS Safari の自動変換との二重変換:
  iOS Safari がファイルピッカーで HEIC を JPEG に自動変換する場合、
  file.type は 'image/jpeg' になるため、変換ロジックはスキップされる。
  つまり二重変換は発生しない。

- HEIC 以外の非対応形式（GIF, SVG, PDF 等）:
  従来通り拒否。CONVERTIBLE_MIME_TYPES に含まれないものは
  ALLOWED_MIME_TYPES でチェックされエラーになる。

Step 7: ドキュメント更新（HEIC 対応に伴う不整合の解消）
  GFX-30 で HEIC を「クライアント変換で対応」とするため、
  「非対応」と記載されている箇所を更新する。

  7a. docs/attachments.md:16
    変更前: **非対応**: GIF（アニメーション不要）、HEIC（ブラウザ互換性）、SVG（XSS リスク）、PDF
    変更後: **非対応**: GIF（アニメーション不要）、SVG（XSS リスク）、PDF
             **自動変換**: HEIC/HEIF（クライアント側で JPEG に変換後アップロード）

  7b. docs/attachments.md:137
    エラーメッセージ表に HEIC の注記を追加:
    → 「HEIC/HEIF はクライアント側で自動変換されるためエラーにならない」

  7c. docs/attachments.md:151
    accept 属性の記載を更新:
    変更前: accept="image/jpeg,image/png,image/webp"
    変更後: accept="image/jpeg,image/png,image/webp,image/heic,image/heif"

  7d. docs/troubleshooting.md:147
    変更前: | **対応形式** | JPEG / PNG / WebP のみ（`ALLOWED_MIME_TYPES`） |
    変更後: | **対応形式** | JPEG / PNG / WebP（HEIC/HEIF はクライアント側で JPEG に自動変換） |

  7e. docs/security.md:254
    変更前: * **許可**：`image/jpeg`, `image/png`, `image/webp`
    変更後: * **許可**：`image/jpeg`, `image/png`, `image/webp`
             * **自動変換（クライアント側）**：`image/heic`, `image/heif` → JPEG に変換後アップロード

  7f. docs/testing.md:299
    HEIC 変換のテスト項目を追加:
    → 「HEIC 画像を添付した場合、自動的に JPEG に変換されてアップロードされる」

  7g. CLAUDE.md — 添付画像機能セクション
    バリデーション定数の記載に HEIC 変換対応を追記

Acceptance Criteria (Done)
- [ ] pnpm add heic2any が実行され、package.json に追加されている
- [ ] CONVERTIBLE_MIME_TYPES と INPUT_ACCEPT_TYPES が attachmentValidation.ts に定義されている
- [ ] iPhone から HEIC 画像を添付すると、自動的に JPEG に変換されてアップロードされる
- [ ] 変換中に ImagePreviewBar に「変換中」インジケータが表示される
- [ ] 変換中は送信ボタンが無効化される
- [ ] 変換後のファイルの MIME タイプが image/jpeg になっている
- [ ] 変換後のファイルサイズが 5MB を超える場合、エラーが表示される
- [ ] 従来の JPEG/PNG/WebP 添付は影響を受けない（変換ロジックがスキップされる）
- [ ] サーバー側（sign API, chat API）に変更がない
- [ ] テストが追加されている
- [ ] ドキュメント更新: attachments.md, troubleshooting.md, security.md, testing.md, CLAUDE.md が更新されている
- [ ] `pnpm lint` / `pnpm typecheck` / `pnpm test` が通る
```

---

## GFX-31: 添付画像を AI（gpt-4o-mini Vision）に渡す Image-to-LLM パイプライン実装

```text
[Task Title]
添付画像を OpenAI gpt-4o-mini の Vision 入力として渡し、AI に画像認識・回答させる

Goal
- ユーザーが添付した画像を AI（gpt-4o-mini）が認識し、画像の内容を踏まえた回答を返す。
- 現状: 画像は Supabase Storage にアップロードされ、DB にメタデータが保存されるが、
  OpenAI API にはテキストメッセージのみが送信されており、画像が渡されていない。
- gpt-4o-mini は Vision（画像入力）に対応しているため、
  streamText の messages に ImagePart を追加するだけで画像認識が可能になる。

Background — なぜ必要か
- TC_C_001（JPEG 画像の添付とチャット送信）のテストで、
  AI が画像の内容を踏まえた回答を返さず、汎用的な学習トピック提案のみを返す。
- 画像添付機能（BE-08〜11, FE-05〜06）は「アップロード・保存・表示」を実装したが、
  「AI への画像入力」が欠落していた。
- β版の塾チャットボットとして、教科書の写真や問題用紙の画像を読ませて
  質問に答える機能は中核的な価値であり、画像添付の主要ユースケース。

Context — 現在の実装と問題点

■ 現在の添付フロー（クライアント→サーバー）:
  1. クライアント: POST /api/attachments/sign で署名 URL を取得
  2. クライアント: 署名 URL に PUT でファイルをアップロード
  3. クライアント: sendMessage の body.attachments[] に
     { storagePath, mimeType, size } を含めて送信
  → ここまでは正常に動作している。

■ 問題箇所 — chat/route.ts (L84-235):
  4. サーバー: requestBody.attachments を受け取る (L90)
     const attachmentInputs = requestBody.attachments ?? []
  5. サーバー: convertSafeMessages(uiMessages) でテキストメッセージを変換 (L110)
  6. サーバー: streamText({ model, system, messages }) を呼び出す (L151-154)
     ★ ここで messages にはテキストのみ。attachmentInputs の画像は含まれない。
  7. サーバー: onFinish 内で attachmentInputs を attachments テーブルに保存 (L195-204)
     → DB 保存のみに使われ、AI には渡されていない。

■ AI SDK v6 の ImagePart 形式:
  { type: 'image', image: URL | base64 | Uint8Array, mediaType?: string }
  → streamText の messages に UserModelMessage の content として含める:
     { role: 'user', content: [
       { type: 'text', text: 'この画像に何が写っていますか？' },
       { type: 'image', image: new URL(signedUrl), mediaType: 'image/jpeg' },
     ]}

■ 関連する問題 — 「(構造化データを受信中...)」表示:
  MessageBubble.tsx (L201-208) のフォールバック表示が出ている。
  AI が画像なしのテキストのみで応答した場合、レスポンスの形式が
  期待通りのテキストパートにならない可能性がある。
  GFX-31 の修正で AI が画像を踏まえた適切なテキスト応答を返すことで
  解消される可能性が高い。解消しない場合は別途調査。

Scope
- 変更OK:
  - app/api/chat/route.ts（streamText に ImagePart を追加するメインの変更）
  - src/shared/utils/ai-message-converter.ts（必要に応じて ImagePart 対応）
  - tests/api/chat-conversations.integration.test.ts（画像付きメッセージのテスト追加）
- 変更NG:
  - クライアントコード（既に正しく attachments を送信している）
  - app/api/attachments/sign/route.ts（署名 URL 発行は正常に動作）
  - DB スキーマ（attachments テーブルは変更不要）
  - src/features/chat/components/*（表示側は変更不要）

Implementation — Step-by-Step

Step 1: Storage から画像の署名 URL を取得する
  ファイル: app/api/chat/route.ts
  位置: L110 (convertSafeMessages の後、streamText の前)

  attachmentInputs がある場合、supabaseAdmin を使って Storage の署名 URL を取得する:

    // 添付画像の署名 URL を取得（AI に渡すため）
    let imageUrls: { url: string; mimeType: string }[] = []
    if (attachmentInputs.length > 0) {
      const signResults = await Promise.all(
        attachmentInputs.map(async (a) => {
          const { data } = await supabaseAdmin.storage
            .from('attachments')
            .createSignedUrl(a.storagePath, 600) // 10分有効
          return {
            url: data?.signedUrl ?? null,
            mimeType: a.mimeType ?? 'image/jpeg',
          }
        }),
      )
      imageUrls = signResults.filter(
        (r): r is { url: string; mimeType: string } => r.url !== null
      )
    }

  注意:
    - Service Role の supabaseAdmin を使うため、Storage ポリシーは不要
    - 署名 URL の有効期限は 600 秒（streamText の実行時間を十分カバー）
    - Storage から直接ダウンロード（base64）する方法もあるが、
      URL 渡しの方がメモリ効率が良い（5MB × 3 枚 = 最大 15MB を避けられる）

Step 2: streamText の messages に画像を追加する
  ファイル: app/api/chat/route.ts
  位置: L151 (streamText 呼び出し)

  方法 A（推奨）: convertSafeMessages の結果に ImagePart を追加する
    messages は ModelMessage[] 形式。最後の user メッセージの content に
    ImagePart を追加する:

    // 最後の user メッセージに画像パートを追加
    if (imageUrls.length > 0) {
      const lastUserIndex = messages.findLastIndex((m) => m.role === 'user')
      if (lastUserIndex >= 0) {
        const userMsg = messages[lastUserIndex]
        // content が string の場合は配列形式に変換
        const existingContent = typeof userMsg.content === 'string'
          ? [{ type: 'text' as const, text: userMsg.content }]
          : Array.isArray(userMsg.content)
            ? userMsg.content
            : []
        const imageParts = imageUrls.map((img) => ({
          type: 'image' as const,
          image: new URL(img.url),
          mediaType: img.mimeType,
        }))
        messages[lastUserIndex] = {
          ...userMsg,
          content: [...existingContent, ...imageParts],
        }
      }
    }

  方法 B（代替）: convertSafeMessages を通さず、直接 ModelMessage を構築する。
    → 既存のメッセージ変換ロジックが複雑なため、方法 A を推奨。

Step 3: テストを追加・修正する
  ファイル: tests/api/chat-conversations.integration.test.ts

  追加テストケース:
  - 画像付きメッセージで streamText が呼ばれた際、
    messages の最後の user メッセージに ImagePart が含まれている
  - 複数画像（3枚）の場合、すべての ImagePart が含まれている
  - 添付なしの場合、従来通りテキストのみの messages が渡される
  - Storage の署名 URL 取得が失敗した場合、
    その画像はスキップされ、テキストのみで AI に送信される（エラーにしない）

  MockQuery の storage モックに createSignedUrl を追加:
    supabaseAdmin.storage.from('attachments').createSignedUrl(path, expires)
    → { data: { signedUrl: 'https://mock-signed-url...' } }

Step 4: system プロンプトに画像対応の指示を追加する（オプション）
  ファイル: app/api/chat/route.ts (L153)

  現在の system プロンプト:
    'あなたは親切で分かりやすい塾の先生です。中高生の学習をサポートしてください。...'

  追加案:
    '画像が添付されている場合は、画像の内容を確認して回答に反映してください。
     教科書の写真や問題用紙の場合は、写っている問題を読み取って解説してください。'

  → これは必須ではないが、AI の応答品質が向上する可能性がある。

Risks / Follow-ups
- Storage 署名 URL の有効期限: streamText 実行中に期限切れになる可能性は極めて低い
  （600秒の署名 URL に対し、ストリーミング開始は数秒以内）。
  ただし、極端に長い会話履歴の場合は初回リクエストが遅延する可能性あり。
- OpenAI API コスト: gpt-4o-mini の Vision 入力はテキストのみより
  トークン消費が増加する（画像1枚あたり約 85〜1105 トークン、解像度依存）。
  β版 20 名規模では問題ないが、スケール時にはコスト監視が必要。
- Storage ポリシー依存: GFX-31 では supabaseAdmin（Service Role）で
  署名 URL を生成するため Storage ポリシーは不要。
  ただし、GFX-32（クライアント側の表示用署名 URL）には Storage ポリシーが必要。
- 「(構造化データを受信中...)」表示: GFX-31 の修正後にも再現する場合は
  MessageBubble.tsx のフォールバック表示ロジックを別途調査する。

前提条件
- GFX-32（Supabase Storage バケット・ポリシー設定）が完了していること。
  バケットが存在しないと署名 URL の生成が失敗する。
  ただし、コード変更自体は GFX-32 の前に実施可能（テストはモックで動く）。

Acceptance Criteria (Done)
- [ ] 画像を添付してチャット送信した際、AI が画像の内容を踏まえた回答を返す
- [ ] 複数画像（最大3枚）を添付した場合、すべての画像を AI が認識する
- [ ] 添付なしの従来のテキストチャットに影響がない
- [ ] Storage の署名 URL 取得が失敗した場合でもチャットが動作する（画像なしで送信）
- [ ] テストが追加されている（画像付き、画像なし、署名失敗の各ケース）
- [ ] `pnpm lint` / `pnpm typecheck` / `pnpm test` が通る
```

---

## GFX-32: Supabase Storage バケット・ポリシー設定ゲート（人間作業）

```text
[Task Title]
Supabase Storage の attachments バケット作成とアクセスポリシー設定（手動作業）

Goal
- 画像添付機能の動作に必要な Supabase Storage の設定を完了する。
- バケットが存在しないと、署名 URL の生成・画像アップロード・画像表示が
  すべて失敗する。
- この設定は Supabase Dashboard での手動作業であり、コード変更は不要。

Background — なぜ必要か
- 画像添付機能（BE-08〜11, FE-05〜06）の実装時に
  「Storage ポリシーは Supabase コンソールで手動設定が必要」と文書化されていた
  （CLAUDE.md §添付画像機能 > Storage 参照）。
- UAT テスト（TC_C_001）で画像添付をテストした際、
  Supabase Storage 側の設定が未実施であることが判明。
- バケット未作成の状態では:
  - POST /api/attachments/sign → 署名 URL 生成が 500 エラー
  - クライアントの PUT アップロード → 失敗
  - MessageBubble の署名 URL 取得 → 失敗 → 「読み込めません」表示

Context — 必要な設定項目

■ 1. attachments バケットの作成
  場所: Supabase Dashboard > Storage > New bucket
  設定:
    - Name: attachments
    - Public: OFF（非公開）
    - File size limit: 5MB（= MAX_FILE_SIZE_BYTES）
    - Allowed MIME types: image/jpeg, image/png, image/webp

■ 2. Storage ポリシー — SELECT（読み取り）
  場所: Supabase Dashboard > Storage > Policies > attachments バケット
  目的: ユーザーが自分の添付画像を表示するための署名 URL 生成を許可
  ポリシー:
    - Name: Users can read own attachments
    - Allowed operation: SELECT
    - Target roles: authenticated
    - Policy definition:
        auth.uid()::text = (storage.foldername(name))[1]
      （Storage パスが {user_id}/{uuid}.{ext} の規約に基づく）

■ 3. Storage ポリシー — INSERT（書き込み）
  場所: Supabase Dashboard > Storage > Policies > attachments バケット
  目的: ユーザーが自分のフォルダに画像をアップロードすることを許可
  ポリシー:
    - Name: Users can upload own attachments
    - Allowed operation: INSERT
    - Target roles: authenticated
    - Policy definition:
        auth.uid()::text = (storage.foldername(name))[1]

■ 4. Storage ポリシー — SELECT（スタッフ用、オプション）
  目的: スタッフが全ユーザーの添付画像を閲覧するための署名 URL 生成を許可
  ポリシー:
    - Name: Staff can read all attachments
    - Allowed operation: SELECT
    - Target roles: authenticated
    - Policy definition:
        (auth.jwt() -> 'app_metadata' ->> 'role') = 'staff'

注意事項
- POST /api/attachments/sign は supabaseAdmin（Service Role）を使用するため、
  署名アップロード URL の生成自体は Storage ポリシーに依存しない。
- ただし、クライアントが署名 URL で PUT アップロードする際には
  INSERT ポリシーが必要。
- MessageBubble が表示用の署名 URL を取得する際には
  getSupabaseBrowserClient()（anon key + user token）を使用するため、
  SELECT ポリシーが必要。
- バケットの File size limit と Allowed MIME types は
  サーバーサイドバリデーション（attachmentValidation.ts）と二重防御になる。

検証手順
1. バケット作成後: Supabase Dashboard > Storage で「attachments」バケットが表示される
2. ポリシー設定後: Supabase Dashboard > Storage > Policies で 2〜3 件のポリシーが表示される
3. 動作確認:
   - localhost で画像を添付してチャット送信 → アップロードが成功する
   - 送信後のメッセージバブルに画像サムネイルが表示される
   - サムネイルをクリックすると拡大表示（ImageLightbox）が開く

Acceptance Criteria (Done)
- [ ] Supabase Dashboard > Storage に「attachments」バケットが存在する
- [ ] バケット設定: Public = OFF, File size limit = 5MB
- [ ] SELECT ポリシー（本人の画像読み取り）が設定されている
- [ ] INSERT ポリシー（本人フォルダへの書き込み）が設定されている
- [ ] localhost で画像添付→チャット送信が成功する
- [ ] 送信後のメッセージに画像サムネイルが表示される
```

---

## GFX-33: 画像添付メッセージの保存・表示の修正（テキストなし送信対応 + リアルタイムサムネイル）

```text
[Task Title]
画像のみ送信時のメッセージ保存漏れ修正、送信直後のサムネイル表示、
「構造化データを受信中...」フォールバック表示の改善

Goal
- 画像のみ（テキストなし）で送信した場合でも、ユーザーメッセージと
  添付メタデータが正しく DB に保存されるようにする。
- 画像送信直後に、リロードせずともメッセージバブル内に
  添付画像のサムネイルが表示されるようにする。
- テキストなし送信時の「(構造化データを受信中...)」フォールバック表示を
  適切なメッセージ（または添付サムネイルのみ表示）に改善する。

Background — なぜ必要か
- UAT テスト（TC_C_001〜）で以下の 3 症状が発生:
  1. 新規チャットに画像のみを送信 → リロード後、AI の応答だけが表示される
     （ユーザーのメッセージと添付画像が消えている）
  2. 画像を送信した直後、メッセージバブルに画像サムネイルが表示されない
     （リロードすると表示されるケースもある）
  3. テキストなしで画像のみ送信すると、ユーザーメッセージに
     「(構造化データを受信中...)」と表示され、以降のメッセージ送信でも消えない
- 塾チャットボットの主要ユースケースとして、教科書や問題用紙の写真だけを
  送って質問するケースが想定されるため、テキストなし送信は正常フローとして
  サポートする必要がある。

Context — 現在の実装と問題点

■ 問題 1: テキストなし送信時に messages/attachments が DB に保存されない

  ファイル: app/api/chat/route.ts

  L189: const userText = getUIMessageText(lastUserMessage)
    → テキストなし送信時は userText = '' (falsy)

  L233-240:
    if (userText) {  // ← '' は falsy → スキップ
      await supabaseAdmin.from('messages').insert({
        id: userMessageId,
        conversation_id: conversationId,
        role: 'user',
        content: userText,
      })
    }
    → ユーザーメッセージが DB に保存されない

  L249:
    if (attachmentInputs.length > 0 && userText) {  // ← userText が falsy → スキップ
      const attachmentRows = attachmentInputs.map(...)
      await supabaseAdmin.from('attachments').insert(attachmentRows)
    }
    → 添付メタデータも DB に保存されない

  L265:
    if (isNewConversation && userText && assistantText) {
      // LLM タイトル生成
    }
    → テキストなしだとタイトルが LLM 生成されない（makeTitle のフォールバックは動く）

  結果: リロード後に GET /api/conversations/[id] が返すメッセージ一覧に
    ユーザーメッセージが含まれず、AI 応答のみが表示される。
    添付画像のメタデータも存在しないため、サムネイルも表示されない。

■ 問題 2: 送信直後にメッセージバブルに画像サムネイルが表示されない

  ファイル: src/features/chat/components/ChatInterface.tsx

  ChatSession コンポーネントの attachmentsByMessageId は、ChatLoader が
  GET /api/conversations/[id] のレスポンスから構築するマップ (L443-448)。

  sendMessage で追加される UIMessage にはテキスト parts のみが含まれ、
  添付画像のメタデータは含まれない。そのため、新規送信メッセージの
  MessageBubble には attachments prop が undefined となり、
  AttachmentThumbnails が描画されない。

  リロード後は ChatLoader が API から取得するため、その時点で
  attachments テーブルにデータがあればサムネイルが表示される。
  ただし問題 1 でデータが保存されていない場合は、リロード後も表示されない。

■ 問題 3:「(構造化データを受信中...)」フォールバック表示

  ファイル: src/features/chat/components/MessageBubble.tsx (L201-208)

  sendMessage({ text: '' }) でテキストなしのユーザーメッセージが作成されると:
    - parts = [{ type: 'text', text: '' }]
    - rawContent = '' (parts の text が空文字)
    - textContent = '' (normalizeMathDelimiters('') = '')
    - !textContent = true
    - message.parts.length > 0 = true (空テキスト part が 1 つある)
    → フォールバック「(構造化データを受信中...)」が表示される

  このフォールバックは本来 Tool calls 等の構造化レスポンス用に設計されたもので、
  テキストなし + 画像添付のユーザーメッセージでは不適切。

Scope
- 変更OK:
  - app/api/chat/route.ts（テキストなし送信時の保存ロジック修正）
  - src/features/chat/components/ChatInterface.tsx（送信直後の添付メタを管理）
  - src/features/chat/components/MessageBubble.tsx（フォールバック表示の改善）
  - tests/api/chat-conversations.integration.test.ts（テキストなし送信のテスト追加）
- 変更NG:
  - app/api/attachments/sign/route.ts（署名 URL 発行は変更不要）
  - app/api/conversations/[id]/route.ts（既に attachments を正しく返している）
  - src/features/chat/hooks/useImageAttachments.ts（アップロードロジックは変更不要）
  - DB スキーマ（既存テーブル構造で対応可能）

Implementation — Step-by-Step

Step 1: テキストなし送信時にもユーザーメッセージを DB に保存する
  ファイル: app/api/chat/route.ts

  1a. ユーザーメッセージ保存の条件を修正 (L233):
    変更前:
      if (userText) {
        await supabaseAdmin.from('messages').insert({
          id: userMessageId,
          ...
          content: userText,
        })
      }
    変更後:
      // テキストまたは添付がある場合にユーザーメッセージを保存
      // 画像のみ送信時は content が空文字になるが、
      // attachments テーブルとの紐付けのためにレコードは必要
      const hasUserContent = userText || attachmentInputs.length > 0
      if (hasUserContent) {
        await supabaseAdmin.from('messages').insert({
          id: userMessageId,
          conversation_id: conversationId,
          role: 'user' as const,
          content: userText || '',  // 画像のみの場合は空文字
        })
      }

  1b. 添付保存の条件を修正 (L249):
    変更前:
      if (attachmentInputs.length > 0 && userText) {
    変更後:
      if (attachmentInputs.length > 0 && hasUserContent) {
    あるいはシンプルに:
      if (attachmentInputs.length > 0) {
    （hasUserContent が true のときのみ userMessageId が有効な INSERT 済み ID になるため、
     hasUserContent チェックは 1a で保証される。
     ただし安全のため attachmentInputs.length > 0 だけで十分 ——
     1a で hasUserContent = true ならメッセージは INSERT 済み。）

  1c. LLM タイトル生成の条件を修正 (L265):
    変更前:
      if (isNewConversation && userText && assistantText) {
    変更後:
      if (isNewConversation && (userText || attachmentInputs.length > 0) && assistantText) {
    画像のみ送信でもタイトルを生成するため。
    ただし LLM への prompt で userText が空の場合は assistantText のみから生成:
      prompt: userText
        ? `ユーザー: ${userText.slice(0, 200)}\nAI: ${assistantText.slice(0, 200)}`
        : `AI: ${assistantText.slice(0, 200)}`

Step 2: 送信直後のメッセージバブルに添付画像サムネイルを表示する
  ファイル: src/features/chat/components/ChatInterface.tsx

  方法: ChatSession 内で「送信済み添付メタデータ」をローカルステートで保持し、
  sendMessage が返す UIMessage の ID と紐付けて attachmentsByMessageId にマージする。

  2a. ChatSession に送信済み添付を追跡する state を追加:
    const [localAttachments, setLocalAttachments] = useState<
      Record<string, MessageAttachment[]>
    >({})

  2b. onSubmit 内で、sendMessage 完了後に添付メタを記録する:
    sendMessage 呼び出し後:
      // sendMessage が追加した最新の user メッセージの ID を取得
      // messages 配列から最新の user メッセージを探す
    ただし、sendMessage は Promise を返し、完了後に messages が更新されている。
    useChat の messages は非同期更新のため、sendMessage 完了直後では
    最新のメッセージ ID が取得できない可能性がある。

    代替方法: sendMessage の前にメッセージ ID を予測するのは困難なため、
    useEffect で messages の変化を監視し、添付付きで送信した直後の
    新しい user メッセージに対して添付メタを紐付ける。

    実装案:
      // onSubmit 内で添付メタを一時保存
      const pendingAttachmentsRef = useRef<AttachmentMeta[] | null>(null)

      // onSubmit の sendMessage 前に:
      if (attachmentMeta.length > 0) {
        pendingAttachmentsRef.current = attachmentMeta
      }

      // useEffect で messages の変化を監視
      useEffect(() => {
        if (!pendingAttachmentsRef.current) return
        // 最新の user メッセージを探す
        const lastUserMsg = [...messages].reverse().find(m => m.role === 'user')
        if (lastUserMsg && !localAttachments[lastUserMsg.id]) {
          const meta = pendingAttachmentsRef.current
          setLocalAttachments(prev => ({
            ...prev,
            [lastUserMsg.id]: meta.map(a => ({
              id: crypto.randomUUID(),
              storagePath: a.storagePath,
              mimeType: a.mimeType,
              sizeBytes: a.size,
            })),
          }))
          pendingAttachmentsRef.current = null
        }
      }, [messages, localAttachments])

  2c. MessageBubble に渡す attachments を統合する:
    <MessageBubble
      key={m.id}
      message={m}
      attachments={
        attachmentsByMessageId[m.id] ?? localAttachments[m.id]
      }
    />

  注意:
    - localAttachments は送信セッション中のみ有効。
      リロード後は ChatLoader が API から取得した attachmentsByMessageId に
      切り替わるため、問題 1 の修正（DB 保存）が前提条件。
    - localAttachments は ChatSession の key={conversationId || 'new'} で
      セッション切り替え時にリセットされる。

Step 3: MessageBubble の「構造化データを受信中...」表示を改善する
  ファイル: src/features/chat/components/MessageBubble.tsx

  3a. フォールバック表示の条件を改善 (L201-208):
    変更前:
      {!textContent && message.parts && message.parts.length > 0 && (
        <div className="text-xs text-gray-500 mt-1 italic">
          (構造化データを受信中...)
        </div>
      )}
    変更後:
      {!textContent && !hasAttachments && message.parts && message.parts.length > 0 && (
        <div className="text-xs text-gray-500 mt-1 italic">
          (構造化データを受信中...)
        </div>
      )}
    → 添付画像がある場合はフォールバック表示を抑制。
      画像のみ送信時に画像サムネイルだけが表示される（テキストなしは自然）。

  3b. ユーザーメッセージのテキスト表示 (L193-195):
    テキストなし + 画像ありの場合、空の <div> が表示される。
    これは問題ないが、意図的であることを明示するためコメントを追加:
      {isUser ? (
        // テキストがない場合（画像のみ送信）は空表示。
        // 添付サムネイルが下に表示される。
        <div className="whitespace-pre-wrap">{textContent}</div>
      ) : ( ... )}

  オプション 3c: テキストなし + 画像ありのユーザーメッセージに
    プレースホルダー表示を追加（UX 向上）:
      {isUser && !textContent && hasAttachments && (
        <p className="text-sm text-blue-200 italic">画像を送信しました</p>
      )}
    → これは必須ではないが、画像だけのバブルに何もテキストがないのは
      ユーザーにとって分かりにくい可能性がある。判断は実装者に委ねる。

Step 4: テストを追加・修正する
  ファイル: tests/api/chat-conversations.integration.test.ts

  追加テストケース:
  - テキストなし + 画像添付でメッセージ送信
    → ユーザーメッセージが content: '' で DB に保存される
  - テキストなし + 画像添付で attachments テーブルにレコードが作成される
  - テキストなし + 画像添付の会話をリロード（GET /api/conversations/[id]）
    → ユーザーメッセージ + 添付画像が返される
  - テキストあり + 画像添付は従来通り動作する（既存テスト維持）
  - テキストなし + 画像なしは送信されない（クライアント側バリデーションで担保）

Risks / Follow-ups
- DB の content カラム: messages.content が NOT NULL 制約の場合、
  空文字 '' でも INSERT は成功するが、NULL は不可。
  現在の実装は content: userText || '' で空文字を使うため問題ない。
  → 確認: messages テーブルの content カラムが NOT NULL かどうか。
    NOT NULL なら '' で OK。NULL 許可なら '' でも NULL でもどちらでも良い。
- sendMessage({ text: '' }) の AI SDK 挙動:
  AI SDK v6 は空テキストのユーザーメッセージを正常に処理するが、
  OpenAI API に空テキスト + 画像 のみが送信されることを確認する必要がある。
  → GFX-31 で画像パートを追加済みのため、空テキスト + ImagePart は有効。
- localAttachments の管理:
  useEffect による紐付けは、messages 配列の更新タイミングに依存する。
  AI SDK v6 の useChat が sendMessage 完了後にどのタイミングで messages を
  更新するかを確認する必要がある。
  → sendMessage は Promise を返し、完了後に messages は更新済みのはず。
    ただし React の state 更新は非同期のため、次の render で反映される。

前提条件
- GFX-31（Image-to-LLM パイプライン）が完了していること。
  テキストなしで画像のみ送信した場合に AI が画像を認識するためには、
  GFX-31 で実装した ImagePart 追加が必要。
- GFX-32（Storage 設定）が完了していること。
  AttachmentThumbnails が署名 URL を取得するために Storage ポリシーが必要。

Acceptance Criteria (Done)
- [ ] テキストなし + 画像のみで送信した場合、ユーザーメッセージが DB に保存される
- [ ] テキストなし + 画像のみで送信した場合、attachments が DB に保存される
- [ ] リロード後に、ユーザーメッセージと添付画像サムネイルが正しく表示される
- [ ] 送信直後（リロードなし）に、ユーザーメッセージバブルに添付画像サムネイルが表示される
- [ ] テキストなし + 画像送信時に「(構造化データを受信中...)」が表示されない
- [ ] テキストあり + 画像送信は従来通り動作する（デグレなし）
- [ ] テキストのみ（画像なし）送信は従来通り動作する（デグレなし）
- [ ] テストが追加されている
- [ ] `pnpm lint` / `pnpm typecheck` / `pnpm test` が通る
```

---

## GFX-34: 会話 ID の URL 管理と画面遷移の安定化（実装済み PR #76/#77）

```text
[Task Title]
会話 ID を URL searchParams で管理し、リロード耐性・新規チャット・
画面遷移の安定化を実現する

Goal
- 会話 ID を URL の search parameter（?c=xxx）に反映し、
  リロードしても同じ会話が表示されるようにする。
- 新規チャットで最初のメッセージ送信後の「自動リロード」を解消する。
- 「新規チャット」ボタンが確実に機能するようにする。

Background — なぜ必要か
- UAT テスト中に以下の 3 症状が発生:

  1. LLM 生成完了後に画面が自動リロードされたように見える
     新規チャットで最初のメッセージを送信すると、AI 応答完了後に
     画面が一瞬リセットされて再描画される。
     システムが落ちたように感じ、UX が悪い。

  2. 「新規チャット」ボタンが機能しない
     サイドバーの「新規チャット」をクリックしても、
     現在のチャット画面がリセットされない。

  3. リロードすると新規チャットになってしまう
     会話中にブラウザをリロードすると、
     会話が失われて新規チャット画面に戻る。

- これら 3 症状は「会話 ID が URL に反映されていない」という
  同一の根本原因に起因する。

Context — 現在の実装と問題点

■ 現在のアーキテクチャ:
  ファイル: app/chat/page.tsx

  L17: const [selectedId, setSelectedId] = useState<string>('')
  → 会話 ID は React state のみで管理。URL は常に /chat のまま。

  L67-70: handleConversationCreated
    const handleConversationCreated = (id: string) => {
      setSelectedId(id)
      setSidebarKey(prev => prev + 1)
    }
  → 新規会話作成時に selectedId を更新するが、URL は変わらない。

■ 問題 1 の発生メカニズム（自動リロード）:

  ChatInterface.tsx L242-252:
    新規チャット（conversationId = null）で sendMessage 完了後、
    onConversationCreated(firstConv.id) が呼ばれる。

  page.tsx L67-70:
    setSelectedId(id) → conversationId が null → 'abc-123' に変化。

  ChatInterface.tsx L469:
    <ChatSession key={conversationId || 'new'} ... />
    key が 'new' → 'abc-123' に変わるため、ChatSession がアンマウント→再マウント。
    → useChat の全メッセージが消失し、ChatLoader が API から再取得。
    → ユーザーには画面が一瞬リセットされたように見える。

■ 問題 2 の発生メカニズム（新規チャットボタン不機能）:

  ConversationSidebar.tsx L123:
    onClick={() => onSelect('')}
    → setSelectedId('') を呼ぶ。

  すでに selectedId = '' の場合（新規チャット状態）:
    → setSelectedId('') は値が変わらず、React の再レンダリングが発生しない。
    → 既にメッセージが表示されている新規チャットのリセットができない。

  selectedId がある場合（既存会話を閲覧中）:
    → setSelectedId('') で selectedId が変わり、ChatSession が再マウントされる。
    → この場合は正常に動作するが、URL は /chat のまま。

■ 問題 3 の発生メカニズム（リロードで新規チャット）:

  page.tsx L17:
    const [selectedId, setSelectedId] = useState<string>('')
    → ページリロードで常に '' に初期化される。
    → URL に会話 ID が含まれていないため復元できない。

Scope
- 変更OK:
  - app/chat/page.tsx（URL searchParams による会話 ID 管理）
  - src/features/chat/components/ChatInterface.tsx（onConversationCreated の
    コールバックで URL を更新する方式に変更。ChatSession の key 管理見直し）
  - src/features/chat/components/ConversationSidebar.tsx
    （「新規チャット」ボタンのリセット確実化）
- 変更NG:
  - app/api/**（サーバー API は変更不要）
  - DB スキーマ（変更不要）
  - middleware.ts（/chat のマッチャーは既存のまま）

Implementation — Step-by-Step

Step 1: URL searchParams で会話 ID を管理する
  ファイル: app/chat/page.tsx

  方法: Next.js の useSearchParams + useRouter を使い、
  selectedId を URL の ?c=xxx パラメータから読み書きする。

  1a. selectedId の初期値を URL から読む:
    import { useSearchParams } from 'next/navigation'

    const searchParams = useSearchParams()
    const conversationIdFromUrl = searchParams.get('c') ?? ''
    const [selectedId, setSelectedId] = useState<string>(conversationIdFromUrl)

    // URL パラメータの変化を監視（ブラウザの戻る/進むボタン対応）
    useEffect(() => {
      const idFromUrl = searchParams.get('c') ?? ''
      if (idFromUrl !== selectedId) {
        setSelectedId(idFromUrl)
      }
    }, [searchParams])  // selectedId は依存配列に入れない（ループ防止）

  1b. selectedId 変更時に URL を更新する:
    → setSelectedId を直接呼ぶ代わりに、URL を更新するラッパー関数を作る。

    const navigateToConversation = useCallback((id: string) => {
      setSelectedId(id)
      if (id) {
        router.replace(`/chat?c=${id}`, { scroll: false })
      } else {
        router.replace('/chat', { scroll: false })
      }
    }, [router])

    注意:
      - router.replace を使用（router.push ではない）。
        push だとブラウザ履歴が積み上がり、戻るボタンで会話を遡ることになる。
        replace なら現在の履歴エントリを置き換える。
      - { scroll: false } でページ位置を維持する。

  1c. handleConversationCreated を URL 更新方式に変更:
    変更前:
      const handleConversationCreated = (id: string) => {
        setSelectedId(id)
        setSidebarKey(prev => prev + 1)
      }
    変更後:
      const handleConversationCreated = (id: string) => {
        navigateToConversation(id)
        setSidebarKey(prev => prev + 1)
      }

  1d. handleSelect を URL 更新方式に変更:
    変更前:
      const handleSelect = (id: string) => {
        setSelectedId(id)
        setIsSidebarOpen(false)
      }
    変更後:
      const handleSelect = (id: string) => {
        navigateToConversation(id)
        setIsSidebarOpen(false)
      }

Step 2: 新規会話作成時の ChatSession 再マウントを回避する
  ファイル: src/features/chat/components/ChatInterface.tsx

  現在の問題:
    <ChatSession key={conversationId || 'new'} ... />
    → conversationId が null → ID に変わると key が変わり再マウントされる。

  方法 A（推奨）: ChatSession 内で conversationId の変化を吸収する
    → ChatSession に conversationId を ref で管理し、
      新規会話作成時は conversationId を内部で更新するが key は変えない。

    具体的には:
    - ChatSession に internalConversationId state を追加
    - 外部から conversationId が変わった場合:
      - null/'' → 実ID: internalConversationId を更新するだけ（再マウントしない）
      - 実ID → 別の実ID: これは会話切替なので再マウントが必要
      - 実ID → null/'': 新規チャットへの切替なので再マウントが必要
    → key を使い分ける:
      <ChatSession
        key={conversationId || sessionKeyRef.current}
        ...
      />
      sessionKeyRef は新規チャットのセッション内で固定し、
      conversationId が設定されても key を変えない。

  方法 B（シンプル）: onConversationCreated で URL だけ更新し、
    ChatSession を再マウントしない。
    → ChatSession の conversationId prop が変わっても key は
      初回レンダリング時の値を維持する。

    // ChatLoader 内
    const initialConversationIdRef = useRef(conversationId)
    const sessionKey = initialConversationIdRef.current || 'new'
    // conversationId が変わっても sessionKey は変わらない

    // ただし、サイドバーから別の会話を選択した場合は再マウントが必要
    // → conversationId が「別の実 ID」に変わった場合のみ key を更新

    実装:
    const prevConversationIdRef = useRef(conversationId)
    const [sessionKey, setSessionKey] = useState(conversationId || 'new')

    useEffect(() => {
      const prev = prevConversationIdRef.current
      const curr = conversationId

      // null → ID: 新規チャットが会話に確定（再マウント不要）
      if (!prev && curr) {
        // key は変えない（再マウントしない）
        prevConversationIdRef.current = curr
        return
      }

      // ID → null: 新規チャットへ切替（再マウント必要）
      // ID → 別ID: 会話切替（再マウント必要）
      if (prev !== curr) {
        setSessionKey(curr || `new-${Date.now()}`)
        prevConversationIdRef.current = curr
      }
    }, [conversationId])

    <ChatSession key={sessionKey} conversationId={conversationId} ... />

Step 3: 「新規チャット」ボタンの確実なリセット
  ファイル: app/chat/page.tsx

  問題: selectedId が既に '' の場合、setSelectedId('') は値が変わらず
  再レンダリングが起きない。

  修正: navigateToConversation に強制リセットフラグを追加するか、
  新規チャット専用のハンドラを作る。

    const handleNewChat = useCallback(() => {
      // URL を /chat に更新（パラメータなし）
      router.replace('/chat', { scroll: false })
      // selectedId をリセット（既に '' でも強制的に再レンダリングするため、
      // ChatSession の key にタイムスタンプを含める）
      setSelectedId('')
      setSidebarKey(prev => prev + 1)  // サイドバーも更新
      setIsSidebarOpen(false)
    }, [router])

  ConversationSidebar にも新規チャット用のコールバックを渡す:
    <ConversationSidebar
      ...
      onNewChat={handleNewChat}  // 追加
    />

  ConversationSidebar.tsx:
    props に onNewChat を追加:
      interface ConversationSidebarProps {
        ...
        onNewChat?: () => void
      }

    「新規チャット」ボタンを修正:
      変更前: onClick={() => onSelect('')}
      変更後: onClick={() => onNewChat?.() ?? onSelect('')}

  ChatLoader 側の対応:
    sidebarKey の変化を検知して ChatSession を再マウントする必要がある。
    方法: ChatInterface に resetKey prop を追加するか、
    page.tsx で conversationId に一意の値を含める:

    // selectedId が '' でも、sidebarKey が変わるたびに ChatSession を
    // 再マウントするため、key に sidebarKey を含める:
    <ChatInterface
      token={token}
      conversationId={selectedId || null}
      key={selectedId || `new-${sidebarKey}`}  // ← sidebarKey で強制リセット
      ...
    />

    注意: この方法は ChatInterface 全体の再マウントになるため、
    認証状態の再チェック等が走る。パフォーマンス上の問題がないか確認する。

Step 4: Suspense boundary の追加（useSearchParams 対応）
  ファイル: app/chat/page.tsx

  Next.js App Router で useSearchParams を使う場合、
  最寄りの Suspense boundary が必要（ビルドエラー防止）。

  export default function ChatPage() の中身を内部コンポーネントに移動し、
  外側で Suspense で囲む:

    import { Suspense } from 'react'

    function ChatPageContent() {
      // 現在の ChatPage の中身をここに移動
      const searchParams = useSearchParams()
      ...
    }

    export default function ChatPage() {
      return (
        <Suspense fallback={<div className="flex h-[100dvh] items-center justify-center">読み込み中...</div>}>
          <ChatPageContent />
        </Suspense>
      )
    }

Risks / Follow-ups
- ブラウザ履歴: router.replace を使用するため、
  会話切替のたびにブラウザ履歴が上書きされる。
  「戻る」ボタンで前の会話に戻れない（意図的な設計）。
  将来的に router.push に変更すれば会話間のブラウザバック対応も可能。
- searchParams 変更のタイミング:
  Next.js の useSearchParams は非同期更新のため、
  router.replace 直後に searchParams.get('c') が最新値を返さない可能性がある。
  → selectedId は useState で管理し、URL は同期的に更新するため問題ない。
    useSearchParams は初期値の読み取りとブラウザバック対応にのみ使用。
- ChatSession の key 管理:
  Step 2 の方法 B は、新規チャットが会話に確定する際の再マウントを回避するが、
  ChatSession 内の useChat が古い API URL を使い続ける可能性がある。
  useChat のデフォルト API URL は /api/chat で固定のため問題ないが、
  将来的に API URL を動的に変える場合は注意が必要。
- Middleware への影響:
  middleware.ts のマッチャーは /chat/:path* のため、/chat?c=xxx は対象内。
  search params はマッチャーに影響しないため変更不要。

Acceptance Criteria (Done)
- [ ] 会話中にブラウザをリロードしても、同じ会話が表示される
- [ ] URL に ?c=xxx パラメータが含まれ、会話 ID が反映されている
- [ ] 新規チャットで最初のメッセージ送信後、画面の「リロード」が発生しない
- [ ] サイドバーの「新規チャット」ボタンをクリックすると、新規チャット画面になる
- [ ] 既存の会話をサイドバーから選択すると、その会話が表示され URL が更新される
- [ ] ブラウザの戻る/進むボタンで会話が切り替わる（オプション: replace 使用時は不要）
- [ ] テキストのみ・画像添付・画像のみ送信すべてで会話の継続が正常に動作する
- [ ] `pnpm lint` / `pnpm typecheck` / `pnpm test` が通る
```

---

## GFX-35: sync-user で生徒の app_metadata.role を自動設定する（実装済み PR #78）

```text
[Task Title]
/api/sync-user で app_user 作成時に auth.app_metadata.role = 'student' を
自動設定し、全生徒が requireAuth を通過できるようにする

Goal
- 生徒がログインした際、Supabase Auth の app_metadata.role が
  自動的に 'student' に設定されるようにする。
- これにより、requireAuth() を使う全エンドポイント
  （/api/reports/monthly 等）に生徒がアクセスできるようになる。
- 既存の運用フロー（手動 SQL 実行や admin/grant 経由）を不要にする。

Background — なぜ必要か
- UAT テスト（TC_E_001: 生徒レポート閲覧）で
  allowed_email status='active' の生徒が /reports にアクセスしたところ
  「エラー: ユーザーロールを特定できませんでした。」（403）が発生。
- 原因調査の結果、生徒の auth.users.raw_app_meta_data に
  "role" フィールドが存在しないことが判明:
    { "provider": "email", "providers": ["email"] }
    ← "role": "student" がない
- /api/sync-user は app_user テーブルに role='student' を設定するが、
  Supabase Auth の app_metadata には一切書き込んでいない。
- /api/admin/grant のみが auth.admin.updateUserById() で
  app_metadata.role を設定しており、スタッフ昇格時しか実行されない。
- つまり生徒は永久に app_metadata.role = null のまま。
  requireAuth() は app_metadata.role が 'student' or 'staff' でなければ
  403 を返すため、全生徒がブロックされる。

影響範囲
- requireAuth() を使う全エンドポイント:
  - app/api/reports/monthly/route.ts（GET: レポート閲覧）
  - src/shared/lib/reportRead.ts（レポート読み取りロジック）
  - 今後 requireAuth() を使う新規 API すべて
- 本番環境で全生徒に影響（約20名のβ版ユーザー全員）。
  現状は手動で SQL を実行して role を設定する必要があり、運用負荷が高い。

Context — 現在の実装

■ /api/sync-user (app/api/sync-user/route.ts):
  L82-116: app_user テーブルに INSERT（role は DB デフォルトの 'student'）
  → auth.admin.updateUserById() は呼ばれない
  → app_metadata.role は null のまま

■ /api/admin/grant (src/shared/lib/grant.ts):
  L117-119: auth.admin.updateUserById(targetUser.auth_uid, {
    app_metadata: { role: newRole },
  })
  → スタッフ昇格時にのみ app_metadata.role を設定
  → 生徒には使われない

■ requireAuth (src/shared/lib/requireAuth.ts):
  L36-38:
    const role = (authUser.user.app_metadata)?.role
    if (role !== 'student' && role !== 'staff') {
      throw new AppError(403, 'FORBIDDEN', 'ユーザーロールを特定できませんでした。')
    }
  → app_metadata.role が null/undefined の場合 403

■ docs/security.md の認証フロー:
  Step 4: "Supabase が JWT を発行（初回は app_metadata.role = null）"
  Step 7: "管理者が /api/admin/grant を実行し role = 'staff' に昇格"
  → 生徒の app_metadata.role を設定するステップが存在しない

Scope
- 変更OK:
  - app/api/sync-user/route.ts（app_metadata.role 設定を追加）
  - docs/security.md（認証フローに app_metadata.role 設定ステップを追記）
  - docs/api.md（sync-user の動作説明に追記）
  - docs/troubleshooting.md（「ユーザーロールを特定できません」の原因と対処を追記）
  - CLAUDE.md（既知の問題に追記 or 修正済みとして記録）
  - tests/（sync-user のテストで app_metadata 設定を検証）
- 変更NG:
  - src/shared/lib/requireAuth.ts（app_metadata.role チェックは正しい設計。
    フォールバックで app_user.role を見る方法もあるが、JWT ベースの
    一貫したセキュリティモデルを崩すべきではない）
  - src/shared/lib/grant.ts（スタッフ昇格のロジックは変更不要）
  - DB スキーマ（変更不要）

Implementation — Step-by-Step

Step 1: /api/sync-user で app_metadata.role を設定する
  ファイル: app/api/sync-user/route.ts

  1a. 新規ユーザー作成時（L100-116 の else ブロック内）:
    app_user INSERT の後に auth.admin.updateUserById を追加:

    変更後:
      } else {
        // New: Insert (role defaults to 'student')
        const { data: newUser, error: insertError } = await supabase
          .from('app_user')
          .insert({
            auth_uid: user.id,
            email: email,
          })
          .select('id, role')
          .single()

        if (insertError) throw new Error(insertError.message)
        if (!newUser) throw new Error('Failed to create user')

        // Supabase Auth の app_metadata.role も設定する
        // requireAuth() が JWT の app_metadata.role を参照するため必須
        const { error: metaError } = await supabase.auth.admin.updateUserById(
          user.id,
          { app_metadata: { role: newUser.role } },
        )
        if (metaError) {
          console.error('Failed to set app_metadata.role:', metaError.message)
          // app_user は作成済みなのでエラーにはしない。
          // 次回ログイン時のリトライで再設定される（1b 参照）。
        }

        appUserData = { id: newUser.id, role: newUser.role }
      }

  1b. 既存ユーザーログイン時（L90-99 の if ブロック内）:
    既に app_user が存在する場合でも、app_metadata.role が未設定の可能性がある
    （GFX-35 適用前に作成されたユーザー）。
    既存ユーザーにも app_metadata.role を設定するリカバリ処理を追加:

    変更後:
      if (existingUser) {
        // Exist: Update email only (if changed)
        const { error: updateError } = await supabase
          .from('app_user')
          .update({ email })
          .eq('id', existingUser.id)

        if (updateError) throw new Error(updateError.message)

        // app_metadata.role が未設定の場合は設定する（GFX-35 以前のユーザー対応）
        const currentRole = (
          user.app_metadata as Record<string, string | undefined>
        )?.role
        if (currentRole !== existingUser.role) {
          await supabase.auth.admin.updateUserById(user.id, {
            app_metadata: { role: existingUser.role },
          })
        }

        appUserData = { id: existingUser.id, role: existingUser.role }
      }

    注意:
      - currentRole !== existingUser.role で比較するため、
        既に正しく設定されている場合はスキップ（毎回更新しない）。
      - スタッフが grant で昇格済みの場合、app_metadata.role = 'staff' と
        app_user.role = 'staff' が一致するためスキップされる。
      - grant で昇格後に sync-user が呼ばれても role は上書きされない。

Step 2: ドキュメントを更新する

  2a. docs/security.md — 認証フローを修正:
    変更前:
      4. Supabase が JWT を発行（初回は app_metadata.role = null）
         ↓
      5. クライアントが /api/sync-user を呼び出し
        ↓
      6. Service Role で allowed_email を照合し、status='active' なら
         app_user テーブルに upsert（role = 'student'）

    変更後:
      4. Supabase が JWT を発行
         ↓
      5. クライアントが /api/sync-user を呼び出し
         ↓
      6. Service Role で allowed_email を照合し、status='active' なら
         app_user テーブルに upsert（role = 'student'）
         + auth.admin.updateUserById で app_metadata.role = 'student' を設定
         （既存ユーザーで app_metadata.role が未設定の場合もリカバリ設定）

    「Supabase Auth の app_metadata.role と app_user.role を同期」の記述が
    grant のみの文脈で書かれているため、sync-user でも同期することを明記する。

  2b. docs/troubleshooting.md — 「ユーザーロールを特定できません」の項目を追記:
    追加内容:
      ### 「エラー: ユーザーロールを特定できませんでした。」(403)
      **原因**: Supabase Auth の app_metadata.role が未設定。
      GFX-35 以前に作成されたユーザーで発生する可能性がある。
      **対処**:
      1. ユーザーに再ログインしてもらう（sync-user がリカバリ設定する）
      2. 手動で設定する場合:
         UPDATE auth.users
         SET raw_app_meta_data = raw_app_meta_data || '{"role": "student"}'::jsonb
         WHERE email = '対象のメールアドレス';

  2c. docs/api.md — /api/sync-user の動作説明を修正:
    app_metadata.role の自動設定について追記。

  2d. CLAUDE.md — 既知の問題から削除 or 修正済みとして記録。

Step 3: テストを追加する

  テスト対象:
  - 新規ユーザー作成時に auth.admin.updateUserById が
    { app_metadata: { role: 'student' } } で呼ばれる
  - 既存ユーザーで app_metadata.role が null の場合、
    updateUserById で role が設定される
  - 既存ユーザーで app_metadata.role が既に正しい場合、
    updateUserById は呼ばれない（不要な更新を避ける）
  - updateUserById が失敗しても sync-user 全体は成功する
    （エラーはログのみ）

Risks / Follow-ups
- updateUserById の追加呼び出し:
  sync-user のレスポンス時間が若干増加する（Auth API 1 回追加）。
  ただし初回ログイン時のみの追加であり、UX への影響は軽微。
  既存ユーザーのリカバリは app_metadata.role が一致すればスキップ。
- JWT の即時反映:
  updateUserById で app_metadata を更新しても、現在のセッションの JWT は
  即座には更新されない。ユーザーは次回のトークンリフレッシュ
  （デフォルト 60 分）または再ログインで新しい JWT を取得する。
  → sync-user はログインフロー内で呼ばれるため、
    初回ログイン時は直後にトークンが発行されるので問題ない。
  → 既存ユーザーのリカバリの場合、再ログインが必要な場合がある。
- grant との競合:
  sync-user は app_user.role を参照して app_metadata.role を設定する。
  grant で既に 'staff' に昇格済みの場合、app_user.role = 'staff' と
  app_metadata.role = 'staff' が一致するため上書きされない。
  grant 後に sync-user が呼ばれても安全。
- 既存β版ユーザーの一括修復:
  GFX-35 デプロイ後、既存の約20名は次回ログイン時に自動修復される。
  即座に修復したい場合は以下の SQL を実行:
    UPDATE auth.users
    SET raw_app_meta_data = raw_app_meta_data || '{"role": "student"}'::jsonb
    WHERE id IN (
      SELECT auth_uid FROM app_user WHERE role = 'student'
    )
    AND NOT (raw_app_meta_data ? 'role');

Acceptance Criteria (Done)
- [ ] 新規ユーザーのログイン後、app_metadata.role = 'student' が設定されている
- [ ] 既存ユーザー（app_metadata.role 未設定）がログインすると自動修復される
- [ ] /reports にアクセスしても「ユーザーロールを特定できません」が出ない
- [ ] スタッフ（app_metadata.role = 'staff'）の role が上書きされない
- [ ] updateUserById 失敗時も sync-user 全体は成功する
- [ ] docs/security.md の認証フローが更新されている
- [ ] docs/troubleshooting.md にエラーの対処法が追記されている
- [ ] テストが追加されている
- [ ] `pnpm lint` / `pnpm typecheck` / `pnpm test` が通る
```

---

## GFX-36: 許可メール一覧の検索・フィルタで画面がリロードされる問題の修正（実装済み PR #79）

```text
[Task Title]
/admin/allowlist の検索・フィルタ操作時の不要な全画面リロードを解消し、
デバウンス付きインクリメンタル検索に改善する

Goal
- 検索バーに1文字入力するたびに画面が「読み込み中…」にフルリプレースされる
  問題を解消する。
- ステータスフィルタのプルダウン変更時も同様の問題を解消する。
- デバウンス（300ms）を導入し、入力が落ち着いてから API を呼ぶようにする。
- データ更新中も既存のリスト表示を維持し、ローディングインジケータは
  インライン表示（スピナー等）にする。

Background — なぜ必要か
- UAT テスト（許可リスト管理: /admin/allowlist）で、検索バーに1文字入力する
  または ステータスプルダウンを変更するたびに画面全体が「読み込み中…」に
  フルリプレースされ、非常に使いづらい。
- 約20名のβ版でも登録件数が増えるにつれ、API レスポンス時間が伸びると
  さらに UX が悪化する。

Context — 現在の実装と問題点

■ 問題 1: デバウンスがない
  ファイル: src/features/admin/allowlist/hooks/useAllowlistQuery.ts

  L77: useEffect の依存配列に search と status が直接入っている:
    useEffect(() => {
      // ... API fetch ...
    }, [fetcher, headersMemo, search, status, revision])

  search は検索バーの onChange で即座に更新される（page.tsx L149）。
  1文字入力するたびに useEffect が発火し、API リクエストが送信される。
  例: "test" と入力すると "t", "te", "tes", "test" の 4 回 API を叩く。

■ 問題 2: loading 中に全画面がリプレースされる
  ファイル: app/admin/allowlist/page.tsx

  L75-82:
    if (isCheckingSession || (loading && !error)) {
      return (
        <main>
          <h1>許可メール一覧</h1>
          <p>読み込み中…</p>
        </main>
      )
    }

  初回ロード時だけでなく、検索/フィルタ変更によるデータ再取得時にも
  loading = true になるため、入力欄ごと全画面が「読み込み中…」に置き換わる。
  → ユーザーは入力中のテキストも消えるため、リロードされたように感じる。

Scope
- 変更OK:
  - src/features/admin/allowlist/hooks/useAllowlistQuery.ts
    （デバウンス導入 + 初回/更新の loading 状態を分離）
  - app/admin/allowlist/page.tsx
    （全画面ローディングを初回のみに制限、更新中はインライン表示に変更）
- 変更NG:
  - app/api/admin/allowlist/route.ts（API 側は変更不要）
  - src/features/admin/allowlist/hooks/useAllowlistMutations.ts（変更不要）

Implementation — Step-by-Step

Step 1: useAllowlistQuery にデバウンスを導入する
  ファイル: src/features/admin/allowlist/hooks/useAllowlistQuery.ts

  方法: search の値をデバウンスしてから useEffect に渡す。
  外部ライブラリ不要で実装可能。

  1a. デバウンス用の内部 state を追加:
    const [debouncedSearch, setDebouncedSearch] = useState(search)

    useEffect(() => {
      const timer = setTimeout(() => setDebouncedSearch(search), 300)
      return () => clearTimeout(timer)
    }, [search])

  1b. useEffect の依存配列で search → debouncedSearch に変更:
    useEffect(() => {
      // ... API fetch ...
    }, [fetcher, headersMemo, debouncedSearch, status, revision])
    //                        ^^^^^^^^^^^^^^^^ デバウンス済みの値を使用

  注意:
    - status（プルダウン）はデバウンス不要（即座に反映で問題ない）。
      ただし loading 表示の問題（Step 2）を修正すれば、
      プルダウン変更時の「リロード感」も解消される。
    - デバウンス時間 300ms は一般的な推奨値。
      入力が速いユーザーでも不快にならない程度。

Step 2: 初回ロードと更新中の loading 状態を分離する
  ファイル: src/features/admin/allowlist/hooks/useAllowlistQuery.ts

  方法: loading を「初回ロード中」と「バックグラウンド更新中」に分離する。

  2a. 状態を追加:
    const [initialLoading, setInitialLoading] = useState(true)
    const [fetching, setFetching] = useState(false)

  2b. useEffect 内の loading 管理を変更:
    useEffect(() => {
      let mounted = true
      ;(async () => {
        try {
          setFetching(true)  // バックグラウンド更新フラグ
          setError(null)
          // ... API fetch ...
          if (!mounted) return
          setData(json.data ?? [])
        } catch (err) {
          if (!mounted) return
          setError(err as Error)
        } finally {
          if (mounted) {
            setFetching(false)
            setInitialLoading(false)  // 初回完了
          }
        }
      })()
      return () => { mounted = false }
    }, [fetcher, headersMemo, debouncedSearch, status, revision])

  2c. 返り値を変更:
    return { data, error, loading: initialLoading, fetching, refetch }
    // loading: 初回のみ true（全画面ローディング用）
    // fetching: 更新中（インライン表示用）

Step 3: page.tsx の loading 表示をインライン化する
  ファイル: app/admin/allowlist/page.tsx

  3a. 全画面ローディングを初回のみに制限:
    const { data, loading, fetching, error, refetch } = useAllowlistQuery(...)

    変更前 (L75):
      if (isCheckingSession || (loading && !error)) {
    変更後:
      if (isCheckingSession || loading) {
    // loading は initialLoading のみ true になるため、初回のみ全画面表示

  3b. 更新中のインジケータをリスト上部に追加:
    登録件数表示の横にスピナーを追加:

    <div className="flex items-center justify-between border-b ...">
      <div className="space-y-1">
        <p className="text-sm font-medium text-slate-700">登録件数</p>
        <p className="text-2xl font-bold text-slate-900">{data?.length ?? 0}</p>
      </div>
      {fetching && (
        <div className="text-sm text-slate-400 flex items-center gap-2">
          <div className="w-4 h-4 border-2 border-slate-300 border-t-transparent
                          rounded-full animate-spin" />
          更新中...
        </div>
      )}
    </div>

Risks / Follow-ups
- デバウンス中の UX: 300ms の遅延はほぼ気にならないが、
  入力確定を待っている感覚を補うため、fetching インジケータが有効。
- status フィルタの即時反映: status 変更はデバウンスしないため即座に API を叩く。
  loading 表示の改善（Step 2-3）で「リロード感」は解消されるが、
  短時間に何度もプルダウンを切り替えると不要な API 呼び出しが発生する。
  → β版規模では問題ない。スケール時は status もデバウンス検討。

Acceptance Criteria (Done)
- [ ] 検索バーに文字を入力しても画面がフルリプレースされない
- [ ] ステータスフィルタを変更しても画面がフルリプレースされない
- [ ] 検索入力後 300ms でデータが更新される（デバウンス動作）
- [ ] データ更新中は既存のリスト表示が維持され、インラインスピナーが表示される
- [ ] 初回ロード時は従来通り「読み込み中…」が表示される
- [ ] `pnpm lint` / `pnpm typecheck` / `pnpm test` が通る
```

---

## GFX-37: 許可メール一覧に生徒の個別登録フォームを追加（実装済み）

```text
[Task Title]
/admin/allowlist にスタッフが1人ずつ生徒を登録できるインラインフォームを追加する

Goal
- CSV 一括登録に加え、スタッフが1人ずつ生徒のメールアドレスを登録できる UI を追加する。
- 登録された生徒は active ステータスで追加され、
  即座にチャット・レポート等すべての機能を利用できる。

Context
- 既存の API（POST /api/admin/allowlist）とフック（createAllowedEmail）は
  個別登録をサポート済み。フロントの UI が不足していただけ。

Implementation
- app/admin/allowlist/page.tsx に AddStudentForm コンポーネントを追加
- 「+ 生徒を個別登録」ボタンで展開するインラインフォーム
- メールアドレス（必須）+ ラベル（任意）を入力して登録
- 登録時のステータスは常に active
- 簡易メール形式バリデーション
- サーバー変更なし（既存 API を使用）

Status: 実装済み（feat/gfx-37-individual-student-registration ブランチ）
```

---

## GFX-38: Google OAuth ログインの導入（実装済み）

```text
[Task Title]
Supabase の Google OAuth Provider を有効化し、
ログインページに「Google でログイン」ボタンを追加する

Goal
- 生徒が Google アカウントでワンクリックログインできるようにする。
- パスワード管理の負担を排除し、β版の問合せ（パスワード忘れ）を削減する。
- 既存の Email/Password 認証はフォールバックとして並行運用する。

Background — なぜ必要か
- 対象ユーザーは中高生（約20名のβ版）。パスワード管理に不慣れな層。
- Email/Password のみの場合、「パスワード忘れた」の問合せが頻発する見込み。
- 中高生は日常的に Google（Gmail, YouTube, Google Classroom 等）を使用しており、
  Google ログインが最も自然な認証 UX。
- Supabase は Google を第一級プロバイダとしてサポートしており、
  Dashboard で ON にするだけ + ログインページにボタン追加で完了する。
- allowlist の照合ロジック（/api/sync-user）はメールベースのため、
  認証方式を問わず動作する。変更不要。

前提条件
- [x] Google Cloud Console で OAuth Client ID/Secret を取得済み（Step 3 完了）
      JavaScript 生成元: localhost:3000 のみ。本番ドメインは未追加（デプロイ時に対応）
- [x] Supabase Dashboard で Google Provider を有効化済み（Step 4 完了）
- [ ] Supabase Dashboard の Redirect URL 確認（Step 5 未確認）
- 設定手順: docs/AI-Generated01/05_google_oauth_setup_guide.md を参照
- GFX-35（sync-user で app_metadata.role 設定）が適用済みであること

Scope
- 変更OK:
  - app/login/page.tsx（「Google でログイン」ボタン追加）
  - docs/security.md（認証プロバイダに Google OAuth を追記）
  - CLAUDE.md（認証方式の更新）
- 変更NG:
  - app/api/sync-user/route.ts（変更不要 — メールベース照合は認証方式に依存しない）
  - middleware.ts（変更不要 — Supabase セッション cookie で認証、方式を問わない）
  - allowlist 関連 API/UI（変更不要）

Implementation — Step-by-Step

Step 1: ログインページに Google ログインボタンを追加する
  ファイル: app/login/page.tsx

  1a. signInWithOAuth 関数を追加:
    const handleGoogleLogin = async () => {
      const supabase = getSupabaseBrowserClient()
      const { error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: {
          redirectTo: `${window.location.origin}/login`,
        },
      })
      if (error) {
        setErrorMsg('Google ログインに失敗しました。')
      }
    }

  注意:
    - redirectTo はログインページ自体を指定する。
      Google 認証後、Supabase がセッションを設定して redirectTo に戻す。
      login ページの既存ロジック（onAuthStateChange）がセッションを検知して
      /api/sync-user を呼び出し、その後 /chat にリダイレクトする。
    - supabase.auth.signInWithOAuth はページ遷移を伴う（Google のログイン画面へ）。
      Promise の resolve は遷移前に完了するため、エラー時のみハンドリング。

  1b. ボタン UI を追加（既存のログインフォームの上または下）:
    <button
      type="button"
      onClick={handleGoogleLogin}
      className="w-full flex items-center justify-center gap-3 rounded-lg
                 border border-slate-300 bg-white px-4 py-3 text-sm font-medium
                 text-slate-700 shadow-sm hover:bg-slate-50 transition-colors"
    >
      <svg viewBox="0 0 24 24" width="20" height="20">
        {/* Google G logo SVG */}
      </svg>
      Google でログイン
    </button>

  1c. 区切り線を追加:
    <div className="relative my-6">
      <div className="absolute inset-0 flex items-center">
        <div className="w-full border-t border-slate-200" />
      </div>
      <div className="relative flex justify-center text-sm">
        <span className="bg-white px-4 text-slate-400">または</span>
      </div>
    </div>

  1d. 新規登録フォームにも Google オプションを表示:
    サインアップ画面（isSignUp = true の場合）にも同じ Google ボタンを表示。
    signInWithOAuth は未登録ユーザーの場合、自動的にアカウントを作成する。

Step 2: OAuth コールバック後のフローを確認する
  ファイル: app/login/page.tsx

  既存の onAuthStateChange が SIGNED_IN イベントを検知して
  /api/sync-user を呼び出すフローが、Google OAuth でも動作することを確認:

  - Google 認証後、Supabase が auth.users にユーザーを作成
  - セッション cookie を設定して redirectTo（/login）にリダイレクト
  - login ページの useEffect で onAuthStateChange が発火
  - SIGNED_IN / INITIAL_SESSION イベントで /api/sync-user を呼び出す
  - sync-user が allowlist を照合し、active なら /chat にリダイレクト

  注意:
    - 既存の handleLogin / handleSignUp フローとの競合がないことを確認。
      Google OAuth はページ遷移を伴うため、既存の state は リセットされる。
    - onAuthStateChange 内の sync-user 呼び出しが、
      Google OAuth ログイン時にも正しく発火することを確認。

Step 3: ドキュメントを更新する

  3a. docs/security.md:
    - 認証プロバイダに Google OAuth を追記
    - 認証フローに Google OAuth の経路を追加
    - 変更前: "プロバイダー：Google OAuth 2.0"（ドキュメント上は記載済みだが未実装だった）
    - 変更後: 実装済みであることを明記

  3b. CLAUDE.md:
    - プロジェクト概要の認証方式を更新
    - 完了した PR 一覧に追記

Step 4: CSP（Content Security Policy）の更新
  ファイル: next.config.js

  Google OAuth のリダイレクト先（accounts.google.com）が
  CSP の connect-src / form-action に含まれていない場合、ブロックされる可能性がある。

  確認:
    - Supabase の signInWithOAuth はページ遷移（window.location）を使うため、
      CSP の影響を受けない可能性が高い。
    - ただし、Google のログインポップアップを使う場合は
      frame-src に accounts.google.com を追加する必要がある。
  → まず動作確認し、CSP エラーが出た場合のみ修正する。

Risks / Follow-ups
- Google Cloud Console のテストステータス:
  OAuth 同意画面が「テスト」のままだと、テストユーザーに登録した
  Google アカウントでしかログインできない。
  β版リリース前に「アプリを公開」する必要がある（審査不要）。
- Email の一致:
  Google アカウントのメールと allowlist のメールが一致する必要がある。
  Google Workspace の場合はエイリアス（+tag）に注意。
  sync-user は email.toLowerCase().trim() で正規化するため、
  大文字小文字の差異は問題ない。
- 既存ユーザーの移行:
  Email/Password で登録済みのユーザーが Google OAuth でもログインした場合、
  同じメールアドレスなら Supabase が自動的にアカウントをリンクする
  （デフォルト設定）。手動対応は不要。
- GFX-35 への依存:
  Google OAuth でログインしても、sync-user が app_metadata.role を
  設定しないと requireAuth() でブロックされる。GFX-35 の適用が前提。

Acceptance Criteria (Done)
- [ ] Google Cloud Console で OAuth Client ID/Secret が取得されている
- [ ] Supabase Dashboard で Google Provider が有効化されている
- [ ] ログインページに「Google でログイン」ボタンが表示される
- [ ] Google ボタンをクリックすると Google のログイン画面に遷移する
- [ ] Google 認証後、allowlist に登録済み（active）のメールで /chat に遷移する
- [ ] allowlist に未登録のメールで Google ログインすると適切なエラーが表示される
- [ ] 既存の Email/Password ログインが引き続き動作する
- [ ] docs/security.md が更新されている
- [ ] `pnpm lint` / `pnpm typecheck` / `pnpm test` が通る
```

---

## GFX-39: CSV インポートのファイル選択キャンセル機能（実装済み PR #83）

```text
[Task Title]
/admin/allowlist の CSV インポートフォームにファイル選択のキャンセルボタンを追加する

Goal
- 一度選択した CSV ファイルを「キャンセル」して、アップロード前の初期状態に戻せるようにする。
- 現状はファイルを選択すると、別のファイルを選び直す以外にリセットする方法がない。

Background — なぜ必要か
- UAT テスト中に、誤ったファイルを選択した場合や、やっぱりアップロードしたくない場合に
  リセット手段がないことが判明。
- 特にスタッフが本番環境で操作する場合、誤操作防止のために明示的なキャンセル手段が必要。
- 現在の CsvImportForm は file 選択後に「プレビュー」→「一括登録を実行」のフローだが、
  途中で取りやめる UI がない。

Context — 現在の実装

  ファイル: src/features/admin/allowlist/components/CsvImportForm.tsx

  - L22: `const [file, setFile] = useState<File | null>(null)`
  - L30-37: `handleFileChange` でファイル選択時に state を更新
  - L88: インポート成功後に `inputRef.current.value = ''` で file input をリセット
  - L125-134: ファイル選択後の状態表示（ファイル名・サイズ）

  問題: ファイル選択後の状態表示エリアに「×」ボタンやキャンセルリンクがない。
  ファイルを選び直すには、再度 <input type="file"> をクリックする必要がある。

Scope
- 変更OK:
  - src/features/admin/allowlist/components/CsvImportForm.tsx
- 変更NG:
  - API / バックエンドロジック（変更不要）

Implementation — Step-by-Step

Step 1: キャンセル（クリア）関数を追加する
  ファイル: src/features/admin/allowlist/components/CsvImportForm.tsx

  const handleClearFile = () => {
    setFile(null)
    setCsvText('')
    setPreview([])
    setIsUpsert(false)
    setDetectedEncoding(null)
    if (inputRef.current) {
      inputRef.current.value = ''
    }
  }

Step 2: ファイル選択後の状態表示に「× キャンセル」ボタンを追加する
  L125-134 のファイル情報表示エリアに:

  <button
    type="button"
    onClick={handleClearFile}
    className="ml-2 text-sm text-slate-400 hover:text-red-500"
    title="ファイル選択を取り消す"
  >
    ✕
  </button>

  あるいは「キャンセル」テキストリンクでもよい。
  ファイル名の横に配置し、クリックで初期状態に戻す。

Acceptance Criteria (Done)
- [ ] ファイル選択後に「×」またはキャンセルボタンが表示される
- [ ] クリックでファイル選択が解除され、初期状態に戻る
- [ ] プレビュー表示済みの場合もクリアされる
- [ ] `pnpm lint` / `pnpm typecheck` / `pnpm test` が通る
```

---

## GFX-40: ロール別ナビゲーション — スタッフに管理画面リンク、生徒にはシンプルなヘッダー（実装済み PR #84）

```text
[Task Title]
チャット画面のヘッダーにロールベースのナビゲーションを追加する
（スタッフには管理画面リンク、生徒には表示しない）

Goal
- スタッフが /chat にアクセスした際に、/admin（管理画面）へのリンクが
  ヘッダーに表示されるようにする。
- 生徒にはこのリンクを表示しない（UX をシンプルに保つ）。
- 管理画面（/admin）からチャット画面への導線も整備し、
  スタッフが両画面をスムーズに行き来できるようにする。

Background — なぜ必要か
- 現在、スタッフが /chat にアクセスすると、/admin に戻る手段がない。
  URL を手入力するか、ログアウト→再ログインするしかない。
- 一方、/admin ダッシュボードには「戻る → /」のリンクがあるが、
  /chat への明示的なリンクがない。
- スタッフは「生徒としてチャットを試す（動作確認）」と「管理業務」を
  頻繁に行き来するため、双方向のナビゲーションが必要。
- 生徒にとっては管理画面は無関係であり、リンクが見えると混乱を招く。

Context — 現在のナビゲーション構造

  /chat ヘッダー（app/chat/page.tsx）:
    左: ハンバーガーメニュー（モバイル）+ "Marubo AI" + "Beta" バッジ
    右: UsageBadge + "レポート" リンク + ログアウトボタン + "✕ 閉じる" リンク
    → スタッフ向けリンクなし

  /admin ダッシュボード（app/admin/page.tsx）:
    右上: "ログアウト" + "戻る（/）" リンク
    → /chat への明示的なリンクなし

  middleware.ts:
    → 認証チェックのみ。ロールチェックなし。
    → スタッフも生徒も /chat にアクセス可能（これは正しい動作）。

  ロール判定方法:
    → Supabase の session.user.app_metadata.role で判定可能
    → 'staff' = スタッフ、'student' = 生徒
    → GFX-35 で sync-user が自動設定する前提

設計方針 — ユーザー体験の最適化

  ■ 生徒の体験:
    - ヘッダーはシンプルなまま維持（現状と同じ）
    - 余計なリンクやアイコンは一切表示しない
    - 「学習に集中できる」UI を損なわない

  ■ スタッフの体験:
    - /chat ヘッダーに控えめな「管理画面」リンクを追加
    - /admin ダッシュボードに「チャットを試す」リンクを追加
    - 両画面をワンクリックで行き来できる

  ■ なぜ共通ナビバーではなくヘッダー内リンクにするか:
    - 共通ナビバーを導入すると、生徒の画面にも影響が出る
    - 画面の構造が大きく変わり、変更範囲が広がる
    - β版20名の規模では、ヘッダーにリンク1つで十分
    - 将来スケール時にはサイドナビやドロワーを検討する

Scope
- 変更OK:
  - app/chat/page.tsx（ヘッダーにスタッフ向けリンク追加）
  - app/admin/page.tsx（「チャットを試す」リンク追加）
- 変更NG:
  - middleware.ts（ロールチェック不要 — 両方アクセス可能でよい）
  - app/admin/*/page.tsx の個別ページ（ダッシュボードのみで十分）
  - ChatInterface.tsx（ヘッダーは page.tsx 側で管理）

Implementation — Step-by-Step

Step 1: セッションからユーザーロールを取得するヘルパーを用意する

  既存のセッション取得処理を活用。app/chat/page.tsx は client component のため、
  Supabase Browser Client からセッションを取得し、app_metadata.role を参照する。

  const [isStaff, setIsStaff] = useState(false)

  useEffect(() => {
    const supabase = getSupabaseBrowserClient()
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session?.user?.app_metadata?.role === 'staff') {
        setIsStaff(true)
      }
    })
  }, [])

Step 2: /chat ヘッダーにスタッフ向け「管理画面」リンクを追加する

  ファイル: app/chat/page.tsx
  配置: ヘッダー右側の「レポート」リンクの隣（ログアウトの前）

  {isStaff && (
    <Link
      href="/admin"
      className="text-sm text-slate-500 hover:text-slate-700 transition-colors"
    >
      管理画面
    </Link>
  )}

  デザイン:
    - 既存の「レポート」リンクと同じスタイル（控えめなテキストリンク）
    - アイコンは不要（テキストで十分明確）
    - 生徒の目に入らないため、目立つ必要はない

Step 3: /admin ダッシュボードに「チャットを試す」リンクを追加する

  ファイル: app/admin/page.tsx
  配置: ヘッダーの「戻る」リンクの近く、またはダッシュボードカードとして

  案A（ヘッダーリンク）:
    <Link href="/chat" className="text-sm text-blue-600 hover:underline">
      チャットを試す →
    </Link>

  案B（ダッシュボードカードとして追加）:
    既存の4枚のカード（許可リスト・権限管理・会話検索・レポート管理）に加えて、
    「チャットを試す」カードを追加。
    → 案B は他のカードと並列になり、管理機能ではないため違和感がある。
    → 案A のヘッダーリンクが適切。

Risks / Follow-ups
- GFX-35 への依存:
  app_metadata.role が設定されていないユーザーは isStaff = false になる。
  GFX-35 適用前の既存ユーザーは手動で SQL 設定済み（今回の UAT 対応）。
  GFX-35 適用後は自動設定されるため問題なし。
- セッション取得の非同期性:
  useEffect でセッションを取得するため、初回レンダリング時は isStaff = false。
  リンクが一瞬遅れて表示されるが、ヘッダーの小さなリンクなので
  レイアウトシフトはほぼ気にならない。
- /admin のアクセス制御:
  現在 middleware.ts はロールチェックをしていないため、
  生徒が URL 直打ちで /admin にアクセスすることは技術的に可能。
  ただし /admin の各ページは API 側で staff 認証を行うため、
  データは取得できない（403 になる）。β版では許容。
  将来的に middleware でロールチェックを追加することを推奨（別 GFX）。

Acceptance Criteria (Done)
- [ ] スタッフが /chat にアクセスすると、ヘッダーに「管理画面」リンクが表示される
- [ ] 生徒が /chat にアクセスしても、「管理画面」リンクは表示されない
- [ ] 「管理画面」リンクをクリックすると /admin に遷移する
- [ ] /admin ダッシュボードに「チャットを試す」リンクがあり、/chat に遷移する
- [ ] モバイルでもリンクが適切に表示される
- [ ] `pnpm lint` / `pnpm typecheck` / `pnpm test` が通る
```

---

## 4. 実装ロードマップサマリー

```
Sprint 1 (1-2週間): GFX-01, GFX-02, GFX-03, GFX-04
  → 認証フローの完成 + セキュリティ基盤
  → ゲート E: 認証フロー手動検証

Sprint 2 (1-2週間): GFX-05 → GFX-06 → GFX-07, GFX-08 (並列)
  → UX の安定化 + モバイル対応
  → ゲート F: モバイル・UX 手動検証

Sprint 3 (1-2週間): GFX-09, GFX-10, GFX-11, GFX-12 (すべて並列可)
  → プロダクト品質の向上

Sprint 4 (1-2週間): GFX-13, GFX-14, GFX-15, GFX-16, GFX-17, GFX-18
  → パフォーマンス + セキュリティの堅牢化

Critical: GFX-29
  → 会話継続・メッセージ保存・時系列の統合修正（チャット基本動作の根幹）
  → マイグレーション適用が必要（messages テーブルに seq 列追加）

Critical (Blocker): GFX-35 ✅ 実装済み (PR #78)
  → sync-user で生徒の app_metadata.role = 'student' を自動設定
  → 全生徒が requireAuth() を通過できない致命的バグの修正
  → 既存ユーザーの自動リカバリ + ドキュメント更新含む

Hotfix: GFX-27, GFX-28
  → GFX-27: ログインリダイレクト先修正（1 行変更）
  → GFX-28: UsageBadge リアルタイム更新（UAT TC_B_010 対応）

Critical: GFX-31, GFX-33, GFX-34 ✅ すべて実装済み
  → GFX-31: 添付画像を AI（gpt-4o-mini Vision）に渡す Image-to-LLM パイプライン実装
  → GFX-33: 画像添付メッセージの保存・表示修正（テキストなし送信対応 + リアルタイムサムネイル）
  → GFX-34: 会話 ID の URL 管理と画面遷移の安定化（PR #76/#77）

Gate H（GFX-31 の前に実施）: GFX-32
  → Supabase Storage の attachments バケット作成 + ポリシー設定（人間作業）
  → バケット未作成だと署名 URL 生成・アップロード・表示がすべて失敗する

Sprint 5: GFX-30
  → HEIC/HEIF 画像のクライアント変換対応（iPhone ユーザー UX）

Sprint 6: GFX-36, GFX-37, GFX-39, GFX-40 ✅ すべて実装済み
  → GFX-36: 許可メール一覧の検索・フィルタ即時リロード解消（PR #79）
  → GFX-37: 許可メール一覧に生徒の個別登録フォーム追加（PR #80/#81/#82）
  → GFX-39: CSV インポートのファイル選択キャンセルボタン追加（PR #83）
  → GFX-40: ロール別ナビゲーション（PR #84）

Critical (β版リリース前): GFX-38 ✅ 実装済み
  → Google OAuth ログインの導入（Google でログインボタン追加）

Backlog: GFX-19, GFX-20, GFX-21, GFX-22, GFX-23, GFX-24, GFX-25, GFX-26
  → 優先度に応じて順次対応

ゲート G: 全スプリント完了後の最終受け入れ
```

---

## 5. 最終マージ前チェック（人間向け）

- [ ] 全 GFX の PR がマージ済み。
- [ ] ゲート E（認証フロー）、ゲート F（UX 検証）が完了している。
- [ ] `pnpm lint && pnpm typecheck && pnpm test` が通る。
- [ ] モバイル端末での主要フロー（ログイン → チャット → 会話切替 → ログアウト）を手動確認。
- [ ] 管理画面の主要フロー（ログイン → ダッシュボード → 許可リスト管理 → レポート管理）を手動確認。
- [ ] `/chat-test` が本番環境で遮断されていることを確認。

---

*このドキュメントは `docs/AI-Generated01/03_gap_analysis_and_proposals.md` の GAP-01〜GAP-27 に基づいて作成されました（2026-03-08）。*
*実際の優先度・スプリント配分はプロダクトオーナーとの協議により調整してください。*
