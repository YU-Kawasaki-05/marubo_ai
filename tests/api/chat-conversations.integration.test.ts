import { beforeEach, describe, expect, it, vi } from 'vitest'

const mockState = vi.hoisted(() => ({
  conversations: [] as Array<Record<string, unknown>>,
  messages: [] as Array<Record<string, unknown>>,
  attachments: [] as Array<Record<string, unknown>>,
  seq: 0,
}))

type TableName = 'conversations' | 'messages' | 'attachments'

class MockQuery implements PromiseLike<{ data: Array<Record<string, unknown>> | null; error: { message: string } | null }> {
  private readonly table: TableName
  private filters: Array<(row: Record<string, unknown>) => boolean> = []
  private sorts: Array<{ field: string; ascending: boolean }> = []
  private limitCount: number | null = null

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

  in(field: string, values: unknown[]) {
    this.filters.push((row) => values.includes(row[field]))
    return this
  }

  order(field: string, opts?: { ascending?: boolean }) {
    this.sorts.push({ field, ascending: opts?.ascending ?? true })
    return this
  }

  limit(count: number) {
    this.limitCount = count
    return this
  }

  or() {
    return this
  }

  insert(values: Record<string, unknown> | Array<Record<string, unknown>>) {
    const rows = Array.isArray(values) ? values : [values]
    const tableData = this.getTableData()
    rows.forEach((row) => {
      mockState.seq += 1
      const createdAt = row.created_at ?? new Date(1700000000000 + mockState.seq * 1000).toISOString()
      tableData.push({ ...row, created_at: createdAt })
    })
    return Promise.resolve({ data: null, error: null })
  }

  async single() {
    const { data } = await this.execute()
    const row = data?.[0]
    if (!row) {
      return { data: null, error: { message: 'No rows found' } }
    }
    return { data: row, error: null }
  }

  then<TResult1 = { data: Array<Record<string, unknown>> | null; error: { message: string } | null }, TResult2 = never>(
    onfulfilled?: ((value: { data: Array<Record<string, unknown>> | null; error: { message: string } | null }) => TResult1 | PromiseLike<TResult1>) | null,
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
    const source = this.getTableData()
    let data = source.filter((row) => this.filters.every((fn) => fn(row)))
    ;[...this.sorts].reverse().forEach(({ field, ascending }) => {
      data = [...data].sort((a, b) => {
        if (a[field] === b[field]) return 0
        return (a[field]! > b[field]! ? 1 : -1) * (ascending ? 1 : -1)
      })
    })
    if (this.limitCount !== null) {
      data = data.slice(0, this.limitCount)
    }
    return { data, error: null }
  }
}

