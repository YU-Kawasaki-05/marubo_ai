import { beforeEach, describe, expect, it, vi } from 'vitest'

import type { MonthlyReportRow } from '../../../src/shared/types/database'
import { resetSupabaseAdminClientForTest } from '../../../src/shared/lib/supabaseAdmin'

// Mock LLM dependencies (required by monthlyReport import chain)
vi.mock('@ai-sdk/openai', () => ({
  openai: () => ({}),
}))

vi.mock('ai', () => ({
  generateText: async () => ({
    text: 'mock',
    usage: { inputTokens: 0, outputTokens: 0 },
  }),
}))

import { GET } from '../../../app/api/reports/monthly/route'
import { GET as csvGet } from '../../../app/api/reports/monthly/csv/route'

const BASE_URL = 'http://localhost/api/reports/monthly'
const CSV_URL = 'http://localhost/api/reports/monthly/csv'
const STAFF_HEADER = { Authorization: 'Bearer staff-token' }
const STUDENT_HEADER = { Authorization: 'Bearer student-token' }

async function parseJson(res: Response) {
  return (await res.json()) as any
}

async function seedReports() {
  const { getSupabaseAdminClient } = await import('../../../src/shared/lib/supabaseAdmin')
  const supabase = getSupabaseAdminClient()

  // Seed student user
  await supabase.from('app_user').insert({
    id: 'student-read-id',
    auth_uid: 'mock-student-auth',
    email: 'student@example.com',
    display_name: 'Test Student',
    role: 'student',
  })

  // Seed a second student
  await supabase.from('app_user').insert({
    id: 'student2-read-id',
    auth_uid: 'student2-auth',
    email: 'student2@example.com',
    display_name: 'Second Student',
    role: 'student',
  })

  // Seed conversations + messages (for CSV stats)
  await supabase.from('conversations').insert([
    {
      id: 'conv-csv-1',
      user_id: 'mock-student-auth',
      title: '数学の質問',
      created_at: '2026-02-15T10:00:00.000Z',
    },
    {
      id: 'conv-csv-2',
      user_id: 'student2-auth',
      title: '英語の質問',
      created_at: '2026-02-16T14:00:00.000Z',
    },
  ])

  await supabase.from('messages').insert([
    {
      id: 'msg-csv-1',
      conversation_id: 'conv-csv-1',
      role: 'user' as const,
      content: '二次方程式を教えて',
      created_at: '2026-02-15T10:01:00.000Z',
    },
    {
      id: 'msg-csv-2',
      conversation_id: 'conv-csv-1',
      role: 'assistant' as const,
      content: '二次方程式の解の公式は…',
      created_at: '2026-02-15T10:02:00.000Z',
    },
    {
      id: 'msg-csv-3',
      conversation_id: 'conv-csv-2',
      role: 'user' as const,
      content: '現在完了形を教えて',
      created_at: '2026-02-16T14:01:00.000Z',
    },
  ])

  // Seed reports
  await supabase.from('monthly_report').insert([
    {
      id: 'rpt-1',
      user_id: 'student-read-id',
      month: '2026-02',
      status: 'generated',
      content: '## 今月の学習サマリー\nテストレポート1',
      stats: { questions: 5, conversations: 2, activeDays: 3, mostActiveDay: '2026-02-15' },
      llm_model: 'gpt-4o-mini',
      llm_tokens_in: 100,
      llm_tokens_out: 200,
      generated_at: '2026-02-28T23:58:00.000Z',
      created_at: '2026-02-28T23:58:00.000Z',
    },
    {
      id: 'rpt-2',
      user_id: 'student2-read-id',
      month: '2026-02',
      status: 'generated',
      content: '## 今月の学習サマリー\nテストレポート2',
      stats: { questions: 3, conversations: 1, activeDays: 1, mostActiveDay: '2026-02-16' },
      llm_model: 'gpt-4o-mini',
      llm_tokens_in: 80,
      llm_tokens_out: 150,
      generated_at: '2026-02-28T23:59:00.000Z',
      created_at: '2026-02-28T23:59:00.000Z',
    },
  ])
}

