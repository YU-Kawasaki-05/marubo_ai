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

function getList(query = '') {
  return listGet(
    new Request(`${BASE_URL}${query ? `?${query}` : ''}`, {
      method: 'GET',
      headers: STAFF_HEADER,
    }),
  )
}

function getDetail(id: string) {
  return detailGet(
    new Request(`${BASE_URL}/${id}`, { method: 'GET', headers: STAFF_HEADER }),
    { params: { id } },
  )
}

async function seedData() {
  const { getSupabaseAdminClient } = await import('../../../src/shared/lib/supabaseAdmin')
  const supabase = getSupabaseAdminClient()

  // Seed students
  await supabase.from('app_user').insert([
    {
      id: 'student-taro-id',
      auth_uid: 'student-taro-auth',
      email: 'taro@example.com',
      display_name: '太郎',
      role: 'student',
    },
    {
      id: 'student-hanako-id',
      auth_uid: 'student-hanako-auth',
      email: 'hanako@example.com',
      display_name: '花子',
      role: 'student',
    },
  ])

  // Seed conversations
  await supabase.from('conversations').insert([
    {
      id: 'conv-1',
      user_id: 'student-taro-id',
      title: '二次方程式の解き方',
      created_at: '2026-02-15T10:00:00Z',
    },
    {
      id: 'conv-2',
      user_id: 'student-hanako-id',
      title: '英語の文法について',
      created_at: '2026-02-20T14:00:00Z',
    },
    {
      id: 'conv-3',
      user_id: 'student-hanako-id',
      title: '連立方程式の応用問題',
      created_at: '2026-02-25T09:00:00Z',
    },
  ])

  // Seed messages
  await supabase.from('messages').insert([
    {
      id: 'msg-1a',
      conversation_id: 'conv-1',
      role: 'user',
      content: '二次方程式を教えて',
      created_at: '2026-02-15T10:00:01Z',
    },
    {
      id: 'msg-1b',
      conversation_id: 'conv-1',
      role: 'assistant',
      content: '二次方程式の解の公式は...',
      created_at: '2026-02-15T10:00:05Z',
    },
    {
      id: 'msg-2a',
      conversation_id: 'conv-2',
      role: 'user',
      content: '英語の文法を教えて',
      created_at: '2026-02-20T14:00:01Z',
    },
    {
      id: 'msg-3a',
      conversation_id: 'conv-3',
      role: 'user',
      content: '連立方程式の問題です',
      created_at: '2026-02-25T09:00:01Z',
    },
    {
      id: 'msg-3b',
      conversation_id: 'conv-3',
      role: 'assistant',
      content: '連立方程式を解くには...',
      created_at: '2026-02-25T09:00:05Z',
    },
    {
      id: 'msg-3c',
      conversation_id: 'conv-3',
      role: 'user',
      content: '画像を添付します',
      created_at: '2026-02-25T09:01:00Z',
    },
  ])

  // Seed attachment
  await supabase.from('attachments').insert([
    {
      id: 'att-1',
      message_id: 'msg-3c',
      user_id: 'student-hanako-id',
      storage_path: 'student-hanako-id/abc123.png',
      mime_type: 'image/png',
      size_bytes: 102400,
      created_at: '2026-02-25T09:01:01Z',
    },
  ])
}

describe('/api/admin/conversations (mock supabase)', () => {
  beforeEach(async () => {
    process.env.MOCK_SUPABASE = 'true'
    resetSupabaseAdminClientForTest()
    await seedData()
  })

  it('GET list: returns all conversations', async () => {
    const res = await getList()
    const body = await parseJson(res)
    expect(res.status).toBe(200)
    expect(body.data.conversations).toHaveLength(3)
    expect(body.data.pagination.total).toBe(3)
  })

  it('GET list: email partial match filter', async () => {
    const res = await getList('email=taro')
    const body = await parseJson(res)
    expect(res.status).toBe(200)
    expect(body.data.conversations).toHaveLength(1)
    expect(body.data.conversations[0].user.email).toBe('taro@example.com')
  })

  it('GET list: date range filter', async () => {
    const res = await getList('from=2026-02-14&to=2026-02-16')
    const body = await parseJson(res)
    expect(res.status).toBe(200)
    expect(body.data.conversations).toHaveLength(1)
    expect(body.data.conversations[0].id).toBe('conv-1')
  })

  it('GET list: keyword filter on title', async () => {
    const res = await getList('keyword=方程式')
    const body = await parseJson(res)
    expect(res.status).toBe(200)
    expect(body.data.conversations).toHaveLength(2)
  })

  it('GET list: AND compound filter', async () => {
    const res = await getList('email=hanako&keyword=英語')
    const body = await parseJson(res)
    expect(res.status).toBe(200)
    expect(body.data.conversations).toHaveLength(1)
    expect(body.data.conversations[0].title).toBe('英語の文法について')
  })

  it('GET list: pagination', async () => {
    const res1 = await getList('limit=2&page=1')
    const body1 = await parseJson(res1)
    expect(body1.data.conversations).toHaveLength(2)
    expect(body1.data.pagination.totalPages).toBe(2)

    const res2 = await getList('limit=2&page=2')
    const body2 = await parseJson(res2)
    expect(body2.data.conversations).toHaveLength(1)
  })

  it('GET list: no matches returns empty array', async () => {
    const res = await getList('email=nobody')
    const body = await parseJson(res)
    expect(res.status).toBe(200)
    expect(body.data.conversations).toHaveLength(0)
    expect(body.data.pagination.total).toBe(0)
  })

  it('GET list: messageCount is correct per conversation', async () => {
    const res = await getList()
    const body = await parseJson(res)
    const convMap = new Map(
      body.data.conversations.map((c: any) => [c.id, c.messageCount]),
    )
    expect(convMap.get('conv-1')).toBe(2)
    expect(convMap.get('conv-2')).toBe(1)
    expect(convMap.get('conv-3')).toBe(3)
  })

  it('GET detail: returns messages and attachments', async () => {
    const res = await getDetail('conv-3')
    const body = await parseJson(res)
    expect(res.status).toBe(200)
    expect(body.data.id).toBe('conv-3')
    expect(body.data.messages).toHaveLength(3)
    // Messages should be in ascending order
    expect(body.data.messages[0].id).toBe('msg-3a')
    expect(body.data.messages[2].id).toBe('msg-3c')
    // Attachment on last message
    expect(body.data.messages[2].attachments).toHaveLength(1)
    expect(body.data.messages[2].attachments[0].id).toBe('att-1')
  })

  it('GET detail: non-existing ID returns 404', async () => {
    const res = await getDetail('non-existing-id')
    const body = await parseJson(res)
    expect(res.status).toBe(404)
    expect(body.error.code).toBe('CONVERSATION_NOT_FOUND')
  })

  it('GET list: no auth returns 401', async () => {
    const res = await listGet(
      new Request(BASE_URL, { method: 'GET' }),
    )
    const body = await parseJson(res)
    expect(res.status).toBe(401)
    expect(body.error.code).toBe('UNAUTHORIZED')
  })

  it('GET list: student token returns 403', async () => {
    const res = await listGet(
      new Request(BASE_URL, { method: 'GET', headers: STUDENT_HEADER }),
    )
    const body = await parseJson(res)
    expect(res.status).toBe(403)
    expect(body.error.code).toBe('FORBIDDEN')
  })
})
