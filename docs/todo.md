# TODO / Roadmap

本書は、今後実装予定の機能や改善点を整理する **開発ロードマップ** である。
スプリント計画・優先度の共有・開発の進捗管理を目的とする。

---

## タスク一覧

> **Status Legend**: `todo` = 未着手, `progress` = 進行中, `blocked` = 調整待ち, `review` = 実装済みレビュー待ち, `done` = 完了

### 1. 仕様・ドキュメント整備

| ID | Status | 概要 | 詳細 |
|----|--------|------|------|
| SPEC-01 | todo | 許可メール運用詳細追記 | `docs/security.md` / `docs/architecture.md` に招待文面、CSV取り扱い、監査ログ保持期間を明記する。 |
| SPEC-02 | review | Allowlist UI/CSV 仕様確定 | `/admin/allowlist` のUX、バリデーション、CSV列定義、重複時の挙動を `docs/api.md` に追記済み。 |
| SPEC-03 | review | `/api/sync-user` メッセージ定義 | `pending/revoked/not-found` のフロント表示文言と問い合わせ導線を `docs/api.md` に追加済み。 |
| SPEC-04 | todo | 退会/削除ポリシー整理 | 会話・添付の保持期限、削除手順を `docs/database.md` と `docs/operational/runbook.md` に追記。 |
| SPEC-05 | blocked | 保護者共有要件確認 | 許可リストの CSV を保護者に配布するか等、ユーザー確認が必要。回答待ち。 |
| SPEC-06 | todo | Onboarding/README 更新 | 初回セットアップ（Supabase プロジェクト作成、SQL Editor でのテーブル作成、`.env` の埋め方）を `docs/onboarding.md` / `README.md` に追記し、CLI との切り替え手順も示す。 |

### 2. バックエンド実装

| ID | Status | 概要 | 詳細 |
|----|--------|------|------|
| BE-01 | todo | `allowed_email` マイグレーション | `updated_by`, `label`, `notes`, `status` index、`allowed_email_lowercase` 制約を SQL に反映。 |
| BE-02 | todo | `audit_allowlist` 追加 | 操作種別・差分を保存する監査テーブルと挿入処理を実装。 |
| BE-03 | review | `/api/admin/allowlist` 実装 | GET/POST/PATCH、CSV受け付け、リクエスト検証、`requestId` 付与、`staff` ガードを `app/api/admin/allowlist/*` で実装済み。 |
| BE-04 | todo | `/api/sync-user` 拡張 | `allowed_email` 状態チェック、エラーコード、レスポンス payload を実装し、`app_user` upsert を idempotent に。 |
| BE-05 | progress | seed/import スクリプト | `scripts/seed-allowlist.ts` (CSV→bulk upsert) と `export` スクリプトを作成。CSV バリデーションも含む。 |
| BE-06 | todo | Supabase CLI マイグレーション運用 | `supabase/migrations` に `allowed_email` / `audit_allowlist` 追加分を作成し、`supabase db push` / `pnpm db:migrate` の手順を `README.md` / `docs/deployment.md` に明記。Webコンソールのみでの暫定手順も併記。 |

### 3. フロントエンド実装

| ID | Status | 概要 | 詳細 |
|----|--------|------|------|
| FE-01 | todo | `/admin/allowlist` UI | 一覧・検索・フィルタ・status切替モーダル・notes入力・`requestId` 表示を実装。 |
| FE-02 | todo | Allowlist hooks | `useAllowlistQuery`, `useAllowlistMutations`, `useCsvImport` の hooks/型整備。 |
| FE-03 | todo | CSV アップロード UI | 取り込みプレビュー、検証エラー表示、成功/失敗トーストを実装。 |
| FE-04 | todo | 学生向け警告表示 | `/api/sync-user` の `allowedEmailStatus` から Pending/Revoked メッセージを表示し、問い合わせ先リンクを追加。 |

### 4. テスト & QA

| ID | Status | 概要 | 詳細 |
|----|--------|------|------|
| QA-01 | todo | RLS/Allowed Email テスト | Supabase クライアントで `allowed_email` が staff 以外アクセス不可か、`/api/sync-user` が状態通りに動くか検証。 |
| QA-02 | todo | API 統合テスト | `/api/admin/allowlist` / `/api/sync-user` の happy/sad パスを Vitest + supertest 等でカバー。 |
| QA-03 | todo | フロント E2E | スタッフが allowlist 追加 → 生徒がログイン完了、退会後にログイン不可までを Playwright 等で自動化。 |
| QA-04 | todo | スクリプトテスト | CSV seed/export スクリプトの dry-run、バリデーション単体テスト。 |
| QA-05 | todo | `/api/admin/allowlist` API テスト | Vitest + supertest で GET/POST/PATCH/import の happy/sad ケースをカバーし、Service Role モックや CSV バリデーションを検証する。 |

### 5. 運用 / DevOps

| ID | Status | 概要 | 詳細 |
|----|--------|------|------|
| OPS-01 | todo | Migration ワークフロー整理 | Supabase CLI で migration/seed を実行する手順 (`pnpm db:migrate` など) を README/docs に明記。 |
| OPS-02 | todo | CI 更新 | GitHub Actions で `pnpm lint && pnpm typecheck && pnpm test` を必須化、`pnpm db:check` などを検討。 |
| OPS-03 | blocked | Allowlist 変更通知設計 | 変更を Slack/メール通知するかユーザーへ確認。必要なら Implementation タスク追加。 |
| OPS-04 | review | README 統合反映 | `README.new.md` 廃止の旨を changelog/docs に記載済みか再確認。 |

---

必要な情報や優先度が変わった場合は、このファイルで随時アップデートしてください。

