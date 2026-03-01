/** @file
 * レポート生成→参照→再生成の統合フローテスト（QA-10）。
 * POST /api/reports/monthly → GET /api/reports/monthly のエンドツーエンド検証。
 * 生成結果の永続化、userId フィールド、権限分離、再生成フローを確認。
 *
 * Note: Mock supabase の upsert は composite key に非対応のため、
 * 生成テストは userId 指定（単一ユーザー）で行い、
 * 複数ユーザー読み取りテストは insert() でシードする。
 */

import { beforeEach, describe, expect, it, vi } from 'vitest'

import type { MonthlyReportRow } from '../../../src/shared/types/database'
import { resetSupabaseAdminClientForTest } from '../../../src/shared/lib/supabaseAdmin'

// Mock LLM
vi.mock('@ai-sdk/openai', () => ({
  openai: () => ({}),
}))

vi.mock('ai', () => ({
  generateText: async () => ({
    text: '## 今月の学習サマリー\n統合テスト用レポート。',
    usage: { inputTokens: 50, outputTokens: 100 },
  }),
}))

// Mock Resend
vi.spyOn(globalThis, 'fetch').mockResolvedValue(
  new Response(JSON.stringify({ id: 'mock-email-id' }), { status: 200 }),
)

import { POST, GET } from '../../../app/api/reports/monthly/route'

const BASE_URL = 'http://localhost/api/reports/monthly'
const STAFF_HEADER = { Authorization: 'Bearer staff-token', 'Content-Type': 'application/json' }
const STUDENT_HEADER = { Authorization: 'Bearer student-token' }

async function parseJson(res: Response) {
  return (await res.json()) as any
}

async function getSupabase() {
  const { getSupabaseAdminClient } = await import('../../../src/shared/lib/supabaseAdmin')
  return getSupabaseAdminClient()
}

async function seedStudentWithMessages(
  id: string,
  authUid: string,
  email: string,
  displayName: string,
) {
  const supabase = await getSupabase()

  await supabase.from('app_user').insert({
    id,
    auth_uid: authUid,
    email,
    display_name: displayName,
    role: 'student',
  })

  await supabase.from('conversations').insert({
    id: `conv-${id}`,
    user_id: authUid,
    title: 'テスト会話',
    created_at: '2026-03-10T10:00:00.000Z',
  })

  await supabase.from('messages').insert({
    id: `msg-${id}`,
    conversation_id: `conv-${id}`,
    role: 'user' as const,
    content: 'テスト質問です',
    created_at: '2026-03-10T10:01:00.000Z',
  })
}

/** Seed report rows directly via insert (bypass upsert composite key issue) */
async function seedReportRows() {
  const supabase = await getSupabase()

  await supabase.from('app_user').insert([
    {
      id: 'flow-s1-id',
      auth_uid: 'mock-student-auth',
      email: 'flow-s1@example.com',
      display_name: 'Flow Student 1',
      role: 'student',
    },
    {
      id: 'flow-s2-id',
      auth_uid: 'flow-s2-auth',
      email: 'flow-s2@example.com',
      display_name: 'Flow Student 2',
      role: 'student',
    },
  ])

  await supabase.from('monthly_report').insert([
    {
      id: 'flow-rpt-1',
      user_id: 'flow-s1-id',
      month: '2026-03',
      status: 'generated',
      content: '## 今月の学習サマリー\nレポート1',
      stats: { questions: 5, conversations: 2 },
      generated_at: '2026-03-31T23:58:00.000Z',
      created_at: '2026-03-31T23:58:00.000Z',
    },
    {
      id: 'flow-rpt-2',
      user_id: 'flow-s2-id',
      month: '2026-03',
      status: 'failed',
      content: null,
      stats: { questions: 3, conversations: 1 },
      error_message: 'LLM timeout',
      created_at: '2026-03-31T23:59:00.000Z',
    },
  ])
}

