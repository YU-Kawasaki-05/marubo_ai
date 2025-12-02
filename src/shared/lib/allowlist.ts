/** @file
 * Allowlist domain service shared by admin API routes.
 * 入力: Allowlist API から渡される検索/登録/更新/CSV データ。
 * 出力: Supabase `allowed_email` / `audit_allowlist` テーブルへの副作用結果。
 * 依存: Supabase Service Role クライアント、AppError（ドメインエラー）、requestId 生成元。
 * セキュリティ: すべてのメールは lowercase/trim して比較。Service Role での書き込み時に WHERE を必ず指定。
 */

import { AppError } from './errors'
import { getSupabaseAdminClient } from './supabaseAdmin'
import type {
  AllowedEmailRow,
  AllowedEmailStatus,
  Database,
} from '../types/database'

const EMAIL_MAX_LENGTH = 320
const LABEL_MAX_LENGTH = 64
const NOTES_MAX_LENGTH = 512
const STATUS_VALUES: AllowedEmailStatus[] = ['active', 'pending', 'revoked']

export type AllowlistQueryParams = {
  status?: AllowedEmailStatus
  search?: string
}

export type CreateAllowlistPayload = {
  email: string
  status: AllowedEmailStatus
  label?: string | null
  notes?: string | null
}

export type UpdateAllowlistPayload = {
  status?: AllowedEmailStatus
  label?: string | null
  notes?: string | null
}

export type CsvMode = 'insert' | 'upsert'

export type CsvRecord = {
  email: string
  status?: AllowedEmailStatus
  label?: string
  notes?: string
  rowNumber: number
}

export function normalizeEmail(email: string) {
  return email.trim().toLowerCase()
}

export async function listAllowlistEntries(params: AllowlistQueryParams) {
  const supabase = getSupabaseAdminClient()
  let query = supabase
    .from('allowed_email')
    .select('*')
    .order('updated_at', { ascending: false })

  if (params.status) {
    query = query.eq('status', params.status)
  }

  if (params.search) {
    const keyword = params.search.trim()
    query = query.or(`email.ilike.%${keyword}%,label.ilike.%${keyword}%`)
  }

  const { data, error } = await query
  if (error) {
    throw new AppError(500, 'ALLOWLIST_FETCH_FAILED', '許可リストを取得できませんでした。')
  }

  return data ?? []
}

export async function createAllowlistEntry(
  payload: CreateAllowlistPayload,
  staffUserId: string,
  requestId: string,
) {
  const supabase = getSupabaseAdminClient()
  const normalizedEmail = normalizeEmail(assertEmail(payload.email))
  const status = assertStatus(payload.status)
  const label = ensureMaxLength(payload.label, LABEL_MAX_LENGTH)
  const notes = ensureMaxLength(payload.notes, NOTES_MAX_LENGTH)

  await assertNotExistingEmail(normalizedEmail)
  const now = new Date().toISOString()

  const { data, error } = await supabase
    .from('allowed_email')
    .insert({
      email: normalizedEmail,
      status,
      label,
      notes,
      created_by: staffUserId,
      updated_at: now,
    })
    .select('*')
    .single()

  const inserted = data as AllowedEmailRow | null

  if (error || !inserted) {
    throw new AppError(500, 'ALLOWLIST_INSERT_FAILED', '許可リストを登録できませんでした。')
  }

  await recordAuditLog({
    requestId,
    operation: 'insert',
    email: normalizedEmail,
    staffUserId,
    prev: null,
    next: summarizeAllowlistRow(inserted),
  })

  return inserted
}

export async function updateAllowlistEntry(
  email: string,
  payload: UpdateAllowlistPayload,
  staffUserId: string,
  requestId: string,
) {
  if (!payload.status && payload.label == null && payload.notes == null) {
    throw new AppError(400, 'ALLOWLIST_EMPTY_UPDATE', '更新項目を 1 つ以上指定してください。')
  }

  const supabase = getSupabaseAdminClient()
  const normalizedEmail = normalizeEmail(assertEmail(email))

  const { data: existing, error: existingError } = await supabase
    .from('allowed_email')
    .select('*')
    .eq('email', normalizedEmail)
    .single()

  const currentRow = existing as AllowedEmailRow | null

  if (existingError || !currentRow) {
    throw new AppError(404, 'ALLOWLIST_NOT_FOUND', '対象のメールアドレスが存在しません。')
  }

  const nextStatus = payload.status ? assertStatus(payload.status) : currentRow.status
  assertStatusTransition(currentRow.status as AllowedEmailStatus, nextStatus)
  const label =
    payload.label !== undefined ? ensureMaxLength(payload.label, LABEL_MAX_LENGTH) : currentRow.label
  const notes =
    payload.notes !== undefined ? ensureMaxLength(payload.notes, NOTES_MAX_LENGTH) : currentRow.notes
  const now = new Date().toISOString()

  const { data, error } = await supabase
    .from('allowed_email')
    .update({
      status: nextStatus,
      label,
      notes,
      updated_at: now,
    })
    .eq('email', normalizedEmail)
    .select('*')
    .single()

  const updated = data as AllowedEmailRow | null

  if (error || !updated) {
    throw new AppError(500, 'ALLOWLIST_UPDATE_FAILED', '許可リストを更新できませんでした。')
  }

  await recordAuditLog({
    requestId,
    operation: 'update',
    email: normalizedEmail,
    staffUserId,
    prev: summarizeAllowlistRow(currentRow),
    next: summarizeAllowlistRow(updated),
  })

  return updated
}

