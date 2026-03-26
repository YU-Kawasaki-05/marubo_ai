/** @file
 * 月次レポート生成ドメインサービス。
 * 入力: 対象月 (YYYY-MM)、オプション (userId, dryRun, chunkSize)。
 * 出力: 生成結果サマリー { total, pending, processed, generated, failed, skipped, remaining }。
 * 依存: Supabase Service Role、OpenAI (ai SDK)、Resend (fetch)。
 * セキュリティ: Cron 認証 or requireStaff() で認可済みの呼び出しのみ想定。
 * 備考: チャンク分割処理（REPORT_CHUNK_SIZE、デフォルト3）で Vercel タイムアウトを回避。
 *   生徒間に REPORT_DELAY_MS（デフォルト5000ms）のディレイで OpenAI レートリミットを回避。
 *   status='generated' の生徒は自動スキップ（リジューム対応）。
 */

import { openai } from '@ai-sdk/openai'
import { generateText } from 'ai'

import type { AppUserRow, Json, MonthlyReportStatus } from '../types/database'

import { AppError } from './errors'
import { getSupabaseAdminClient } from './supabaseAdmin'

type ConversationRow = { id: string; user_id: string; title: string; created_at: string }
type MessageRow = {
  id: string
  conversation_id: string
  role: 'user' | 'assistant'
  content: string
  created_at: string
}

// ── 型定義 ──

export type GenerateReportPayload = {
  month: string
  userId?: string
  dryRun?: boolean
  chunkSize?: number
}

type StudentStats = {
  questions: number
  conversations: number
  activeDays: number
  mostActiveDay: string | null
}

type GenerationResult = {
  month: string
  dryRun: boolean
  results: {
    total: number
    pending: number
    processed: number
    generated: number
    failed: number
    skipped: number
    remaining: number
  }
  notificationSent: boolean
}

// ── 定数 ──

const SYSTEM_PROMPT = `あなたは塾の学習アドバイザーです。
以下は生徒の1ヶ月分のAIチャット質問履歴です。
この履歴を分析して、以下のセクションを含むMarkdown形式のレポートを生成してください。

## 今月の学習サマリー
質問の傾向を要約（100〜200字）

## 学習トピックの分布
どの教科・分野の質問が多かったか（箇条書き3〜8項目）

## 理解度の所見
質問内容から推測される理解度（100〜200字）

## 学習アドバイス
生徒へのアドバイス（100〜300字）

語調: 丁寧かつ励ましのある表現（です・ます調）
対象: 中高生の生徒本人が読むことを想定
個人情報: メールアドレスや本名は出力しない`

const NO_DATA_CONTENT = `## 今月の学習サマリー

今月はAIチャットでの質問がありませんでした。

## 学習アドバイス

ぜひAIチャットを活用して、わからない問題や気になることを質問してみてください。どんな小さな疑問でも大歓迎です！`

const MAX_MESSAGES_FOR_LLM = 200
const DEFAULT_MAX_TOKENS_OUT = 2000
const DEFAULT_CHUNK_SIZE = 3
const DEFAULT_DELAY_MS = 5000

// ── ヘルパー ──

function getMonthRange(month: string): { start: string; end: string } {
  const [year, mon] = month.split('-').map(Number)
  const start = new Date(Date.UTC(year, mon - 1, 1)).toISOString()
  const endDate = new Date(Date.UTC(year, mon, 1))
  const end = endDate.toISOString()
  return { start, end }
}

export function isLastDayOfMonth(): boolean {
  const now = new Date()
  const jst = new Date(now.getTime() + 9 * 60 * 60 * 1000)
  const tomorrow = new Date(jst)
  tomorrow.setUTCDate(tomorrow.getUTCDate() + 1)
  return tomorrow.getUTCDate() === 1
}

/** 月末7日前〜月末の期間内かどうかを判定（チャンク分割 Cron 用） */
export function isReportGenerationWindow(): boolean {
  const now = new Date()
  const jst = new Date(now.getTime() + 9 * 60 * 60 * 1000)
  const lastDay = new Date(Date.UTC(jst.getUTCFullYear(), jst.getUTCMonth() + 1, 0)).getUTCDate()
  const currentDay = jst.getUTCDate()
  return currentDay >= lastDay - 6
}

