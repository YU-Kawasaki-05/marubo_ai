/** @file
 * rateLimit ユーティリティのテスト。
 * 分間レート制限、月間クォータ、利用カウンタ増分、app_user 解決を検証。
 * Mock supabase を使用（MOCK_SUPABASE=true）。
 */

import { beforeEach, describe, expect, it, vi } from 'vitest'

import { resetSupabaseAdminClientForTest } from '../../../src/shared/lib/supabaseAdmin'

// MOCK_SUPABASE を有効化
vi.stubEnv('MOCK_SUPABASE', 'true')

import {
  checkMinuteRate,
  checkMonthlyQuota,
  getJstMonth,
  getJstToday,
  incrementUsage,
  resolveAppUserId,
} from '../../../src/shared/lib/rateLimit'

const STAFF_ID = 'mock-staff-id'
const STAFF_AUTH_UID = 'mock-staff-auth'

async function getSupabase() {
  const { getSupabaseAdminClient } = await import('../../../src/shared/lib/supabaseAdmin')
  return getSupabaseAdminClient()
}

/** テスト用の生徒を app_user に追加 */
async function seedStudent(id: string, authUid: string, email: string) {
  const supabase = await getSupabase()
  await supabase.from('app_user').insert({
    id,
    auth_uid: authUid,
    email,
    display_name: 'Test Student',
    role: 'student',
  })
}

