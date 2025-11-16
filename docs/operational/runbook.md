# Operational Runbook

本書では、障害発生時にスタッフ/開発者が実施すべき **運用手順と判断基準** をまとめる。
目的は、障害復旧の MTTR を短くし、人依存を排除することである。

## 本書で扱う内容
- LLM 障害時の UI 対応 → 再試行/フォールバック
- 月次レポート失敗時のリトライフロー
- Storage / 添付削除処理
- メール不達（SPF/DKIM/DMARC）
- クォータ制限

---

## エラー対処設計

### AppError による正規化

* すべての例外は **`AppError`** に正規化（種別/重大度/通知先）
* `withHandledErrors()` で API をラップ

```ts
// src/shared/lib/errors.ts
export class AppError extends Error {
  constructor(
    public code: string,
    public severity: 'S1' | 'S2' | 'S3',
    message: string
  ) {
    super(message)
  }
}
```

### API ハンドラー

```ts
// src/shared/lib/apiHandler.ts
export function withHandledErrors(handler: Function) {
  return async (req: Request) => {
    const requestId = crypto.randomUUID()
    try {
      return await handler(req)
    } catch (error) {
      const appError = normalizeError(error)
      if (appError.severity === 'S1') {
        await notifyAdmin(appError, requestId)
      }
      return Response.json({ error: appError.message, requestId }, { status: 500 })
    }
  }
}
```

### LLM 呼び出しのエラーハンドリング

* **15 秒程度のタイムアウト**
* **バックオフ再試行 → フォールバックモデル**
* 429 / 5xx / Timeout を吸収

```ts
// src/shared/lib/llm.ts
async function callLLM(prompt: string): Promise<string> {
  try {
    return await callPrimaryWithRetry(prompt)
  } catch (primaryError) {
    console.warn('Primary LLM failed, trying fallback:', primaryError)
    try {
      return await callFallbackWithRetry(prompt)
    } catch (fallbackError) {
      throw new AppError('LLM_ALL_FAILED', 'S1', 'LLM API が利用できません')
    }
  }
}
```

### UI へのフィードバック

* **初回失敗時**：「混雑中。自動再試行中...」
* **全経路失敗時**：「時間をおいて再実行してください」+ S1 通知

---

## LLM 障害時の対応

### 検知

* API が 429 / 5xx / Timeout を返す
* Sentry でエラーが記録される

### 自動対応

1. **バックオフ再試行**（最大 3 回）
2. **フォールバックモデルへ切り替え**
3. **UI に即時フィードバック**

### 手動対応

1. **Sentry / Vercel Logs で詳細確認**
2. **プロバイダーのステータスページを確認**
3. **必要に応じて一時的にサービスを停止**し、ユーザーに告知

### 復旧確認

* プロバイダーが復旧したら `/api/chat` を手動テスト
* フォールバックから元のモデルに戻す（環境変数変更 + 再デプロイ）

---

## 月次レポート失敗時のリトライ

### 検知

* Cron 実行後、メールが届かない
* Vercel Logs でエラーを確認

### 中間結果確認

```sql
-- monthly_summary に当月のデータがあるか
SELECT * FROM monthly_summary WHERE month = '2025-01';
```

### 手動リトライ

1. **管理 UI** → 「レポート再実行」ボタン
2. 対象月を指定：`/api/reports/monthly?month=2025-01`
3. Resend Dashboard でメール送信を確認

### 段階保存

* **集計 → CSV 生成 → HTML 生成 → メール送信**
* 途中で失敗しても、成功したステップはスキップ可能

---

## Storage / 添付削除処理

### 会話削除時の添付ファイル削除

```ts
// 会話削除時に Storage オブジェクトを削除（ベストエフォート）
async function deleteConversation(convId: string) {
  // 1. 添付ファイルのパスを取得
  const { data: attachments } = await supabase
    .from('attachment')
    .select('storage_path')
    .eq('message_id', messageId)
  
  // 2. Storage から削除
  for (const att of attachments || []) {
    await supabase.storage.from('attachments').remove([att.storage_path])
  }
  
  // 3. DB から会話削除（CASCADE で message, attachment も削除）
  await supabase.from('conversation').delete().eq('id', convId)
}
```

### 孤立したオブジェクトのクリーンアップ

* 定期的に Storage と DB を照合し、DB にないオブジェクトを削除
* Cron で月次実行（任意）

---

## メール不達（SPF/DKIM/DMARC）

### 検知

* Resend Dashboard で Bounce / Complaint を確認

### 原因

* DNS 設定の不備
* From アドレス未検証

### 解決

1. **DNS レコードを確認**：

```bash
dig TXT your-domain.example
# SPF, DKIM, DMARC が正しく設定されているか
```

2. **Resend Dashboard** → Domains → Verify
3. **From 名と本文を見直し**：
   * From: `noreply@your-domain.example`
   * 件名: 短く明確
   * 本文: リンク多用を避ける

---

## クォータ制限

### 検知

* API が 429 を返す
* `usage_counters` を監視

### 対応

1. **usage_counters を確認**：

```sql
SELECT user_id, SUM(questions) AS total
FROM usage_counters
WHERE day >= date_trunc('month', now())
GROUP BY user_id
HAVING SUM(questions) >= 100; -- MONTHLY_QUOTA
```

2. **ユーザーに通知**：「月間クォータに達しました。翌月までお待ちください」
3. **必要に応じてクォータを一時的に増やす**（管理者判断）

---

## データ保持と削除

### 保持期間

* 会話データ：**90 日間**（`DATA_RETENTION_DAYS`）
* 将来的に Cron で自動削除

### 手動削除

1. 管理 UI から特定会話を削除
2. RLS により自分の会話 or スタッフ権限のみ削除可能
3. 削除時に Storage オブジェクトもベストエフォートで削除

---

## 重大度別の対応フロー

### S1（重大）

* **例**：LLM 全経路失敗、DB 接続不可、認証システム障害
* **通知**：`ADMIN_EMAILS` + `DEV_ALERT_EMAILS` へ即座にメール
* **対応**：即座に調査・復旧作業開始
* **目標**：MTTR 30 分以内

### S2（中程度）

* **例**：一部機能の障害、パフォーマンス劣化
* **通知**：Sentry でエラー記録
* **対応**：営業時間内に調査・修正
* **目標**：MTTR 4 時間以内

### S3（軽微）

* **例**：UI の表示崩れ、非重要機能の不具合
* **通知**：Sentry でエラー記録
* **対応**：次回スプリントで修正
* **目標**：MTTR 24 時間以内

---

## インシデント対応チェックリスト

- [ ] エラーの種別と重大度を判定
- [ ] Sentry / Vercel Logs で詳細を確認
- [ ] 影響範囲を特定（全ユーザー / 特定ユーザー / 特定機能）
- [ ] 一時的な回避策を実施（フォールバック / 機能停止など）
- [ ] 根本原因を特定
- [ ] 修正を実施・デプロイ
- [ ] 復旧を確認
- [ ] ポストモーテムを作成（再発防止策）

---

## 関連ドキュメント

* [トラブルシューティング](../troubleshooting.md)
* [デプロイメント](../deployment.md)
* [セキュリティポリシー](../security.md)
* [アーキテクチャ](../architecture.md)
