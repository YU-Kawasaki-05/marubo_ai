/** @file
 * ブラウザ用の Supabase クライアント生成。
 * 入力：public env (`NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`)
 * 出力：`createClient` のインスタンス。
 * 依存：`@supabase/supabase-js`
 * セキュリティ：public key のみ利用。Service Role は別ファイルで管理する。
 */

import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import type { Database } from '../types/database'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

let cachedClient: SupabaseClient<Database> | null = null

export function getSupabaseBrowserClient(): SupabaseClient<Database> {
  if (cachedClient) {
    return cachedClient
  }

  if (!supabaseUrl || !supabaseAnonKey) {
    throw new Error('Supabase public env (NEXT_PUBLIC_SUPABASE_URL / NEXT_PUBLIC_SUPABASE_ANON_KEY) が未設定です。')
  }

  cachedClient = createClient<Database>(supabaseUrl, supabaseAnonKey)
  return cachedClient
}

export const isSupabaseBrowserClientConfigured = Boolean(supabaseUrl && supabaseAnonKey)