export function getCurrentMonth(): string {
  const now = new Date()
  const jst = new Date(now.getTime() + 9 * 60 * 60 * 1000)
  const y = jst.getUTCFullYear()
  const m = String(jst.getUTCMonth() + 1).padStart(2, '0')
  return `${y}-${m}`
}

// ── Cron 認証 ──

export function verifyCronAuth(request: Request): boolean {
  const cronSecret = process.env.CRON_SECRET
  if (!cronSecret) return false
  const header = request.headers.get('authorization')
  return header === `Bearer ${cronSecret}`
}

// ── 統計集計 ──

async function collectStats(
  userId: string,
  monthStart: string,
  monthEnd: string,
): Promise<{ stats: StudentStats; messageTexts: string[] }> {
  const supabase = getSupabaseAdminClient()

  // conversations for this user in this month
  const { data: convs } = await supabase
    .from('conversations')
    .select()
    .eq('user_id', userId)
    .gte('created_at', monthStart)
    .lt('created_at', monthEnd)

  const convIds = ((convs ?? []) as ConversationRow[]).map((c) => c.id)
  if (convIds.length === 0) {
    return {
      stats: { questions: 0, conversations: 0, activeDays: 0, mostActiveDay: null },
      messageTexts: [],
    }
  }

  // all messages for these conversations
  const { data: msgs } = await supabase
    .from('messages')
    .select()
    .in('conversation_id', convIds)
    .order('created_at', { ascending: true })

  const allMsgs = ((msgs ?? []) as MessageRow[])
  const userMsgs = allMsgs.filter((m) => m.role === 'user')

  // active days
  const daySet = new Set<string>()
  const dayCounts = new Map<string, number>()
  for (const m of userMsgs) {
    const d = new Date(m.created_at)
    const jst = new Date(d.getTime() + 9 * 60 * 60 * 1000)
    const dayStr = jst.toISOString().split('T')[0]
    daySet.add(dayStr)
    dayCounts.set(dayStr, (dayCounts.get(dayStr) ?? 0) + 1)
  }

  let mostActiveDay: string | null = null
  let maxCount = 0
  for (const [day, count] of dayCounts) {
    if (count > maxCount) {
      maxCount = count
      mostActiveDay = day
    }
  }

  const stats: StudentStats = {
    questions: userMsgs.length,
    conversations: convIds.length,
    activeDays: daySet.size,
    mostActiveDay,
  }

  // message texts for LLM (latest MAX_MESSAGES_FOR_LLM user messages)
  const recentUserMsgs = userMsgs.slice(-MAX_MESSAGES_FOR_LLM)
  const messageTexts = recentUserMsgs.map((m) => {
    const d = new Date(m.created_at)
    const jst = new Date(d.getTime() + 9 * 60 * 60 * 1000)
    const mm = String(jst.getUTCMonth() + 1).padStart(2, '0')
    const dd = String(jst.getUTCDate()).padStart(2, '0')
    const hh = String(jst.getUTCHours()).padStart(2, '0')
    const min = String(jst.getUTCMinutes()).padStart(2, '0')
    return `[${mm}/${dd} ${hh}:${min}] ${m.content}`
  })

  return { stats, messageTexts }
}

// ── LLM 呼び出し ──

async function callLlm(
  month: string,
  stats: StudentStats,
  messageTexts: string[],
): Promise<{ content: string; tokensIn: number; tokensOut: number; model: string }> {
  const modelName = process.env.REPORT_LLM_MODEL ?? 'gpt-4o-mini'
  const maxTokens = parseInt(process.env.REPORT_MAX_TOKENS_OUT ?? String(DEFAULT_MAX_TOKENS_OUT), 10)

  const userPrompt = `【対象期間】${month}
【質問数】${stats.questions}件
【会話数】${stats.conversations}件
【利用日数】${stats.activeDays}日
${stats.mostActiveDay ? `【最も活発な日】${stats.mostActiveDay}` : ''}

--- 質問履歴（ユーザーメッセージのみ抜粋） ---
${messageTexts.join('\n')}`

  const result = await generateText({
    model: openai(modelName),
    system: SYSTEM_PROMPT,
    prompt: userPrompt,
    maxOutputTokens: maxTokens,
  })

  return {
    content: result.text,
    tokensIn: result.usage?.inputTokens ?? 0,
    tokensOut: result.usage?.outputTokens ?? 0,
    model: modelName,
  }
}

