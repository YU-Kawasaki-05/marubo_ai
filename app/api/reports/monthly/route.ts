/** @file
 * `/api/reports/monthly` Route Handler（GET/POST）
 * GET: Cron トリガー（Vercel Cron → 月末判定 → 生成）/ レポート参照（生徒=自分のみ、スタッフ=全員＋ページネーション）
 * POST: レポート一括生成（スタッフ手動）
 * 依存: monthlyReport / reportRead ドメインサービス、requireAuth / requireStaff、AppError
 * セキュリティ: GET は認証ユーザー全員（ロールで参照範囲制限）、POST は Cron or Staff のみ
 */

export const runtime = 'nodejs'

import { AppError, errorResponse } from '../../../../src/shared/lib/errors'
import {
  generateMonthlyReports,
  getCurrentMonth,
  isReportGenerationWindow,
  verifyCronAuth,
  type GenerateReportPayload,
} from '../../../../src/shared/lib/monthlyReport'
import { notifyError } from '../../../../src/shared/lib/notifier'
import {
  getStaffReportDetail,
  getStaffReportList,
  getStudentReport,
} from '../../../../src/shared/lib/reportRead'
import { generateRequestId, parseJsonBody } from '../../../../src/shared/lib/request'
import { requireAuth } from '../../../../src/shared/lib/requireAuth'
import { requireStaff } from '../../../../src/shared/lib/requireStaff'
import { jsonResponse } from '../../../../src/shared/lib/response'

export async function GET(request: Request) {
  // Cron trigger: Vercel Cron は GET リクエストで呼び出す（Authorization: Bearer CRON_SECRET）
  if (verifyCronAuth(request)) {
    const requestId = generateRequestId('monthly_report')
    try {
      if (!isReportGenerationWindow()) {
        return jsonResponse(requestId, { skipped: true, reason: 'not_in_generation_window' })
      }
      const month = getCurrentMonth()
      const result = await generateMonthlyReports({ month })
      return jsonResponse(requestId, result)
    } catch (error) {
      if (!(error instanceof AppError) || error.status >= 500) {
        const msg = error instanceof Error ? error.message : String(error)
        void notifyError('S1', '月次レポート生成失敗', msg, requestId)
      }
      return errorResponse(requestId, error instanceof Error ? error : new Error(String(error)))
    }
  }

  // 通常の GET: レポート参照
  const requestId = generateRequestId('report_get')
  try {
    const auth = await requireAuth(request)
    const url = new URL(request.url)
    const month = url.searchParams.get('month') ?? getCurrentMonth()

    if (auth.role === 'staff') {
      const userId = url.searchParams.get('userId') ?? undefined
      const detail = url.searchParams.get('detail')

      // detail=true + userId → 個別レポート（content 含む）を返す
      if (detail === 'true' && userId) {
        const data = await getStaffReportDetail(month, userId)
        return jsonResponse(requestId, data)
      }

      const page = parseInt(url.searchParams.get('page') ?? '1', 10)
      const limit = parseInt(url.searchParams.get('limit') ?? '20', 10)

      const data = await getStaffReportList({ month, userId, page, limit })
      return jsonResponse(requestId, data)
    }

    // Student — own report only
    const data = await getStudentReport(auth, month)
    return jsonResponse(requestId, data)
  } catch (error) {
    if (!(error instanceof AppError) || error.status >= 500) {
      const msg = error instanceof Error ? error.message : String(error)
      void notifyError('S2', 'レポート参照エラー', msg, requestId)
    }
    return errorResponse(requestId, error instanceof Error ? error : new Error(String(error)))
  }
}

export async function POST(request: Request) {
  const requestId = generateRequestId('monthly_report')
  try {
    const isCron = verifyCronAuth(request)

    if (!isCron) {
      // Staff manual trigger — requires staff auth
      await requireStaff(request)
    }

    const body = await parseJsonBody<Partial<GenerateReportPayload>>(request)

    let month: string
    if (isCron) {
      // Cron: always current month, only in generation window (last 7 days of month)
      if (!isReportGenerationWindow()) {
        return jsonResponse(requestId, { skipped: true, reason: 'not_in_generation_window' })
      }
      month = getCurrentMonth()
    } else {
      // Staff manual: month is required in body
      if (!body.month) {
        throw new AppError(400, 'INVALID_MONTH', 'month は YYYY-MM 形式で指定してください。')
      }
      month = body.month
    }

    const result = await generateMonthlyReports({
      month,
      userId: body.userId,
      dryRun: body.dryRun ?? false,
    })

    return jsonResponse(requestId, result)
  } catch (error) {
    if (!(error instanceof AppError) || error.status >= 500) {
      const msg = error instanceof Error ? error.message : String(error)
      void notifyError('S1', '月次レポート生成失敗', msg, requestId)
    }
    return errorResponse(requestId, error instanceof Error ? error : new Error(String(error)))
  }
}
