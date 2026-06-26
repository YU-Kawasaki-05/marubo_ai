/** @file
 * DELETE /api/conversations/[id] のユニットテスト。
 * 入力: 認証トークン + 会話 ID。
 * 出力: 204（成功）、401（未認証）、403（他人の会話）、404（存在しない）。
 * 依存: MockQuery（Supabase クエリビルダー模擬）。
 */

import { beforeEach, describe, expect, it, vi } from 'vitest'

const mockState = vi.hoisted(() => ({
  conversations: [] as Array<Record<string, unknown>>,
  messages: [] as Array<Record<string, unknown>>,
  attachments: [] as Array<Record<string, unknown>>,
}))

type TableName = 'conversations' | 'messages' | 'attachments'

class MockQuery {
  private readonly table: TableName
  private filters: Array<(row: Record<string, unknown>) => boolean> = []
  private isDelete = false

  constructor(table: TableName) {
    this.table = table
  }

  select() {
    return this
  }

  eq(field: string, value: unknown) {
    this.filters.push((row) => row[field] === value)
    return this
  }

  delete() {
    this.isDelete = true
    return this
  }

  async single() {
    const tableData = this.getTableData()
    const rows = tableData.filter((row) => this.filters.every((fn) => fn(row)))

    if (this.isDelete) {
      const toDelete = rows[0]
      if (toDelete) {
        const idx = tableData.indexOf(toDelete)
        if (idx !== -1) tableData.splice(idx, 1)
      }
      return { data: toDelete ?? null, error: toDelete ? null : { message: 'No rows found' } }
    }

    const row = rows[0]
    if (!row) {
      return { data: null, error: { message: 'No rows found' } }
    }
    return { data: row, error: null }
  }

  then<TResult1, TResult2 = never>(
    onfulfilled?: ((value: { data: unknown; error: unknown }) => TResult1 | PromiseLike<TResult1>) | null,
    onrejected?: ((reason: unknown) => TResult2 | PromiseLike<TResult2>) | null,
  ): Promise<TResult1 | TResult2> {
    return this.execute().then(onfulfilled, onrejected) as Promise<TResult1 | TResult2>
  }

  private getTableData() {
    switch (this.table) {
      case 'conversations':
        return mockState.conversations
      case 'messages':
        return mockState.messages
      case 'attachments':
        return mockState.attachments
    }
  }

  private async execute() {
    const tableData = this.getTableData()

    if (this.isDelete) {
      const toRemove = tableData.filter((row) => this.filters.every((fn) => fn(row)))
      for (const row of toRemove) {
        const idx = tableData.indexOf(row)
        if (idx !== -1) tableData.splice(idx, 1)
      }
      return { data: null, error: null }
    }

    const data = tableData.filter((row) => this.filters.every((fn) => fn(row)))
    return { data, error: null }
  }
}

const STUDENT_USER_ID = 'user-student-001'
const OTHER_USER_ID = 'user-other-002'

const mockClient = {
  auth: {
    getUser: async (token: string) => {
      if (token === 'student-token') {
        return {
          data: { user: { id: STUDENT_USER_ID, email: 'student@example.com' } },
          error: null,
        }
      }
      if (token === 'other-token') {
        return {
          data: { user: { id: OTHER_USER_ID, email: 'other@example.com' } },
          error: null,
        }
      }
      return { data: { user: null }, error: { message: 'invalid token' } }
    },
  },
  from: (table: TableName) => new MockQuery(table),
}

vi.mock('@supabase/supabase-js', () => ({
  createClient: () => mockClient,
}))

import { DELETE } from '../../app/api/conversations/[id]/route'

function makeRequest(id: string, token?: string) {
  const headers: Record<string, string> = {}
  if (token) {
    headers.Authorization = `Bearer ${token}`
  }
  return new Request(`http://localhost/api/conversations/${id}`, {
    method: 'DELETE',
    headers,
  })
}

describe('DELETE /api/conversations/[id]', () => {
  beforeEach(() => {
    mockState.conversations = [
      { id: 'conv-1', user_id: STUDENT_USER_ID, title: 'テスト会話', created_at: '2026-01-01T00:00:00Z' },
      { id: 'conv-2', user_id: OTHER_USER_ID, title: '他人の会話', created_at: '2026-01-02T00:00:00Z' },
    ]
    mockState.messages = [
      { id: 'msg-1', conversation_id: 'conv-1', role: 'user', content: 'hello', created_at: '2026-01-01T00:00:01Z' },
      { id: 'msg-2', conversation_id: 'conv-1', role: 'assistant', content: 'hi', created_at: '2026-01-01T00:00:02Z' },
    ]
    mockState.attachments = [
      { id: 'att-1', message_id: 'msg-1', storage_path: 'user-student-001/abc.jpg', mime_type: 'image/jpeg', size_bytes: 1000 },
    ]
    process.env.NEXT_PUBLIC_SUPABASE_URL = 'http://mock.local'
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = 'anon-key'
  })

  it('returns 401 when authorization header is missing', async () => {
    const res = await DELETE(makeRequest('conv-1'), { params: Promise.resolve({ id: 'conv-1' }) })
    expect(res.status).toBe(401)
  })

  it('returns 401 when token is invalid', async () => {
    const res = await DELETE(makeRequest('conv-1', 'bad-token'), { params: Promise.resolve({ id: 'conv-1' }) })
    expect(res.status).toBe(401)
  })

  it('returns 404 when conversation does not exist', async () => {
    const res = await DELETE(makeRequest('nonexistent', 'student-token'), { params: Promise.resolve({ id: 'nonexistent' }) })
    expect(res.status).toBe(404)
  })

  it('returns 403 when trying to delete another user conversation', async () => {
    const res = await DELETE(makeRequest('conv-2', 'student-token'), { params: Promise.resolve({ id: 'conv-2' }) })
    expect(res.status).toBe(403)
  })

  it('returns 204 and deletes the conversation on success', async () => {
    expect(mockState.conversations).toHaveLength(2)

    const res = await DELETE(makeRequest('conv-1', 'student-token'), { params: Promise.resolve({ id: 'conv-1' }) })
    expect(res.status).toBe(204)

    // 会話が削除されたことを確認
    expect(mockState.conversations.find((c) => c.id === 'conv-1')).toBeUndefined()
    // 他の会話は残っている
    expect(mockState.conversations).toHaveLength(1)
    expect(mockState.conversations[0].id).toBe('conv-2')
  })

  it('owner can delete their own conversation (other user cannot)', async () => {
    // other-token の所有者は conv-2 を削除できる
    const res = await DELETE(makeRequest('conv-2', 'other-token'), { params: Promise.resolve({ id: 'conv-2' }) })
    expect(res.status).toBe(204)
    expect(mockState.conversations.find((c) => c.id === 'conv-2')).toBeUndefined()
  })
})