// ── 通知メール ──

async function sendNotificationEmail(
  month: string,
  total: number,
  generated: number,
  failed: number,
): Promise<boolean> {
  const apiKey = process.env.RESEND_API_KEY
  const adminEmails = process.env.ADMIN_EMAILS
  const mailFrom = process.env.MAIL_FROM ?? 'noreply@example.com'

  if (!apiKey || !adminEmails) {
    console.warn('RESEND_API_KEY or ADMIN_EMAILS not set; skipping notification email')
    return false
  }

  const recipients = adminEmails
    .split(';')
    .map((e) => e.trim())
    .filter(Boolean)
  if (recipients.length === 0) return false

  const [year, mon] = month.split('-')
  const monthLabel = `${year}年${parseInt(mon, 10)}月`

  const failedNote =
    failed > 0
      ? '\n一部の生徒のレポート生成に失敗しました。管理画面から再生成してください。'
      : ''

  const textBody = `Marubo AI 月次レポート通知 — ${monthLabel}

レポート生成完了

  対象月:      ${monthLabel}
  生成件数:    ${generated} / ${total} 名
  失敗件数:    ${failed} 件
${failedNote}

レポートは管理画面からご確認いただけます。

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
        subject: `【Marubo AI】${monthLabel} 月次レポートが生成されました`,
        text: textBody,
      }),
    })
    if (!res.ok) {
      console.error('Resend API error:', res.status, await res.text().catch(() => ''))
      return false
    }
    return true
  } catch (err) {
    console.error('Failed to send notification email:', err)
    return false
  }
}

// ── メイン処理 ──

export async function generateMonthlyReports(
  payload: GenerateReportPayload,
): Promise<GenerationResult> {
  const { month, userId, dryRun = false, chunkSize: chunkSizeOverride } = payload
  const chunkSize = chunkSizeOverride ?? (Number(process.env.REPORT_CHUNK_SIZE) || DEFAULT_CHUNK_SIZE)
  const envDelay = process.env.REPORT_DELAY_MS
  const delayMs = envDelay !== undefined ? Number(envDelay) : DEFAULT_DELAY_MS

  if (!month || !/^\d{4}-\d{2}$/.test(month)) {
    throw new AppError(400, 'INVALID_MONTH', 'month は YYYY-MM 形式で指定してください。')
  }

  const supabase = getSupabaseAdminClient()
  const { start: monthStart, end: monthEnd } = getMonthRange(month)

  // Step 1: find active students for the month
  let targetUserIds: string[]

  if (userId) {
    targetUserIds = [userId]
  } else {
    const { data: activeConvs } = await supabase
      .from('conversations')
      .select()
      .gte('created_at', monthStart)
      .lt('created_at', monthEnd)

    const userIdSet = new Set<string>()
    for (const c of (activeConvs ?? []) as ConversationRow[]) {
      userIdSet.add(c.user_id)
    }

    // conversations.user_id is auth_uid; resolve to app_user.id
    if (userIdSet.size === 0) {
      return {
        month,
        dryRun,
        results: { total: 0, pending: 0, processed: 0, generated: 0, failed: 0, skipped: 0, remaining: 0 },
        notificationSent: false,
      }
    }

    const { data: appUsers } = await supabase
      .from('app_user')
      .select()
      .in('auth_uid', Array.from(userIdSet))

    targetUserIds = ((appUsers ?? []) as AppUserRow[]).map((u) => u.id)
  }

  if (targetUserIds.length === 0) {
    return {
      month,
      dryRun,
      results: { total: 0, pending: 0, processed: 0, generated: 0, failed: 0, skipped: 0, remaining: 0 },
      notificationSent: false,
    }
  }

  // Step 2: resolve auth_uid for each app_user.id (for conversations query)
  const { data: users } = await supabase
    .from('app_user')
    .select()
    .in('id', targetUserIds)

  const userMap = new Map<string, { id: string; authUid: string }>()
  for (const u of (users ?? []) as AppUserRow[]) {
    userMap.set(u.id, { id: u.id, authUid: u.auth_uid })
  }

  // Step 2b: 生成済み (generated) の生徒を除外してチャンク制限
  // userId 指定時（個別再生成）はスキップしない
  let pendingIds: string[]
  if (userId) {
    pendingIds = targetUserIds
  } else {
    const { data: existingReports } = await supabase
      .from('monthly_report')
      .select('user_id, status')
      .eq('month', month)
      .in('user_id', targetUserIds)
    const generatedIds = new Set(
      (existingReports ?? [])
        .filter((r: { status: string }) => r.status === 'generated')
        .map((r: { user_id: string }) => r.user_id),
    )
    pendingIds = targetUserIds.filter((id) => !generatedIds.has(id))
  }

  const chunk = pendingIds.slice(0, chunkSize)

  let generated = 0
  let failed = 0
  let skipped = 0

  // Step 3: process chunk sequentially with delay
  for (let i = 0; i < chunk.length; i++) {
    const appUserId = chunk[i]
    const userInfo = userMap.get(appUserId)
    if (!userInfo) {
      skipped++
      continue
    }

    // 2人目以降はディレイ（OpenAI レートリミット回避）
    if (i > 0) {
      await new Promise((resolve) => setTimeout(resolve, delayMs))
    }

    try {
      // Mark as generating (unless dryRun)
      if (!dryRun) {
        await supabase
          .from('monthly_report')
          .upsert(
            [{ user_id: appUserId, month, status: 'generating' as MonthlyReportStatus }],
            { onConflict: 'user_id,month' as never },
          )
      }

      // Collect stats — conversations.user_id stores auth_uid in this project
      const { stats, messageTexts } = await collectStats(userInfo.authUid, monthStart, monthEnd)

      let content: string
      let llmModel: string | null = null
      let tokensIn = 0
      let tokensOut = 0

      if (stats.questions === 0) {
        content = NO_DATA_CONTENT
      } else {
        const llmResult = await callLlm(month, stats, messageTexts)
        content = llmResult.content
        llmModel = llmResult.model
        tokensIn = llmResult.tokensIn
        tokensOut = llmResult.tokensOut
      }

      if (!dryRun) {
        await supabase.from('monthly_report').upsert(
          [
            {
              user_id: appUserId,
              month,
              status: 'generated' as MonthlyReportStatus,
              content,
              stats: stats as unknown as Json,
              llm_model: llmModel,
              llm_tokens_in: tokensIn,
              llm_tokens_out: tokensOut,
              error_message: null,
              generated_at: new Date().toISOString(),
            },
          ],
          { onConflict: 'user_id,month' as never },
        )
      }

      generated++
    } catch (err) {
      failed++
      const errorMessage = err instanceof Error ? err.message : String(err)
      console.error(`Report generation failed for user ${appUserId}:`, errorMessage)

      if (!dryRun) {
        try {
          await supabase.from('monthly_report').upsert(
            [
              {
                user_id: appUserId,
                month,
                status: 'failed' as MonthlyReportStatus,
                error_message: errorMessage,
              },
            ],
            { onConflict: 'user_id,month' as never },
          )
        } catch (saveErr) {
          console.error('Failed to save error status:', saveErr)
        }
      }
    }
  }

  const remaining = pendingIds.length - chunk.length

  // Step 4: send notification only when all students are done (skip for dryRun)
  let notificationSent = false
  if (!dryRun && targetUserIds.length > 0 && remaining === 0) {
    notificationSent = await sendNotificationEmail(month, targetUserIds.length, generated, failed)
  }

  return {
    month,
    dryRun,
    results: {
      total: targetUserIds.length,
      pending: pendingIds.length,
      processed: chunk.length,
      generated,
      failed,
      skipped,
      remaining,
    },
    notificationSent,
  }
}
