/* eslint-disable @typescript-eslint/no-explicit-any */
import type { SupabaseClient } from '@supabase/supabase-js'

import type {
  AllowedEmailRow,
  AllowedEmailStatus,
  AppUserRow,
  AuditAllowlistRow,
  AuditGrantRow,
  Database,
} from '../types/database'

type TableName = keyof Database['public']['Tables']

type ConversationRow = Database['public']['Tables']['conversations']['Row']
type MessageRow = Database['public']['Tables']['messages']['Row']
type AttachmentRow = Database['public']['Tables']['attachments']['Row']

type TableMap = {
  allowed_email: AllowedEmailRow[]
  audit_allowlist: AuditAllowlistRow[]
  audit_grant: AuditGrantRow[]
  app_user: AppUserRow[]
  conversations: ConversationRow[]
  messages: MessageRow[]
  attachments: AttachmentRow[]
}

type FilterFn<T> = (row: T) => boolean

type SelectResponse<T> = { data: T[] | null; error: null }
type SingleResponse<T> = { data: T | null; error: { message: string } | null }

const toLower = (v: string) => v.toLowerCase()

function matchesAllowedSearch(row: AllowedEmailRow, keyword: string) {
  const k = keyword.toLowerCase()
  return row.email.toLowerCase().includes(k) || (row.label ?? '').toLowerCase().includes(k)
}

class MockQuery<T extends Record<string, any>> implements PromiseLike<SelectResponse<T>> {
  private filters: FilterFn<T>[] = []
  private orderField: keyof T | null = null
  private orderAsc = true
  private operation: 'select' | 'insert' | 'update' | 'upsert' | null = null
  private payload: any = null
  private onConflict: keyof T | undefined
  private returnRows = false
  private readonly tableName: TableName
  private readonly tables: TableMap

  constructor(tableName: TableName, tables: TableMap) {
    this.tableName = tableName
    this.tables = tables
  }

  eq(field: keyof T, value: any) {
    this.filters.push((row) => row[field] === value)
    return this
  }

  in(field: keyof T, values: any[]) {
    this.filters.push((row) => values.includes(row[field]))
    return this
  }

  or(condition: string) {
    // Support pattern: email.ilike.%keyword% OR label.ilike.%keyword%
    const match = condition.match(/\.ilike\.\%(.+)\%/)
    if (match && this.tableName === 'allowed_email') {
      const keyword = match[1]
      this.filters.push((row) => matchesAllowedSearch(row as unknown as AllowedEmailRow, keyword))
    }
    return this
  }

  order(field: keyof T, opts?: { ascending?: boolean }) {
    this.orderField = field
    this.orderAsc = opts?.ascending ?? true
    return this
  }

  select() {
    this.operation = this.operation ?? 'select'
    this.returnRows = true
    return this
  }

  insert(values: any) {
    this.operation = 'insert'
    this.payload = Array.isArray(values) ? values : [values]
    return this
  }

  update(values: Partial<T>) {
    this.operation = 'update'
    this.payload = values
    return this
  }

  upsert(values: any[], opts?: { onConflict?: keyof T }) {
    this.operation = 'upsert'
    this.payload = values
    this.onConflict = opts?.onConflict
    return this
  }

  async single(): Promise<SingleResponse<T>> {
    const res = await this.execute()
    const first = res.data?.[0] ?? null
    if (!first) {
      return { data: null, error: { message: 'No rows found' } }
    }
    return { data: first, error: null }
  }

  async maybeSingle(): Promise<SingleResponse<T>> {
    const res = await this.execute()
    const first = res.data?.[0] ?? null
    return { data: first, error: null }
  }

  then<TResult1 = SelectResponse<T>, TResult2 = never>(
    onfulfilled?: ((value: SelectResponse<T>) => TResult1 | PromiseLike<TResult1>) | null,
    onrejected?: ((reason: any) => TResult2 | PromiseLike<TResult2>) | null,
  ): Promise<TResult1 | TResult2> {
    return this.execute().then(onfulfilled, onrejected) as Promise<TResult1 | TResult2>
  }

  private async execute(): Promise<SelectResponse<T>> {
    const table = this.tables[this.tableName] as unknown as T[]
    if (this.operation === 'insert') {
      const incoming = (this.payload as T[]).map((row) => this.normalizeInsert(row))
      table.push(...incoming)
      const data = this.returnRows ? incoming : null
      return { data, error: null }
    }

    if (this.operation === 'update') {
      const updated: T[] = []
      const values = this.payload as Partial<T>
      this.tables[this.tableName] = table.map((row: T) => {
        if (this.filters.every((fn) => fn(row))) {
          const next = { ...row, ...values }
          updated.push(next)
          return next
        }
        return row
      }) as any
      const data = this.returnRows ? updated : null
      return { data, error: null }
    }

    if (this.operation === 'upsert') {
      const incoming = this.payload as T[]
      const key = this.onConflict as keyof T | undefined
      const touched: T[] = []
      incoming.forEach((row) => {
        const normalized = this.normalizeInsert(row)
        if (key) {
          const idx = table.findIndex((r) => r[key] === normalized[key])
          if (idx >= 0) {
            table[idx] = { ...table[idx], ...normalized }
            touched.push(table[idx])
            return
          }
        }
        table.push(normalized)
        touched.push(normalized)
      })
      const data = this.returnRows ? touched : null
      return { data, error: null }
    }

    // select (default)
    let data = table.filter((row) => this.filters.every((fn) => fn(row)))
    if (this.orderField) {
      const field = this.orderField
      const asc = this.orderAsc
      data = [...data].sort((a, b) => {
        if (a[field] === b[field]) return 0
        return (a[field] > b[field] ? 1 : -1) * (asc ? 1 : -1)
      })
    }
    return { data, error: null }
  }

  private normalizeInsert(row: any): T {
    if (this.tableName === 'allowed_email') {
      const r = row as AllowedEmailRow
      return {
        ...r,
        email: toLower(r.email),
        status: r.status as AllowedEmailStatus,
        updated_at: r.updated_at ?? new Date().toISOString(),
        created_at: r.created_at ?? new Date().toISOString(),
      } as any
    }
    return row as T
  }
}

class MockSupabaseAdminClient {
  private tables: TableMap = {
    allowed_email: [],
    audit_allowlist: [],
    audit_grant: [],
    app_user: [
      {
        id: 'mock-staff-id',
        auth_uid: 'mock-staff-auth',
        email: 'staff@example.com',
        display_name: 'Mock Staff',
        role: 'staff',
        created_at: new Date().toISOString(),
      },
    ],
    conversations: [],
    messages: [],
    attachments: [],
  }

  auth = {
    getUser: async (token: string) => {
      if (token === 'staff-token') {
        return {
          data: {
            user: {
              id: 'mock-staff-auth',
              email: 'staff@example.com',
              app_metadata: { role: 'staff' },
            },
          },
          error: null,
        }
      }
      return { data: { user: null }, error: { message: 'invalid token' } }
    },
    admin: {
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      updateUserById: async (userId: string, attrs: Record<string, any>) => {
        return { data: { user: {} }, error: null }
      },
    },
  }

  from(table: TableName) {
    return new MockQuery(table, this.tables)
  }
}

export function isMockSupabaseEnabled() {
  return process.env.MOCK_SUPABASE === 'true'
}

export function getMockSupabaseAdminClient(): SupabaseClient<Database> {
  return new MockSupabaseAdminClient() as unknown as SupabaseClient<Database>
}
