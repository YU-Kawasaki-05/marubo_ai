/** @file
 * QA-09: スタッフ会話検索 API の認可テスト。
 * 入力: staff-token / student-token / 認証なし の各リクエスト。
 * 出力: staff → 200、student → 403、未認証 → 401 を検証。
 * 依存: MockSupabaseAdminClient（MOCK_SUPABASE=true）。
 * セキュリティ: requireStaff() による認可チェックの網羅テスト。
 */

import { beforeEach, describe, expect, it } from 'vitest'

import { GET as listGet } from '../../../app/api/admin/conversations/route'
import { GET as detailGet } from '../../../app/api/admin/conversations/[id]/route'
import { resetSupabaseAdminClientForTest } from '../../../src/shared/lib/supabaseAdmin'

const BASE_URL = 'http://localhost/api/admin/conversations'
const STAFF_HEADER = { Authorization: 'Bearer staff-token' }
const STUDENT_HEADER = { Authorization: 'Bearer student-token' }

async function parseJson(res: Response) {
  return (await res.json()) as any
}

async function seedData() {
  const { getSupabaseAdminClient } = await import('../../../src/shared/lib/supabaseAdmin')
  const supabase = getSupabaseAdminClient()

  await supabase.from('app_user').insert([
    {
      id: 'student-a-id',
      auth_uid: 'student-a-auth',
      email: 'student-a@example.com',
      display_name: 'Student A',
      role: 'student',
    },
    {
      id: 'student-b-id',
      auth_uid: 'student-b-auth',
      email: 'student-b@example.com',
      display_name: 'Student B',
      role: 'student',
    },
  ])

  await supabase.from('conversations').insert([
    {
      id: 'auth-conv-1',
      user_id: 'student-a-id',
      title: 'Student A の会話',
      created_at: '2026-02-20T10:00:00Z',
    },
    {
      id: 'auth-conv-2',
      user_id: 'student-b-id',
      title: 'Student B の会話',
      created_at: '2026-02-21T10:00:00Z',
    },
  ])

  await supabase.from('messages').insert([
    {
      id: 'auth-msg-1',
      conversation_id: 'auth-conv-1',
      role: 'user',
      content: 'テスト質問 A',
      created_at: '2026-02-20T10:00:01Z',
    },
    {
      id: 'auth-msg-2',
      conversation_id: 'auth-conv-2',
      role: 'user',
      content: 'テスト質問 B',
      created_at: '2026-02-21T10:00:01Z',
    },
  ])
}

describe('QA-09: /api/admin/conversations 認可テスト', () => {
  beforeEach(async () => {
    process.env.MOCK_SUPABASE = 'true'
    resetSupabaseAdminClientForTest()
    await seedData()
  })

  // ── 一覧 API: 正常系（staff） ──

  it('GET list: staff は全生徒の会話を取得できる', async () => {
    const res = await listGet(
      new Request(BASE_URL, { method: 'GET', headers: STAFF_HEADER }),
    )
    const body = await parseJson(res)
    expect(res.status).toBe(200)
    expect(body.data.conversations).toHaveLength(2)
    const emails = body.data.conversations.map((c: any) => c.user.email)
    expect(emails).toContain('student-a@example.com')
    expect(emails).toContain('student-b@example.com')
  })

  // ── 一覧 API: 異常系（認証なし） ──

  it('GET list: 認証なし → 401 UNAUTHORIZED', async () => {
    const res = await listGet(
      new Request(BASE_URL, { method: 'GET' }),
    )
    const body = await parseJson(res)
    expect(res.status).toBe(401)
    expect(body.error.code).toBe('UNAUTHORIZED')
  })

  // ── 一覧 API: 異常系（student） ──

  it('GET list: student トークン → 403 FORBIDDEN', async () => {
    const res = await listGet(
      new Request(BASE_URL, { method: 'GET', headers: STUDENT_HEADER }),
    )
    const body = await parseJson(res)
    expect(res.status).toBe(403)
    expect(body.error.code).toBe('FORBIDDEN')
  })

  // ── 一覧 API: 異常系（無効トークン） ──

  it('GET list: 無効トークン → 401 UNAUTHORIZED', async () => {
    const res = await listGet(
      new Request(BASE_URL, {
        method: 'GET',
        headers: { Authorization: 'Bearer invalid-token-xyz' },
      }),
    )
    const body = await parseJson(res)
    expect(res.status).toBe(401)
    expect(body.error.code).toBe('UNAUTHORIZED')
  })

  // ── 詳細 API: 正常系（staff） ──

  it('GET detail: staff は任意の生徒の会話詳細を取得できる', async () => {
    const res = await detailGet(
      new Request(`${BASE_URL}/auth-conv-1`, { method: 'GET', headers: STAFF_HEADER }),
      { params: { id: 'auth-conv-1' } },
    )
    const body = await parseJson(res)
    expect(res.status).toBe(200)
    expect(body.data.id).toBe('auth-conv-1')
    expect(body.data.user.email).toBe('student-a@example.com')
    expect(body.data.messages).toHaveLength(1)
  })

  it('GET detail: staff は別の生徒の会話詳細も取得できる', async () => {
    const res = await detailGet(
      new Request(`${BASE_URL}/auth-conv-2`, { method: 'GET', headers: STAFF_HEADER }),
      { params: { id: 'auth-conv-2' } },
    )
    const body = await parseJson(res)
    expect(res.status).toBe(200)
    expect(body.data.id).toBe('auth-conv-2')
    expect(body.data.user.email).toBe('student-b@example.com')
  })

  // ── 詳細 API: 異常系（認証なし） ──

  it('GET detail: 認証なし → 401 UNAUTHORIZED', async () => {
    const res = await detailGet(
      new Request(`${BASE_URL}/auth-conv-1`, { method: 'GET' }),
      { params: { id: 'auth-conv-1' } },
    )
    const body = await parseJson(res)
    expect(res.status).toBe(401)
    expect(body.error.code).toBe('UNAUTHORIZED')
  })

  // ── 詳細 API: 異常系（student） ──

  it('GET detail: student トークン → 403 FORBIDDEN', async () => {
    const res = await detailGet(
      new Request(`${BASE_URL}/auth-conv-1`, {
        method: 'GET',
        headers: STUDENT_HEADER,
      }),
      { params: { id: 'auth-conv-1' } },
    )
    const body = await parseJson(res)
    expect(res.status).toBe(403)
    expect(body.error.code).toBe('FORBIDDEN')
  })

  // ── 詳細 API: 異常系（無効トークン） ──

  it('GET detail: 無効トークン → 401 UNAUTHORIZED', async () => {
    const res = await detailGet(
      new Request(`${BASE_URL}/auth-conv-1`, {
        method: 'GET',
        headers: { Authorization: 'Bearer invalid-token-xyz' },
      }),
      { params: { id: 'auth-conv-1' } },
    )
    const body = await parseJson(res)
    expect(res.status).toBe(401)
    expect(body.error.code).toBe('UNAUTHORIZED')
  })
})
