/** @file
 * notifier ユーティリティのテスト。
 * S1 メール送信、S2/S3 ログ出力、デバウンス、ENV 未設定時フォールバックを検証。
 */

import { beforeEach, describe, expect, it, vi } from 'vitest'

import { notifyError, resetDebounceForTest } from '../../../src/shared/lib/notifier'

// Mock fetch globally for entire file — never restore (Resend calls go here)
const fetchMock = vi.fn<Parameters<typeof fetch>, ReturnType<typeof fetch>>().mockResolvedValue(
  new Response(JSON.stringify({ id: 'mock-email-id' }), { status: 200 }),
)
vi.stubGlobal('fetch', fetchMock)

describe('notifier', () => {
  beforeEach(() => {
    resetDebounceForTest()
    fetchMock.mockClear()
    fetchMock.mockResolvedValue(
      new Response(JSON.stringify({ id: 'mock-email-id' }), { status: 200 }),
    )
    delete process.env.RESEND_API_KEY
    delete process.env.ADMIN_EMAILS
    delete process.env.MAIL_FROM
  })

  // ── S1: email sending ──

  it('S1: sends email when RESEND_API_KEY and ADMIN_EMAILS are set', async () => {
    process.env.RESEND_API_KEY = 'test-key'
    process.env.ADMIN_EMAILS = 'admin@example.com'
    vi.spyOn(console, 'error').mockImplementation(() => {})

    await notifyError('S1', 'LLM 全経路失敗', 'Connection timeout', 'req_abc123')

    expect(fetchMock).toHaveBeenCalledTimes(1)
    const [url, opts] = fetchMock.mock.calls[0]
    expect(url).toBe('https://api.resend.com/emails')
    expect((opts as RequestInit).method).toBe('POST')

    const body = JSON.parse((opts as RequestInit).body as string)
    expect(body.to).toEqual(['admin@example.com'])
    expect(body.subject).toContain('S1')
    expect(body.subject).toContain('LLM 全経路失敗')
    expect(body.text).toContain('Connection timeout')
    expect(body.text).toContain('req_abc123')

    vi.mocked(console.error).mockRestore()
  })

  it('S1: sends to multiple recipients (semicolon-separated)', async () => {
    process.env.RESEND_API_KEY = 'test-key'
    process.env.ADMIN_EMAILS = 'a@example.com; b@example.com'
    vi.spyOn(console, 'error').mockImplementation(() => {})

    await notifyError('S1', 'DB 接続失敗', 'ECONNREFUSED')

    expect(fetchMock).toHaveBeenCalledTimes(1)
    const body = JSON.parse((fetchMock.mock.calls[0][1] as RequestInit).body as string)
    expect(body.to).toEqual(['a@example.com', 'b@example.com'])

    vi.mocked(console.error).mockRestore()
  })

  it('S1: uses MAIL_FROM when set', async () => {
    process.env.RESEND_API_KEY = 'test-key'
    process.env.ADMIN_EMAILS = 'admin@example.com'
    process.env.MAIL_FROM = 'alert@marubo.ai'
    vi.spyOn(console, 'error').mockImplementation(() => {})

    await notifyError('S1', 'Test', 'Test detail')

    const body = JSON.parse((fetchMock.mock.calls[0][1] as RequestInit).body as string)
    expect(body.from).toBe('alert@marubo.ai')

    vi.mocked(console.error).mockRestore()
  })

  it('S1: skips email when RESEND_API_KEY not set', async () => {
    process.env.ADMIN_EMAILS = 'admin@example.com'
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {})
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {})

    await notifyError('S1', 'Test', 'Detail')

    expect(fetchMock).not.toHaveBeenCalled()
    expect(warnSpy).toHaveBeenCalledWith(
      expect.stringContaining('RESEND_API_KEY or ADMIN_EMAILS not set'),
    )

    warnSpy.mockRestore()
    errorSpy.mockRestore()
  })

  it('S1: skips email when ADMIN_EMAILS not set', async () => {
    process.env.RESEND_API_KEY = 'test-key'
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {})
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {})

    await notifyError('S1', 'Test', 'Detail')

    expect(fetchMock).not.toHaveBeenCalled()

    warnSpy.mockRestore()
    errorSpy.mockRestore()
  })

  it('S1: handles Resend API failure gracefully (no throw)', async () => {
    process.env.RESEND_API_KEY = 'test-key'
    process.env.ADMIN_EMAILS = 'admin@example.com'
    fetchMock.mockResolvedValueOnce(new Response('Internal Server Error', { status: 500 }))
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {})

    // Should not throw
    await notifyError('S1', 'Test', 'Detail')

    expect(fetchMock).toHaveBeenCalledTimes(1)
    expect(errorSpy).toHaveBeenCalledWith(
      expect.stringContaining('Resend API error'),
      500,
      expect.any(String),
    )

    errorSpy.mockRestore()
  })

  it('S1: handles fetch exception gracefully (double failure)', async () => {
    process.env.RESEND_API_KEY = 'test-key'
    process.env.ADMIN_EMAILS = 'admin@example.com'
    fetchMock.mockRejectedValueOnce(new Error('network down'))
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {})

    await notifyError('S1', 'Test', 'Detail')

    expect(errorSpy).toHaveBeenCalledWith(
      expect.stringContaining('Failed to send S1 email'),
      expect.any(Error),
    )

    errorSpy.mockRestore()
  })

  // ── S2: console.warn ──

  it('S2: logs warning to console', async () => {
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {})

    await notifyError('S2', '画像アップロード失敗', 'Storage timeout', 'req_xyz')

    expect(warnSpy).toHaveBeenCalledWith(
      expect.stringContaining('[S2]'),
    )
    expect(warnSpy).toHaveBeenCalledWith(
      expect.stringContaining('画像アップロード失敗'),
    )
    expect(fetchMock).not.toHaveBeenCalled()

    warnSpy.mockRestore()
  })

  // ── S3: console.info ──

  it('S3: logs info to console', async () => {
    const infoSpy = vi.spyOn(console, 'info').mockImplementation(() => {})

    await notifyError('S3', 'バリデーションエラー', 'image too large')

    expect(infoSpy).toHaveBeenCalledWith(
      expect.stringContaining('[S3]'),
    )
    expect(fetchMock).not.toHaveBeenCalled()

    infoSpy.mockRestore()
  })

  // ── Debounce ──

  it('debounce: suppresses duplicate notifications within 5 minutes', async () => {
    process.env.RESEND_API_KEY = 'test-key'
    process.env.ADMIN_EMAILS = 'admin@example.com'
    vi.spyOn(console, 'error').mockImplementation(() => {})

    await notifyError('S1', 'LLM 全経路失敗', 'first call')
    await notifyError('S1', 'LLM 全経路失敗', 'second call (should be suppressed)')

    // Only 1 email should be sent
    expect(fetchMock).toHaveBeenCalledTimes(1)

    vi.mocked(console.error).mockRestore()
  })

  it('debounce: allows different error titles through', async () => {
    process.env.RESEND_API_KEY = 'test-key'
    process.env.ADMIN_EMAILS = 'admin@example.com'
    vi.spyOn(console, 'error').mockImplementation(() => {})

    await notifyError('S1', 'LLM 全経路失敗', 'detail A')
    await notifyError('S1', 'DB 接続失敗', 'detail B')

    expect(fetchMock).toHaveBeenCalledTimes(2)

    vi.mocked(console.error).mockRestore()
  })

  it('debounce: allows after reset', async () => {
    process.env.RESEND_API_KEY = 'test-key'
    process.env.ADMIN_EMAILS = 'admin@example.com'
    vi.spyOn(console, 'error').mockImplementation(() => {})

    await notifyError('S1', 'LLM 全経路失敗', 'first')
    resetDebounceForTest()
    await notifyError('S1', 'LLM 全経路失敗', 'after reset')

    expect(fetchMock).toHaveBeenCalledTimes(2)

    vi.mocked(console.error).mockRestore()
  })

  // ── requestId optional ──

  it('S1: email body omits requestId section when not provided', async () => {
    process.env.RESEND_API_KEY = 'test-key'
    process.env.ADMIN_EMAILS = 'admin@example.com'
    vi.spyOn(console, 'error').mockImplementation(() => {})

    await notifyError('S1', 'Test', 'No requestId')

    const body = JSON.parse((fetchMock.mock.calls[0][1] as RequestInit).body as string)
    expect(body.text).not.toContain('リクエスト ID')

    vi.mocked(console.error).mockRestore()
  })
})
