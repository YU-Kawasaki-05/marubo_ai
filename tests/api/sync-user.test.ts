import { beforeEach, describe, expect, it, vi } from 'vitest'

/* eslint-disable @typescript-eslint/no-explicit-any */

const mockState = vi.hoisted(() => ({
  appUsers: [] as Array<Record<string, unknown>>,
  allowedEmails: [] as Array<Record<string, unknown>>,
  updateUserByIdCalls: [] as Array<{ userId: string; attrs: Record<string, any> }>,
  updateUserByIdShouldFail: false,
  authUser: null as Record<string, unknown> | null,
}))

class MockQuery {
  private readonly table: string
  private filters: Array<(row: Record<string, unknown>) => boolean> = []
  private returnSelect = false

  constructor(table: string) {
    this.table = table
  }

  select() {
    this.returnSelect = true
    return this
  }

  eq(field: string, value: unknown) {
    this.filters.push((row) => row[field] === value)
    return this
  }

  insert(values: Record<string, unknown> | Array<Record<string, unknown>>) {
    const rows = Array.isArray(values) ? values : [values]
    const table = this.getTable()
    rows.forEach((row) => {
      table.push({
        id: `new-${Date.now()}`,
        role: 'student',
        created_at: new Date().toISOString(),
        ...row,
      })
    })
    return this
  }

  update(values: Record<string, unknown>) {
    const table = this.getTable()
    const matched = table.filter((row) => this.filters.every((fn) => fn(row)))
    matched.forEach((row) => Object.assign(row, values))
    return this
  }

  async single() {
    const table = this.getTable()
    const data = table.filter((row) => this.filters.every((fn) => fn(row)))
    if (data.length === 0) return { data: null, error: { message: 'Not found' } }
    return { data: data[0], error: null }
  }

  async maybeSingle() {
    const table = this.getTable()
    const data = table.filter((row) => this.filters.every((fn) => fn(row)))
    return { data: data[0] ?? null, error: null }
  }

  then<T1, T2>(
    onfulfilled?: ((v: any) => T1) | null,
    onrejected?: ((r: any) => T2) | null,
  ): Promise<T1 | T2> {
    return Promise.resolve({ data: null, error: null }).then(onfulfilled, onrejected) as Promise<T1 | T2>
  }

  private getTable() {
    if (this.table === 'app_user') return mockState.appUsers
    if (this.table === 'allowed_email') return mockState.allowedEmails
    return []
  }
}

const mockClient = {
  auth: {
    getUser: async () => {
      if (!mockState.authUser) {
        return { data: { user: null }, error: { message: 'invalid' } }
      }
      return { data: { user: mockState.authUser }, error: null }
    },
    admin: {
      updateUserById: async (userId: string, attrs: Record<string, any>) => {
        mockState.updateUserByIdCalls.push({ userId, attrs })
        if (mockState.updateUserByIdShouldFail) {
          return { data: null, error: { message: 'Auth API error' } }
        }
        return { data: { user: {} }, error: null }
      },
    },
  },
  from: (table: string) => new MockQuery(table),
}

vi.mock('@shared/lib/supabaseAdmin', () => ({
  getSupabaseAdminClient: () => mockClient,
}))

vi.mock('../../../src/shared/lib/supabaseAdmin', () => ({
  getSupabaseAdminClient: () => mockClient,
}))

import { POST } from '../../app/api/sync-user/route'

function makeRequest(token = 'valid-token') {
  return new Request('http://localhost/api/sync-user', {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}` },
  }) as any
}

describe('sync-user app_metadata.role (GFX-35)', () => {
  beforeEach(() => {
    mockState.appUsers = []
    mockState.allowedEmails = []
    mockState.updateUserByIdCalls = []
    mockState.updateUserByIdShouldFail = false
    mockState.authUser = null
  })

  it('sets app_metadata.role on new user creation', async () => {
    mockState.authUser = {
      id: 'auth-new',
      email: 'new@example.com',
      app_metadata: {},
    }
    mockState.allowedEmails.push({
      email: 'new@example.com',
      status: 'active',
    })

    const res = await POST(makeRequest())
    expect(res.status).toBe(200)

    // updateUserById が呼ばれて role = 'student' を設定
    expect(mockState.updateUserByIdCalls).toHaveLength(1)
    expect(mockState.updateUserByIdCalls[0].userId).toBe('auth-new')
    expect(mockState.updateUserByIdCalls[0].attrs).toEqual({
      app_metadata: { role: 'student' },
    })
  })

  it('sets app_metadata.role on existing user with missing role', async () => {
    mockState.authUser = {
      id: 'auth-existing',
      email: 'existing@example.com',
      app_metadata: {}, // role が未設定
    }
    mockState.appUsers.push({
      id: 'app-existing',
      auth_uid: 'auth-existing',
      email: 'existing@example.com',
      role: 'student',
    })
    mockState.allowedEmails.push({
      email: 'existing@example.com',
      status: 'active',
    })

    const res = await POST(makeRequest())
    expect(res.status).toBe(200)

    // updateUserById が呼ばれて role = 'student' を設定
    expect(mockState.updateUserByIdCalls).toHaveLength(1)
    expect(mockState.updateUserByIdCalls[0].attrs).toEqual({
      app_metadata: { role: 'student' },
    })
  })

  it('skips updateUserById when app_metadata.role already matches', async () => {
    mockState.authUser = {
      id: 'auth-ok',
      email: 'ok@example.com',
      app_metadata: { role: 'student' },
    }
    mockState.appUsers.push({
      id: 'app-ok',
      auth_uid: 'auth-ok',
      email: 'ok@example.com',
      role: 'student',
    })
    mockState.allowedEmails.push({
      email: 'ok@example.com',
      status: 'active',
    })

    const res = await POST(makeRequest())
    expect(res.status).toBe(200)

    // updateUserById は呼ばれない
    expect(mockState.updateUserByIdCalls).toHaveLength(0)
  })

  it('does not overwrite staff role on sync', async () => {
    mockState.authUser = {
      id: 'auth-staff',
      email: 'staff@example.com',
      app_metadata: { role: 'staff' },
    }
    mockState.appUsers.push({
      id: 'app-staff',
      auth_uid: 'auth-staff',
      email: 'staff@example.com',
      role: 'staff',
    })
    mockState.allowedEmails.push({
      email: 'staff@example.com',
      status: 'active',
    })

    const res = await POST(makeRequest())
    expect(res.status).toBe(200)

    // updateUserById は呼ばれない（既に staff で一致）
    expect(mockState.updateUserByIdCalls).toHaveLength(0)
  })

  it('succeeds even when updateUserById fails (error is logged only)', async () => {
    mockState.authUser = {
      id: 'auth-fail',
      email: 'fail@example.com',
      app_metadata: {},
    }
    mockState.allowedEmails.push({
      email: 'fail@example.com',
      status: 'active',
    })
    mockState.updateUserByIdShouldFail = true

    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {})

    const res = await POST(makeRequest())
    // sync-user 全体は成功する
    expect(res.status).toBe(200)

    // updateUserById は呼ばれたがエラーはログのみ
    expect(mockState.updateUserByIdCalls).toHaveLength(1)
    expect(consoleSpy).toHaveBeenCalledWith(
      'Failed to set app_metadata.role:',
      'Auth API error',
    )

    consoleSpy.mockRestore()
  })
})
