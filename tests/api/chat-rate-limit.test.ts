/** @file
 * QA-11 / QA-12（chat 部分）: レート制限 429 レスポンス＋通知連携の統合テスト。
 * 分間レート制限超過・月間クォータ超過時の HTTP 429、
 * S1/S2 通知の発火条件、resolveAppUserId 失敗時の 403 を検証。
 */

import { beforeEach, describe, expect, it, vi } from 'vitest'

import { AppError } from '../../src/shared/lib/errors'

// ── Mock: rateLimit（テストごとに挙動を制御） ──

const rateLimitMocks = vi.hoisted(() => ({
  resolveAppUserId: vi.fn<[string], Promise<string>>(),
  checkMinuteRate: vi.fn<[string], Promise<void>>(),
  checkMonthlyQuota: vi.fn<[string], Promise<void>>(),
  incrementUsage: vi.fn<[string], Promise<void>>(),
}))

vi.mock('@shared/lib/rateLimit', () => rateLimitMocks)

// ── Mock: notifier（呼び出しをスパイ） ──

const notifierMock = vi.hoisted(() => ({
  notifyError: vi.fn<[string, string, string, string?], Promise<void>>(),
}))

vi.mock('@shared/lib/notifier', () => notifierMock)

// ── Mock: Supabase (Auth + DB) ──

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

const aiMocks = vi.hoisted(() => ({
  streamText: vi.fn<unknown[], Promise<unknown>>(),
}))

vi.mock('@ai-sdk/openai', () => ({
  openai: () => ({}),
}))

vi.mock('ai', () => ({
  convertToModelMessages: async (messages: unknown[]) => messages,
  streamText: (...args: unknown[]) => aiMocks.streamText(...args),
}))

// ── Import route after mocks ──

import { POST as chatPost } from '../../app/api/chat/route'

// ── Helpers ──

function makeRequest(token = 'student-token') {
  return new Request('http://localhost/api/chat', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      messages: [{ id: 'm1', role: 'user', parts: [{ type: 'text', text: 'テスト質問' }] }],
    }),
  })
}

async function parseJson(res: Response) {
  return (await res.json()) as Record<string, unknown>
}

// ── Tests ──

