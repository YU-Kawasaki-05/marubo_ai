/** @file
 * Grant domain service for admin grant/revoke API routes.
 * 入力: スタッフ権限操作リクエスト（email, action）および操作者コンテキスト。
 * 出力: app_user.role 更新 + auth.admin.updateUserById + audit_grant 記録。
 * 依存: Supabase Service Role クライアント、AppError。
 * セキュリティ: GRANT_ALLOWED_EMAILS でホワイトリスト制御。自己解除を防止。
 */

import type { AppUserRole, Database } from '../types/database'

import { AppError } from './errors'
import { getSupabaseAdminClient } from './supabaseAdmin'

type GrantAction = 'grant' | 'revoke'

export type GrantPayload = {
  email: string
  action: GrantAction
}

type GrantResult = {
  email: string
  previousRole: AppUserRole
  newRole: AppUserRole
  note: string
}

type StaffUserEntry = {
  email: string
  displayName: string | null
  role: AppUserRole
  grantedAt: string
}

type AuditLogEntry = {
  id: string
  operatorEmail: string
  targetEmail: string
  action: GrantAction
  createdAt: string
}

type GrantListResult = {
  staffUsers: StaffUserEntry[]
  auditLog: AuditLogEntry[]
}

function getGrantAllowedEmails(): string[] {
  const raw = process.env.GRANT_ALLOWED_EMAILS ?? ''
  if (!raw.trim()) return []
  return raw
    .split(';')
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean)
}

export function assertGrantAllowed(operatorEmail: string) {
  const allowed = getGrantAllowedEmails()
  if (!allowed.includes(operatorEmail.toLowerCase())) {
    throw new AppError(403, 'GRANT_NOT_ALLOWED', 'この操作を行う権限がありません。')
  }
}

export async function executeGrant(
  payload: GrantPayload,
  operator: { appUserId: string; email: string },
  requestId: string,
): Promise<GrantResult> {
  const { action, email } = payload

  if (!action || !['grant', 'revoke'].includes(action)) {
    throw new AppError(400, 'INVALID_ACTION', 'action は grant または revoke を指定してください。')
  }

  if (!email || !email.trim()) {
    throw new AppError(400, 'EMAIL_REQUIRED', 'メールアドレスを入力してください。')
  }

  const normalizedEmail = email.trim().toLowerCase()

  if (action === 'revoke' && operator.email.toLowerCase() === normalizedEmail) {
    throw new AppError(400, 'SELF_REVOKE_FORBIDDEN', '自分自身の権限を解除することはできません。')
  }

  const supabase = getSupabaseAdminClient()

  const { data: targetUser, error: targetError } = await supabase
    .from('app_user')
    .select('id, auth_uid, email, role')
    .eq('email', normalizedEmail)
    .single()

  if (targetError || !targetUser) {
    throw new AppError(404, 'USER_NOT_FOUND', '対象のユーザーが見つかりません。')
  }

  const currentRole = targetUser.role as AppUserRole
  const newRole: AppUserRole = action === 'grant' ? 'staff' : 'student'

  if (action === 'grant' && currentRole === 'staff') {
    throw new AppError(409, 'ALREADY_STAFF', 'このユーザーは既にスタッフです。')
  }

  if (action === 'revoke' && currentRole === 'student') {
    throw new AppError(409, 'ALREADY_STUDENT', 'このユーザーは既に生徒です。')
  }

  const { error: updateError } = await supabase
    .from('app_user')
    .update({ role: newRole })
    .eq('id', targetUser.id)

  if (updateError) {
    throw new AppError(500, 'ROLE_UPDATE_FAILED', 'ロールの更新に失敗しました。')
  }

  const { error: authError } = await supabase.auth.admin.updateUserById(targetUser.auth_uid, {
    app_metadata: { role: newRole },
  })

  if (authError) {
    await supabase.from('app_user').update({ role: currentRole }).eq('id', targetUser.id)
    throw new AppError(500, 'AUTH_UPDATE_FAILED', 'Auth メタデータの更新に失敗しました。ロールをロールバックしました。')
  }

  const { error: auditError } = await supabase.from('audit_grant').insert({
    request_id: requestId,
    operator_user_id: operator.appUserId,
    target_user_id: targetUser.id,
    action,
    prev_role: currentRole,
    new_role: newRole,
  } as Database['public']['Tables']['audit_grant']['Insert'])

  if (auditError) {
    console.error('Failed to insert audit_grant log', auditError)
  }

  return {
    email: normalizedEmail,
    previousRole: currentRole,
    newRole,
    note: '対象ユーザーは再ログインが必要です',
  }
}

export async function listGrantInfo(): Promise<GrantListResult> {
  const supabase = getSupabaseAdminClient()

  const { data: staffUsers, error: staffError } = await supabase
    .from('app_user')
    .select('id, email, display_name, role, created_at')
    .eq('role', 'staff')
    .order('created_at', { ascending: true })

  if (staffError) {
    throw new AppError(500, 'STAFF_LIST_FAILED', 'スタッフ一覧を取得できませんでした。')
  }

  const { data: auditLogs, error: auditError } = await supabase
    .from('audit_grant')
    .select('id, operator_user_id, target_user_id, action, created_at')
    .order('created_at', { ascending: false })

  if (auditError) {
    throw new AppError(500, 'AUDIT_LOG_FAILED', '監査ログを取得できませんでした。')
  }

  const userIds = new Set<string>()
  for (const log of auditLogs ?? []) {
    userIds.add(log.operator_user_id)
    userIds.add(log.target_user_id)
  }

  let emailMap = new Map<string, string>()
  if (userIds.size > 0) {
    const { data: users } = await supabase
      .from('app_user')
      .select('id, email')
      .in('id', Array.from(userIds))

    emailMap = new Map((users ?? []).map((u) => [u.id, u.email]))
  }

  return {
    staffUsers: (staffUsers ?? []).map((u) => ({
      email: u.email,
      displayName: u.display_name,
      role: u.role as AppUserRole,
      grantedAt: u.created_at,
    })),
    auditLog: (auditLogs ?? []).map((log) => ({
      id: log.id,
      operatorEmail: emailMap.get(log.operator_user_id) ?? 'unknown',
      targetEmail: emailMap.get(log.target_user_id) ?? 'unknown',
      action: log.action as GrantAction,
      createdAt: log.created_at,
    })),
  }
}
