# 公開リポジトリ安全化 — 引き継ぎドキュメント

> 作成日: 2026-06-28
> 元の監査票: `develop/job-hunt/notes/その他/2026-06-19_marubo-public-repo-review.md`
> ステータス: 一部完了、残件あり

---

## これまでに完了したこと

### PR①: `fix/public-safety`（マージ済み、commit `faa7e25`）

| 変更内容 | 対象 |
|---|---|
| 実メール匿名化（`maru.juku.maru@gmail.com` → `owner@example.com`、`yuu.kw5.sea@gmail.com` → `admin@example.com`） | docs 6ファイル |
| `support@example.com` を `NEXT_PUBLIC_SUPPORT_EMAIL` 環境変数参照に変更（未設定時はリンク非表示） | `src/features/allowlist/components/AccountStatusBanner.tsx` |
| `<repo-url>` / `<repo>` を実 URL に修正 | `README.md` |
| CI に `permissions: contents: read` と `pnpm audit --prod` ステップを追加 | `.github/workflows/test.yml` |

### PR②: `fix/deps-next15`（マージ済み、commit `7f54323`）

| 変更内容 | 詳細 |
|---|---|
| Next.js 14.2.35 → 15.5.19 | High 6件・Moderate 9件を含む全脆弱性を解消 |
| eslint-config-next 14.2.3 → 15.5.19 | |
| @supabase/ssr 0.9.0 → 0.12.0 | |
| @supabase/supabase-js 2.86.0 → 2.108.2 | |
| postcss 8.4.38 → 8.5.15（devDep）+ pnpm overrides で transitive 依存も強制上書き | |
| Route Handler 3ファイルの `params` を `Promise<{...}>` + `await` に変更（Next.js 15 破壊的変更対応） | `app/api/conversations/[id]/route.ts`（GET/DELETE）、`app/api/admin/conversations/[id]/route.ts`（GET）、`app/api/admin/allowlist/[email]/route.ts`（PATCH） |
| allowlist.ts の update payload 型を `AllowedEmailUpdate` に変更（supabase-js 2.108 型厳格化対応） | |
| テスト13ファイルで `params` を `Promise.resolve({...})` 渡しに修正 | |

**確認済み: `pnpm audit --prod` = 0件、lint・typecheck・test（225件）全パス**

---

## 残っている作業

### 🔴 P0: Git履歴の書き換え（最優先・破壊的操作）

**なぜ必要か**
`fix/public-safety` PR で現行ファイルのメールは匿名化したが、過去のコミット履歴の中には実メールが残っている。GitHub の過去コミットページから誰でも閲覧できる状態。

**実メールを含む過去コミット（本文内）**
- `aff55a6` — `docs(spec): 実装に合わせて主要仕様ドキュメントを再整合`
- `ae9a978` — `UAT仕様書を作成`
- `5c31555` — `role追加doc追記`

**author email の問題**
- 個人 Gmail を author email に持つコミット: 約199件
- 業務ドメインのメールを持つコミット: 2件
- GitHub noreply の bot コミット: 13件

**実施手順**

```bash
# Step 1: 作業前に mirror backup を取得（絶対に行う）
git clone --mirror git@github.com:YU-Kawasaki-05/marubo_ai.git /path/to/marubo_ai.git.backup

# Step 2: git filter-repo のインストール（未インストールの場合）
pip install git-filter-repo

# Step 3: 本文中の実メールを置換する mailmap ファイルを作成
# 以下を mailmap.txt として保存
# maru.juku.maru@gmail.com => owner@example.com
# yuu.kw5.sea@gmail.com => admin@example.com

# Step 4: 本文中のメールを置換
git filter-repo --replace-text mailmap.txt

# Step 5: author email を GitHub noreply に書き換え
# GitHubのnoreplyアドレスは「{数字}+{ユーザー名}@users.noreply.github.com」
# 例: 12345678+YU-Kawasaki-05@users.noreply.github.com
# GitHub設定 > Email > "Keep my email addresses private" で確認できる
git filter-repo --email-callback '
    return b"YOUR_NOREPLY@users.noreply.github.com"
'

# Step 6: 新規 clone で現行ツリーと全履歴を確認
# 実メールが残っていないことを grep で確認
git log -p | grep -E "maru\.juku\.maru|yuu\.kw5\.sea"

# Step 7: GitHub Actions / Vercel 連携 / ブランチ保護への影響を確認してから
# force push（--force-with-lease ではなく --force が必要）
git push --force origin main

# Step 8: 新規 clone で最終確認
git clone git@github.com:YU-Kawasaki-05/marubo_ai.git /tmp/verify_clone
cd /tmp/verify_clone
git log -p | grep -E "maru\.juku\.maru|yuu\.kw5\.sea"
```

