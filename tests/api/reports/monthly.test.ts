import { beforeEach, describe, expect, it, vi } from 'vitest'

import type { MonthlyReportRow } from '../../../src/shared/types/database'
import { resetSupabaseAdminClientForTest } from '../../../src/shared/lib/supabaseAdmin'

// Mock LLM dependencies before importing route
vi.mock('@ai-sdk/openai', () => ({
  openai: () => ({}),
}))

vi.mock('ai', () => ({
  generateText: async () => ({
    text: '## 今月の学習サマリー\nテスト用レポート内容です。',
    usage: { inputTokens: 100, outputTokens: 200 },
  }),
}))

// Mock fetch for Resend email API
const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValue(
  new Response(JSON.stringify({ id: 'mock-email-id' }), { status: 200 }),
)

import { POST } from '../../../app/api/reports/monthly/route'

const BASE_URL = 'http://localhost/api/reports/monthly'
const STAFF_HEADER = { Authorization: 'Bearer staff-token', 'Content-Type': 'application/json' }
const CRON_SECRET = 'test-cron-secret-123'

async function parseJson(res: Response) {
  return (await res.json()) as any
}

function postReport(payload: Record<string, unknown>, headers?: Record<string, string>) {
  return POST(
    new Request(BASE_URL, {
      method: 'POST',
      headers: headers ?? STAFF_HEADER,
      body: JSON.stringify(payload),
    }),
  )
}

async function seedStudentWithMessages(month: string) {
  const { getSupabaseAdminClient } = await import('../../../src/shared/lib/supabaseAdmin')
  const supabase = getSupabaseAdminClient()

  // Seed student user
  await supabase.from('app_user').insert({
    id: 'student-report-id',
    auth_uid: 'student-report-auth',
    email: 'student-report@example.com',
    display_name: 'Report Student',
    role: 'student',
  })

  // Seed conversation (user_id = auth_uid in conversations table)
  const [year, mon] = month.split('-').map(Number)
  const convDate = new Date(Date.UTC(year, mon - 1, 15)).toISOString()

  await supabase.from('conversations').insert({
    id: 'conv-report-1',
    user_id: 'student-report-auth',
    title: '数学の質問',
    created_at: convDate,
  })

  // Seed messages
  await supabase.from('messages').insert([
    {
      id: 'msg-r1',
      conversation_id: 'conv-report-1',
      role: 'user' as const,
      content: '二次方程式の解き方を教えてください',
      created_at: new Date(Date.UTC(year, mon - 1, 15, 10, 0)).toISOString(),
    },
    {
      id: 'msg-r2',
      conversation_id: 'conv-report-1',
      role: 'assistant' as const,
      content: '二次方程式の解の公式は…',
      created_at: new Date(Date.UTC(year, mon - 1, 15, 10, 1)).toISOString(),
    },
    {
      id: 'msg-r3',
      conversation_id: 'conv-report-1',
      role: 'user' as const,
      content: '因数分解でも解けますか？',
      created_at: new Date(Date.UTC(year, mon - 1, 16, 14, 0)).toISOString(),
    },
  ])
}

