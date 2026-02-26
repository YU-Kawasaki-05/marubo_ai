import { beforeEach, describe, expect, it, vi } from 'vitest'

// --- Mock state ---
const mockState = vi.hoisted(() => ({
  signedUploadCalls: [] as Array<{ path: string }>,
  signError: null as { message: string } | null,
}))

// --- Mock Supabase client ---
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

import { POST } from '../../app/api/attachments/sign/route'

function buildRequest(
  body: Record<string, unknown>,
  token?: string,
): Request {
  const headers: Record<string, string> = { 'Content-Type': 'application/json' }
  if (token) {
    headers['Authorization'] = `Bearer ${token}`
  }
  return new Request('http://localhost/api/attachments/sign', {
    method: 'POST',
    headers,
    body: JSON.stringify(body),
  })
}

async function parseJson(res: Response) {
  return (await res.json()) as Record<string, unknown>
}

describe('/api/attachments/sign', () => {
  beforeEach(() => {
    mockState.signedUploadCalls = []
    mockState.signError = null
  })

  // --- 認証系テスト ---

  it('Authorization ヘッダなしで 401 を返す', async () => {
    const res = await POST(
      new Request('http://localhost/api/attachments/sign', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ mimeType: 'image/jpeg', size: 1000 }),
      }),
    )
    expect(res.status).toBe(401)
    const body = await parseJson(res)
    expect((body.error as Record<string, string>).code).toBe('UNAUTHORIZED')
  })

  it('不正なトークンで 401 を返す', async () => {
    const res = await POST(buildRequest({ mimeType: 'image/jpeg', size: 1000 }, 'invalid-token'))
    expect(res.status).toBe(401)
    const body = await parseJson(res)
    expect((body.error as Record<string, string>).code).toBe('UNAUTHORIZED')
  })

  // --- バリデーション系テスト ---

  it('mimeType 未指定で 400 を返す', async () => {
    const res = await POST(buildRequest({ size: 1000 }, 'student-token'))
    expect(res.status).toBe(400)
    const body = await parseJson(res)
    expect((body.error as Record<string, string>).code).toBe('MISSING_MIME_TYPE')
  })

  it('size 未指定で 400 を返す', async () => {
    const res = await POST(buildRequest({ mimeType: 'image/jpeg' }, 'student-token'))
    expect(res.status).toBe(400)
    const body = await parseJson(res)
    expect((body.error as Record<string, string>).code).toBe('MISSING_SIZE')
  })

  it('非対応 MIME タイプで 400 を返す', async () => {
    const res = await POST(buildRequest({ mimeType: 'image/gif', size: 1000 }, 'student-token'))
    expect(res.status).toBe(400)
    const body = await parseJson(res)
    expect((body.error as Record<string, string>).code).toBe('INVALID_MIME_TYPE')
  })

  it('サイズ超過で 400 を返す', async () => {
    const oversize = 6 * 1024 * 1024 // 6 MB
    const res = await POST(buildRequest({ mimeType: 'image/jpeg', size: oversize }, 'student-token'))
    expect(res.status).toBe(400)
    const body = await parseJson(res)
    expect((body.error as Record<string, string>).code).toBe('FILE_TOO_LARGE')
  })

  it('サイズが 0 以下で 400 を返す', async () => {
    const res = await POST(buildRequest({ mimeType: 'image/jpeg', size: 0 }, 'student-token'))
    expect(res.status).toBe(400)
    const body = await parseJson(res)
    expect((body.error as Record<string, string>).code).toBe('INVALID_FILE_SIZE')
  })

  // --- 正常系テスト ---

  it('JPEG で署名 URL を返す', async () => {
    const res = await POST(buildRequest({ mimeType: 'image/jpeg', size: 2000 }, 'student-token'))
    expect(res.status).toBe(200)
    const body = await parseJson(res)

    expect(body.requestId).toBeTruthy()

    const data = body.data as Record<string, string>
    expect(data.signedUrl).toContain('mock.supabase.co')
    expect(data.storagePath).toMatch(/^mock-student-uid\/[a-f0-9-]+\.jpg$/)
    expect(data.token).toBe('mock-token')

    expect(mockState.signedUploadCalls).toHaveLength(1)
    expect(mockState.signedUploadCalls[0].path).toBe(data.storagePath)
  })

  it('PNG で署名 URL を返す', async () => {
    const res = await POST(buildRequest({ mimeType: 'image/png', size: 500 }, 'student-token'))
    expect(res.status).toBe(200)
    const body = await parseJson(res)
    const data = body.data as Record<string, string>
    expect(data.storagePath).toMatch(/\.png$/)
  })

  it('WebP で署名 URL を返す', async () => {
    const res = await POST(buildRequest({ mimeType: 'image/webp', size: 1500 }, 'student-token'))
    expect(res.status).toBe(200)
    const body = await parseJson(res)
    const data = body.data as Record<string, string>
    expect(data.storagePath).toMatch(/\.webp$/)
  })

  it('5 MB ちょうどは許可される', async () => {
    const exactMax = 5 * 1024 * 1024
    const res = await POST(buildRequest({ mimeType: 'image/jpeg', size: exactMax }, 'student-token'))
    expect(res.status).toBe(200)
  })

  // --- Storage エラー系テスト ---

  it('Storage 署名 URL 発行失敗で 500 を返す', async () => {
    mockState.signError = { message: 'Bucket not found' }
    const res = await POST(buildRequest({ mimeType: 'image/jpeg', size: 1000 }, 'student-token'))
    expect(res.status).toBe(500)
    const body = await parseJson(res)
    expect((body.error as Record<string, string>).code).toBe('SIGN_URL_FAILED')
  })
})