describe('Report flow integration (QA-10)', () => {
  beforeEach(() => {
    process.env.MOCK_SUPABASE = 'true'
    delete process.env.CRON_SECRET
    delete process.env.RESEND_API_KEY
    delete process.env.ADMIN_EMAILS
    resetSupabaseAdminClientForTest()
  })

  // ── Staff read with userId field ──

  it('staff read returns userId field for each report', async () => {
    await seedReportRows()

    const res = await GET(
      new Request(`${BASE_URL}?month=2026-03`, { headers: { Authorization: 'Bearer staff-token' } }),
    )
    const body = await parseJson(res)
    expect(res.status).toBe(200)
    expect(body.data.reports).toHaveLength(2)

    const rpt1 = body.data.reports.find((r: any) => r.userId === 'flow-s1-id')
    const rpt2 = body.data.reports.find((r: any) => r.userId === 'flow-s2-id')
    expect(rpt1).toBeDefined()
    expect(rpt1.user.email).toBe('flow-s1@example.com')
    expect(rpt1.status).toBe('generated')
    expect(rpt2).toBeDefined()
    expect(rpt2.user.email).toBe('flow-s2@example.com')
    expect(rpt2.status).toBe('failed')
  })

  // ── Student can only see own report ──

  it('student reads only own report after generation', async () => {
    await seedReportRows()

    // student-token resolves to mock-student-auth → flow-s1-id
    const res = await GET(
      new Request(`${BASE_URL}?month=2026-03`, { headers: STUDENT_HEADER }),
    )
    const body = await parseJson(res)
    expect(res.status).toBe(200)
    expect(body.data.report).not.toBeNull()
    expect(body.data.report.id).toBe('flow-rpt-1')
    expect(body.data.report.status).toBe('generated')
    expect(body.data.report.content).toContain('学習サマリー')
    // Student response uses { report } not { reports }
    expect(body.data.reports).toBeUndefined()
  })

  it('student cannot see other students report', async () => {
    await seedReportRows()

    // Student only sees flow-rpt-1, not flow-rpt-2
    const res = await GET(
      new Request(`${BASE_URL}?month=2026-03`, { headers: STUDENT_HEADER }),
    )
    const body = await parseJson(res)
    expect(body.data.report.id).toBe('flow-rpt-1')
    // flow-rpt-2 (student2) should not be accessible
    expect(body.data.report.id).not.toBe('flow-rpt-2')
  })

  // ── Dry-run vs real run ──

  it('dry-run does not persist, then real run persists', async () => {
    await seedStudentWithMessages(
      'dryrun-student-id',
      'mock-student-auth',
      'dryrun@example.com',
      'Dry Run Student',
    )

    // Dry run
    const dryRes = await POST(
      new Request(BASE_URL, {
        method: 'POST',
        headers: STAFF_HEADER,
        body: JSON.stringify({ month: '2026-03', dryRun: true, userId: 'dryrun-student-id' }),
      }),
    )
    const dryBody = await parseJson(dryRes)
    expect(dryRes.status).toBe(200)
    expect(dryBody.data.dryRun).toBe(true)
    expect(dryBody.data.results.generated).toBe(1)

    // Verify nothing persisted
    const readDry = await GET(
      new Request(`${BASE_URL}?month=2026-03`, { headers: { Authorization: 'Bearer staff-token' } }),
    )
    const dryReadBody = await parseJson(readDry)
    expect(dryReadBody.data.reports).toHaveLength(0)

    // Real run
    const realRes = await POST(
      new Request(BASE_URL, {
        method: 'POST',
        headers: STAFF_HEADER,
        body: JSON.stringify({ month: '2026-03', userId: 'dryrun-student-id' }),
      }),
    )
    const realBody = await parseJson(realRes)
    expect(realBody.data.dryRun).toBe(false)
    expect(realBody.data.results.generated).toBe(1)

    // Verify persisted
    const readReal = await GET(
      new Request(`${BASE_URL}?month=2026-03`, { headers: { Authorization: 'Bearer staff-token' } }),
    )
    const realReadBody = await parseJson(readReal)
    expect(realReadBody.data.reports).toHaveLength(1)
    expect(realReadBody.data.reports[0].status).toBe('generated')
  })

  // ── Single user generation + read back ──

  it('generate single user → read back with correct stats', async () => {
    await seedStudentWithMessages(
      'stats-student-id',
      'mock-student-auth',
      'stats@example.com',
      'Stats Student',
    )

    const genRes = await POST(
      new Request(BASE_URL, {
        method: 'POST',
        headers: STAFF_HEADER,
        body: JSON.stringify({ month: '2026-03', userId: 'stats-student-id' }),
      }),
    )
    const genBody = await parseJson(genRes)
    expect(genRes.status).toBe(200)
    expect(genBody.data.results.total).toBe(1)
    expect(genBody.data.results.generated).toBe(1)

    // Staff read — verify userId and stats
    const readRes = await GET(
      new Request(`${BASE_URL}?month=2026-03`, { headers: { Authorization: 'Bearer staff-token' } }),
    )
    const readBody = await parseJson(readRes)
    expect(readBody.data.reports).toHaveLength(1)

    const rpt = readBody.data.reports[0]
    expect(rpt.userId).toBe('stats-student-id')
    expect(rpt.status).toBe('generated')
    expect(rpt.user.email).toBe('stats@example.com')

    // Verify DB record stats
    const supabase = await getSupabase()
    const { data: reports } = await supabase
      .from('monthly_report')
      .select()
      .eq('user_id', 'stats-student-id')
      .eq('month', '2026-03')

    const dbRows = (reports ?? []) as MonthlyReportRow[]
    // Find the 'generated' row (mock may have both 'generating' and 'generated')
    const generated = dbRows.find((r) => r.status === 'generated')
    expect(generated).toBeDefined()
    const stats = generated!.stats as Record<string, number>
    expect(stats.questions).toBe(1)
    expect(stats.conversations).toBe(1)
    expect(generated!.llm_tokens_in).toBe(50)
    expect(generated!.llm_tokens_out).toBe(100)
  })

  // ── Regeneration for single user ──

  it('regeneration with userId generates only that user', async () => {
    await seedStudentWithMessages(
      'regen-student-id',
      'mock-student-auth',
      'regen@example.com',
      'Regen Student',
    )

    const res = await POST(
      new Request(BASE_URL, {
        method: 'POST',
        headers: STAFF_HEADER,
        body: JSON.stringify({ month: '2026-03', userId: 'regen-student-id' }),
      }),
    )
    const body = await parseJson(res)
    expect(res.status).toBe(200)
    expect(body.data.results.total).toBe(1)
    expect(body.data.results.generated).toBe(1)

    // Read back
    const readRes = await GET(
      new Request(`${BASE_URL}?month=2026-03`, { headers: { Authorization: 'Bearer staff-token' } }),
    )
    const readBody = await parseJson(readRes)
    // At least 1 report row exists for this user
    const userReports = readBody.data.reports.filter(
      (r: any) => r.userId === 'regen-student-id',
    )
    expect(userReports.length).toBeGreaterThanOrEqual(1)
    expect(userReports.some((r: any) => r.status === 'generated')).toBe(true)
  })
})