describe('POST /api/reports/monthly (mock supabase)', () => {
  beforeEach(() => {
    process.env.MOCK_SUPABASE = 'true'
    delete process.env.CRON_SECRET
    delete process.env.RESEND_API_KEY
    delete process.env.ADMIN_EMAILS
    resetSupabaseAdminClientForTest()
    fetchSpy.mockClear()
  })

  // ── Staff manual trigger ──

  it('staff: generates report for specified month and user', async () => {
    await seedStudentWithMessages('2026-02')

    const res = await postReport({ month: '2026-02' })
    const body = await parseJson(res)
    expect(res.status).toBe(200)
    expect(body.data.month).toBe('2026-02')
    expect(body.data.dryRun).toBe(false)
    expect(body.data.results.total).toBe(1)
    expect(body.data.results.generated).toBe(1)
    expect(body.data.results.failed).toBe(0)
  })

  it('staff: dryRun=true does not persist reports', async () => {
    await seedStudentWithMessages('2026-02')

    const res = await postReport({ month: '2026-02', dryRun: true })
    const body = await parseJson(res)
    expect(res.status).toBe(200)
    expect(body.data.dryRun).toBe(true)
    expect(body.data.results.generated).toBe(1)

    // Verify no report was saved
    const { getSupabaseAdminClient } = await import('../../../src/shared/lib/supabaseAdmin')
    const supabase = getSupabaseAdminClient()
    const { data: reports } = await supabase
      .from('monthly_report')
      .select()
      .eq('month', '2026-02')
    expect(reports).toHaveLength(0)
  })

  it('staff: report is persisted with correct fields', async () => {
    await seedStudentWithMessages('2026-02')

    await postReport({ month: '2026-02' })

    const { getSupabaseAdminClient } = await import('../../../src/shared/lib/supabaseAdmin')
    const supabase = getSupabaseAdminClient()
    const { data: reports } = await supabase
      .from('monthly_report')
      .select()
      .eq('month', '2026-02')

    expect(reports).toHaveLength(1)
    const report = (reports as MonthlyReportRow[])[0]
    expect(report.user_id).toBe('student-report-id')
    expect(report.status).toBe('generated')
    expect(report.content).toContain('学習サマリー')
    expect(report.llm_tokens_in).toBe(100)
    expect(report.llm_tokens_out).toBe(200)
    expect(report.generated_at).toBeTruthy()
  })

  it('staff: single userId generates only that user report', async () => {
    await seedStudentWithMessages('2026-02')

    const res = await postReport({ month: '2026-02', userId: 'student-report-id' })
    const body = await parseJson(res)
    expect(res.status).toBe(200)
    expect(body.data.results.total).toBe(1)
    expect(body.data.results.generated).toBe(1)
  })

  it('staff: no active students returns total=0', async () => {
    const res = await postReport({ month: '2026-01' })
    const body = await parseJson(res)
    expect(res.status).toBe(200)
    expect(body.data.results.total).toBe(0)
    expect(body.data.results.generated).toBe(0)
  })

  it('staff: missing month returns 400 INVALID_MONTH', async () => {
    const res = await postReport({})
    const body = await parseJson(res)
    expect(res.status).toBe(400)
    expect(body.error.code).toBe('INVALID_MONTH')
  })

  it('staff: invalid month format returns 400 INVALID_MONTH', async () => {
    const res = await postReport({ month: '2026/02' })
    const body = await parseJson(res)
    expect(res.status).toBe(400)
    expect(body.error.code).toBe('INVALID_MONTH')
  })

  // ── Stats collection ──

  it('stats: user with 0 messages gets NO_DATA_CONTENT', async () => {
    const { getSupabaseAdminClient } = await import('../../../src/shared/lib/supabaseAdmin')
    const supabase = getSupabaseAdminClient()

    await supabase.from('app_user').insert({
      id: 'empty-student-id',
      auth_uid: 'empty-student-auth',
      email: 'empty@example.com',
      display_name: 'Empty Student',
      role: 'student',
    })

    // Conversation exists but no messages
    await supabase.from('conversations').insert({
      id: 'conv-empty-1',
      user_id: 'empty-student-auth',
      title: '空の会話',
      created_at: new Date(Date.UTC(2026, 2, 10)).toISOString(),
    })

    await postReport({ month: '2026-03' })

    const { data: reports } = await supabase
      .from('monthly_report')
      .select()
      .eq('user_id', 'empty-student-id')

    expect(reports).toHaveLength(1)
    const report = (reports as MonthlyReportRow[])[0]
    expect(report.content).toContain('質問がありませんでした')
    expect(report.llm_model).toBeNull()
  })

  // ── Notification ──

  it('notification: sends email when RESEND_API_KEY and ADMIN_EMAILS set', async () => {
    process.env.RESEND_API_KEY = 'test-resend-key'
    process.env.ADMIN_EMAILS = 'admin@example.com'
    await seedStudentWithMessages('2026-02')

    const res = await postReport({ month: '2026-02' })
    const body = await parseJson(res)
    expect(res.status).toBe(200)
    expect(body.data.notificationSent).toBe(true)
    expect(fetchSpy).toHaveBeenCalledTimes(1)

    const [url, opts] = fetchSpy.mock.calls[0]
    expect(url).toBe('https://api.resend.com/emails')
    expect((opts as RequestInit).method).toBe('POST')
  })

  it('notification: skipped when env vars not set', async () => {
    await seedStudentWithMessages('2026-02')

    const res = await postReport({ month: '2026-02' })
    const body = await parseJson(res)
    expect(res.status).toBe(200)
    expect(body.data.notificationSent).toBe(false)
    expect(fetchSpy).not.toHaveBeenCalled()
  })

  it('notification: skipped for dryRun', async () => {
    process.env.RESEND_API_KEY = 'test-resend-key'
    process.env.ADMIN_EMAILS = 'admin@example.com'
    await seedStudentWithMessages('2026-02')

    const res = await postReport({ month: '2026-02', dryRun: true })
    const body = await parseJson(res)
    expect(res.status).toBe(200)
    expect(body.data.notificationSent).toBe(false)
    expect(fetchSpy).not.toHaveBeenCalled()
  })

  // ── Cron auth ──

  it('cron: valid CRON_SECRET authenticates without staff token', async () => {
    process.env.CRON_SECRET = CRON_SECRET

    // Mock isLastDayOfMonth to return true
    const monthlyReport = await import('../../../src/shared/lib/monthlyReport')
    vi.spyOn(monthlyReport, 'isLastDayOfMonth').mockReturnValue(true)
    vi.spyOn(monthlyReport, 'getCurrentMonth').mockReturnValue('2026-02')

    await seedStudentWithMessages('2026-02')

    const res = await POST(
      new Request(BASE_URL, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${CRON_SECRET}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({}),
      }),
    )
    const body = await parseJson(res)
    expect(res.status).toBe(200)
    expect(body.data.month).toBe('2026-02')
    expect(body.data.results.generated).toBe(1)

    vi.restoreAllMocks()
  })

  it('cron: skips when not last day of month', async () => {
    process.env.CRON_SECRET = CRON_SECRET

    const monthlyReport = await import('../../../src/shared/lib/monthlyReport')
    vi.spyOn(monthlyReport, 'isLastDayOfMonth').mockReturnValue(false)

    const res = await POST(
      new Request(BASE_URL, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${CRON_SECRET}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({}),
      }),
    )
    const body = await parseJson(res)
    expect(res.status).toBe(200)
    expect(body.data.skipped).toBe(true)
    expect(body.data.reason).toBe('not_last_day')

    vi.restoreAllMocks()
  })

  // ── Auth errors ──

  it('no auth: returns 401 UNAUTHORIZED', async () => {
    const res = await POST(
      new Request(BASE_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ month: '2026-02' }),
      }),
    )
    const body = await parseJson(res)
    expect(res.status).toBe(401)
    expect(body.error.code).toBe('UNAUTHORIZED')
  })

  it('student token: returns 403 FORBIDDEN', async () => {
    const res = await POST(
      new Request(BASE_URL, {
        method: 'POST',
        headers: {
          Authorization: 'Bearer student-token',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ month: '2026-02' }),
      }),
    )
    const body = await parseJson(res)
    expect(res.status).toBe(403)
    expect(body.error.code).toBe('FORBIDDEN')
  })
})
