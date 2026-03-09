/** @file
 * GAP-17 / GAP-26: /api/chat サーバーサイドバリデーションのテスト。
 * 入力: 添付枚数超過 / メッセージ文字数超過のリクエスト。
 * 出力: 400 Bad Request。
 * 依存: chat route + mocked Supabase / AI SDK / rateLimit。
 */

import { beforeEach, describe, expect, it, vi } from 'vitest'

import { AppError } from '../../src/shared/lib/errors'

// ── Mock: rateLimit ──

const rateLimitMocks = vi.hoisted(() => ({
  resolveAppUserId: vi.fn<[string], Promise<string>>(),
  checkMinuteRate: vi.fn<[string], Promise<void>>(),
  checkMonthlyQuota: vi.fn<[string], Promise<void>>(),
  incrementUsage: vi.fn<[string], Promise<void>>(),
}))

vi.mock('@shared/lib/rateLimit', () => rateLimitMocks)

// ── Mock: notifier ──

vi.mock('@shared/lib/notifier', () => ({
  notifyError: vi.fn(),
}))

// ── Mock: Supabase ──

const mockClient = {
  auth: {
    getUser: async (token: string) => {
      if (token === 'student-token') {
        return {
          data: { user: { id: 'mock-student-auth', email: 'student@example.com' } },
          error: null,
        }
      }
      return { data: { user: null }, error: { message: 'invalid token' } }
    },
  },
  from: () => ({
    insert: () => Promise.resolve({ data: null, error: null }),
    update: () => ({
      eq: () => Promise.resolve({ data: null, error: null }),
    }),
    select: () => ({
      eq: () => ({
        eq: () => ({ single: async () => ({ data: null, error: null }) }),
        single: async () => ({ data: null, error: null }),
      }),
    }),
  }),
}

vi.mock('@supabase/supabase-js', () => ({
  createClient: () => mockClient,
}))

vi.mock('@shared/lib/supabaseAdmin', () => ({
  getSupabaseAdminClient: () => mockClient,
  resetSupabaseAdminClientForTest: () => {},
}))

// ── Mock: AI SDK ──

vi.mock('@ai-sdk/openai', () => ({
  openai: () => ({}),
}))

vi.mock('ai', () => ({
  convertToModelMessages: async (messages: unknown[]) => messages,
  generateText: async () => ({ text: 'モックタイトル' }),
  streamText: async ({ onFinish }: any) => {
    if (onFinish) await onFinish({ text: 'AI mock answer' })
    return {
      toUIMessageStreamResponse: () =>
        new Response('data: mock\n\n', {
          status: 200,
          headers: { 'content-type': 'text/event-stream' },
        }),
    }
  },
}))

// ── Import route after mocks ──

import { POST as chatPost } from '../../app/api/chat/route'

// ── Helpers ──

function makeRequest(opts?: {
  text?: string
  attachments?: Array<{ storagePath: string; mimeType?: string; size?: number }>
}) {
  const text = opts?.text ?? 'テスト質問'
  return new Request('http://localhost/api/chat', {
    method: 'POST',
    headers: {
      Authorization: 'Bearer student-token',
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      messages: [{ id: 'm1', role: 'user', parts: [{ type: 'text', text }] }],
      attachments: opts?.attachments,
    }),
  })
}

async function parseJson(res: Response) {
  return (await res.json()) as Record<string, unknown>
}

// ── Tests ──

describe('Chat validation (GAP-17 / GAP-26)', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    rateLimitMocks.resolveAppUserId.mockResolvedValue('mock-app-user-id')
    rateLimitMocks.checkMinuteRate.mockResolvedValue(undefined)
    rateLimitMocks.checkMonthlyQuota.mockResolvedValue(undefined)
    rateLimitMocks.incrementUsage.mockResolvedValue(undefined)
    process.env.OPENAI_API_KEY = 'test-key'
    process.env.NEXT_PUBLIC_SUPABASE_URL = 'http://mock.local'
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = 'anon-key'
  })

  it('returns 400 when attachments exceed MAX_ATTACHMENTS_PER_MESSAGE (4 files)', async () => {
    const attachments = Array.from({ length: 4 }, (_, i) => ({
      storagePath: `user/img${i}.jpg`,
      mimeType: 'image/jpeg',
      size: 1000,
    }))

    const res = await chatPost(makeRequest({ attachments }))
    expect(res.status).toBe(400)

    const body = await parseJson(res)
    expect(body.error).toContain('3枚まで')
  })

  it('returns 400 when message exceeds MAX_MESSAGE_LENGTH (2001 chars)', async () => {
    const longText = 'あ'.repeat(2001)

    const res = await chatPost(makeRequest({ text: longText }))
    expect(res.status).toBe(400)

    const body = await parseJson(res)
    expect(body.error).toContain('2000文字以内')
  })

  it('allows exactly MAX_MESSAGE_LENGTH (2000 chars)', async () => {
    const exactText = 'あ'.repeat(2000)

    const res = await chatPost(makeRequest({ text: exactText }))
    expect(res.status).toBe(200)
  })

  it('allows exactly MAX_ATTACHMENTS_PER_MESSAGE (3 files)', async () => {
    const attachments = Array.from({ length: 3 }, (_, i) => ({
      storagePath: `user/img${i}.jpg`,
      mimeType: 'image/jpeg',
      size: 1000,
    }))

    const res = await chatPost(makeRequest({ attachments }))
    expect(res.status).toBe(200)
  })
})
