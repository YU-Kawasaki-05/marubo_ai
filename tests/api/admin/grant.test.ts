import { beforeEach, describe, expect, it } from 'vitest'

import { POST as grantPost, GET as grantGet } from '../../../app/api/admin/grant/route'
import { resetSupabaseAdminClientForTest } from '../../../src/shared/lib/supabaseAdmin'

const BASE_URL = 'http://localhost/api/admin/grant'
const STAFF_HEADER = { Authorization: 'Bearer staff-token', 'Content-Type': 'application/json' }

async function parseJson(res: Response) {
  return (await res.json()) as any
}

function postGrant(payload: Record<string, string>) {
  return grantPost(
    new Request(BASE_URL, {
      method: 'POST',
      headers: STAFF_HEADER,
      body: JSON.stringify(payload),
    }),
  )
}

describe('/api/admin/grant (mock supabase)', () => {
  beforeEach(() => {
    process.env.MOCK_SUPABASE = 'true'
    process.env.GRANT_ALLOWED_EMAILS = 'staff@example.com'
    resetSupabaseAdminClientForTest()
  })

  it('POST grant: student → staff', async () => {
    // Seed a student user
    const { getSupabaseAdminClient } = await import('../../../src/shared/lib/supabaseAdmin')
    const supabase = getSupabaseAdminClient()
    await supabase.from('app_user').insert({
      id: 'target-user-id',
      auth_uid: 'target-auth-uid',
      email: 'student@example.com',
      display_name: 'Student',
      role: 'student',
    })

    const res = await postGrant({ email: 'student@example.com', action: 'grant' })
    const body = await parseJson(res)
    expect(res.status).toBe(200)
    expect(body.data.previousRole).toBe('student')
    expect(body.data.newRole).toBe('staff')
    expect(body.data.note).toContain('再ログイン')
  })

  it('POST revoke: staff → student', async () => {
    const { getSupabaseAdminClient } = await import('../../../src/shared/lib/supabaseAdmin')
    const supabase = getSupabaseAdminClient()
    await supabase.from('app_user').insert({
      id: 'staff2-id',
      auth_uid: 'staff2-auth',
      email: 'staff2@example.com',
      display_name: 'Staff 2',
      role: 'staff',
    })

    const res = await postGrant({ email: 'staff2@example.com', action: 'revoke' })
    const body = await parseJson(res)
    expect(res.status).toBe(200)
    expect(body.data.previousRole).toBe('staff')
    expect(body.data.newRole).toBe('student')
  })

  it('POST non-allowed staff returns 403 GRANT_NOT_ALLOWED', async () => {
    process.env.GRANT_ALLOWED_EMAILS = 'other@example.com'
    resetSupabaseAdminClientForTest()

    const res = await postGrant({ email: 'anyone@example.com', action: 'grant' })
    const body = await parseJson(res)
    expect(res.status).toBe(403)
    expect(body.error.code).toBe('GRANT_NOT_ALLOWED')
  })

  it('POST non-existing user returns 404 USER_NOT_FOUND', async () => {
    const res = await postGrant({ email: 'nobody@example.com', action: 'grant' })
    const body = await parseJson(res)
    expect(res.status).toBe(404)
    expect(body.error.code).toBe('USER_NOT_FOUND')
  })

  it('POST already staff returns 409 ALREADY_STAFF', async () => {
    // mock-staff-id is already staff in the mock seed
    const res = await postGrant({ email: 'staff@example.com', action: 'grant' })
    const body = await parseJson(res)
    expect(res.status).toBe(409)
    expect(body.error.code).toBe('ALREADY_STAFF')
  })

  it('POST already student returns 409 ALREADY_STUDENT', async () => {
    const { getSupabaseAdminClient } = await import('../../../src/shared/lib/supabaseAdmin')
    const supabase = getSupabaseAdminClient()
    await supabase.from('app_user').insert({
      id: 'student-only-id',
      auth_uid: 'student-only-auth',
      email: 'student-only@example.com',
      display_name: 'Student Only',
      role: 'student',
    })

    const res = await postGrant({ email: 'student-only@example.com', action: 'revoke' })
    const body = await parseJson(res)
    expect(res.status).toBe(409)
    expect(body.error.code).toBe('ALREADY_STUDENT')
  })

  it('POST self-revoke returns 400 SELF_REVOKE_FORBIDDEN', async () => {
    const res = await postGrant({ email: 'staff@example.com', action: 'revoke' })
    const body = await parseJson(res)
    expect(res.status).toBe(400)
    expect(body.error.code).toBe('SELF_REVOKE_FORBIDDEN')
  })

  it('POST without auth returns 401 UNAUTHORIZED', async () => {
    const res = await grantPost(
      new Request(BASE_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: 'any@example.com', action: 'grant' }),
      }),
    )
    const body = await parseJson(res)
    expect(res.status).toBe(401)
    expect(body.error.code).toBe('UNAUTHORIZED')
  })

  it('GET returns staff list', async () => {
    const req = new Request(BASE_URL, { method: 'GET', headers: STAFF_HEADER })
    const res = await grantGet(req)
    const body = await parseJson(res)
    expect(res.status).toBe(200)
    expect(Array.isArray(body.data.staffUsers)).toBe(true)
    expect(body.data.staffUsers.length).toBeGreaterThanOrEqual(1)
    expect(body.data.staffUsers[0].email).toBe('staff@example.com')
  })

  it('GET non-allowed staff returns 403 GRANT_NOT_ALLOWED', async () => {
    process.env.GRANT_ALLOWED_EMAILS = 'other@example.com'
    resetSupabaseAdminClientForTest()

    const req = new Request(BASE_URL, { method: 'GET', headers: STAFF_HEADER })
    const res = await grantGet(req)
    const body = await parseJson(res)
    expect(res.status).toBe(403)
    expect(body.error.code).toBe('GRANT_NOT_ALLOWED')
  })

  it('GET returns audit log after grant operation', async () => {
    const { getSupabaseAdminClient } = await import('../../../src/shared/lib/supabaseAdmin')
    const supabase = getSupabaseAdminClient()
    await supabase.from('app_user').insert({
      id: 'audit-target-id',
      auth_uid: 'audit-target-auth',
      email: 'audit-target@example.com',
      display_name: 'Audit Target',
      role: 'student',
    })

    // Perform a grant
    await postGrant({ email: 'audit-target@example.com', action: 'grant' })

    // Now GET to check audit log
    const req = new Request(BASE_URL, { method: 'GET', headers: STAFF_HEADER })
    const res = await grantGet(req)
    const body = await parseJson(res)
    expect(res.status).toBe(200)
    expect(body.data.auditLog.length).toBeGreaterThanOrEqual(1)
    const logEntry = body.data.auditLog.find(
      (e: any) => e.targetEmail === 'audit-target@example.com',
    )
    expect(logEntry).toBeDefined()
    expect(logEntry.action).toBe('grant')
    expect(logEntry.operatorEmail).toBe('staff@example.com')
  })
})
