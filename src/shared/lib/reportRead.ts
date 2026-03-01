/** @file
 * 月次レポート参照ドメインサービス（GET / CSV）。
 * 入力: 認証コンテキスト + クエリパラメータ（month, userId, page, limit）。
 * 出力: レポート一覧（生徒=自分のみ / スタッフ=全員）or CSV 文字列。
 * 依存: Supabase Service Role、AppError。
 * セキュリティ: 生徒は自分の user_id のみ、スタッフは全ユーザーのレポートを参照可能。
 */

import type { AppUserRow, MonthlyReportRow } from '../types/database'

import { AppError } from './errors'
import type { AuthContext } from './requireAuth'
import { getSupabaseAdminClient } from './supabaseAdmin'

// ── 型定義 ──

export type ReportListParams = {
  month: string
  userId?: string
  page?: number
  limit?: number
}

type StudentReportResponse = {
  report: {
    id: string
    month: string
    status: string
    content: string | null
    stats: unknown
    generatedAt: string | null
  } | null
}

type StaffReportItem = {
  id: string
  month: string
  status: string
  generatedAt: string | null
  user: { email: string; displayName: string | null }
  stats: unknown
}

type StaffReportListResponse = {
  reports: StaffReportItem[]
  pagination: { page: number; limit: number; total: number; totalPages: number }
}

// ── 生徒用（自分のレポート 1 件） ──

export async function getStudentReport(
  auth: AuthContext,
  month: string,
): Promise<StudentReportResponse> {
  if (!month || !/^\d{4}-\d{2}$/.test(month)) {
    throw new AppError(400, 'INVALID_MONTH', 'month は YYYY-MM 形式で指定してください。')
  }

  const supabase = getSupabaseAdminClient()

  const { data: reports } = await supabase
    .from('monthly_report')
    .select()
    .eq('user_id', auth.appUserId)
    .eq('month', month)

  const rows = (reports ?? []) as MonthlyReportRow[]
  if (rows.length === 0) {
    return { report: null }
  }

  const r = rows[0]
  return {
    report: {
      id: r.id,
      month: r.month,
      status: r.status,
      content: r.content,
      stats: r.stats,
      generatedAt: r.generated_at,
    },
  }
}

// ── スタッフ用（全員一覧 + ページネーション） ──

export async function getStaffReportList(
  params: ReportListParams,
): Promise<StaffReportListResponse> {
  const { month, userId, page = 1, limit = 20 } = params

  if (!month || !/^\d{4}-\d{2}$/.test(month)) {
    throw new AppError(400, 'INVALID_MONTH', 'month は YYYY-MM 形式で指定してください。')
  }

  const supabase = getSupabaseAdminClient()

  // Build query
  let query = supabase.from('monthly_report').select().eq('month', month)

  if (userId) {
    query = query.eq('user_id', userId)
  }

  const { data: allReports } = await query
  const rows = (allReports ?? []) as MonthlyReportRow[]

  const total = rows.length
  const totalPages = Math.max(1, Math.ceil(total / limit))
  const offset = (page - 1) * limit
  const paged = rows.slice(offset, offset + limit)

  // Resolve user info for each report
  const userIds = [...new Set(paged.map((r) => r.user_id))]
  const userMap = new Map<string, AppUserRow>()

  if (userIds.length > 0) {
    const { data: users } = await supabase.from('app_user').select().in('id', userIds)
    for (const u of (users ?? []) as AppUserRow[]) {
      userMap.set(u.id, u)
    }
  }

  const reports: StaffReportItem[] = paged.map((r) => {
    const user = userMap.get(r.user_id)
    return {
      id: r.id,
      month: r.month,
      status: r.status,
      generatedAt: r.generated_at,
      user: {
        email: user?.email ?? '',
        displayName: user?.display_name ?? null,
      },
      stats: r.stats,
    }
  })

  return {
    reports,
    pagination: { page, limit, total, totalPages },
  }
}

// ── CSV 用データ取得 ──

export type CsvReportRow = {
  email: string
  displayName: string | null
  conversations: number
  questions: number
  firstActivity: string | null
  lastActivity: string | null
  reportStatus: string
}

export async function getCsvData(month: string): Promise<CsvReportRow[]> {
  if (!month || !/^\d{4}-\d{2}$/.test(month)) {
    throw new AppError(400, 'INVALID_MONTH', 'month は YYYY-MM 形式で指定してください。')
  }

  const supabase = getSupabaseAdminClient()

  // Get all reports for the month
  const { data: reports } = await supabase
    .from('monthly_report')
    .select()
    .eq('month', month)

  const rows = (reports ?? []) as MonthlyReportRow[]

  // Resolve user info
  const userIds = rows.map((r) => r.user_id)
  const userMap = new Map<string, AppUserRow>()

  if (userIds.length > 0) {
    const { data: users } = await supabase.from('app_user').select().in('id', userIds)
    for (const u of (users ?? []) as AppUserRow[]) {
      userMap.set(u.id, u)
    }
  }

  // Get conversations + messages for stats
  const authUids = [...userMap.values()].map((u) => u.auth_uid)
  const [yearStr, monStr] = month.split('-').map(Number)
  const monthStart = new Date(Date.UTC(yearStr, monStr - 1, 1)).toISOString()
  const monthEnd = new Date(Date.UTC(yearStr, monStr, 1)).toISOString()

  type ConvRow = { id: string; user_id: string; created_at: string }
  type MsgRow = { id: string; conversation_id: string; role: string; created_at: string }

  const { data: convs } = await supabase
    .from('conversations')
    .select()
    .in('user_id', authUids.length > 0 ? authUids : ['__none__'])
    .gte('created_at', monthStart)
    .lt('created_at', monthEnd)

  const allConvs = (convs ?? []) as ConvRow[]
  const convIds = allConvs.map((c) => c.id)

  let allMsgs: MsgRow[] = []
  if (convIds.length > 0) {
    const { data: msgs } = await supabase
      .from('messages')
      .select()
      .in('conversation_id', convIds)
      .order('created_at', { ascending: true })
    allMsgs = (msgs ?? []) as MsgRow[]
  }

  // Build per-authUid stats
  const authUidToAppUser = new Map<string, AppUserRow>()
  for (const u of userMap.values()) {
    authUidToAppUser.set(u.auth_uid, u)
  }

  type ActivityStats = {
    conversations: number
    questions: number
    firstActivity: string | null
    lastActivity: string | null
  }

  const statsByUserId = new Map<string, ActivityStats>()

  for (const authUid of authUids) {
    const userConvs = allConvs.filter((c) => c.user_id === authUid)
    const userConvIds = new Set(userConvs.map((c) => c.id))
    const userMsgs = allMsgs.filter(
      (m) => userConvIds.has(m.conversation_id) && m.role === 'user',
    )

    const appUser = authUidToAppUser.get(authUid)
    if (!appUser) continue

    statsByUserId.set(appUser.id, {
      conversations: userConvs.length,
      questions: userMsgs.length,
      firstActivity: userMsgs.length > 0 ? userMsgs[0].created_at : null,
      lastActivity: userMsgs.length > 0 ? userMsgs[userMsgs.length - 1].created_at : null,
    })
  }

  return rows.map((r) => {
    const user = userMap.get(r.user_id)
    const stats = statsByUserId.get(r.user_id)
    return {
      email: user?.email ?? '',
      displayName: user?.display_name ?? null,
      conversations: stats?.conversations ?? 0,
      questions: stats?.questions ?? 0,
      firstActivity: stats?.firstActivity ?? null,
      lastActivity: stats?.lastActivity ?? null,
      reportStatus: r.status,
    }
  })
}