describe('rateLimit', () => {
  beforeEach(() => {
    resetSupabaseAdminClientForTest()
    delete process.env.MONTHLY_QUOTA
  })

  // ── resolveAppUserId ──

  describe('resolveAppUserId', () => {
    it('resolves app_user.id from auth_uid', async () => {
      // mock-staff-auth is seeded by MockSupabaseAdminClient
      const id = await resolveAppUserId(STAFF_AUTH_UID)
      expect(id).toBe(STAFF_ID)
    })

    it('throws 403 for unknown auth_uid', async () => {
      await expect(resolveAppUserId('unknown-auth')).rejects.toThrow('ユーザー情報を取得できませんでした')
    })
  })

  // ── checkMinuteRate ──

  describe('checkMinuteRate', () => {
    it('allows requests under the minute limit', async () => {
      await seedStudent('student-1', 'auth-1', 's1@example.com')
      // Should not throw for first request
      await expect(checkMinuteRate('student-1')).resolves.toBeUndefined()
    })

    it('allows up to 10 requests per minute', async () => {
      await seedStudent('student-2', 'auth-2', 's2@example.com')

      // Send 10 requests (all should succeed)
      for (let i = 0; i < 10; i++) {
        await checkMinuteRate('student-2')
      }

      // 11th request should be rejected
      await expect(checkMinuteRate('student-2')).rejects.toThrow('送信が早すぎます')
    })

    it('allows requests from different users independently', async () => {
      await seedStudent('student-3a', 'auth-3a', 's3a@example.com')
      await seedStudent('student-3b', 'auth-3b', 's3b@example.com')

      // Fill up student-3a's rate limit
      for (let i = 0; i < 10; i++) {
        await checkMinuteRate('student-3a')
      }

      // student-3b should still be able to send
      await expect(checkMinuteRate('student-3b')).resolves.toBeUndefined()
    })

    it('increments counter on each request', async () => {
      await seedStudent('student-4', 'auth-4', 's4@example.com')

      await checkMinuteRate('student-4')
      await checkMinuteRate('student-4')

      const supabase = await getSupabase()
      const { data } = await supabase
        .from('rate_limiter')
        .select()
        .eq('key', 'chat:user:student-4')

      expect(data).toHaveLength(1)
      expect((data as any[])[0].count).toBe(2)
    })
  })

  // ── checkMonthlyQuota ──

  describe('checkMonthlyQuota', () => {
    it('allows requests under the monthly quota', async () => {
      await seedStudent('student-5', 'auth-5', 's5@example.com')
      await expect(checkMonthlyQuota('student-5')).resolves.toBeUndefined()
    })

    it('rejects when monthly quota is exceeded', async () => {
      await seedStudent('student-6', 'auth-6', 's6@example.com')

      const supabase = await getSupabase()
      const today = getJstToday()

      // Insert a usage_counter row at the quota limit
      await supabase.from('usage_counters').insert({
        id: crypto.randomUUID(),
        user_id: 'student-6',
        day: today,
        questions: 100,
        tokens_in: 0,
        tokens_out: 0,
      })

      await expect(checkMonthlyQuota('student-6')).rejects.toThrow('今月の質問上限')
    })

    it('sums across multiple days in the same month', async () => {
      await seedStudent('student-7', 'auth-7', 's7@example.com')

      const supabase = await getSupabase()
      const month = getJstMonth()

      // Insert two rows in the same month
      await supabase.from('usage_counters').insert({
        id: crypto.randomUUID(),
        user_id: 'student-7',
        day: `${month}-01`,
        questions: 60,
        tokens_in: 0,
        tokens_out: 0,
      })
      await supabase.from('usage_counters').insert({
        id: crypto.randomUUID(),
        user_id: 'student-7',
        day: `${month}-15`,
        questions: 40,
        tokens_in: 0,
        tokens_out: 0,
      })

      // 60 + 40 = 100 → should reject
      await expect(checkMonthlyQuota('student-7')).rejects.toThrow('今月の質問上限')
    })

    it('respects MONTHLY_QUOTA environment variable', async () => {
      process.env.MONTHLY_QUOTA = '5'
      await seedStudent('student-8', 'auth-8', 's8@example.com')

      const supabase = await getSupabase()
      const today = getJstToday()

      await supabase.from('usage_counters').insert({
        id: crypto.randomUUID(),
        user_id: 'student-8',
        day: today,
        questions: 5,
        tokens_in: 0,
        tokens_out: 0,
      })

      await expect(checkMonthlyQuota('student-8')).rejects.toThrow('今月の質問上限（5 回）')
    })

    it('does not count previous month usage', async () => {
      await seedStudent('student-9', 'auth-9', 's9@example.com')

      const supabase = await getSupabase()
      const month = getJstMonth()
      const [y, m] = month.split('-').map(Number)
      const prevMonth = m === 1
        ? `${y - 1}-12-15`
        : `${y}-${String(m - 1).padStart(2, '0')}-15`

      // Insert 100 questions in previous month
      await supabase.from('usage_counters').insert({
        id: crypto.randomUUID(),
        user_id: 'student-9',
        day: prevMonth,
        questions: 100,
        tokens_in: 0,
        tokens_out: 0,
      })

      // Should pass because the usage is from last month
      await expect(checkMonthlyQuota('student-9')).resolves.toBeUndefined()
    })
  })

  // ── incrementUsage ──

  describe('incrementUsage', () => {
    it('creates a new row when no usage exists for today', async () => {
      await seedStudent('student-10', 'auth-10', 's10@example.com')

      await incrementUsage('student-10')

      const supabase = await getSupabase()
      const today = getJstToday()
      const { data } = await supabase
        .from('usage_counters')
        .select()
        .eq('user_id', 'student-10')
        .eq('day', today)

      expect(data).toHaveLength(1)
      expect((data as any[])[0].questions).toBe(1)
    })

    it('increments existing row for today', async () => {
      await seedStudent('student-11', 'auth-11', 's11@example.com')

      const supabase = await getSupabase()
      const today = getJstToday()

      await supabase.from('usage_counters').insert({
        id: crypto.randomUUID(),
        user_id: 'student-11',
        day: today,
        questions: 5,
        tokens_in: 0,
        tokens_out: 0,
      })

      await incrementUsage('student-11')

      const { data } = await supabase
        .from('usage_counters')
        .select()
        .eq('user_id', 'student-11')
        .eq('day', today)

      expect(data).toHaveLength(1)
      expect((data as any[])[0].questions).toBe(6)
    })

    it('increments multiple times correctly', async () => {
      await seedStudent('student-12', 'auth-12', 's12@example.com')

      await incrementUsage('student-12')
      await incrementUsage('student-12')
      await incrementUsage('student-12')

      const supabase = await getSupabase()
      const today = getJstToday()
      const { data } = await supabase
        .from('usage_counters')
        .select()
        .eq('user_id', 'student-12')
        .eq('day', today)

      expect(data).toHaveLength(1)
      expect((data as any[])[0].questions).toBe(3)
    })
  })

  // ── JST ヘルパー ──

  describe('JST helpers', () => {
    it('getJstToday returns YYYY-MM-DD format', () => {
      const today = getJstToday()
      expect(today).toMatch(/^\d{4}-\d{2}-\d{2}$/)
    })

    it('getJstMonth returns YYYY-MM format', () => {
      const month = getJstMonth()
      expect(month).toMatch(/^\d{4}-\d{2}$/)
    })
  })
})
