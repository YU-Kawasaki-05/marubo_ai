# Troubleshooting Guide

本書では、開発〜本番における **代表的な不具合と解決手順** をまとめる。
目的は、障害発生時の調査時間を短縮し、よくある罠を事前に回避することである。

## 本書で扱う内容
- OAuth リダイレクトズレ
- RLS が効かない/効きすぎる問題
- 署名 URL の期限切れ（Storage 403）
- LLM 429/Timeout
- 月次レポートの集計エラー

---

## Google OAuth リダイレクト不一致

### 症状

* Google ログイン後、Supabase へのコールバックが失敗
* `redirect_uri_mismatch` エラー

### 原因

* Supabase Provider 設定のコールバック URL が Google 側の許可オリジンと一致していない
* ローカル開発時の `localhost` と本番の `your-domain.example` が混在

### 解決方法

1. **Supabase Dashboard** → Authentication → Providers → Google
2. **Callback URL** を確認：`https://your-project.supabase.co/auth/v1/callback`
3. **Google Cloud Console** → 認証情報 → OAuth 2.0 クライアント ID
4. **承認済みのリダイレクト URI** に Supabase の Callback URL を追加
5. ローカル開発用に `http://localhost:54321/auth/v1/callback` も追加（Supabase CLI 使用時）

---

## RLS が効かない / 効きすぎる

### 症状 1：学生が他人の会話を閲覧できてしまう

**原因**：

* RLS ポリシーが有効になっていない
* `auth.uid()` と `app_user.auth_uid` の紐付けミス

**解決方法**：

```sql
-- RLS が有効か確認
SELECT tablename, rowsecurity FROM pg_tables WHERE schemaname = 'public';

-- 無効の場合は有効化
ALTER TABLE conversation ENABLE ROW LEVEL SECURITY;

-- ポリシーの確認
SELECT * FROM pg_policies WHERE tablename = 'conversation';
```

### 症状 2：スタッフが全件閲覧できない

**原因**：

* JWT の `app_metadata.role` が `null` または `student` のまま
* `/api/admin/grant` でロール更新後、再ログインしていない

**解決方法**：

1. `/api/admin/grant` を実行してロールを `staff` に更新
2. **ユーザーは必ず再ログイン**（JWT 再取得）
3. JWT をデコードして `app_metadata.role` が `staff` になっているか確認

```ts
// JWT デコード確認
const jwt = 'your-jwt-token'
const payload = JSON.parse(atob(jwt.split('.')[1]))
console.log(payload.app_metadata.role) // 'staff' であるべき
```

---

## Storage 403 / URL 期限切れ

### 症状

* 添付画像の表示で 403 Forbidden
* 署名 URL が期限切れ

### 原因

* 署名 URL の有効期限（60 秒）が切れている
* Storage ポリシーのパス判定ミス

### 解決方法

1. **署名 URL の再発行**：失敗時に 1 回だけ自動再発行するロジックを実装
2. **Storage ポリシーの確認**：

```sql
-- storage.objects のポリシーを確認
SELECT * FROM pg_policies WHERE tablename = 'objects' AND schemaname = 'storage';

-- パス判定が正しいか確認
SELECT name FROM storage.objects 
WHERE bucket_id = 'attachments' 
  AND name LIKE 'user-id-here/%';
```

3. **パス規約の徹底**：`{user_id}/{conversation_id}/{message_id}/{uuid}.{ext}`

---

## LLM 429 / Timeout

### 症状

* LLM API が 429（Too Many Requests）を返す
* タイムアウトエラー

### 原因

* API レート制限に達している
* ネットワーク遅延
* プロバイダー側の障害

### 解決方法

1. **フォールバックモデルへの自動切り替え**を確認
2. **バックオフ再試行**が動作しているか確認

```ts
// src/shared/lib/llm.ts
async function callLLM(prompt: string) {
  try {
    return await callPrimary(prompt)
  } catch (error) {
    if (error.status === 429 || error.status >= 500) {
      return await callFallback(prompt) // フォールバック
    }
    throw error
  }
}
```

3. **UI で即時フィードバック**：「混雑中。自動再試行中...」
4. **全経路失敗時**：S1 通知を送信

---

## メール迷惑判定

### 症状

* 月次レポートが迷惑メールフォルダに入る
* メールが届かない

### 原因

* SPF / DKIM / DMARC が未設定
* From アドレスが検証されていない

### 解決方法

1. **DNS 設定を確認**：

```
SPF:   v=spf1 include:_spf.resend.com ~all
DKIM:  Resend Dashboard で提供される公開鍵を TXT レコードに追加
DMARC: v=DMARC1; p=quarantine; rua=mailto:dmarc@your-domain.example
```

2. **From アドレスを検証**：Resend Dashboard → Domains で Verify
3. **件名と本文を見直し**：
   * 件名：短く明確に「[塾名] 月次レポート」
   * 本文：リンクを多用しない、会社情報を明記

---

## 月次レポート失敗

### 症状

* Cron が実行されたが、メールが送信されていない
* 管理 UI でエラーが表示される

### 原因

* DB 集計クエリの失敗
* Resend API エラー
* 環境変数の設定ミス

### 解決方法

1. **中間結果テーブルを確認**：`monthly_summary` に当月のデータがあるか
2. **ログを確認**：Vercel Logs で `/api/reports/monthly` のエラーを確認
3. **手動リトライ**：管理 UI から対象月を指定して再実行

```ts
// app/admin
<button onClick={() => fetch('/api/reports/monthly?month=2025-01')}>
  1月分を再送信
</button>
```

---

## クォータ超過

### 症状

* API が 429 を返す
* 「月間クォータに達しました」と表示

### 原因

* `usage_counters` の `questions` が `MONTHLY_QUOTA` を超えた

### 解決方法

1. **usage_counters を確認**：

```sql
SELECT user_id, SUM(questions) AS total
FROM usage_counters
WHERE day >= date_trunc('month', now())
GROUP BY user_id;
```

2. **クォータを一時的に増やす**（管理者判断）：

```sql
-- 環境変数 MONTHLY_QUOTA を変更
-- または特定ユーザーの usage_counters をリセット（非推奨）
```

3. **翌月まで待つ**ようユーザーに案内

---

## TypeScript / Lint エラー

### 症状

* `pnpm typecheck` や `pnpm lint` が失敗
* CI が通らない

### 原因

* 型定義の不整合
* 未使用インポート
* コーディング規約違反

### 解決方法

```bash
# 自動修正
pnpm lint --fix
pnpm format

# 型エラーの詳細確認
pnpm typecheck

# 未使用インポートの削除
# ESLint の unused-imports プラグインが自動削除
```

---

## 関連ドキュメント

* [RLS ポリシー](./rls.md)
* [セキュリティポリシー](./security.md)
* [デプロイメント](./deployment.md)
* [運用 Runbook](./operational/runbook.md)