describe('Chat rate limit + notifier integration (QA-11 / QA-12)', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    rateLimitMocks.resolveAppUserId.mockResolvedValue('mock-app-user-id')
    rateLimitMocks.checkMinuteRate.mockResolvedValue(undefined)
    rateLimitMocks.checkMonthlyQuota.mockResolvedValue(undefined)
    rateLimitMocks.incrementUsage.mockResolvedValue(undefined)
    notifierMock.notifyError.mockResolvedValue(undefined)
    // Default: streamText succeeds
    aiMocks.streamText.mockImplementation(async ({ onFinish }: any) => {
      if (onFinish) await onFinish({ text: 'AI mock answer' })
      return {
        toUIMessageStreamResponse: () =>
          new Response('data: mock\n\n', {
            status: 200,
            headers: { 'content-type': 'text/event-stream' },
          }),
      }
    })
    process.env.OPENAI_API_KEY = 'test-key'
    process.env.NEXT_PUBLIC_SUPABASE_URL = 'http://mock.local'
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = 'anon-key'
  })

  // ── QA-11: Rate limit 429 responses ──

  describe('QA-11: rate limit 429 responses', () => {
    it('returns 429 when minute rate limit is exceeded', async () => {
      rateLimitMocks.checkMinuteRate.mockRejectedValueOnce(
        new AppError(429, 'RATE_LIMIT_EXCEEDED', '送信が早すぎます。しばらく待ってからもう一度お試しください。'),
      )

      const res = await chatPost(makeRequest())
      expect(res.status).toBe(429)

      const body = await parseJson(res)
      expect(body.error).toContain('送信が早すぎます')
    })

    it('returns 429 when monthly quota is exceeded', async () => {
      rateLimitMocks.checkMonthlyQuota.mockRejectedValueOnce(
        new AppError(429, 'MONTHLY_QUOTA_EXCEEDED', '今月の質問上限（100 回）に達しました。来月になると再びご利用いただけます。ご不明点はスタッフにお問い合わせください。'),
      )

      const res = await chatPost(makeRequest())
      expect(res.status).toBe(429)

      const body = await parseJson(res)
      expect(body.error).toContain('今月の質問上限')
    })

    it('returns 429 with JSON content-type', async () => {
      rateLimitMocks.checkMinuteRate.mockRejectedValueOnce(
        new AppError(429, 'RATE_LIMIT_EXCEEDED', '送信が早すぎます。'),
      )

      const res = await chatPost(makeRequest())
      expect(res.status).toBe(429)
      expect(res.headers.get('Content-Type')).toBe('application/json')
    })

    it('returns 200 when rate limits pass', async () => {
      const res = await chatPost(makeRequest())
      expect(res.status).toBe(200)
    })

    it('returns 403 when resolveAppUserId fails', async () => {
      rateLimitMocks.resolveAppUserId.mockRejectedValueOnce(
        new AppError(403, 'USER_NOT_FOUND', 'ユーザー情報を取得できませんでした。'),
      )

      const res = await chatPost(makeRequest())
      expect(res.status).toBe(403)

      const body = await parseJson(res)
      expect(body.error).toContain('ユーザー情報を取得できませんでした')
    })
  })

  // ── QA-12: Notifier integration in chat route ──

  describe('QA-12: notifier integration in chat route', () => {
    it('triggers S2 notifyError on rate limit 429 (not S1)', async () => {
      rateLimitMocks.checkMinuteRate.mockRejectedValueOnce(
        new AppError(429, 'RATE_LIMIT_EXCEEDED', '送信が早すぎます。'),
      )

      await chatPost(makeRequest())

      // S2 should be called (per monitoring.md: レート制限発動 = S2)
      expect(notifierMock.notifyError).toHaveBeenCalledTimes(1)
      expect(notifierMock.notifyError).toHaveBeenCalledWith(
        'S2',
        'レート制限発動',
        expect.stringContaining('RATE_LIMIT_EXCEEDED'),
      )
    })

    it('triggers S2 notifyError on monthly quota 429', async () => {
      rateLimitMocks.checkMonthlyQuota.mockRejectedValueOnce(
        new AppError(429, 'MONTHLY_QUOTA_EXCEEDED', '今月の質問上限（100 回）に達しました。'),
      )

      await chatPost(makeRequest())

      expect(notifierMock.notifyError).toHaveBeenCalledTimes(1)
      expect(notifierMock.notifyError).toHaveBeenCalledWith(
        'S2',
        'レート制限発動',
        expect.stringContaining('MONTHLY_QUOTA_EXCEEDED'),
      )
    })

    it('does not trigger S1 on 429 rate limit', async () => {
      rateLimitMocks.checkMinuteRate.mockRejectedValueOnce(
        new AppError(429, 'RATE_LIMIT_EXCEEDED', '送信が早すぎます。'),
      )

      await chatPost(makeRequest())

      // Verify S1 was NOT called
      const calls = notifierMock.notifyError.mock.calls
      calls.forEach((call) => {
        expect(call[0]).not.toBe('S1')
      })
    })

    it('triggers S1 notifyError on LLM / unexpected error', async () => {
      aiMocks.streamText.mockRejectedValueOnce(new Error('OpenAI API connection refused'))
      const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {})

      const res = await chatPost(makeRequest())
      expect(res.status).toBe(500)

      expect(notifierMock.notifyError).toHaveBeenCalledWith(
        'S1',
        'LLM 全経路失敗',
        'OpenAI API connection refused',
      )

      errorSpy.mockRestore()
    })

    it('does not trigger notifyError on 403 user not found', async () => {
      rateLimitMocks.resolveAppUserId.mockRejectedValueOnce(
        new AppError(403, 'USER_NOT_FOUND', 'ユーザー情報を取得できませんでした。'),
      )

      await chatPost(makeRequest())

      expect(notifierMock.notifyError).not.toHaveBeenCalled()
    })

    it('does not trigger notifyError on normal successful request', async () => {
      await chatPost(makeRequest())

      expect(notifierMock.notifyError).not.toHaveBeenCalled()
    })
  })
})
