/** @file
 * Staff authorization helper for Service Role APIs.
 * Input: Next.js `Request` containing `Authorization: Bearer <supabase_access_token>`.
 * Output: verified staff user context (Supabase auth UID + `app_user.id`).
 * Dependencies: Supabase admin client, request helpers, AppError class.
 * Security: ensures only Supabase users with `app_metadata.role = 'staff'` can proceed.
 */

import { AppError } from './errors'
import { getSupabaseAdminClient } from './supabaseAdmin'
import { getBearerToken } from './request'

type StaffContext = {
  authUserId: string
  appUserId: string
  email: string
}

export async function requireStaff(request: Request): Promise<StaffContext> {
  let token: string
  try {
    token = getBearerToken(request)
  } catch {
    throw new AppError(401, 'UNAUTHORIZED', 'Authorization ヘッダがありません。')
  }

  const supabase = getSupabaseAdminClient()
  const { data: authUser, error } = await supabase.auth.getUser(token)
  if (error || !authUser.user) {
    throw new AppError(401, 'UNAUTHORIZED', 'ログイン情報を確認できませんでした。')
  }

  if ((authUser.user.app_metadata as Record<string, string | undefined>)?.role !== 'staff') {
    throw new AppError(403, 'FORBIDDEN', 'スタッフ権限が必要です。')
  }

  const { data: appUser, error: userError } = await supabase
    .from('app_user')
    .select('id, email')
    .eq('auth_uid', authUser.user.id)
    .single()

  if (userError || !appUser) {
    throw new AppError(403, 'FORBIDDEN', 'スタッフユーザーを特定できませんでした。')
  }

  return {
    authUserId: authUser.user.id,
    appUserId: appUser.id,
    email: appUser.email,
  }
}
