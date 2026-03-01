/** @file
 * 認証ヘルパー（ロール問わず）。
 * 入力: Next.js `Request` の `Authorization: Bearer <token>`。
 * 出力: ユーザーコンテキスト（authUserId, appUserId, email, role）。
 * 依存: Supabase admin client, request helpers, AppError。
 * セキュリティ: トークン検証＋app_user 解決。ロール制限は呼び出し元で判断。
 */

import type { AppUserRow } from '../types/database'

import { AppError } from './errors'
import { getBearerToken } from './request'
import { getSupabaseAdminClient } from './supabaseAdmin'

export type AuthContext = {
  authUserId: string
  appUserId: string
  email: string
  role: 'student' | 'staff'
}

export async function requireAuth(request: Request): Promise<AuthContext> {
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

  const role = (authUser.user.app_metadata as Record<string, string | undefined>)?.role
  if (role !== 'student' && role !== 'staff') {
    throw new AppError(403, 'FORBIDDEN', 'ユーザーロールを特定できませんでした。')
  }

  const { data: appUser, error: userError } = await supabase
    .from('app_user')
    .select()
    .eq('auth_uid', authUser.user.id)
    .single()

  if (userError || !appUser) {
    throw new AppError(403, 'FORBIDDEN', 'ユーザーを特定できませんでした。')
  }

  const u = appUser as AppUserRow

  return {
    authUserId: authUser.user.id,
    appUserId: u.id,
    email: u.email,
    role,
  }
}