describe('GET /api/reports/monthly (mock supabase)', () => {
  beforeEach(() => {
    process.env.MOCK_SUPABASE = 'true'
    resetSupabaseAdminClientForTest()
  })

  // ── Student access ──

  it('student: gets own report for specified month', async () => {
    await seedReports()

    const res = await GET(
      new Request(`${BASE_URL}?month=2026-02`, { headers: STUDENT_HEADER }),
    )
    const body = await parseJson(res)
    expect(res.status).toBe(200)
    expect(body.data.report).not.toBeNull()
    expect(body.data.report.id).toBe('rpt-1')
    expect(body.data.report.month).toBe('2026-02')
    expect(body.data.report.status).toBe('generated')
    expect(body.data.report.content).toContain('テストレポート1')
    expect(body.data.report.stats).toBeTruthy()
    expect(body.data.report.generatedAt).toBe('2026-02-28T23:58:00.000Z')
  })

  it('student: returns null for month with no report', async () => {
    await seedReports()

    const res = await GET(
      new Request(`${BASE_URL}?month=2026-01`, { headers: STUDENT_HEADER }),
    )
    const body = await parseJson(res)
    expect(res.status).toBe(200)
    expect(body.data.report).toBeNull()
  })

  it('student: cannot see other students reports (only own)', async () => {
    await seedReports()

    // student-token resolves to mock-student-auth → student-read-id
    // student2's report (rpt-2) should NOT be returned
    const res = await GET(
      new Request(`${BASE_URL}?month=2026-02`, { headers: STUDENT_HEADER }),
    )
    const body = await parseJson(res)
    expect(res.status).toBe(200)
    // Should only return rpt-1 (own), not rpt-2
    expect(body.data.report.id).toBe('rpt-1')
  })

  // ── Staff access ──

  it('staff: gets all reports with pagination', async () => {
    await seedReports()

    const res = await GET(
      new Request(`${BASE_URL}?month=2026-02`, { headers: STAFF_HEADER }),
    )
    const body = await parseJson(res)
    expect(res.status).toBe(200)
    expect(body.data.reports).toHaveLength(2)
    expect(body.data.pagination.total).toBe(2)
    expect(body.data.pagination.totalPages).toBe(1)
  })

  it('staff: pagination with limit=1', async () => {
    await seedReports()

    const res = await GET(
      new Request(`${BASE_URL}?month=2026-02&limit=1&page=1`, { headers: STAFF_HEADER }),
    )
    const body = await parseJson(res)
    expect(res.status).toBe(200)
    expect(body.data.reports).toHaveLength(1)
    expect(body.data.pagination.total).toBe(2)
    expect(body.data.pagination.totalPages).toBe(2)

    // page 2
    const res2 = await GET(
      new Request(`${BASE_URL}?month=2026-02&limit=1&page=2`, { headers: STAFF_HEADER }),
    )
    const body2 = await parseJson(res2)
    expect(body2.data.reports).toHaveLength(1)
    expect(body2.data.reports[0].id).not.toBe(body.data.reports[0].id)
  })

  it('staff: filter by userId', async () => {
    await seedReports()

    const res = await GET(
      new Request(`${BASE_URL}?month=2026-02&userId=student2-read-id`, {
        headers: STAFF_HEADER,
      }),
    )
    const body = await parseJson(res)
    expect(res.status).toBe(200)
    expect(body.data.reports).toHaveLength(1)
    expect(body.data.reports[0].id).toBe('rpt-2')
  })

  it('staff: report includes user info', async () => {
    await seedReports()

    const res = await GET(
      new Request(`${BASE_URL}?month=2026-02`, { headers: STAFF_HEADER }),
    )
    const body = await parseJson(res)
    expect(res.status).toBe(200)

    const rpt = body.data.reports.find((r: any) => r.id === 'rpt-1')
    expect(rpt.user.email).toBe('student@example.com')
    expect(rpt.user.displayName).toBe('Test Student')
  })

  it('staff: empty month returns empty array', async () => {
    await seedReports()

    const res = await GET(
      new Request(`${BASE_URL}?month=2026-01`, { headers: STAFF_HEADER }),
    )
    const body = await parseJson(res)
    expect(res.status).toBe(200)
    expect(body.data.reports).toHaveLength(0)
    expect(body.data.pagination.total).toBe(0)
  })

  // ── Staff detail (detail=true) ──

  it('staff: detail=true + userId returns single report with content', async () => {
    await seedReports()

    const res = await GET(
      new Request(`${BASE_URL}?month=2026-02&userId=student-read-id&detail=true`, {
        headers: STAFF_HEADER,
      }),
    )
    const body = await parseJson(res)
    expect(res.status).toBe(200)
    expect(body.data.report).not.toBeNull()
    expect(body.data.report.id).toBe('rpt-1')
    expect(body.data.report.content).toContain('テストレポート1')
    expect(body.data.report.status).toBe('generated')
    expect(body.data.report.stats).toBeTruthy()
    expect(body.data.report.generatedAt).toBe('2026-02-28T23:58:00.000Z')
    expect(body.data.report.user.email).toBe('student@example.com')
    expect(body.data.report.user.displayName).toBe('Test Student')
  })

  it('staff: detail=true + userId returns null for non-existent report', async () => {
    await seedReports()

    const res = await GET(
      new Request(`${BASE_URL}?month=2026-01&userId=student-read-id&detail=true`, {
        headers: STAFF_HEADER,
      }),
    )
    const body = await parseJson(res)
    expect(res.status).toBe(200)
    expect(body.data.report).toBeNull()
  })

  it('staff: detail=true + non-existent userId returns null', async () => {
    await seedReports()

    const res = await GET(
      new Request(`${BASE_URL}?month=2026-02&userId=non-existent-id&detail=true`, {
        headers: STAFF_HEADER,
      }),
    )
    const body = await parseJson(res)
    expect(res.status).toBe(200)
    expect(body.data.report).toBeNull()
  })

  it('staff: detail=true without userId falls through to list', async () => {
    await seedReports()

    const res = await GET(
      new Request(`${BASE_URL}?month=2026-02&detail=true`, {
        headers: STAFF_HEADER,
      }),
    )
    const body = await parseJson(res)
    expect(res.status).toBe(200)
    // Should return list format (reports array), not detail format
    expect(body.data.reports).toBeDefined()
    expect(body.data.reports).toHaveLength(2)
  })

  it('student: detail param is ignored (returns own report only)', async () => {
    await seedReports()

    const res = await GET(
      new Request(`${BASE_URL}?month=2026-02&userId=student2-read-id&detail=true`, {
        headers: STUDENT_HEADER,
      }),
    )
    const body = await parseJson(res)
    expect(res.status).toBe(200)
    // Student path ignores userId/detail params, returns own report
    expect(body.data.report).not.toBeNull()
    expect(body.data.report.id).toBe('rpt-1')
  })

  // ── Validation ──

  it('invalid month returns 400', async () => {
    const res = await GET(
      new Request(`${BASE_URL}?month=2026/02`, { headers: STAFF_HEADER }),
    )
    const body = await parseJson(res)
    expect(res.status).toBe(400)
    expect(body.error.code).toBe('INVALID_MONTH')
  })

  // ── Auth errors ──

  it('no auth returns 401', async () => {
    const res = await GET(new Request(`${BASE_URL}?month=2026-02`))
    const body = await parseJson(res)
    expect(res.status).toBe(401)
    expect(body.error.code).toBe('UNAUTHORIZED')
  })

  it('invalid token returns 401', async () => {
    const res = await GET(
      new Request(`${BASE_URL}?month=2026-02`, {
        headers: { Authorization: 'Bearer bad-token' },
      }),
    )
    const body = await parseJson(res)
    expect(res.status).toBe(401)
    expect(body.error.code).toBe('UNAUTHORIZED')
  })
})

