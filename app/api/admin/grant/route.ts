/** @file
 * `/api/admin/grant` Route Handler（GET/POST）
 * 入力：Authorization ヘッダ（Supabase セッション）、POST body（email/action）
 * 出力：権限付与/解除結果 or スタッフ一覧・操作履歴
 * 依存：Supabase Service Role、grant ドメインサービス、AppError
 * セキュリティ：`requireStaff()` + `GRANT_ALLOWED_EMAILS` チェックで二重認可
 */

export const runtime = 'nodejs'

import { errorResponse } from '../../../../src/shared/lib/errors'
import {
  assertGrantAllowed,
  executeGrant,
  listGrantInfo,
  type GrantPayload,
} from '../../../../src/shared/lib/grant'
import { parseJsonBody, generateRequestId } from '../../../../src/shared/lib/request'
import { requireStaff } from '../../../../src/shared/lib/requireStaff'
import { jsonResponse } from '../../../../src/shared/lib/response'

export async function GET(request: Request) {
  const requestId = generateRequestId('grant_list')
  try {
    const staff = await requireStaff(request)
    assertGrantAllowed(staff.email)
    const data = await listGrantInfo()
    return jsonResponse(requestId, data)
  } catch (error) {
    return errorResponse(requestId, error instanceof Error ? error : new Error(String(error)))
  }
}

export async function POST(request: Request) {
  const requestId = generateRequestId('grant')
  try {
    const staff = await requireStaff(request)
    assertGrantAllowed(staff.email)
    const body = await parseJsonBody<GrantPayload>(request)
    const data = await executeGrant(body, staff, requestId)
    return jsonResponse(requestId, data)
  } catch (error) {
    return errorResponse(requestId, error instanceof Error ? error : new Error(String(error)))
  }
}
