/** @file
 * `GET /api/usage` Route Handler
 * 機能：認証済みユーザーの当月利用状況（質問数・残り回数）を返す。
 * 入力：Authorization ヘッダ（Bearer トークン）
 * 出力：JSON { requestId, data: { used, limit, remaining } }
 * 依存：Supabase Admin Client (Service Role), rateLimit (getJstMonth, resolveAppUserId)
 * セキュリティ：Bearer トークンで認証必須。Service Role で usage_counters を参照。
 */

import { AppError, errorResponse } from '../../../src/shared/lib/errors'
import { getJstMonth, resolveAppUserId } from '../../../src/shared/lib/rateLimit'
import { generateRequestId, getBearerToken } from '../../../src/shared/lib/request'
import { jsonResponse } from '../../../src/shared/lib/response'
import { getSupabaseAdminClient } from '../../../src/shared/lib/supabaseAdmin'
import type { UsageCounterRow } from '../../../src/shared/types/database'

export const runtime = 'nodejs'

const DEFAULT_MONTHLY_QUOTA = 100

export async function GET(req: Request) {
  const requestId = generateRequestId('usage')

  try {
    // 1. 認証チェック
    let token: string
    try {
      token = getBearerToken(req)
    } catch {
      throw new AppError(401, 'UNAUTHORIZED', 'Authorization ヘッダがありません。')
    }

    const supabase = getSupabaseAdminClient()
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser(token)

    if (authError || !user) {
      throw new AppError(401, 'UNAUTHORIZED', 'ログインセッションが無効です。')
    }

    // 2. app_user ID を解決
    const appUserId = await resolveAppUserId(user.id)

    // 3. 当月の usage_counters を取得（rateLimit.ts と同じロジック）
    const month = getJstMonth()
    const monthStart = `${month}-01`

    const [y, m] = month.split('-').map(Number)
    const nextMonthStart =
      m === 12
        ? `${y + 1}-01-01`
        : `${y}-${String(m + 1).padStart(2, '0')}-01`

    const { data: rows } = await supabase
      .from('usage_counters')
      .select()
      .eq('user_id', appUserId)
      .gte('day', monthStart)
      .lt('day', nextMonthStart)

    const used = ((rows as UsageCounterRow[] | null) ?? []).reduce(
      (sum, r) => sum + (r.questions ?? 0),
      0,
    )

    const limit = parseInt(
      process.env.MONTHLY_QUOTA ?? String(DEFAULT_MONTHLY_QUOTA),
      10,
    )
    const remaining = Math.max(limit - used, 0)

    // 4. レスポンス
    return jsonResponse(requestId, { used, limit, remaining })
  } catch (error) {
    return errorResponse(requestId, error as Error)
  }
}
