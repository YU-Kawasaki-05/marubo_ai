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

Backlog: GFX-19, GFX-20, GFX-21, GFX-22, GFX-23, GFX-24, GFX-25
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
