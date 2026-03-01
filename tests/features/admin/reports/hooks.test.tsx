/** @file
 * useReportsQuery / useReportsMutation フックのテスト（QA-14）。
 * mock fetcher でルートハンドラを直接呼び出し、フックの動作を検証。
 */

import React from 'react'
import '@testing-library/jest-dom/vitest'
import { render, screen, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { resetSupabaseAdminClientForTest } from '../../../../src/shared/lib/supabaseAdmin'

// Mock LLM (required by monthlyReport import chain)
vi.mock('@ai-sdk/openai', () => ({
  openai: () => ({}),
}))

vi.mock('ai', () => ({
  generateText: async () => ({
    text: 'mock',
    usage: { inputTokens: 0, outputTokens: 0 },
  }),
}))

import { GET } from '../../../../app/api/reports/monthly/route'
import { GET as csvGet } from '../../../../app/api/reports/monthly/csv/route'
import { POST } from '../../../../app/api/reports/monthly/route'
import { useReportsQuery } from '../../../../src/features/admin/reports/hooks/useReportsQuery'
import { useReportsMutation } from '../../../../src/features/admin/reports/hooks/useReportsMutation'

const BASE_URL = 'http://localhost'
const STAFF_AUTH = { Authorization: 'Bearer staff-token' }

// ── Route handler fetcher ──

async function mockFetcher(url: string | URL | Request, init?: RequestInit): Promise<Response> {
  const urlStr = typeof url === 'string' ? url : url instanceof URL ? url.toString() : url.url
  const fullUrl = urlStr.startsWith('/') ? `${BASE_URL}${urlStr}` : urlStr

  if (fullUrl.includes('/api/reports/monthly/csv')) {
    return csvGet(new Request(fullUrl, { headers: init?.headers }))
  }

  if (fullUrl.includes('/api/reports/monthly')) {
    if (init?.method === 'POST') {
      return POST(new Request(fullUrl, {
        method: 'POST',
        headers: init?.headers,
        body: init?.body,
      }))
    }
    return GET(new Request(fullUrl, { headers: init?.headers }))
  }

  throw new Error(`Unhandled request: ${urlStr}`)
}

// ── Seed data ──

async function seedReports() {
  const { getSupabaseAdminClient } = await import('../../../../src/shared/lib/supabaseAdmin')
  const supabase = getSupabaseAdminClient()

  await supabase.from('app_user').insert([
    {
      id: 'hook-student1-id',
      auth_uid: 'hook-student1-auth',
      email: 'hook-student1@example.com',
      display_name: 'Hook Student 1',
      role: 'student',
    },
    {
      id: 'hook-student2-id',
      auth_uid: 'hook-student2-auth',
      email: 'hook-student2@example.com',
      display_name: 'Hook Student 2',
      role: 'student',
    },
  ])

  await supabase.from('monthly_report').insert([
    {
      id: 'hook-rpt-1',
      user_id: 'hook-student1-id',
      month: '2026-03',
      status: 'generated',
      content: '## サマリー\nレポート1',
      stats: { questions: 5, conversations: 2 },
      generated_at: '2026-03-31T23:58:00.000Z',
      created_at: '2026-03-31T23:58:00.000Z',
    },
    {
      id: 'hook-rpt-2',
      user_id: 'hook-student2-id',
      month: '2026-03',
      status: 'failed',
      content: null,
      stats: { questions: 3, conversations: 1 },
      error_message: 'LLM timeout',
      created_at: '2026-03-31T23:59:00.000Z',
    },
  ])
}

// ── useReportsQuery テスト ──

function QueryTestComponent({ month }: { month: string }) {
  const { data, loading, error } = useReportsQuery({
    fetcher: mockFetcher as typeof fetch,
    headers: STAFF_AUTH,
    params: { month },
  })

  if (loading) return <div>loading</div>
  if (error) return <div>error:{error.message}</div>
  return (
    <div>
      <span data-testid="count">{data?.reports.length ?? 0}</span>
      {data?.reports.map((r) => (
        <span key={r.id} data-testid={`report-${r.id}`}>
          {r.user.email}|{r.status}|{r.userId}
        </span>
      ))}
    </div>
  )
}

describe('useReportsQuery (QA-14)', () => {
  beforeEach(() => {
    process.env.MOCK_SUPABASE = 'true'
    resetSupabaseAdminClientForTest()
  })

  it('fetches report list with userId and status', async () => {
    await seedReports()

    render(<QueryTestComponent month="2026-03" />)

    await waitFor(() => expect(screen.queryByText('loading')).not.toBeInTheDocument())

    expect(screen.getByTestId('count').textContent).toBe('2')
    expect(screen.getByTestId('report-hook-rpt-1').textContent).toContain('hook-student1@example.com')
    expect(screen.getByTestId('report-hook-rpt-1').textContent).toContain('generated')
    expect(screen.getByTestId('report-hook-rpt-1').textContent).toContain('hook-student1-id')
    expect(screen.getByTestId('report-hook-rpt-2').textContent).toContain('failed')
    expect(screen.getByTestId('report-hook-rpt-2').textContent).toContain('hook-student2-id')
  })

  it('returns empty list for month with no reports', async () => {
    render(<QueryTestComponent month="2025-01" />)

    await waitFor(() => expect(screen.queryByText('loading')).not.toBeInTheDocument())

    expect(screen.getByTestId('count').textContent).toBe('0')
  })
})

// ── useReportsMutation テスト ──

describe('useReportsMutation (QA-14)', () => {
  beforeEach(() => {
    process.env.MOCK_SUPABASE = 'true'
    delete process.env.RESEND_API_KEY
    delete process.env.ADMIN_EMAILS
    resetSupabaseAdminClientForTest()
  })

  it('generateReports calls POST with correct params', async () => {
    const { generateReports } = useReportsMutation({
      fetcher: mockFetcher as typeof fetch,
      headers: STAFF_AUTH,
    })

    // No students seeded → total=0 but should not throw
    const result = await generateReports('2026-03', false)
    expect(result.results.total).toBe(0)
  })

  it('generateReports dry-run returns dryRun=true', async () => {
    const { generateReports } = useReportsMutation({
      fetcher: mockFetcher as typeof fetch,
      headers: STAFF_AUTH,
    })

    const result = await generateReports('2026-03', true)
    expect(result.dryRun).toBe(true)
  })

  it('regenerateReport calls POST with userId', async () => {
    // Seed a student with messages so generation succeeds
    const { getSupabaseAdminClient } = await import('../../../../src/shared/lib/supabaseAdmin')
    const supabase = getSupabaseAdminClient()

    await supabase.from('app_user').insert({
      id: 'regen-student-id',
      auth_uid: 'regen-student-auth',
      email: 'regen@example.com',
      display_name: 'Regen Student',
      role: 'student',
    })

    await supabase.from('conversations').insert({
      id: 'regen-conv-1',
      user_id: 'regen-student-auth',
      title: 'テスト会話',
      created_at: '2026-03-15T10:00:00.000Z',
    })

    await supabase.from('messages').insert({
      id: 'regen-msg-1',
      conversation_id: 'regen-conv-1',
      role: 'user' as const,
      content: 'テスト質問',
      created_at: '2026-03-15T10:01:00.000Z',
    })

    const { regenerateReport } = useReportsMutation({
      fetcher: mockFetcher as typeof fetch,
      headers: STAFF_AUTH,
    })

    const result = await regenerateReport('2026-03', 'regen-student-id')
    expect(result.results.total).toBe(1)
    expect(result.results.generated).toBe(1)
  })

  it('downloadCsv triggers blob download', async () => {
    await seedReports()

    // Mock DOM elements for download
    const mockClick = vi.fn()
    const mockAppendChild = vi.spyOn(document.body, 'appendChild').mockImplementation(() => null as any)
    const mockRemoveChild = vi.spyOn(document.body, 'removeChild').mockImplementation(() => null as any)
    const mockCreateObjectURL = vi.fn(() => 'blob:mock-url')
    const mockRevokeObjectURL = vi.fn()
    globalThis.URL.createObjectURL = mockCreateObjectURL
    globalThis.URL.revokeObjectURL = mockRevokeObjectURL

    const origCreateElement = document.createElement.bind(document)
    vi.spyOn(document, 'createElement').mockImplementation((tag: string) => {
      if (tag === 'a') {
        const el = origCreateElement('a')
        el.click = mockClick
        return el
      }
      return origCreateElement(tag)
    })

    const { downloadCsv } = useReportsMutation({
      fetcher: mockFetcher as typeof fetch,
      headers: STAFF_AUTH,
    })

    await downloadCsv('2026-03')

    expect(mockCreateObjectURL).toHaveBeenCalledTimes(1)
    expect(mockClick).toHaveBeenCalledTimes(1)
    expect(mockRevokeObjectURL).toHaveBeenCalledTimes(1)
    expect(mockAppendChild).toHaveBeenCalledTimes(1)
    expect(mockRemoveChild).toHaveBeenCalledTimes(1)

    mockAppendChild.mockRestore()
    mockRemoveChild.mockRestore()
    vi.restoreAllMocks()
  })

  it('generateReports throws on API error', async () => {
    const { generateReports } = useReportsMutation({
      fetcher: mockFetcher as typeof fetch,
      headers: { Authorization: 'Bearer student-token' },
    })

    await expect(generateReports('2026-03', false)).rejects.toThrow()
  })
})