export function parseAllowlistCsv(csvText: string): CsvRecord[] {
  if (!csvText || !csvText.trim()) {
    throw new AppError(400, 'CSV_EMPTY', 'CSV ファイルが空です。')
  }

  const rows = parseCsv(csvText.trim())
  if (!rows.length) {
    throw new AppError(400, 'CSV_EMPTY', 'CSV の行が見つかりません。')
  }

  const header = rows[0].map((h) => h.trim().toLowerCase())
  if (!header.includes('email')) {
    throw new AppError(400, 'CSV_MISSING_EMAIL', '必須列 email が存在しません。')
  }

  const records: CsvRecord[] = []
  for (let i = 1; i < rows.length; i += 1) {
    const cells = rows[i]
    if (cells.every((c) => !c || !c.trim())) continue

    const record: CsvRecord = {
      email: '',
      rowNumber: i + 1,
    }

    header.forEach((column, idx) => {
      const value = cells[idx]?.trim() ?? ''
      if (column === 'email') {
        record.email = normalizeEmail(assertEmail(value))
      } else if (column === 'status' && value) {
        record.status = assertStatus(value as AllowedEmailStatus)
      } else if (column === 'label') {
        record.label = ensureMaxLength(value, LABEL_MAX_LENGTH) ?? undefined
      } else if (column === 'notes') {
        record.notes = ensureMaxLength(value, NOTES_MAX_LENGTH) ?? undefined
      }
    })

    if (!record.email) {
      throw new AppError(400, 'CSV_INVALID_EMAIL', `Row ${record.rowNumber} の email が空です。`)
    }

    records.push(record)
  }

  if (!records.length) {
    throw new AppError(400, 'CSV_EMPTY', '有効な行がありません。')
  }

  checkCsvDuplicates(records)
  return records
}

export async function importAllowlistCsv(
  records: CsvRecord[],
  options: { mode: CsvMode; staffUserId: string; requestId: string },
) {
  const supabase = getSupabaseAdminClient()
  const emails = records.map((record) => record.email)
  const payloads = records.map((record) => ({
    email: record.email,
    status: record.status ?? 'pending',
    label: record.label ?? null,
    notes: record.notes ?? null,
    created_by: options.staffUserId,
    updated_at: new Date().toISOString(),
  }))

  if (options.mode === 'insert') {
    const existing = await fetchExistingEmails(emails)
    if (existing.length) {
      throw new AppError(409, 'ALLOWLIST_EXISTS', '既に登録済みのメールが含まれています。', {
        emails: existing.join(','),
      })
    }

    const { data, error } = await supabase.from('allowed_email').insert(payloads).select('*')
    const insertedRows = (data ?? []) as AllowedEmailRow[]
    if (error) {
      throw new AppError(500, 'ALLOWLIST_INSERT_FAILED', 'CSV の取り込みに失敗しました。')
    }

    await Promise.all(
      insertedRows.map((row) =>
        recordAuditLog({
          requestId: options.requestId,
          operation: 'csv-import',
          email: row.email,
          staffUserId: options.staffUserId,
          prev: null,
          next: summarizeAllowlistRow(row),
        }),
      ),
    )

    return { inserted: insertedRows.length, updated: 0 }
  }

  const { data: previousRows } = await supabase
    .from('allowed_email')
    .select('*')
    .in('email', emails)

  const prevRows = (previousRows ?? []) as AllowedEmailRow[]
  const prevMap = new Map(prevRows.map((row) => [row.email, summarizeAllowlistRow(row)]))

  const { data, error } = await supabase
    .from('allowed_email')
    .upsert(payloads, { onConflict: 'email' })
    .select('*')

  const upsertedRows = (data ?? []) as AllowedEmailRow[]

  if (error) {
    throw new AppError(500, 'ALLOWLIST_UPSERT_FAILED', 'CSV の上書きに失敗しました。')
  }

  await Promise.all(
    upsertedRows.map((row) =>
      recordAuditLog({
        requestId: options.requestId,
        operation: 'csv-import',
        email: row.email,
        staffUserId: options.staffUserId,
        prev: prevMap.get(row.email) ?? null,
        next: summarizeAllowlistRow(row),
      }),
    ),
  )

  const updatedCount = upsertedRows.filter((row) => prevMap.has(row.email)).length
  const insertedCount = upsertedRows.length - updatedCount
  return { inserted: insertedCount, updated: updatedCount }
}