**注意事項**
- force push 後は既存の fork/clone のハッシュが全て変わる
- GitHub Actions のキャッシュ、Vercel のデプロイ履歴との紐付けが切れる可能性がある
- 検索エンジンキャッシュから即座に消えるわけではない（GitHub に削除依頼が必要な場合もある）
- 実施前に必ず mirror backup を別ディレクトリに保存する

---

### 🟡 P1: 内部文書の整理

**なぜ必要か**
`docs/` 配下に管理者権限付与手順・環境変数名・API 入出力・監視・障害対応が詳細に公開されている。採用担当者が見たとき、設計判断より生成物の量が前面に出てしまい、担当範囲が分かりにくい。

**整理方針（推奨）**

公開リポジトリに残す:
- `README.md`
- `docs/architecture.md`、`docs/security.md`、`docs/database.md`（匿名化済みのもの）
- `docs/testing.md`、`docs/coding-guidelines.md`
- ソースコード、migration、テスト

private リポジトリまたはローカルアーカイブへ移す:
- `docs/UAT/uat-creation-template/`（全体）
- `docs/AI-Generated01/`（全体）
- backup / 検証途中の生成物
- `docs/operational/`（実運用 runbook、通知先、権限付与対象）
- `docs/admin/`（管理者操作手順。README に概要だけ残す）

**手順**
```bash
# 1. private リポジトリを別途作成してアーカイブ
# 2. 公開リポジトリから削除
git rm -r docs/UAT/ docs/AI-Generated01/
git commit -m "docs: 内部運用文書を非公開リポジトリへ移動"
```

---

### 🟡 P1: 本番デプロイの確認（コード変更なし、運用確認）

`https://marubo.vercel.app` が外部から到達可能な状態。以下を確認する:

- [ ] 新規登録が無効または許可リスト制御になっているか（`OPEN_REGISTRATION` 環境変数の確認）
- [ ] `/admin` および管理 API がスタッフ権限なしで利用できないか
- [ ] 公開デモと実利用環境の Supabase プロジェクトが分離されているか
- [ ] Preview Deployment から本番 DB に接続していないか
- [ ] Service Role Key がブラウザバンドルに入っていないか

---

### 🟢 P2: LICENSE ファイルの追加

現在 LICENSE ファイルが存在しないが、public repository になっている。`README.md` 末尾に「社内利用前提」と書かれたまま。

方針の選択肢:
1. **MIT ライセンス** — ポートフォリオとして公開し、参照自由にする
2. **All Rights Reserved（明示的な COPYRIGHT のみ）** — コピーを禁止する
3. **リポジトリを private に戻す** — 採用担当者には URL ではなく zip で提示

---

### 🟢 P2: README のポートフォリオ向けリライト

監査票（`develop/job-hunt/notes/その他/2026-06-19_marubo-public-repo-review.md`）の「推奨 README 構成」を参照。追加すべき内容:

1. 一文のプロダクト説明
2. 実際の利用状態と設計上の想定規模（β版 / 約20名 を明確に）
3. 匿名化したスクリーンショット or デモ GIF
4. 解決した課題と利用者
5. 本人の担当範囲
6. アーキテクチャ図
7. 主要な設計判断（LINE Bot → Web 化、RLS、署名 URL、コスト制御、LLM フォールバック）
8. テスト・セキュリティ・運用
9. AI 開発支援ツールを使った範囲と本人が判断した範囲
10. 匿名化されたセットアップ手順
11. ライセンス方針

---

### 🟢 P2: CI の残り強化

```yaml
# .github/workflows/test.yml に追加検討
- name: Build
  run: pnpm build
  env:
    NEXT_PUBLIC_SUPABASE_URL: ${{ secrets.NEXT_PUBLIC_SUPABASE_URL }}
    NEXT_PUBLIC_SUPABASE_ANON_KEY: ${{ secrets.NEXT_PUBLIC_SUPABASE_ANON_KEY }}
```

その他:
- GitHub Settings > Security > Dependabot alerts を有効化
- GitHub Settings > Security > Secret scanning を有効化
- GitHub Settings > Security > Push protection を有効化
- Actions のバージョンをコミット SHA にピン留め（`actions/checkout@v4` → `actions/checkout@<sha>`）

---

## 再公開チェックリスト

- [x] 現行ツリーに本人・関係者の実メールがない
- [ ] 全 Git 履歴に実メール本文がない
- [ ] commit author email が GitHub noreply になっている
- [x] `.env`・APIキー・Service Role Key が履歴を含め存在しない
- [x] `pnpm audit --prod` の High が 0件
- [x] lint・typecheck・test・build が成功する
- [ ] 新規登録・管理者権限・RLS を本番相当で確認した
- [ ] 公開デモと実利用データを分離した
- [ ] 公開不要な UAT・backup・runbook・memo が追跡されていない
- [x] README の clone URL が正しい
- [ ] ライセンス方針が明記されている
- [ ] 採用担当者へ説明できない主張や未実装機能がない
