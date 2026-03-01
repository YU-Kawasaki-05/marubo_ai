/** @file
 * `POST /api/reports/monthly` Route Handler
 * 入力：Cron Bearer (CRON_SECRET) or Staff Bearer (Supabase token)、body { month?, userId?, dryRun? }
 * 出力：月次レポート生成結果サマリー { month, dryRun, results, notificationSent }
 * 依存：monthlyReport ドメインサービス、requireStaff、AppError
 * セキュリティ：Cron 認証（月末のみ自動実行）or requireStaff() で二重認可
 */

export const runtime = 'nodejs'

import { AppError, errorResponse } from '../../../../src/shared/lib/errors'
import {
  generateMonthlyReports,
  getCurrentMonth,
  isLastDayOfMonth,
  verifyCronAuth,
  type GenerateReportPayload,
} from '../../../../src/shared/lib/monthlyReport'
import { generateRequestId, parseJsonBody } from '../../../../src/shared/lib/request'
import { requireStaff } from '../../../../src/shared/lib/requireStaff'
import { jsonResponse } from '../../../../src/shared/lib/response'

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
      // Cron: always current month, only on last day
      if (!isLastDayOfMonth()) {
        return jsonResponse(requestId, { skipped: true, reason: 'not_last_day' })
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
    return errorResponse(requestId, error instanceof Error ? error : new Error(String(error)))
  }
}
