/** @file
 * `/api/admin/allowlist` Route Handler（GET/POST）
 * 入力：Authorization ヘッダ（Supabase セッション）、GET クエリ（status/search）、POST body（email/status/label/notes）
 * 出力：許可メールの一覧 or 作成結果（`{ requestId, data }`）
 * 依存：Supabase Service Role、allowlist ドメインサービス、AppError
 * セキュリティ：`requireStaff()` でスタッフ確認後、Service Role で `allowed_email` を検索/作成し、監査ログに記録
 */

export const runtime = 'nodejs'

import { AppError, errorResponse } from '../../../../src/shared/lib/errors'
import { jsonResponse } from '../../../../src/shared/lib/response'
import { parseJsonBody, generateRequestId } from '../../../../src/shared/lib/request'
import { requireStaff } from '../../../../src/shared/lib/requireStaff'
import {
  createAllowlistEntry,
  listAllowlistEntries,
  type CreateAllowlistPayload,
} from '../../../../src/shared/lib/allowlist'
import type { AllowedEmailStatus } from '../../../../src/shared/types/database'

export async function GET(request: Request) {
  const requestId = generateRequestId('allowlist')
  try {
    await requireStaff(request)
    const url = new URL(request.url)
    const statusParam = url.searchParams.get('status')
    const search = url.searchParams.get('search') ?? undefined
    const status = parseStatusParam(statusParam)

    const data = await listAllowlistEntries({ status, search })
    return jsonResponse(requestId, data)
  } catch (error) {
    return errorResponse(requestId, error instanceof Error ? error : new Error(String(error)))
  }
}

export async function POST(request: Request) {
  const requestId = generateRequestId('allowlist')
  try {
    const staff = await requireStaff(request)
    const body = await parseJsonBody<CreateAllowlistPayload>(request)
    const payload: CreateAllowlistPayload = {
      email: body.email,
      status: (body.status ?? 'pending') as AllowedEmailStatus,
      label: body.label ?? null,
      notes: body.notes ?? null,
    }

    const data = await createAllowlistEntry(payload, staff.appUserId, requestId)
    return jsonResponse(requestId, data, 201)
  } catch (error) {
    return errorResponse(requestId, error instanceof Error ? error : new Error(String(error)))
  }
}

function parseStatusParam(value: string | null): AllowedEmailStatus | undefined {
  if (!value) return undefined
  const normalized = value.toLowerCase()
  if (!['active', 'pending', 'revoked'].includes(normalized)) {
    throw new AppError(400, 'STATUS_INVALID', 'status クエリは active/pending/revoked のみ指定できます。')
  }
  return normalized as AllowedEmailStatus
}
