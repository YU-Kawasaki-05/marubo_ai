/** @file
 * `/api/admin/conversations` Route Handler（GET）
 * 入力：Authorization ヘッダ（Supabase セッション）、クエリパラメータ（email/from/to/keyword/page/limit）
 * 出力：ページング済み会話一覧
 * 依存：Supabase Service Role、adminConversations ドメインサービス、AppError
 * セキュリティ：`requireStaff()` でスタッフ認可チェック
 */

export const runtime = 'nodejs'

import { listConversations } from '../../../../src/shared/lib/adminConversations'
import { errorResponse } from '../../../../src/shared/lib/errors'
import { generateRequestId } from '../../../../src/shared/lib/request'
import { requireStaff } from '../../../../src/shared/lib/requireStaff'
import { jsonResponse } from '../../../../src/shared/lib/response'

export async function GET(request: Request) {
  const requestId = generateRequestId('admin_conv')
  try {
    await requireStaff(request)

    const url = new URL(request.url)
    const email = url.searchParams.get('email') || undefined
    const from = url.searchParams.get('from') || undefined
    const to = url.searchParams.get('to') || undefined
    const keyword = url.searchParams.get('keyword') || undefined
    const page = Math.max(1, parseInt(url.searchParams.get('page') ?? '1', 10) || 1)
    const limit = Math.min(50, Math.max(1, parseInt(url.searchParams.get('limit') ?? '20', 10) || 20))

    const data = await listConversations({ email, from, to, keyword, page, limit })
    return jsonResponse(requestId, data)
  } catch (error) {
    return errorResponse(requestId, error instanceof Error ? error : new Error(String(error)))
  }
}
