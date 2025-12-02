/** @file
 * Service Role 用 Supabase クライアント。
 * 入力：`SUPABASE_URL` と `SUPABASE_SERVICE_ROLE_KEY`
 * 出力：サーバーサイドで共有する管理クライアント。
 * 依存：@supabase/supabase-js、env helper。
 * セキュリティ：Service Role キーは Node.js からのみ参照し、クライアントに渡さない。
 */

import { createClient, type SupabaseClient } from '@supabase/supabase-js'

import type { Database } from '../types/database'
import { requireEnv } from './env'

let adminClient: SupabaseClient<Database> | null = null

export function getSupabaseAdminClient(): SupabaseClient<Database> {
  if (adminClient) return adminClient
  const url = requireEnv('SUPABASE_URL')
  const serviceRoleKey = requireEnv('SUPABASE_SERVICE_ROLE_KEY')

  adminClient = createClient<Database>(url, serviceRoleKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
      detectSessionInUrl: false,
    },
  })

  return adminClient
}
