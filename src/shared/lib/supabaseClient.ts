/** @file
 * ブラウザ用の Supabase クライアント生成。
 * 入力：public env (`NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`)
 * 出力：`createClient` のインスタンス。
 * 依存：`@supabase/supabase-js`
 * セキュリティ：public key のみ利用。Service Role は別ファイルで管理する。
 */

import { createClient } from '@supabase/supabase-js'
import type { Database } from '../types/database'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

if (!supabaseUrl || !supabaseAnonKey) {
  // eslint-disable-next-line no-console
  console.warn('Supabase public env is not configured.')
}

export const supabaseBrowserClient = createClient<Database>(
  supabaseUrl ?? '',
  supabaseAnonKey ?? '',
)
