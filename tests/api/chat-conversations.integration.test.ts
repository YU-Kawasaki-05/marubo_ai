import { beforeEach, describe, expect, it, vi } from 'vitest'

const mockState = vi.hoisted(() => ({
  conversations: [] as Array<Record<string, unknown>>,
  messages: [] as Array<Record<string, unknown>>,
  attachments: [] as Array<Record<string, unknown>>,
  seq: 0,
  lastStreamTextArgs: null as Record<string, unknown> | null,
  storageSignedUrlShouldFail: false,
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
      tableData.push({ ...row, created_at: createdAt, seq: mockState.seq })
    })
    return Promise.resolve({ data: null, error: null })
  }

  update(values: Record<string, unknown>) {
    const tableData = this.getTableData()
    const matched = tableData.filter((row) => this.filters.every((fn) => fn(row)))
    matched.forEach((row) => Object.assign(row, values))
    return this
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
  storage: {
    from: () => ({
      createSignedUrl: async (path: string) => {
        if (mockState.storageSignedUrlShouldFail) {
          return { data: null, error: { message: 'Storage error' } }
        }
        return {
          data: { signedUrl: `https://mock-storage.local/signed/${path}` },
          error: null,
        }
      },
    }),
  },
}

vi.mock('@supabase/supabase-js', () => ({
  createClient: () => mockClient,
}))

vi.mock('@shared/lib/supabaseAdmin', () => ({
  getSupabaseAdminClient: () => mockClient,
  resetSupabaseAdminClientForTest: () => {},
}))

vi.mock('@shared/lib/rateLimit', () => ({
  resolveAppUserId: async () => 'mock-student-id',
  checkMinuteRate: async () => {},
  checkMonthlyQuota: async () => {},
  incrementUsage: async () => {},
}))

vi.mock('@ai-sdk/openai', () => ({
  openai: () => ({}),
}))

