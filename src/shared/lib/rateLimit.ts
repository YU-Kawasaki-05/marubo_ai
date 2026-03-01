/** @file
 * レート制限ユーティリティ。
 * 機能: 分間レート制限（10 req/min）+ 月間クォータ（100 問/月）+ 利用カウンタ増分。
 * 入力: appUserId（app_user.id）。
 * 出力: void（超過時は AppError(429) をスロー）。
 * 依存: supabaseAdmin, AppError, env(MONTHLY_QUOTA)。
 * セキュリティ: Service Role で usage_counters / rate_limiter を操作。auth_uid → app_user.id の解決も提供。
 */

import type { AppUserRow, RateLimiterRow, UsageCounterRow } from '../types/database'

import { AppError } from './errors'
import { getSupabaseAdminClient } from './supabaseAdmin'

const MINUTE_LIMIT = 10
const DEFAULT_MONTHLY_QUOTA = 100

// ── JST 日付ヘルパー ──

/** JST 基準で現在の日付を取得 (YYYY-MM-DD) */
export function getJstToday(): string {
  const now = new Date()
  const jst = new Date(now.getTime() + 9 * 60 * 60 * 1000)
  return jst.toISOString().slice(0, 10)
}

/** JST 基準で現在の年月を取得 (YYYY-MM) */
export function getJstMonth(): string {
  return getJstToday().slice(0, 7)
}

/** 現在の分のウィンドウ開始タイムスタンプ (ISO 8601) */
export function getMinuteWindowStart(): string {
  const now = new Date()
  now.setSeconds(0, 0)
  return now.toISOString()
}

// ── app_user 解決 ──

/** auth_uid から app_user.id を解決する */
export async function resolveAppUserId(authUid: string): Promise<string> {
  const supabase = getSupabaseAdminClient()
  const { data, error } = await supabase
    .from('app_user')
    .select()
    .eq('auth_uid', authUid)
    .single()

  if (error || !data) {
    throw new AppError(403, 'USER_NOT_FOUND', 'ユーザー情報を取得できませんでした。')
  }

  return (data as AppUserRow).id
}

// ── 分間レート制限 ──

/** 分間レート制限チェック + カウント増分 */
export async function checkMinuteRate(appUserId: string): Promise<void> {
  const supabase = getSupabaseAdminClient()
  const key = `chat:user:${appUserId}`
  const windowStart = getMinuteWindowStart()

  const { data: rows } = await supabase
    .from('rate_limiter')
    .select()
    .eq('key', key)
    .eq('window_start', windowStart)

  const current = (rows as RateLimiterRow[] | null)?.[0]

  if (current && current.count >= MINUTE_LIMIT) {
    throw new AppError(
      429,
      'RATE_LIMIT_EXCEEDED',
      '送信が早すぎます。しばらく待ってからもう一度お試しください。',
    )
  }

  if (current) {
    await supabase
      .from('rate_limiter')
      .update({ count: current.count + 1 })
      .eq('key', key)
      .eq('window_start', windowStart)
  } else {
    await supabase
      .from('rate_limiter')
      .insert({ key, window_start: windowStart, count: 1 })
  }
}

// ── 月間クォータ ──

/** 月間クォータチェック（usage_counters の当月合計を検証） */
export async function checkMonthlyQuota(appUserId: string): Promise<void> {
  const supabase = getSupabaseAdminClient()
  const month = getJstMonth()
  const monthStart = `${month}-01`

  const [y, m] = month.split('-').map(Number)
  const nextMonthStart =
    m === 12
      ? `${y + 1}-01-01`
      : `${y}-${String(m + 1).padStart(2, '0')}-01`

  const quota = parseInt(process.env.MONTHLY_QUOTA ?? String(DEFAULT_MONTHLY_QUOTA), 10)

  const { data: rows } = await supabase
    .from('usage_counters')
    .select()
    .eq('user_id', appUserId)
    .gte('day', monthStart)
    .lt('day', nextMonthStart)

  const totalQuestions = ((rows as UsageCounterRow[] | null) ?? []).reduce(
    (sum, r) => sum + (r.questions ?? 0),
    0,
  )

  if (totalQuestions >= quota) {
    throw new AppError(
      429,
      'MONTHLY_QUOTA_EXCEEDED',
      `今月の質問上限（${quota} 回）に達しました。来月になると再びご利用いただけます。ご不明点はスタッフにお問い合わせください。`,
    )
  }
}

// ── 利用カウンタ増分 ──

/** usage_counters の当日行 questions を +1（LLM 応答成功後に呼ぶ） */
export async function incrementUsage(appUserId: string): Promise<void> {
  const supabase = getSupabaseAdminClient()
  const today = getJstToday()

  const { data: rows } = await supabase
    .from('usage_counters')
    .select()
    .eq('user_id', appUserId)
    .eq('day', today)

  const current = (rows as UsageCounterRow[] | null)?.[0]

  if (current) {
    await supabase
      .from('usage_counters')
      .update({ questions: current.questions + 1 })
      .eq('user_id', appUserId)
      .eq('day', today)
  } else {
    await supabase
      .from('usage_counters')
      .insert({
        id: crypto.randomUUID(),
        user_id: appUserId,
        day: today,
        questions: 1,
        tokens_in: 0,
        tokens_out: 0,
      })
  }
}
