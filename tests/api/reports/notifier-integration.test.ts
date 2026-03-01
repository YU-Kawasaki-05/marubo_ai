/** @file
 * QA-12（reports 部分）: /api/reports/monthly の通知連携テスト。
 * POST 失敗時の S1 通知、GET 失敗時の S2 通知、AppError < 500 で通知スキップを検証。
 */

import { beforeEach, describe, expect, it, vi } from 'vitest'

import { AppError } from '../../../src/shared/lib/errors'

// ── Mock: notifier ──

const notifierMock = vi.hoisted(() => ({
  notifyError: vi.fn<[string, string, string, string?], Promise<void>>(),
}))

vi.mock('../../../src/shared/lib/notifier', () => notifierMock)

// ── Mock: monthlyReport（POST で使用） ──

const monthlyReportMock = vi.hoisted(() => ({
  generateMonthlyReports: vi.fn<[unknown], Promise<unknown>>(),
  getCurrentMonth: vi.fn<[], string>(),
  isLastDayOfMonth: vi.fn<[], boolean>(),
  verifyCronAuth: vi.fn<[Request], boolean>(),
}))

vi.mock('../../../src/shared/lib/monthlyReport', () => monthlyReportMock)

// ── Mock: reportRead（GET で使用） ──

const reportReadMock = vi.hoisted(() => ({
  getStaffReportList: vi.fn<[unknown], Promise<unknown>>(),
  getStudentReport: vi.fn<[unknown, string], Promise<unknown>>(),
}))

vi.mock('../../../src/shared/lib/reportRead', () => reportReadMock)

// ── Mock: auth helpers ──

const requireAuthMock = vi.hoisted(() => ({
  requireAuth: vi.fn<[Request], Promise<unknown>>(),
}))

vi.mock('../../../src/shared/lib/requireAuth', () => requireAuthMock)

const requireStaffMock = vi.hoisted(() => ({
  requireStaff: vi.fn<[Request], Promise<unknown>>(),
}))

vi.mock('../../../src/shared/lib/requireStaff', () => requireStaffMock)

// ── Mock: request helpers ──

vi.mock('../../../src/shared/lib/request', () => ({
  generateRequestId: (prefix: string) => `${prefix}_test123`,
  parseJsonBody: async (req: Request) => req.json(),
}))

vi.mock('../../../src/shared/lib/response', () => ({
  jsonResponse: (requestId: string, data: unknown) =>
    new Response(JSON.stringify({ requestId, data }), {
      status: 200,
      headers: { 'content-type': 'application/json' },
    }),
}))

// ── Import route after mocks ──

import { POST, GET } from '../../../app/api/reports/monthly/route'

// ── Helpers ──

const BASE_URL = 'http://localhost/api/reports/monthly'
const STAFF_HEADER = { Authorization: 'Bearer staff-token', 'Content-Type': 'application/json' }
const STUDENT_HEADER = { Authorization: 'Bearer student-token' }

function postReport(payload: Record<string, unknown>) {
  return POST(
    new Request(BASE_URL, {
      method: 'POST',
      headers: STAFF_HEADER,
      body: JSON.stringify(payload),
    }),
  )
}

function getReport(params = '') {
  return GET(
    new Request(`${BASE_URL}${params}`, {
      method: 'GET',
      headers: STUDENT_HEADER,
    }),
  )
}

function getReportAsStaff(params = '') {
  return GET(
    new Request(`${BASE_URL}${params}`, {
      method: 'GET',
      headers: { Authorization: 'Bearer staff-token' },
    }),
  )
}

// ── Tests ──

