/** @file
 * `/api/sync-user` Route Handler
 * 機能：ログイン時にユーザーを許可リストと照合し、app_user を作成/更新する。
 *   初回作成時は allowed_email.initial_role を参照して role を設定する（GFX-42）。
 *   OPEN_REGISTRATION=true のとき、許可リスト未登録ユーザーを student として自動登録し
 *   allowed_email にも追記する（管理者が後から revoke 可能）（GFX-50）。
 *   app_metadata.role 未設定時にもリカバリ設定し、requireAuth() を通過可能にする。
 * 入力：Authorization: Bearer <token>
 * 出力：{ appUserId, role, allowedEmailStatus }
 * 依存：Supabase Auth (admin), app_user テーブル, allowed_email テーブル
 * セキュリティ：Service Role で app_metadata を更新。role の上書きは行わない。
 */

import { type NextRequest } from 'next/server'

import { AppError, errorResponse } from '../../../src/shared/lib/errors'
import { generateRequestId, getBearerToken } from '../../../src/shared/lib/request'
import { jsonResponse } from '../../../src/shared/lib/response'
import { getSupabaseAdminClient } from '../../../src/shared/lib/supabaseAdmin'
import type { AllowedEmailRow } from '../../../src/shared/types/database'

export const runtime = 'nodejs'

export async function POST(req: NextRequest) {
  const requestId = generateRequestId('sync')

  try {
    const token = getBearerToken(req)
    const supabase = getSupabaseAdminClient()

    // 1. Verify User
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser(token)

    if (authError || !user || !user.email) {
      throw new AppError(401, 'UNAUTHORIZED', 'ログインセッションが無効です。', {
        originalError: authError?.message || 'No user found',
      })
    }

    const email = user.email.toLowerCase().trim()

    // 2. Check Allowlist
    const { data: allowedEmail, error: allowlistError } = await supabase
      .from('allowed_email')
      .select('*')
      .eq('email', email)
      .maybeSingle()

    if (allowlistError) {
      console.error('Allowlist Error:', allowlistError)
      throw new AppError(500, 'INTERNAL_SERVER_ERROR', '許可リストの確認中にエラーが発生しました。')
    }

    // OPEN_REGISTRATION=true のとき、許可リスト未登録ユーザーをそのまま通す
    const openRegistration = process.env.OPEN_REGISTRATION === 'true'

    if (!allowedEmail) {
      if (!openRegistration) {
        // 許可リスト制: 未登録ユーザーはブロック
        throw new AppError(403, 'ALLOWLIST_NOT_FOUND', '許可されていないメールアドレスです。', {
          email,
        })
      }
      // オープン登録: 許可リスト未登録でも student として登録して通す
      // allowed_email にも追記することで管理者が後から一覧・revoke できる
      const { error: allowlistInsertError } = await supabase
        .from('allowed_email')
        .insert({
          email,
          status: 'active',
          initial_role: 'student',
          notes: 'open_registration',
        })
      if (allowlistInsertError) {
        // 競合（同一メアドが同時登録）は無視。致命的ではないのでログのみ
        console.error('Failed to insert open registration to allowed_email:', allowlistInsertError.message)
      }

      const { data: newUser, error: insertError } = await supabase
        .from('app_user')
        .insert({ auth_uid: user.id, email, role: 'student' })
        .select('id, role')
        .single()

      if (insertError) throw new Error(insertError.message)
      if (!newUser) throw new Error('Failed to create user')

      const { error: metaError } = await supabase.auth.admin.updateUserById(
        user.id,
        { app_metadata: { role: 'student' } },
      )
      if (metaError) {
        console.error('Failed to set app_metadata.role:', metaError.message)
      }

      return jsonResponse(requestId, {
        appUserId: newUser.id,
        role: 'student',
        allowedEmailStatus: 'open',
      })
    }

    const allowRow = allowedEmail as AllowedEmailRow

    // 3. Logic Branch by Status
    switch (allowRow.status) {
      case 'revoked':
        throw new AppError(403, 'ALLOWLIST_REVOKED', 'アカウントが停止されています。', {
          email,
          notes: allowRow.notes || null,
        })
      case 'pending':
        throw new AppError(409, 'ALLOWLIST_PENDING', '利用開始準備中です。', { email })
      case 'active':
        // OK, proceed
        break
      default:
        throw new AppError(403, 'ALLOWLIST_Review', '不明なステータスです。')
    }

    // 4. Upsert App User
    // We want to insert if not exists, or update email if exists.
    // Important: We should NOT overwrite 'role' if it's already set (e.g. to 'staff').
    // Postgres ON CONFLICT DO UPDATE...
    
    // First, try to select to see if user exists, because simple upsert from JS client
    // might be tricky to "update only email, keep role".
    // Actually, simple upsert with ignoreDuplicates: false updates all fields provided.
    // If we only provide { auth_uid, email }, other fields like 'role' might not be touched provided they are not in the payload?
    // No, upsert usually requires all required fields for insert.
    // Let's use clean approach:
    
    const { data: existingUser } = await supabase
      .from('app_user')
      .select('id, role')
      .eq('auth_uid', user.id)
      .single()

    let appUserData: { id: string; role: string }

    if (existingUser) {
      // Exist: Update email only (if changed)
      const { error: updateError } = await supabase
        .from('app_user')
        .update({ email })
        .eq('id', existingUser.id)

      if (updateError) throw new Error(updateError.message)

      // app_metadata.role が未設定の場合はリカバリ設定（GFX-35 以前のユーザー対応）
      const currentRole = (
        user.app_metadata as Record<string, string | undefined>
      )?.role
      if (currentRole !== existingUser.role) {
        const { error: metaError } = await supabase.auth.admin.updateUserById(
          user.id,
          { app_metadata: { role: existingUser.role } },
        )
        if (metaError) {
          console.error('Failed to set app_metadata.role:', metaError.message)
        }
      }

      appUserData = { id: existingUser.id, role: existingUser.role }
    } else {
      // New: Insert (role from allowed_email.initial_role, defaults to 'student')
      const initialRole = allowRow.initial_role || 'student'
      const { data: newUser, error: insertError } = await supabase
        .from('app_user')
        .insert({
          auth_uid: user.id,
          email: email,
          role: initialRole,
        })
        .select('id, role')
        .single()

      if (insertError) throw new Error(insertError.message)
      if (!newUser) throw new Error('Failed to create user')

      // Supabase Auth の app_metadata.role を設定（requireAuth() が参照するため必須）
      const { error: metaError } = await supabase.auth.admin.updateUserById(
        user.id,
        { app_metadata: { role: newUser.role } },
      )
      if (metaError) {
        console.error('Failed to set app_metadata.role:', metaError.message)
        // app_user は作成済みなのでエラーにしない。次回ログイン時にリカバリされる。
      }

      appUserData = { id: newUser.id, role: newUser.role }
    }

    return jsonResponse(requestId, {
      appUserId: appUserData.id,
      role: appUserData.role,
      allowedEmailStatus: allowRow.status,
    })

  } catch (error) {
    return errorResponse(requestId, error as Error)
  }
}