function assertEmail(value: string) {
  if (!value || !value.trim()) {
    throw new AppError(400, 'EMAIL_REQUIRED', 'メールアドレスを入力してください。')
  }

  const trimmed = value.trim()
  if (trimmed.length > EMAIL_MAX_LENGTH) {
    throw new AppError(400, 'EMAIL_TOO_LONG', 'メールアドレスが長すぎます。')
  }

  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmed)) {
    throw new AppError(400, 'EMAIL_INVALID', 'メールアドレスの形式が正しくありません。')
  }

  return trimmed
}

function assertStatus(value: AllowedEmailStatus) {
  const normalized = value.toLowerCase() as AllowedEmailStatus
  if (!STATUS_VALUES.includes(normalized)) {
    throw new AppError(400, 'STATUS_INVALID', 'status は active/pending/revoked のいずれかです。')
  }
  return normalized
}

async function assertNotExistingEmail(email: string) {
  const supabase = getSupabaseAdminClient()
  const { data } = await supabase.from('allowed_email').select('email').eq('email', email).maybeSingle()
  if (data) {
    throw new AppError(409, 'ALLOWLIST_EXISTS', '既に登録済みのメールです。')
  }
}

function ensureMaxLength(value: string | null | undefined, max: number) {
  if (value == null) return null
  const trimmed = value.trim()
  if (!trimmed) return null
  if (trimmed.length > max) {
    throw new AppError(400, 'FIELD_TOO_LONG', `入力値が長すぎます（最大 ${max} 文字）。`)
  }
  return trimmed
}

function assertStatusTransition(current: AllowedEmailStatus, next: AllowedEmailStatus) {
  if (current === next) return

  const allowed: Record<AllowedEmailStatus, AllowedEmailStatus[]> = {
    pending: ['active'],
    active: ['revoked'],
    revoked: ['active'],
  }

  if (!allowed[current]?.includes(next)) {
    throw new AppError(400, 'STATUS_TRANSITION_FORBIDDEN', 'この status 変更は許可されていません。')
  }
}

async function fetchExistingEmails(emails: string[]) {
  if (!emails.length) return []
  const supabase = getSupabaseAdminClient()
  const { data } = await supabase.from('allowed_email').select('email').in('email', emails)
  return (data ?? []).map((row) => row.email)
}

function checkCsvDuplicates(records: CsvRecord[]) {
  const seen = new Map<string, number>()
  const duplicates: { email: string; row: number; duplicateRow: number }[] = []

  records.forEach((record) => {
    const row = seen.get(record.email)
    if (row) {
      duplicates.push({ email: record.email, row, duplicateRow: record.rowNumber })
    } else {
      seen.set(record.email, record.rowNumber)
    }
  })

  if (duplicates.length) {
    throw new AppError(400, 'CSV_DUPLICATED_IN_FILE', 'CSV に同じメールが複数含まれています。', {
      duplicates: duplicates.map((dup) => `${dup.email}(rows ${dup.row},${dup.duplicateRow})`).join(', '),
    })
  }
}

function summarizeAllowlistRow(row: AllowedEmailRow): AllowedEmailRow {
  return {
    email: row.email,
    status: row.status,
    label: row.label,
    invited_at: row.invited_at,
    expires_at: row.expires_at,
    notes: row.notes,
    created_by: row.created_by,
    updated_at: row.updated_at,
    created_at: row.created_at,
  }
}

async function recordAuditLog(params: {
  requestId: string
  operation: 'insert' | 'update' | 'csv-import'
  email: string
  staffUserId: string
  prev: Record<string, unknown> | null
  next: Record<string, unknown> | null
}) {
  const supabase = getSupabaseAdminClient()
  const { error } = await supabase.from('audit_allowlist').insert({
    request_id: params.requestId,
    operation: params.operation,
    email: params.email,
    staff_user_id: params.staffUserId,
    prev: params.prev,
    next: params.next,
  } as Database['public']['Tables']['audit_allowlist']['Insert'])

  if (error) {
    console.error('Failed to insert audit log', error)
  }
}

function parseCsv(text: string) {
  const rows: string[][] = []
  let current = ''
  const row: string[] = []
  let inQuotes = false

  const pushField = () => {
    row.push(current)
    current = ''
  }

  const pushRow = () => {
    if (row.length) {
      rows.push([...row])
    }
    row.length = 0
  }

  for (let i = 0; i < text.length; i += 1) {
    const char = text[i]
    if (inQuotes) {
      if (char === '"') {
        if (text[i + 1] === '"') {
          current += '"'
          i += 1
        } else {
          inQuotes = false
        }
      } else {
        current += char
      }
      continue
    }

    if (char === '"') {
      inQuotes = true
      continue
    }

    if (char === ',') {
      pushField()
      continue
    }

    if (char === '\r') {
      continue
    }

    if (char === '\n') {
      pushField()
      pushRow()
      continue
    }

    current += char
  }

  pushField()
  pushRow()

  return rows.filter((r) => r.length)
}
