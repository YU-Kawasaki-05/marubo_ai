import { afterEach, beforeEach, describe, expect, it } from 'vitest'

import { getSupabaseAdminClient } from '../src/shared/lib/supabaseAdmin'

describe('Supabase admin client mock', () => {
  const originalEnv = process.env.MOCK_SUPABASE

  beforeEach(() => {
    process.env.MOCK_SUPABASE = 'true'
  })

  it('returns mock data for allowed_email insert/select', async () => {
    const supabase = getSupabaseAdminClient()

    const insert = await supabase.from('allowed_email').insert({
      email: 'student@example.com',
      status: 'active',
      label: 'Test',
      invited_at: null,
      expires_at: null,
      notes: null,
      created_by: null,
      updated_at: new Date().toISOString(),
      created_at: new Date().toISOString(),
    })
    expect(insert.error).toBeNull()

    const { data, error } = await supabase.from('allowed_email').select('*').eq('email', 'student@example.com').single()
    expect(error).toBeNull()
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    expect((data as any)?.email).toBe('student@example.com')
  })

  it('provides staff auth user when token matches', async () => {
    const supabase = getSupabaseAdminClient()
    const { data, error } = await supabase.auth.getUser('staff-token')
    expect(error).toBeNull()
    expect(data.user?.app_metadata).toEqual({ role: 'staff' })
  })

  afterEach(() => {
    process.env.MOCK_SUPABASE = originalEnv
  })
})
