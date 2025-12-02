/** @file
 * `/api/admin/allowlist/:email` Route Handler（PATCH）
 * 入力：Authorization ヘッダ、URL パラメータ email、Body(status/label/notes)
 * 出力：更新後の許可メール 1 件 `{ requestId, data }`
 * 依存：requireStaff, allowlist.updateAllowlistEntry
 * セキュリティ：スタッフのみ更新可能、メールは lowercase/trim で正規化。
 */

export const runtime = 'nodejs'

import { errorResponse } from '../../../../../src/shared/lib/errors'
import { jsonResponse } from '../../../../../src/shared/lib/response'
import { parseJsonBody, generateRequestId } from '../../../../../src/shared/lib/request'
import { requireStaff } from '../../../../../src/shared/lib/requireStaff'
import { updateAllowlistEntry, type UpdateAllowlistPayload } from '../../../../../src/shared/lib/allowlist'

type RouteContext = {
  params: { email: string }
}

export async function PATCH(request: Request, context: RouteContext) {
  const requestId = generateRequestId('allowlist')
  try {
    const staff = await requireStaff(request)
    const body = await parseJsonBody<UpdateAllowlistPayload>(request)
    const emailParam = decodeURIComponent(context.params.email || '')
    const data = await updateAllowlistEntry(emailParam, body, staff.appUserId, requestId)
    return jsonResponse(requestId, data)
  } catch (error) {
    return errorResponse(requestId, error instanceof Error ? error : new Error(String(error)))
  }
}
