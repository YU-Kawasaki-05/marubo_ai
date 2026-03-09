/** @file
 * `POST /api/admin/attachments/signed-url` Route Handler
 * 機能：スタッフ向けに任意の添付画像の署名 URL を生成する。
 * 入力：JSON { storagePath: string }
 * 出力：JSON { requestId, data: { signedUrl: string } }
 * 依存：requireStaff, Supabase Admin Client (Service Role)
 * セキュリティ：スタッフ認証必須。Service Role で Storage RLS をバイパス。
 */

import { AppError, errorResponse } from '../../../../../src/shared/lib/errors'
import { generateRequestId } from '../../../../../src/shared/lib/request'
import { requireStaff } from '../../../../../src/shared/lib/requireStaff'
import { jsonResponse } from '../../../../../src/shared/lib/response'
import { getSupabaseAdminClient } from '../../../../../src/shared/lib/supabaseAdmin'

export const runtime = 'nodejs'

/** 署名 URL の有効期間（秒）: 10 分 */
const SIGNED_URL_EXPIRES_IN = 600

type SignedUrlRequestBody = {
  storagePath?: string
}

export async function POST(req: Request) {
  const requestId = generateRequestId('admin-signed-url')

  try {
    // 1. スタッフ認証
    await requireStaff(req)

    // 2. リクエストボディ解析
    const body = (await req.json()) as SignedUrlRequestBody
    const { storagePath } = body

    if (!storagePath || typeof storagePath !== 'string') {
      throw new AppError(400, 'MISSING_STORAGE_PATH', 'storagePath は必須です。')
    }

    // 3. Service Role で署名 URL を生成
    const supabase = getSupabaseAdminClient()
    const { data, error } = await supabase.storage
      .from('attachments')
      .createSignedUrl(storagePath, SIGNED_URL_EXPIRES_IN)

    if (error || !data?.signedUrl) {
      throw new AppError(500, 'SIGNED_URL_FAILED', '署名 URL の生成に失敗しました。', {
        originalError: error?.message ?? 'Unknown storage error',
      })
    }

    // 4. レスポンス
    return jsonResponse(requestId, { signedUrl: data.signedUrl })
  } catch (error) {
    return errorResponse(requestId, error as Error)
  }
}
