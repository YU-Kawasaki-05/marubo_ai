/** @file
 * `GET /api/reports/monthly/csv` Route Handler
 * 入力: Authorization Bearer (staff token)、クエリ month (YYYY-MM)
 * 出力: text/csv レスポンス（Content-Disposition: attachment）
 * 依存: reportRead ドメインサービス、toCsv ユーティリティ、requireStaff、AppError
 * セキュリティ: requireStaff() でスタッフのみ許可
 */

export const runtime = 'nodejs'

import { toCsv } from '../../../../../src/features/reports/toCsv'
import { AppError, errorResponse } from '../../../../../src/shared/lib/errors'
import { getCsvData } from '../../../../../src/shared/lib/reportRead'
import { generateRequestId } from '../../../../../src/shared/lib/request'
import { requireStaff } from '../../../../../src/shared/lib/requireStaff'

export async function GET(request: Request) {
  const requestId = generateRequestId('report_csv')
  try {
    await requireStaff(request)

    const url = new URL(request.url)
    const month = url.searchParams.get('month')

    if (!month || !/^\d{4}-\d{2}$/.test(month)) {
      throw new AppError(400, 'INVALID_MONTH', 'month は YYYY-MM 形式で指定してください。')
    }

    const rows = await getCsvData(month)
    const csv = toCsv(rows)

    return new Response(csv, {
      status: 200,
      headers: {
        'content-type': 'text/csv; charset=utf-8',
        'content-disposition': `attachment; filename="marubo_ai_report_${month}.csv"`,
      },
    })
  } catch (error) {
    return errorResponse(requestId, error instanceof Error ? error : new Error(String(error)))
  }
}
