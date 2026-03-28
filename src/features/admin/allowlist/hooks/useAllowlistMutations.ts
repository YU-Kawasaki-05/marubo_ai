type AllowedEmailStatus = 'active' | 'pending' | 'revoked'

type Fetcher = typeof fetch

type MutationOptions = {
  fetcher?: Fetcher
  headers?: HeadersInit
}

export function useAllowlistMutations(options: MutationOptions = {}) {
  const { fetcher = fetch, headers } = options

  async function createAllowedEmail(input: {
    email: string
    status: AllowedEmailStatus
    label?: string | null
    notes?: string | null
    initial_role?: 'student' | 'staff'
  }) {
    const res = await fetcher('/api/admin/allowlist', {
      method: 'POST',
      headers: { 'content-type': 'application/json', ...headers },
      body: JSON.stringify(input),
    })
    const json = await res.json().catch(() => ({}))
    if (!res.ok) {
      throw new Error(json?.error?.message ?? `登録に失敗しました (${res.status})`)
    }
    return json.data
  }

  async function updateAllowedEmail(email: string, input: { status?: AllowedEmailStatus; label?: string | null; notes?: string | null; initial_role?: 'student' | 'staff' }) {
    const res = await fetcher(`/api/admin/allowlist/${encodeURIComponent(email)}`, {
      method: 'PATCH',
      headers: { 'content-type': 'application/json', ...headers },
      body: JSON.stringify(input),
    })
    const json = await res.json().catch(() => ({}))
    if (!res.ok) {
      throw new Error(json?.error?.message ?? `更新に失敗しました (${res.status})`)
    }
    return json.data
  }

  async function importCsv(csv: string, mode: 'insert' | 'upsert' = 'insert') {
    const res = await fetcher('/api/admin/allowlist/import', {
      method: 'POST',
      headers: { 'content-type': 'application/json', ...headers },
      body: JSON.stringify({ csv, mode }),
    })
    const json = await res.json().catch(() => ({}))
    if (!res.ok) {
      throw new Error(json?.error?.message ?? `CSV 取り込みに失敗しました (${res.status})`)
    }
    return json.data as { inserted: number; updated: number }
  }

  return { createAllowedEmail, updateAllowedEmail, importCsv }
}
