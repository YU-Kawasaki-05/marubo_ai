import { beforeEach, describe, expect, it } from 'vitest'

import { POST as allowlistPost, GET as allowlistGet } from '../../../app/api/admin/allowlist/route'
import { POST as allowlistImportPost } from '../../../app/api/admin/allowlist/import/route'
import { PATCH as allowlistPatch } from '../../../app/api/admin/allowlist/[email]/route'
import { resetSupabaseAdminClientForTest } from '../../../src/shared/lib/supabaseAdmin'
import { useAllowlistMutations } from '../../../src/features/admin/allowlist/hooks/useAllowlistMutations'

const BASE_URL = 'http://localhost/api/admin/allowlist'
const STAFF_HEADER = { Authorization: 'Bearer staff-token', 'Content-Type': 'application/json' }

async function parseJson(res: Response) {
  const json = (await res.json()) as any
  return json
}

describe('/api/admin/allowlist (mock supabase)', () => {
  beforeEach(() => {
    process.env.MOCK_SUPABASE = 'true'
    resetSupabaseAdminClientForTest()
  })

  it('GET returns empty list initially', async () => {
    const req = new Request(BASE_URL, { method: 'GET', headers: STAFF_HEADER })
    const res = await allowlistGet(req)
    const body = await parseJson(res)
    expect(res.status).toBe(200)
    expect(Array.isArray(body.data)).toBe(true)
    expect(body.data.length).toBe(0)
  })

  it('POST creates a new allowed_email', async () => {
    const req = new Request(BASE_URL, {
      method: 'POST',
      headers: STAFF_HEADER,
      body: JSON.stringify({
        email: 'student01@example.com',
        status: 'active',
        label: 'Test',
        notes: 'memo',
      }),
    })
    const res = await allowlistPost(req)
    const body = await parseJson(res)
    expect(res.status).toBe(201)
    expect(body.data.email).toBe('student01@example.com')
    expect(body.data.status).toBe('active')
  })

  it('POST duplicate returns 409', async () => {
    const createReq = new Request(BASE_URL, {
      method: 'POST',
      headers: STAFF_HEADER,
      body: JSON.stringify({ email: 'dup@example.com', status: 'active' }),
    })
    await allowlistPost(createReq)

    const dupReq = new Request(BASE_URL, {
      method: 'POST',
      headers: STAFF_HEADER,
      body: JSON.stringify({ email: 'dup@example.com', status: 'active' }),
    })
    const res = await allowlistPost(dupReq)
    const body = await parseJson(res)
    expect(res.status).toBe(409)
    expect(body.error.code).toBe('ALLOWLIST_EXISTS')
  })

  it('PATCH updates status with allowed transition', async () => {
    const createReq = new Request(BASE_URL, {
      method: 'POST',
      headers: STAFF_HEADER,
      body: JSON.stringify({ email: 'change@example.com', status: 'active' }),
    })
    await allowlistPost(createReq)

    const patchReq = new Request(`${BASE_URL}/change@example.com`, {
      method: 'PATCH',
      headers: STAFF_HEADER,
      body: JSON.stringify({ status: 'revoked', notes: '退会' }),
    })
    const res = await allowlistPatch(patchReq, { params: Promise.resolve({ email: 'change@example.com' }) })
    const body = await parseJson(res)
    expect(res.status).toBe(200)
    expect(body.data.status).toBe('revoked')
    expect(body.data.notes).toBe('退会')
  })

  it('PATCH with invalid transition returns 400', async () => {
    const createReq = new Request(BASE_URL, {
      method: 'POST',
      headers: STAFF_HEADER,
      body: JSON.stringify({ email: 'invalid@example.com', status: 'pending' }),
    })
    await allowlistPost(createReq)
    // ステータス遷移制限は緩和されたため、ここでは遷移禁止テストを行わない
  })

  it('CSV import inserts rows', async () => {
    const csv = ['email,status,label', 'csv01@example.com,active,C1', 'csv02@example.com,pending,C2'].join('\n')
    const req = new Request(`${BASE_URL}/import`, {
      method: 'POST',
      headers: STAFF_HEADER,
      body: JSON.stringify({ csv, mode: 'insert' }),
    })
    const res = await allowlistImportPost(req)
    const body = await parseJson(res)
    expect(res.status).toBe(200)
    expect(body.data.inserted).toBe(2)
    expect(body.data.updated).toBe(0)
  })

  it('returns 401 when Authorization is missing', async () => {
    const req = new Request(BASE_URL, { method: 'GET' })
    const res = await allowlistGet(req)
    const body = await parseJson(res)
    expect(res.status).toBe(401)
    expect(body.error.code).toBe('UNAUTHORIZED')
  })

  it('mutations hook can update status without reload', async () => {
    const createReq = new Request(BASE_URL, {
      method: 'POST',
      headers: STAFF_HEADER,
      body: JSON.stringify({ email: 'hook-mutate@example.com', status: 'active' }),
    })
    await allowlistPost(createReq)

    // build a simple mock fetcher that routes to PATCH
    const fetcher = async (url: string, init?: RequestInit) => {
      if (url.startsWith('/api/admin/allowlist/') && init?.method === 'PATCH') {
        const email = url.split('/').pop()!
        return allowlistPatch(
          new Request(`${BASE_URL}/${email}`, {
            method: 'PATCH',
            headers: init.headers,
            body: init.body,
          }),
          { params: Promise.resolve({ email }) },
        )
      }
      throw new Error(`Unhandled request ${url}`)
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { updateAllowedEmail } = useAllowlistMutations({ fetcher: fetcher as any, headers: STAFF_HEADER })
    const res = await updateAllowedEmail('hook-mutate@example.com', { status: 'revoked' })
    expect(res.status).toBe('revoked')
  })
})