vi.mock('ai', () => ({
  convertToModelMessages: async (messages: unknown[]) => messages,
  generateText: async () => ({ text: 'モックタイトル' }),
  streamText: async (args: { messages?: unknown[]; onFinish?: (event: { text: string }) => Promise<void> }) => {
    mockState.lastStreamTextArgs = args as Record<string, unknown>
    if (args.onFinish) {
      await args.onFinish({ text: 'AI mock answer' })
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
    mockState.lastStreamTextArgs = null
    mockState.storageSignedUrlShouldFail = false
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

  it('appends messages to existing conversation when conversationId is provided', async () => {
    // 1通目: 新規会話を作成
    const chatRes1 = await chatPost(
      new Request('http://localhost/api/chat', {
        method: 'POST',
        headers: {
          Authorization: 'Bearer student-token',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          messages: [{ id: 'm1', role: 'user', parts: [{ type: 'text', text: '最初の質問' }] }],
        }),
      }),
    )
    expect(chatRes1.status).toBe(200)
    const conversationId = chatRes1.headers.get('x-conversation-id')
    expect(conversationId).toBeTruthy()
    expect(mockState.conversations).toHaveLength(1)

    // 2通目: 既存会話に追記
    const chatRes2 = await chatPost(
      new Request('http://localhost/api/chat', {
        method: 'POST',
        headers: {
          Authorization: 'Bearer student-token',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          messages: [
            { id: 'm1', role: 'user', parts: [{ type: 'text', text: '最初の質問' }] },
            { id: 'm2', role: 'assistant', parts: [{ type: 'text', text: 'AI mock answer' }] },
            { id: 'm3', role: 'user', parts: [{ type: 'text', text: '続きの質問' }] },
          ],
          conversationId,
        }),
      }),
    )
    expect(chatRes2.status).toBe(200)

    // conversations テーブルには新しい行が作られていないこと
    expect(mockState.conversations).toHaveLength(1)
    expect(mockState.conversations[0].id).toBe(conversationId)

    // messages テーブルに 4 件（user+assistant x2）
    const convMessages = mockState.messages.filter((m) => m.conversation_id === conversationId)
    expect(convMessages).toHaveLength(4)

    // 会話詳細 API で全メッセージが返ること
    const detailRes = await conversationDetailGet(
      new Request(`http://localhost/api/conversations/${conversationId}`, {
        method: 'GET',
        headers: { Authorization: 'Bearer student-token' },
      }),
      { params: { id: conversationId! } },
    )
    const detailBody = await parseJson(detailRes)
    expect(detailRes.status).toBe(200)
    const msgs = (detailBody.data as { messages: Array<{ role: string; content: string }> }).messages
    expect(msgs).toHaveLength(4)
    expect(msgs[0]).toMatchObject({ role: 'user', content: '最初の質問' })
    expect(msgs[1]).toMatchObject({ role: 'assistant', content: 'AI mock answer' })
    expect(msgs[2]).toMatchObject({ role: 'user', content: '続きの質問' })
    expect(msgs[3]).toMatchObject({ role: 'assistant', content: 'AI mock answer' })
  })

  it('returns 404 when conversationId belongs to another user', async () => {
    // 別ユーザーの会話を直接 mockState に挿入
    mockState.conversations.push({
      id: 'other-user-conv',
      user_id: 'other-user-id',
      title: '他人の会話',
      created_at: new Date().toISOString(),
    })

    const chatRes = await chatPost(
      new Request('http://localhost/api/chat', {
        method: 'POST',
        headers: {
          Authorization: 'Bearer student-token',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          messages: [{ id: 'm1', role: 'user', parts: [{ type: 'text', text: '不正アクセス' }] }],
          conversationId: 'other-user-conv',
        }),
      }),
    )
    expect(chatRes.status).toBe(404)
    const body = await parseJson(chatRes)
    expect(body.error).toContain('会話が見つかりません')
  })

  it('preserves message ordering via seq (user before assistant)', async () => {
    const chatRes = await chatPost(
      new Request('http://localhost/api/chat', {
        method: 'POST',
        headers: {
          Authorization: 'Bearer student-token',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          messages: [{ id: 'm1', role: 'user', parts: [{ type: 'text', text: '順序テスト' }] }],
        }),
      }),
    )
    expect(chatRes.status).toBe(200)
    const conversationId = chatRes.headers.get('x-conversation-id')

    const convMessages = mockState.messages.filter((m) => m.conversation_id === conversationId)
    expect(convMessages).toHaveLength(2)

    const userMsg = convMessages.find((m) => m.role === 'user')
    const assistantMsg = convMessages.find((m) => m.role === 'assistant')
    expect(userMsg).toBeTruthy()
    expect(assistantMsg).toBeTruthy()
    // user の seq が assistant の seq より小さいこと
    expect((userMsg!.seq as number)).toBeLessThan(assistantMsg!.seq as number)
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

  it('includes ImagePart in streamText messages when attachments are provided', async () => {
    const chatRes = await chatPost(
      new Request('http://localhost/api/chat', {
        method: 'POST',
        headers: {
          Authorization: 'Bearer student-token',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          messages: [{ id: 'm1', role: 'user', content: 'この問題を解いて', parts: [{ type: 'text', text: 'この問題を解いて' }] }],
          attachments: [
            { storagePath: 'mock-student-auth/img1.jpg', mimeType: 'image/jpeg', size: 10000 },
          ],
        }),
      }),
    )

    expect(chatRes.status).toBe(200)

    // streamText に渡された messages を検証
    // convertToModelMessages モックは passthrough なので、
    // messages は UIMessage 形式のまま渡される（content フィールドあり）
    const args = mockState.lastStreamTextArgs!
    const msgs = args.messages as Array<{ role: string; content: unknown }>
    const lastUser = [...msgs].reverse().find((m) => m.role === 'user')
    expect(lastUser).toBeTruthy()
    expect(Array.isArray(lastUser!.content)).toBe(true)
    const contentParts = lastUser!.content as Array<{ type: string }>
    expect(contentParts.some((p) => p.type === 'text')).toBe(true)
    expect(contentParts.some((p) => p.type === 'image')).toBe(true)

    const imagePart = contentParts.find((p) => p.type === 'image') as { type: string; image: URL; mimeType: string }
    expect(imagePart.image).toBeInstanceOf(URL)
    expect(imagePart.image.href).toContain('mock-student-auth/img1.jpg')
    expect(imagePart.mimeType).toBe('image/jpeg')
  })

  it('includes multiple ImageParts for multiple attachments (max 3)', async () => {
    const chatRes = await chatPost(
      new Request('http://localhost/api/chat', {
        method: 'POST',
        headers: {
          Authorization: 'Bearer student-token',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          messages: [{ id: 'm1', role: 'user', content: '3枚の画像を見て', parts: [{ type: 'text', text: '3枚の画像を見て' }] }],
          attachments: [
            { storagePath: 'mock-student-auth/a.jpg', mimeType: 'image/jpeg', size: 1000 },
            { storagePath: 'mock-student-auth/b.png', mimeType: 'image/png', size: 2000 },
            { storagePath: 'mock-student-auth/c.webp', mimeType: 'image/webp', size: 3000 },
          ],
        }),
      }),
    )

    expect(chatRes.status).toBe(200)

    const args = mockState.lastStreamTextArgs!
    const msgs = args.messages as Array<{ role: string; content: unknown }>
    const lastUser = [...msgs].reverse().find((m) => m.role === 'user')
    const contentParts = lastUser!.content as Array<{ type: string }>
    const imageParts = contentParts.filter((p) => p.type === 'image')
    expect(imageParts).toHaveLength(3)
  })

  it('sends text-only messages when no attachments are provided (no ImagePart)', async () => {
    const chatRes = await chatPost(
      new Request('http://localhost/api/chat', {
        method: 'POST',
        headers: {
          Authorization: 'Bearer student-token',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          messages: [{ id: 'm1', role: 'user', parts: [{ type: 'text', text: 'テキストのみ' }] }],
        }),
      }),
    )

    expect(chatRes.status).toBe(200)

    const args = mockState.lastStreamTextArgs!
    const msgs = args.messages as Array<{ role: string; content: unknown; parts?: unknown[] }>
    const lastUser = [...msgs].reverse().find((m) => m.role === 'user')
    // 添付なしの場合、content は元の parts 形式のまま（ImagePart なし）
    if (Array.isArray(lastUser!.content)) {
      const contentParts = lastUser!.content as Array<{ type: string }>
      expect(contentParts.every((p) => p.type !== 'image')).toBe(true)
    }
  })

  it('skips failed signed URLs and sends text-only to AI (graceful degradation)', async () => {
    mockState.storageSignedUrlShouldFail = true

    const chatRes = await chatPost(
      new Request('http://localhost/api/chat', {
        method: 'POST',
        headers: {
          Authorization: 'Bearer student-token',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          messages: [{ id: 'm1', role: 'user', parts: [{ type: 'text', text: '画像つき' }] }],
          attachments: [
            { storagePath: 'mock-student-auth/fail.jpg', mimeType: 'image/jpeg', size: 5000 },
          ],
        }),
      }),
    )

    // チャット自体は成功する（画像なしで AI に送信される）
    expect(chatRes.status).toBe(200)

    const args = mockState.lastStreamTextArgs!
    const msgs = args.messages as Array<{ role: string; content: unknown; parts?: unknown[] }>
    const lastUser = [...msgs].reverse().find((m) => m.role === 'user')
    // ImagePart が含まれないこと（署名 URL 取得失敗のため）
    if (Array.isArray(lastUser!.content)) {
      const contentParts = lastUser!.content as Array<{ type: string }>
      expect(contentParts.every((p) => p.type !== 'image')).toBe(true)
    }

    // attachments は DB に保存されること（AI に渡せなくても保存は行う）
    expect(mockState.attachments).toHaveLength(1)
  })

  it('saves user message and attachments when text is empty (image-only send)', async () => {
    const chatRes = await chatPost(
      new Request('http://localhost/api/chat', {
        method: 'POST',
        headers: {
          Authorization: 'Bearer student-token',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          messages: [{ id: 'm1', role: 'user', content: '', parts: [{ type: 'text', text: '' }] }],
          attachments: [
            { storagePath: 'mock-student-auth/photo.jpg', mimeType: 'image/jpeg', size: 20000 },
          ],
        }),
      }),
    )

    expect(chatRes.status).toBe(200)
    const conversationId = chatRes.headers.get('x-conversation-id')
    expect(conversationId).toBeTruthy()

    // ユーザーメッセージが content: '' で保存されること
    const userMsg = mockState.messages.find((m) => m.role === 'user')
    expect(userMsg).toBeTruthy()
    expect(userMsg!.content).toBe('')
    expect(userMsg!.conversation_id).toBe(conversationId)

    // assistant メッセージも保存されること
    const assistantMsg = mockState.messages.find((m) => m.role === 'assistant')
    expect(assistantMsg).toBeTruthy()

    // attachments が保存されること
    expect(mockState.attachments).toHaveLength(1)
    expect(mockState.attachments[0]).toMatchObject({
      user_id: 'mock-student-auth',
      storage_path: 'mock-student-auth/photo.jpg',
      mime_type: 'image/jpeg',
      size_bytes: 20000,
    })
    expect(mockState.attachments[0].message_id).toBe(userMsg!.id)
  })

  it('loads image-only message with attachments from conversation detail API', async () => {
    // テキストなし + 画像で送信
    const chatRes = await chatPost(
      new Request('http://localhost/api/chat', {
        method: 'POST',
        headers: {
          Authorization: 'Bearer student-token',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          messages: [{ id: 'm1', role: 'user', content: '', parts: [{ type: 'text', text: '' }] }],
          attachments: [
            { storagePath: 'mock-student-auth/q.png', mimeType: 'image/png', size: 15000 },
          ],
        }),
      }),
    )

    expect(chatRes.status).toBe(200)
    const conversationId = chatRes.headers.get('x-conversation-id')

    // 会話詳細 API でユーザーメッセージと添付が返ること
    const detailRes = await conversationDetailGet(
      new Request(`http://localhost/api/conversations/${conversationId}`, {
        method: 'GET',
        headers: { Authorization: 'Bearer student-token' },
      }),
      { params: { id: conversationId! } },
    )
    const detailBody = await parseJson(detailRes)
    expect(detailRes.status).toBe(200)

    type MsgWithAttachments = {
      role: string
      content: string
      attachments: Array<{ storagePath: string; mimeType: string }>
    }
    const msgs = (detailBody.data as { messages: MsgWithAttachments[] }).messages

    // ユーザーメッセージ（content: ''）が存在すること
    const userMsg = msgs.find((m) => m.role === 'user')
    expect(userMsg).toBeTruthy()
    expect(userMsg!.content).toBe('')
    expect(userMsg!.attachments).toHaveLength(1)
    expect(userMsg!.attachments[0]).toMatchObject({
      storagePath: 'mock-student-auth/q.png',
      mimeType: 'image/png',
    })
  })
})
