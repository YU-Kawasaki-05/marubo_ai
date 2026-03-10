/** @file
 * `POST /api/attachments/sign` Route Handler
 * 機能：認証済みユーザー向けに Supabase Storage の署名アップロード URL を発行する。
 *   分間レート制限（10 req/min、/api/chat と共有カウンター）を適用。
 * 入力：JSON { filename: string, mimeType: string, size: number }
 * 出力：JSON { requestId, data: { signedUrl, storagePath, token } }
 * 依存：Supabase Admin Client (Service Role), attachmentValidation, rateLimit
 * セキュリティ：Bearer トークンで認証必須。MIME / サイズをサーバー側で再検証。
 *   Service Role で署名するため Node.js ランタイム強制。レート制限で過剰利用を防止。
 */

import {
  assertAllowedMimeType,
  assertFileSize,
  extFromMimeType,
} from '../../../../src/shared/lib/attachmentValidation'
import { AppError, errorResponse } from '../../../../src/shared/lib/errors'
import { notifyError } from '../../../../src/shared/lib/notifier'
import { checkMinuteRate, resolveAppUserId } from '../../../../src/shared/lib/rateLimit'
import { generateRequestId, getBearerToken, parseJsonBody } from '../../../../src/shared/lib/request'
import { jsonResponse } from '../../../../src/shared/lib/response'
import { getSupabaseAdminClient } from '../../../../src/shared/lib/supabaseAdmin'

export const runtime = 'nodejs'

type SignRequestBody = {
  filename?: string
  mimeType?: string
  size?: number
}

export async function POST(req: Request) {
  const requestId = generateRequestId('sign')

  try {
    // 1. 認証チェック
    let token: string
    try {
      token = getBearerToken(req)
    } catch {
      throw new AppError(401, 'UNAUTHORIZED', 'Authorization ヘッダがありません。')
    }

    const supabase = getSupabaseAdminClient()
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser(token)

    if (authError || !user) {
      throw new AppError(401, 'UNAUTHORIZED', 'ログインセッションが無効です。', {
        originalError: authError?.message ?? 'No user found',
      })
    }

    // 2. レート制限チェック（/api/chat と共有カウンター、10 req/min）
    const appUserId = await resolveAppUserId(user.id)
    await checkMinuteRate(appUserId)

    // 3. リクエストボディ解析
    const body = await parseJsonBody<SignRequestBody>(req)
    const { mimeType, size } = body

    if (!mimeType) {
      throw new AppError(400, 'MISSING_MIME_TYPE', 'mimeType は必須です。')
    }
    if (size == null) {
      throw new AppError(400, 'MISSING_SIZE', 'size は必須です。')
    }

    // 4. バリデーション（MIME タイプ・サイズ）
    assertAllowedMimeType(mimeType)
    assertFileSize(size)

    // 5. Storage パス生成
    //    パス規約: {user_id}/{uuid}.{ext}
    //    conversation_id / message_id はチャット送信時に確定するため、
    //    署名URL発行時点では user_id + uuid で一意性を確保する。
    const ext = extFromMimeType(mimeType)
    const fileId = crypto.randomUUID()
    const storagePath = `${user.id}/${fileId}.${ext}`

    // 6. 署名 URL 発行
    const { data: signedData, error: signError } = await supabase.storage
      .from('attachments')
      .createSignedUploadUrl(storagePath)

    if (signError || !signedData) {
      throw new AppError(500, 'SIGN_URL_FAILED', '署名 URL の発行に失敗しました。', {
        originalError: signError?.message ?? 'Unknown storage error',
      })
    }

    // 7. レスポンス
    return jsonResponse(requestId, {
      signedUrl: signedData.signedUrl,
      storagePath,
      token: signedData.token,
    })
  } catch (error) {
    if (error instanceof AppError && error.status === 429) {
      void notifyError('S2', 'レート制限発動 (attachments/sign)', `${error.code}: ${error.message}`)
    }
    return errorResponse(requestId, error as Error)
  }
}
