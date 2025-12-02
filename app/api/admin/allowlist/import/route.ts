/** @file
 * `/api/admin/allowlist/import` Route Handler（CSV upsert）
 * 入力：Authorization ヘッダ、Body（`{ csv: string, mode?: 'insert' | 'upsert' }`）または raw text/csv
 * 出力：取り込み結果 `{ inserted, updated }`
 * 依存：allowlist CSV パーサ、Supabase Service Role、監査ログ
 * セキュリティ：スタッフのみ実行可。1 リクエスト 500 行以内を推奨（フロント側バリデーション前提）。
 */

export const runtime = 'nodejs'

import { errorResponse } from '../../../../../src/shared/lib/errors'
import { jsonResponse } from '../../../../../src/shared/lib/response'
import { generateRequestId, parseJsonBody } from '../../../../../src/shared/lib/request'
import { requireStaff } from '../../../../../src/shared/lib/requireStaff'
import {
  importAllowlistCsv,
  parseAllowlistCsv,
  type CsvMode,
} from '../../../../../src/shared/lib/allowlist'

type ImportBody = {
  csv: string
  mode?: CsvMode
}

export async function POST(request: Request) {
  const requestId = generateRequestId('allowlist')
  try {
    const staff = await requireStaff(request)
    const contentType = request.headers.get('content-type') || ''
    let csvText: string
    let mode: CsvMode = 'insert'

    if (contentType.includes('application/json')) {
      const body = await parseJsonBody<ImportBody>(request)
      csvText = body.csv
      mode = parseMode(body.mode)
    } else {
      csvText = await request.text()
      const url = new URL(request.url)
      mode = parseMode((url.searchParams.get('mode') as CsvMode | null) ?? undefined)
    }

    const records = parseAllowlistCsv(csvText)
    const result = await importAllowlistCsv(records, {
      mode,
      staffUserId: staff.appUserId,
      requestId,
    })

    return jsonResponse(requestId, result)
  } catch (error) {
    return errorResponse(requestId, error instanceof Error ? error : new Error(String(error)))
  }
}

function parseMode(value?: CsvMode) {
  if (value === 'upsert') return 'upsert'
  return 'insert'
}