describe('Reports notifier integration (QA-12)', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    notifierMock.notifyError.mockResolvedValue(undefined)
    monthlyReportMock.verifyCronAuth.mockReturnValue(false)
    monthlyReportMock.getCurrentMonth.mockReturnValue('2026-03')
    monthlyReportMock.isLastDayOfMonth.mockReturnValue(false)
    requireStaffMock.requireStaff.mockResolvedValue({
      authUserId: 'staff-auth',
      appUserId: 'staff-id',
      email: 'staff@example.com',
    })
    requireAuthMock.requireAuth.mockResolvedValue({
      authUserId: 'student-auth',
      appUserId: 'student-id',
      email: 'student@example.com',
      role: 'student',
    })
  })

  // ── POST: S1 notifyError on generation error (500+) ──

  describe('POST: notifier on error', () => {
    it('triggers S1 notifyError when generation throws unexpected error', async () => {
      monthlyReportMock.generateMonthlyReports.mockRejectedValueOnce(
        new Error('DB connection refused'),
      )

      const res = await postReport({ month: '2026-03' })
      expect(res.status).toBe(500)

      expect(notifierMock.notifyError).toHaveBeenCalledTimes(1)
      expect(notifierMock.notifyError).toHaveBeenCalledWith(
        'S1',
        '月次レポート生成失敗',
        'DB connection refused',
        'monthly_report_test123',
      )
    })

    it('triggers S1 notifyError when generation throws AppError with status >= 500', async () => {
      monthlyReportMock.generateMonthlyReports.mockRejectedValueOnce(
        new AppError(500, 'INTERNAL_ERROR', 'LLM API unavailable'),
      )

      const res = await postReport({ month: '2026-03' })
      expect(res.status).toBe(500)

      expect(notifierMock.notifyError).toHaveBeenCalledTimes(1)
      expect(notifierMock.notifyError).toHaveBeenCalledWith(
        'S1',
        '月次レポート生成失敗',
        'LLM API unavailable',
        'monthly_report_test123',
      )
    })

    it('does NOT trigger notifyError on AppError 400 (validation error)', async () => {
      monthlyReportMock.generateMonthlyReports.mockRejectedValueOnce(
        new AppError(400, 'INVALID_MONTH', 'month は YYYY-MM 形式で指定してください。'),
      )

      const res = await postReport({ month: 'invalid' })
      expect(res.status).toBe(400)

      expect(notifierMock.notifyError).not.toHaveBeenCalled()
    })

    it('does NOT trigger notifyError on AppError 401 (auth error)', async () => {
      requireStaffMock.requireStaff.mockRejectedValueOnce(
        new AppError(401, 'UNAUTHORIZED', 'ログイン情報を確認できませんでした。'),
      )

      const res = await postReport({ month: '2026-03' })
      expect(res.status).toBe(401)

      expect(notifierMock.notifyError).not.toHaveBeenCalled()
    })
  })

  // ── GET: S2 notifyError on read error (500+) ──

  describe('GET: notifier on error', () => {
    it('triggers S2 notifyError when read throws unexpected error', async () => {
      reportReadMock.getStudentReport.mockRejectedValueOnce(
        new Error('Supabase query timeout'),
      )

      const res = await getReport('?month=2026-03')
      expect(res.status).toBe(500)

      expect(notifierMock.notifyError).toHaveBeenCalledTimes(1)
      expect(notifierMock.notifyError).toHaveBeenCalledWith(
        'S2',
        'レポート参照エラー',
        'Supabase query timeout',
        'report_get_test123',
      )
    })

    it('triggers S2 notifyError when staff read throws AppError >= 500', async () => {
      requireAuthMock.requireAuth.mockResolvedValueOnce({
        authUserId: 'staff-auth',
        appUserId: 'staff-id',
        email: 'staff@example.com',
        role: 'staff',
      })
      reportReadMock.getStaffReportList.mockRejectedValueOnce(
        new AppError(500, 'DB_ERROR', 'Connection pool exhausted'),
      )

      const res = await getReportAsStaff('?month=2026-03')
      expect(res.status).toBe(500)

      expect(notifierMock.notifyError).toHaveBeenCalledTimes(1)
      expect(notifierMock.notifyError).toHaveBeenCalledWith(
        'S2',
        'レポート参照エラー',
        'Connection pool exhausted',
        'report_get_test123',
      )
    })

    it('does NOT trigger notifyError on AppError 401 (auth error)', async () => {
      requireAuthMock.requireAuth.mockRejectedValueOnce(
        new AppError(401, 'UNAUTHORIZED', 'Authorization ヘッダがありません。'),
      )

      const res = await getReport()
      expect(res.status).toBe(401)

      expect(notifierMock.notifyError).not.toHaveBeenCalled()
    })

    it('does NOT trigger notifyError on AppError 403', async () => {
      requireAuthMock.requireAuth.mockRejectedValueOnce(
        new AppError(403, 'FORBIDDEN', 'ユーザーロールを特定できませんでした。'),
      )

      const res = await getReport()
      expect(res.status).toBe(403)

      expect(notifierMock.notifyError).not.toHaveBeenCalled()
    })
  })
})
