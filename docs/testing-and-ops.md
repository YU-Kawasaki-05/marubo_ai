# テスト戦略・運用・コントリビューション

## 開発ワークフロー

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

* 初期は Supabase **SQL Editor** で `docs/db-schema.md` に記載の SQL を適用
* 将来は Supabase CLI の migration に移行推奨
* Seed は `scripts/` 配下

## テストガイドライン

* **各機能に必ずユニットテスト**（Vitest）
* **実装ファイルと同じファイル**に `import.meta.vitest` で併記
* `describe` は **日本語**、境界/エラー系も含める
* 変更時は **`pnpm test` が常時パス**
* UI は React Testing Library
* **RLS テスト**：学生アカウントでは自分の会話のみ、スタッフアカウントでは全件が取得できることを Supabase クライアント or SQL で検証
* **レート制限テスト**：同一キーで上限直前までは許可され、上限を超えると HTTP 429 相当で拒否されること
* **Markdown/LaTeX サニタイズ**：`<script>` や `javascript:` プロトコルが除去されつつ、KaTeX のクラスは残り表示が崩れないこと
* **LLM フォールバック動作**：プライマリが 429/5xx/Timeout の際にフォールバックが呼ばれ、両方失敗時は UI へ適切なエラーを返す
* **E2E（任意）**：ログイン → チャット投稿（テキスト + 数式）→ レンダリング → 履歴表示までの最低限のシナリオ

## トラブルシューティング

* **Google OAuth リダイレクト不一致**
  → Supabase Provider 設定のコールバックURL、Google側の許可オリジンを確認。
* **RLS 不具合（見えない/見えてはいけない）**
  → `auth.uid()` と `app_user.auth_uid` の紐付け。スタッフで全件閲覧できるか検証。
* **Storage 403/URL期限切れ**
  → 署名URL TTL、ポリシー、パス規約（`user_id/`）を確認。失敗時は1回だけ自動再発行。
* **メール迷惑判定**
  → SPF/DKIM/DMARC 必須。From表示名と本文を見直す。
* **LLM 429/Timeout**
  → バックオフ再試行/フォールバックが動作するか。短時間の連投を避ける。

## 運用 Runbook

1. **LLM障害**：UIで「混雑中」表示 → 自動再試行/フォールバック → 改善しなければ S1 通知（スタッフ/開発者）。
2. **月次レポート失敗**：中間結果テーブル確認 → 管理UIで対象月を指定し手動リトライ。
3. **メール不達**：Resend の Bounce/Troubleshoot → DNS（SPF/DKIM/DMARC）/From名の修正。
4. **削除/保持**：保持期間（例：90日）。会話削除時に添付の**Storageオブジェクト削除 Job**を実行（ベストエフォート）。
5. **クォータ**：`usage_counters` を監視。上限到達時は429と指示文を返す。

## 受け入れ基準（完成の定義）

* 生徒がテキスト/画像で質問し、**Markdown/KaTeX** で崩れず表示
* 自分の会話のみ閲覧、スタッフは**全件**（RLS 検証済み）
* **毎日 23:55 実行**で**月末のみ**レポート送信（手動リトライ可）
* LLM 障害/429 で**即時案内＋自動再試行/フォールバック**
* すべての API が **`requestId`** を返し、S1 以上は**メール通知**
* `pnpm test` / `pnpm typecheck` / `pnpm lint` / `pnpm build` が成功
* **SLO 例**：テキストのみの質問に対する p95 応答時間 3 秒以内（平常時）
* **SLO 例**：LLM API 障害時にフォールバックで救済できる割合を 80% 以上に維持

## コントリビューション

* ブランチ：`feat/*`, `fix/*`, `chore/*`, `docs/*`
* コミット：Conventional Commits（`feat: ...`, `fix: ...`）
* PR：スクショ/動画、テスト結果、影響範囲、RLS/コストへの影響を記載
* レビュー観点：RLS破壊、コスト暴走（トークン/画像）、UX劣化

## コード生成規約

### 書いておくべきこと

* 入出力、前提、例外、**副作用**（DB/外部API）、依存（ENV/モジュール）、**セキュリティ注意**（ID/RLS）

### ファイル冒頭コメント（テンプレ）

```ts
/** @file
 * 機能：チャット送信（画像+テキスト）→ LLM → 会話保存
 * 入力：FormData { text: string; image?: File }
 * 出力：{ answer: string }
 * 例外：LLM失敗=502, Storage失敗=400
 * 依存：env(LLM_API_KEY, MAX_TOKENS_OUT), supabaseAdmin, quota.ts
 * 注意：書込はService Roleのみ。userIdの出所を必ず検証（RLS考慮）。
 */
```