const mockClient = {
  auth: {
    getUser: async (token: string) => {
      if (!token) {
        return { data: { user: null }, error: { message: 'missing token' } }
      }
      if (token === 'student-token') {
        return {
          data: { user: { id: 'mock-student-auth', email: 'student@example.com' } },
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

vi.mock('@shared/lib/supabaseAdmin', () => ({
  getSupabaseAdminClient: () => mockClient,
  resetSupabaseAdminClientForTest: () => {},
}))

vi.mock('@ai-sdk/openai', () => ({
  openai: () => ({}),
}))

vi.mock('ai', () => ({
  convertToModelMessages: async (messages: unknown[]) => messages,
  streamText: async ({ onFinish }: { onFinish?: (event: { text: string }) => Promise<void> }) => {
    if (onFinish) {
      await onFinish({ text: 'AI mock answer' })
    }
    return {
      toUIMessageStreamResponse: () =>
        new Response('data: mock\n\n', {
          status: 200,
          headers: { 'content-type': 'text/event-stream' },
        }),
    }
  },
}))

import { POST as chatPost } from '../../app/api/chat/route'
import { GET as conversationsGet } from '../../app/api/conversations/route'
import { GET as conversationDetailGet } from '../../app/api/conversations/[id]/route'

async function parseJson(res: Response) {
  return (await res.json()) as Record<string, unknown>
}

describe('chat conversations integration', () => {
  beforeEach(() => {
    mockState.conversations = []
    mockState.messages = []
    mockState.attachments = []
    mockState.seq = 0
    process.env.OPENAI_API_KEY = 'test-key'
    process.env.NEXT_PUBLIC_SUPABASE_URL = 'http://mock.local'
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = 'anon-key'
  })

  it('saves chat, lists conversations, and loads detail', async () => {
    const chatRes = await chatPost(
      new Request('http://localhost/api/chat', {
        method: 'POST',
        headers: {
          Authorization: 'Bearer student-token',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          messages: [{ id: 'm-user-1', role: 'user', parts: [{ type: 'text', text: '一次関数を教えて' }] }],
        }),
      }),
    )

    expect(chatRes.status).toBe(200)
    const conversationId = chatRes.headers.get('x-conversation-id')
    expect(conversationId).toBeTruthy()

    const listRes = await conversationsGet(
      new Request('http://localhost/api/conversations?limit=20', {
        method: 'GET',
        headers: { Authorization: 'Bearer student-token' },
      }),
    )
    const listBody = await parseJson(listRes)
    expect(listRes.status).toBe(200)
    expect((listBody.data as Array<{ id: string }>)[0].id).toBe(conversationId)

    const detailRes = await conversationDetailGet(
      new Request(`http://localhost/api/conversations/${conversationId}`, {
        method: 'GET',
        headers: { Authorization: 'Bearer student-token' },
      }),
      { params: { id: conversationId! } },
    )
    const detailBody = await parseJson(detailRes)
    expect(detailRes.status).toBe(200)
    expect((detailBody.data as { id: string }).id).toBe(conversationId)
    expect((detailBody.data as { messages: Array<{ role: string; content: string }> }).messages).toEqual([
      expect.objectContaining({ role: 'user', content: '一次関数を教えて' }),
      expect.objectContaining({ role: 'assistant', content: 'AI mock answer' }),
    ])
  })

  it('returns 401 when authorization is missing or invalid', async () => {
    const noAuthChat = await chatPost(
      new Request('http://localhost/api/chat', { method: 'POST', body: JSON.stringify({ messages: [] }) }),
    )
    expect(noAuthChat.status).toBe(401)

    const invalidChat = await chatPost(
      new Request('http://localhost/api/chat', {
        method: 'POST',
        headers: { Authorization: 'Bearer invalid-token' },
        body: JSON.stringify({ messages: [] }),
      }),
    )
    expect(invalidChat.status).toBe(401)

    const noAuthList = await conversationsGet(new Request('http://localhost/api/conversations', { method: 'GET' }))
    expect(noAuthList.status).toBe(401)

    const invalidList = await conversationsGet(
      new Request('http://localhost/api/conversations', {
        method: 'GET',
        headers: { Authorization: 'Bearer invalid-token' },
      }),
    )
    expect(invalidList.status).toBe(401)

    const noAuthDetail = await conversationDetailGet(
      new Request('http://localhost/api/conversations/conv-1', { method: 'GET' }),
      { params: { id: 'conv-1' } },
    )
    expect(noAuthDetail.status).toBe(401)

    const invalidDetail = await conversationDetailGet(
      new Request('http://localhost/api/conversations/conv-1', {
        method: 'GET',
        headers: { Authorization: 'Bearer invalid-token' },
      }),
      { params: { id: 'conv-1' } },
    )
    expect(invalidDetail.status).toBe(401)
  })

  it('saves attachments with chat and returns them in conversation detail', async () => {
    // チャット送信時に添付画像を含める
    const chatRes = await chatPost(
      new Request('http://localhost/api/chat', {
        method: 'POST',
        headers: {
          Authorization: 'Bearer student-token',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          messages: [{ id: 'm-user-1', role: 'user', parts: [{ type: 'text', text: 'この問題を解いて' }] }],
          attachments: [
            { storagePath: 'mock-student-auth/abc.jpg', mimeType: 'image/jpeg', size: 12345 },
            { storagePath: 'mock-student-auth/def.png', mimeType: 'image/png', size: 67890 },
          ],
        }),
      }),
    )

    expect(chatRes.status).toBe(200)
    const conversationId = chatRes.headers.get('x-conversation-id')
    expect(conversationId).toBeTruthy()

    // attachments が保存されたことを確認
    expect(mockState.attachments).toHaveLength(2)
    expect(mockState.attachments[0]).toMatchObject({
      user_id: 'mock-student-auth',
      storage_path: 'mock-student-auth/abc.jpg',
      mime_type: 'image/jpeg',
      size_bytes: 12345,
    })
    expect(mockState.attachments[1]).toMatchObject({
      storage_path: 'mock-student-auth/def.png',
      mime_type: 'image/png',
      size_bytes: 67890,
    })

    // message_id が user メッセージの ID と一致していることを確認
    const userMessage = mockState.messages.find((m) => m.role === 'user')
    expect(userMessage).toBeTruthy()
    expect(mockState.attachments[0].message_id).toBe(userMessage!.id)
    expect(mockState.attachments[1].message_id).toBe(userMessage!.id)

    // 会話詳細 API で attachments が返ることを確認
    const detailRes = await conversationDetailGet(
      new Request(`http://localhost/api/conversations/${conversationId}`, {
        method: 'GET',
        headers: { Authorization: 'Bearer student-token' },
      }),
      { params: { id: conversationId! } },
    )
    const detailBody = await parseJson(detailRes)
    expect(detailRes.status).toBe(200)

    type MessageWithAttachments = {
      role: string
      content: string
      attachments: Array<{ storagePath: string; mimeType: string; sizeBytes: number }>
    }
    const detailMessages = (detailBody.data as { messages: MessageWithAttachments[] }).messages

    // user メッセージに attachments が含まれること
    const userMsg = detailMessages.find((m) => m.role === 'user')
    expect(userMsg).toBeTruthy()
    expect(userMsg!.attachments).toHaveLength(2)
    expect(userMsg!.attachments[0]).toMatchObject({
      storagePath: 'mock-student-auth/abc.jpg',
      mimeType: 'image/jpeg',
      sizeBytes: 12345,
    })

    // assistant メッセージには attachments が空であること
    const assistantMsg = detailMessages.find((m) => m.role === 'assistant')
    expect(assistantMsg).toBeTruthy()
    expect(assistantMsg!.attachments).toEqual([])
  })

  it('handles chat without attachments (backward compatibility)', async () => {
    const chatRes = await chatPost(
      new Request('http://localhost/api/chat', {
        method: 'POST',
        headers: {
          Authorization: 'Bearer student-token',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          messages: [{ id: 'm-user-1', role: 'user', parts: [{ type: 'text', text: 'テスト' }] }],
        }),
      }),
    )

    expect(chatRes.status).toBe(200)
    expect(mockState.attachments).toHaveLength(0)

    const conversationId = chatRes.headers.get('x-conversation-id')
    const detailRes = await conversationDetailGet(
      new Request(`http://localhost/api/conversations/${conversationId}`, {
        method: 'GET',
        headers: { Authorization: 'Bearer student-token' },
      }),
      { params: { id: conversationId! } },
    )
    const detailBody = await parseJson(detailRes)

    type MessageWithAttachments = {
      role: string
      attachments: unknown[]
    }
    const msgs = (detailBody.data as { messages: MessageWithAttachments[] }).messages
    msgs.forEach((m) => {
      expect(m.attachments).toEqual([])
    })
  })
})
