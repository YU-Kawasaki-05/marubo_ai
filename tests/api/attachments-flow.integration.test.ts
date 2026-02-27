/**
 * QA-08: 画像添付フロー統合テスト
 * 署名URL取得 → (アップロード模擬) → チャット保存 → 会話詳細取得 の一連を検証する。
 */
import { beforeEach, describe, expect, it, vi } from 'vitest'

// --- Mock state: DB テーブル + Storage ---
const mockState = vi.hoisted(() => ({
  conversations: [] as Array<Record<string, unknown>>,
  messages: [] as Array<Record<string, unknown>>,
  attachments: [] as Array<Record<string, unknown>>,
  seq: 0,
  signedUploadCalls: [] as Array<{ path: string }>,
  signError: null as { message: string } | null,
}))

type TableName = 'conversations' | 'messages' | 'attachments'

/**
 * Supabase クエリビルダーのモック。
 * conversations / messages / attachments テーブルへの CRUD をメモリ上で模擬する。
 */
class MockQuery
  implements
    PromiseLike<{
      data: Array<Record<string, unknown>> | null
      error: { message: string } | null
    }>
{
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
      const createdAt =
        row.created_at ?? new Date(1700000000000 + mockState.seq * 1000).toISOString()
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

  then<
    TResult1 = {
      data: Array<Record<string, unknown>> | null
      error: { message: string } | null
    },
    TResult2 = never,
  >(
    onfulfilled?:
      | ((value: {
          data: Array<Record<string, unknown>> | null
          error: { message: string } | null
        }) => TResult1 | PromiseLike<TResult1>)
      | null,
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

// --- Mock Supabase client (DB + Storage + Auth) ---
const mockClient = {
  auth: {
    getUser: async (token: string) => {
      if (!token) {
        return { data: { user: null }, error: { message: 'missing token' } }
      }
      if (token === 'student-token') {
        return {
          data: { user: { id: 'mock-student-uid', email: 'student@example.com' } },
          error: null,
        }
      }
      return { data: { user: null }, error: { message: 'invalid token' } }
    },
  },
  from: (table: TableName) => new MockQuery(table),
  storage: {
    from: () => ({
      createSignedUploadUrl: async (path: string) => {
        mockState.signedUploadCalls.push({ path })
        if (mockState.signError) {
          return { data: null, error: mockState.signError }
        }
        return {
          data: {
            signedUrl: `https://mock.supabase.co/storage/v1/upload/sign/attachments/${path}?token=mock-token`,
            token: 'mock-token',
          },
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

vi.mock('@ai-sdk/openai', () => ({
  openai: () => ({}),
}))

vi.mock('ai', () => ({
  convertToModelMessages: async (messages: unknown[]) => messages,
  streamText: async ({
    onFinish,
  }: {
    onFinish?: (event: { text: string }) => Promise<void>
  }) => {
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

import { POST as signPost } from '../../app/api/attachments/sign/route'
import { POST as chatPost } from '../../app/api/chat/route'
import { GET as conversationDetailGet } from '../../app/api/conversations/[id]/route'

async function parseJson(res: Response) {
  return (await res.json()) as Record<string, unknown>
}

/** 署名 URL を取得するヘルパー */
async function getSignedUrl(mimeType: string, size: number) {
  const res = await signPost(
    new Request('http://localhost/api/attachments/sign', {
      method: 'POST',
      headers: {
        Authorization: 'Bearer student-token',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ filename: 'test.jpg', mimeType, size }),
    }),
  )
  const body = await parseJson(res)
  return { res, body }
}

/** チャットメッセージを送信するヘルパー */
async function sendChat(
  text: string,
  chatAttachments?: Array<{ storagePath: string; mimeType: string; size: number }>,
) {
  return chatPost(
    new Request('http://localhost/api/chat', {
      method: 'POST',
      headers: {
        Authorization: 'Bearer student-token',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        messages: [{ id: 'm-user-1', role: 'user', parts: [{ type: 'text', text }] }],
        ...(chatAttachments ? { attachments: chatAttachments } : {}),
      }),
    }),
  )
}

/** 会話詳細を取得するヘルパー */
async function getConversationDetail(conversationId: string) {
  return conversationDetailGet(
    new Request(`http://localhost/api/conversations/${conversationId}`, {
      method: 'GET',
      headers: { Authorization: 'Bearer student-token' },
    }),
    { params: { id: conversationId } },
  )
}

describe('QA-08: 画像添付フロー統合テスト', () => {
  beforeEach(() => {
    mockState.conversations = []
    mockState.messages = []
    mockState.attachments = []
    mockState.seq = 0
    mockState.signedUploadCalls = []
    mockState.signError = null
    process.env.OPENAI_API_KEY = 'test-key'
    process.env.NEXT_PUBLIC_SUPABASE_URL = 'http://mock.local'
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = 'anon-key'
  })

  it('署名URL取得→チャット保存→会話詳細で添付が返る（単一画像）', async () => {
    // Step 1: 署名 URL を取得
    const { res: signRes, body: signBody } = await getSignedUrl('image/jpeg', 50000)
    expect(signRes.status).toBe(200)

    const signData = signBody.data as { signedUrl: string; storagePath: string; token: string }
    expect(signData.signedUrl).toContain('mock.supabase.co')
    expect(signData.storagePath).toMatch(/^mock-student-uid\/[a-f0-9-]+\.jpg$/)

    // Step 2: (アップロード模擬 — 実際の PUT は省略、storagePath を使って次へ進む)

    // Step 3: チャット送信（storagePath を添付メタとして渡す）
    const chatRes = await sendChat('この問題の解き方を教えて', [
      { storagePath: signData.storagePath, mimeType: 'image/jpeg', size: 50000 },
    ])
    expect(chatRes.status).toBe(200)
    const conversationId = chatRes.headers.get('x-conversation-id')
    expect(conversationId).toBeTruthy()

    // Step 4: DB に attachments が保存されたことを確認
    expect(mockState.attachments).toHaveLength(1)
    expect(mockState.attachments[0]).toMatchObject({
      user_id: 'mock-student-uid',
      storage_path: signData.storagePath,
      mime_type: 'image/jpeg',
      size_bytes: 50000,
    })

    // Step 5: 会話詳細 API で添付が返ることを確認
    const detailRes = await getConversationDetail(conversationId!)
    const detailBody = await parseJson(detailRes)
    expect(detailRes.status).toBe(200)

    type Attachment = { id: string; storagePath: string; mimeType: string; sizeBytes: number }
    type MessageWithAttachments = { role: string; content: string; attachments: Attachment[] }
    const msgs = (detailBody.data as { messages: MessageWithAttachments[] }).messages

    const userMsg = msgs.find((m) => m.role === 'user')
    expect(userMsg).toBeTruthy()
    expect(userMsg!.attachments).toHaveLength(1)
    expect(userMsg!.attachments[0]).toMatchObject({
      storagePath: signData.storagePath,
      mimeType: 'image/jpeg',
      sizeBytes: 50000,
    })

    // assistant メッセージには添付なし
    const aiMsg = msgs.find((m) => m.role === 'assistant')
    expect(aiMsg).toBeTruthy()
    expect(aiMsg!.attachments).toEqual([])
  })

  it('署名URL取得→チャット保存→会話詳細で添付が返る（複数画像）', async () => {
    // 3 枚の異なる形式の画像を署名
    const signs = await Promise.all([
      getSignedUrl('image/jpeg', 30000),
      getSignedUrl('image/png', 45000),
      getSignedUrl('image/webp', 20000),
    ])

    signs.forEach(({ res }) => expect(res.status).toBe(200))

    const storagePaths = signs.map(
      ({ body }) => (body.data as { storagePath: string }).storagePath,
    )

    // 3 件とも署名 URL が発行されたことを確認
    expect(mockState.signedUploadCalls).toHaveLength(3)

    // チャット送信
    const chatRes = await sendChat('これらの画像を比較して', [
      { storagePath: storagePaths[0], mimeType: 'image/jpeg', size: 30000 },
      { storagePath: storagePaths[1], mimeType: 'image/png', size: 45000 },
      { storagePath: storagePaths[2], mimeType: 'image/webp', size: 20000 },
    ])
    expect(chatRes.status).toBe(200)
    const conversationId = chatRes.headers.get('x-conversation-id')

    // DB に 3 件保存されていること
    expect(mockState.attachments).toHaveLength(3)

    // 全添付が同一 user message に紐づくこと
    const userMessage = mockState.messages.find((m) => m.role === 'user')
    expect(userMessage).toBeTruthy()
    mockState.attachments.forEach((a) => {
      expect(a.message_id).toBe(userMessage!.id)
      expect(a.user_id).toBe('mock-student-uid')
    })

    // 会話詳細で 3 件返ること
    const detailRes = await getConversationDetail(conversationId!)
    const detailBody = await parseJson(detailRes)
    expect(detailRes.status).toBe(200)

    type Attachment = { storagePath: string; mimeType: string; sizeBytes: number }
    type Msg = { role: string; attachments: Attachment[] }
    const msgs = (detailBody.data as { messages: Msg[] }).messages

    const userMsg = msgs.find((m) => m.role === 'user')
    expect(userMsg!.attachments).toHaveLength(3)

    // 各画像のメタデータが正確に保存されていること
    const sortedAttachments = [...userMsg!.attachments].sort((a, b) =>
      a.storagePath.localeCompare(b.storagePath),
    )
    const sortedPaths = [...storagePaths].sort()

    sortedAttachments.forEach((a, i) => {
      expect(a.storagePath).toBe(sortedPaths[i])
    })
  })

  it('添付なしのチャットでは attachments が空配列で返る', async () => {
    const chatRes = await sendChat('添付なしの質問です')
    expect(chatRes.status).toBe(200)
    const conversationId = chatRes.headers.get('x-conversation-id')

    expect(mockState.attachments).toHaveLength(0)

    const detailRes = await getConversationDetail(conversationId!)
    const detailBody = await parseJson(detailRes)

    type Msg = { role: string; attachments: unknown[] }
    const msgs = (detailBody.data as { messages: Msg[] }).messages
    msgs.forEach((m) => {
      expect(m.attachments).toEqual([])
    })
  })

  it('署名URL取得が失敗した場合は 500 を返す', async () => {
    mockState.signError = { message: 'Bucket not found' }

    const { res, body } = await getSignedUrl('image/jpeg', 1000)
    expect(res.status).toBe(500)
    expect((body.error as { code: string }).code).toBe('SIGN_URL_FAILED')

    // チャットには影響しない（添付なしで送信可能）
    const chatRes = await sendChat('署名失敗後のテキストのみ送信')
    expect(chatRes.status).toBe(200)
    expect(mockState.attachments).toHaveLength(0)
  })

  it('署名 URL の storagePath が DB の storage_path と一致する', async () => {
    const { body: signBody } = await getSignedUrl('image/png', 10000)
    const storagePath = (signBody.data as { storagePath: string }).storagePath

    await sendChat('パス一致テスト', [
      { storagePath, mimeType: 'image/png', size: 10000 },
    ])

    // DB 内の storage_path と署名 API が返した storagePath が完全一致すること
    expect(mockState.attachments[0].storage_path).toBe(storagePath)

    // 会話詳細 API のレスポンスでも同じ値が返ること
    const conversationId = mockState.conversations[0].id as string
    const detailRes = await getConversationDetail(conversationId)
    const detailBody = await parseJson(detailRes)

    type Attachment = { storagePath: string }
    type Msg = { role: string; attachments: Attachment[] }
    const userMsg = (detailBody.data as { messages: Msg[] }).messages.find(
      (m) => m.role === 'user',
    )
    expect(userMsg!.attachments[0].storagePath).toBe(storagePath)
  })
})
