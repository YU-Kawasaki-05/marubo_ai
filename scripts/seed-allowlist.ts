/** @file
 * Allowlist 一括登録スクリプト。
 * 機能: CSV ファイルを読み込み、allowed_email テーブルに upsert する。
 * 入力: CSV ファイルパス（省略時は scripts/data/allowlist.sample.csv）。
 * 出力: コンソールに処理結果を出力。
 * 依存: env(.env.local), Supabase Service Role, allowlist ドメインサービス。
 * セキュリティ: Service Role 使用のため本番実行時は注意。--dry-run で事前確認を推奨。
 *
 * 使い方:
 *   npx tsx scripts/seed-allowlist.ts                          # サンプル CSV で本実行
 *   npx tsx scripts/seed-allowlist.ts --dry-run                # サンプル CSV で dry-run（DB 書き込みなし）
 *   npx tsx scripts/seed-allowlist.ts path/to/data.csv         # 指定 CSV で本実行
 *   npx tsx scripts/seed-allowlist.ts --dry-run path/to/data.csv  # 指定 CSV で dry-run
 */

import fs from 'fs'
import path from 'path'

import dotenv from 'dotenv'

import { importAllowlistCsv, parseAllowlistCsv } from '../src/shared/lib/allowlist'
import { getSupabaseAdminClient } from '../src/shared/lib/supabaseAdmin'

// Load environment variables from .env.local
dotenv.config({ path: '.env.local' })

const SEED_USER_EMAIL = 'seed-bot@example.com'
const SEED_USER_ID = '00000000-0000-0000-0000-000000000001' // Fixed UUID for repeatability

/** argv から --dry-run フラグと CSV パスを解析 */
export function parseArgs(argv: string[]): { dryRun: boolean; csvPath: string } {
  const args = argv.slice(2) // node, script を除外
  const dryRun = args.includes('--dry-run')
  const csvArg = args.find((a) => a !== '--dry-run')
  const csvPath = csvArg || path.join(__dirname, 'data', 'allowlist.sample.csv')
  return { dryRun, csvPath }
}

async function main() {
  const { dryRun, csvPath } = parseArgs(process.argv)

  if (dryRun) {
    console.log('=== DRY-RUN MODE（DB への書き込みは行いません）===\n')
  }

  console.log('1. Reading CSV...')
  if (!fs.existsSync(csvPath)) {
    console.error(`CSV file not found at: ${csvPath}`)
    process.exit(1)
  }
  console.log(`   File: ${csvPath}`)

  const csvContent = fs.readFileSync(csvPath, 'utf-8')

  console.log('2. Parsing & validating CSV...')
  const records = parseAllowlistCsv(csvContent)
  console.log(`   Found ${records.length} valid records.`)

  // レコードのサマリーを表示
  console.log('\n   --- Records ---')
  records.forEach((r) => {
    console.log(`   Row ${r.rowNumber}: ${r.email} (status: ${r.status ?? 'pending'}, label: ${r.label ?? '-'})`)
  })
  console.log('   ---------------\n')

  if (dryRun) {
    console.log('✅ DRY-RUN 完了: CSV のパースとバリデーションに成功しました。')
    console.log(`   ${records.length} 件のレコードが import 可能です。`)
    console.log('   本実行するには --dry-run を外して再度実行してください。')
    return
  }

  // ── 以下は本実行のみ ──

  console.log('3. Ensuring Seed User (Staff) exists...')
  const adminClient = getSupabaseAdminClient()
  const { error: userError } = await adminClient.from('app_user').upsert({
    id: SEED_USER_ID,
    email: SEED_USER_EMAIL,
    auth_uid: '00000000-0000-0000-0000-000000000001', // Dummy Auth UID
    role: 'staff',
    display_name: 'Seed Bot',
  })

  if (userError) {
    console.error('Failed to create seed user:', userError)
    process.exit(1)
  }
  console.log('   Seed user ready.')

  console.log('4. Importing to Supabase...')
  try {
    const result = await importAllowlistCsv(records, {
      mode: 'upsert',
      staffUserId: SEED_USER_ID,
      requestId: 'script-seed-001',
    })
    console.log('   Success!')
    console.log(`   Inserted: ${result.inserted}, Updated: ${result.updated}`)
  } catch (err: unknown) {
    console.error('   Import failed:')
    const error = err as Error & { details?: unknown }
    console.error(error.message)
    if (error.details) console.error(error.details)
    process.exit(1)
  }
}

// テストから import された場合は main() を実行しない
const isDirectRun = process.argv[1]?.includes('seed-allowlist')
if (isDirectRun) {
  main().catch((err) => {
    console.error(err)
    process.exit(1)
  })
}