describe('GET /api/reports/monthly/csv (mock supabase)', () => {
  beforeEach(() => {
    process.env.MOCK_SUPABASE = 'true'
    resetSupabaseAdminClientForTest()
  })

  it('staff: returns CSV with correct headers and data', async () => {
    await seedReports()

    const res = await csvGet(
      new Request(`${CSV_URL}?month=2026-02`, { headers: STAFF_HEADER }),
    )
    expect(res.status).toBe(200)
    expect(res.headers.get('content-type')).toBe('text/csv; charset=utf-8')
    expect(res.headers.get('content-disposition')).toContain('marubo_ai_report_2026-02.csv')

    const csv = await res.text()
    const lines = csv.replace('\uFEFF', '').trim().split('\r\n')
    expect(lines[0]).toBe('email,display_name,conversations,questions,first_activity,last_activity,report_status')
    expect(lines.length).toBe(3) // header + 2 rows
  })

  it('staff: CSV row contains correct stats', async () => {
    await seedReports()

    const res = await csvGet(
      new Request(`${CSV_URL}?month=2026-02`, { headers: STAFF_HEADER }),
    )
    const csv = await res.text()
    const lines = csv.replace('\uFEFF', '').trim().split('\r\n')

    // Find student1's row
    const student1Row = lines.find((l) => l.includes('student@example.com'))
    expect(student1Row).toBeDefined()
    expect(student1Row).toContain('Test Student')
    expect(student1Row).toContain('generated')
  })

  it('staff: empty month returns CSV with header only', async () => {
    const res = await csvGet(
      new Request(`${CSV_URL}?month=2026-01`, { headers: STAFF_HEADER }),
    )
    expect(res.status).toBe(200)
    const csv = await res.text()
    const lines = csv.replace('\uFEFF', '').trim().split('\r\n')
    expect(lines.length).toBe(1) // header only
  })

  it('staff: missing month returns 400', async () => {
    const res = await csvGet(
      new Request(CSV_URL, { headers: STAFF_HEADER }),
    )
    const body = await parseJson(res)
    expect(res.status).toBe(400)
    expect(body.error.code).toBe('INVALID_MONTH')
  })

  it('student: returns 403 FORBIDDEN', async () => {
    const res = await csvGet(
      new Request(`${CSV_URL}?month=2026-02`, { headers: STUDENT_HEADER }),
    )
    const body = await parseJson(res)
    expect(res.status).toBe(403)
    expect(body.error.code).toBe('FORBIDDEN')
  })

  it('no auth: returns 401 UNAUTHORIZED', async () => {
    const res = await csvGet(new Request(`${CSV_URL}?month=2026-02`))
    const body = await parseJson(res)
    expect(res.status).toBe(401)
    expect(body.error.code).toBe('UNAUTHORIZED')
  })
})
