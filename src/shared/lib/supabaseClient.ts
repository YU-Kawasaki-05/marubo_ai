/** @file
 * ブラウザ用の Supabase クライアント生成。
 * 入力：public env (`NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`)
 * 出力：`createBrowserClient` のインスタンス（cookie ベースセッション管理）。
 * 依存：`@supabase/ssr`
 * セキュリティ：public key のみ利用。Service Role は別ファイルで管理する。
 * 注意：middleware.ts と連携するため @supabase/ssr の createBrowserClient を使用。
 *   localStorage ではなく cookie にセッションを保存し、SSR/Middleware で読み取り可能にする。
 */

import { createBrowserClient } from '@supabase/ssr'
import type { SupabaseClient } from '@supabase/supabase-js'

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

  cachedClient = createBrowserClient<Database>(supabaseUrl, supabaseAnonKey)
  return cachedClient
}

export const isSupabaseBrowserClientConfigured = Boolean(supabaseUrl && supabaseAnonKey)
