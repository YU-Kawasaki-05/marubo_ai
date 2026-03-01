/** @file
 * エラー通知ユーティリティ（S1/S2/S3 重大度方針）。
 * 入力: severity, title, detail, requestId。
 * 出力: S1=Resend メール送信、S2=console.warn、S3=console.info。
 * 依存: env(RESEND_API_KEY, ADMIN_EMAILS, MAIL_FROM)。
 * セキュリティ: エラー詳細はスタッフ宛メールのみ。二重障害時はコンソールログにフォールバック。
 *
 * デバウンス: 同一 code のエラーは 5 分に 1 回まで（メモリ内 Map）。
 */

export type Severity = 'S1' | 'S2' | 'S3'

// ── デバウンス（5 分） ──

const DEBOUNCE_MS = 5 * 60 * 1000
const lastNotified = new Map<string, number>()

function shouldDebounce(key: string): boolean {
  const now = Date.now()
  const last = lastNotified.get(key)
  if (last && now - last < DEBOUNCE_MS) {
    return true
  }
  lastNotified.set(key, now)
  return false
}

/** テスト用: デバウンスキャッシュをリセット */
export function resetDebounceForTest(): void {
  lastNotified.clear()
}

// ── メール送信（S1） ──

async function sendAlertEmail(
  title: string,
  detail: string,
  requestId?: string,
): Promise<boolean> {
  const apiKey = process.env.RESEND_API_KEY
  const adminEmails = process.env.ADMIN_EMAILS
  const mailFrom = process.env.MAIL_FROM ?? 'noreply@example.com'

  if (!apiKey || !adminEmails) {
    console.warn('[notifier] RESEND_API_KEY or ADMIN_EMAILS not set; S1 email skipped')
    return false
  }

  const recipients = adminEmails
    .split(';')
    .map((e) => e.trim())
    .filter(Boolean)
  if (recipients.length === 0) return false

  const now = new Date()
  const jst = new Date(now.getTime() + 9 * 60 * 60 * 1000)
  const timestamp = jst.toISOString().replace('T', ' ').slice(0, 19) + ' JST'

  const textBody = `━━━━━━━━━━━━━━━━━━━━
  Marubo AI 障害通知（S1 - 重大）
━━━━━━━━━━━━━━━━━━━━

■ エラー内容
  ${title}

■ 詳細
  ${detail}

■ 発生日時
  ${timestamp}
${requestId ? `\n■ リクエスト ID\n  ${requestId}\n` : ''}
■ 推奨アクション
  1. Vercel Logs で詳細を確認
  2. 関連サービスのステータスページを確認
  3. 復旧しない場合は docs/operational/runbook.md を参照

━━━━━━━━━━━━━━━━━━━━
※ このメールは Marubo AI から自動送信されています。`

  try {
    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: mailFrom,
        to: recipients,
        subject: `🚨 [Marubo AI] S1: ${title}`,
        text: textBody,
      }),
    })
    if (!res.ok) {
      console.error('[notifier] Resend API error:', res.status, await res.text().catch(() => ''))
      return false
    }
    return true
  } catch (err) {
    // 二重障害: メール送信自体が失敗 → コンソールログにフォールバック
    console.error('[notifier] Failed to send S1 email:', err)
    return false
  }
}

// ── メインエントリ ──

export async function notifyError(
  severity: Severity,
  title: string,
  detail: string,
  requestId?: string,
): Promise<void> {
  const debounceKey = `${severity}:${title}`

  if (shouldDebounce(debounceKey)) {
    return
  }

  switch (severity) {
    case 'S1':
      console.error(`[notifier][S1] ${title}: ${detail}${requestId ? ` (${requestId})` : ''}`)
      await sendAlertEmail(title, detail, requestId)
      break

    case 'S2':
      console.warn(`[notifier][S2] ${title}: ${detail}${requestId ? ` (${requestId})` : ''}`)
      break

    case 'S3':
      console.info(`[notifier][S3] ${title}: ${detail}${requestId ? ` (${requestId})` : ''}`)
      break
  }
}
