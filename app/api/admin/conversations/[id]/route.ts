/** @file
 * `/api/admin/conversations/[id]` Route Handler（GET）
 * 入力：Authorization ヘッダ（Supabase セッション）、URL パスパラメータ `id`
 * 出力：会話詳細（メッセージ＋添付情報）
 * 依存：Supabase Service Role、adminConversations ドメインサービス、AppError
 * セキュリティ：`requireStaff()` でスタッフ認可チェック
 */

export const runtime = 'nodejs'

import { getConversationDetail } from '../../../../../src/shared/lib/adminConversations'
import { errorResponse } from '../../../../../src/shared/lib/errors'
import { generateRequestId } from '../../../../../src/shared/lib/request'
import { requireStaff } from '../../../../../src/shared/lib/requireStaff'
import { jsonResponse } from '../../../../../src/shared/lib/response'

type RouteContext = {
  params: { id: string }
}

export async function GET(request: Request, context: RouteContext) {
  const requestId = generateRequestId('admin_conv_detail')
  try {
    await requireStaff(request)
    const { id } = context.params
    const data = await getConversationDetail(id)
    return jsonResponse(requestId, data)
  } catch (error) {
    return errorResponse(requestId, error instanceof Error ? error : new Error(String(error)))
  }
}
