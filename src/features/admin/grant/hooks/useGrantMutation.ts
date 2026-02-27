/** @file
 * POST /api/admin/grant の付与/解除ミューテーションフック。
 * 入力: headers（認証トークン）、fetcher（テスト用差し替え可）。
 * 出力: grantRole(email), revokeRole(email) 関数。
 * 依存: なし（純粋な fetch ラッパー）。
 * セキュリティ: Bearer トークンを headers 経由で送信。
 */

type Fetcher = typeof fetch

type MutationOptions = {
  fetcher?: Fetcher
  headers?: HeadersInit
}

export function useGrantMutation(options: MutationOptions = {}) {
  const { fetcher = fetch, headers } = options

  async function grantRole(email: string) {
    const res = await fetcher('/api/admin/grant', {
      method: 'POST',
      headers: { 'content-type': 'application/json', ...headers },
      body: JSON.stringify({ email, action: 'grant' }),
    })
    const json = await res.json().catch(() => ({}))
    if (!res.ok) {
      throw new Error(json?.error?.message ?? `付与に失敗しました (${res.status})`)
    }
    return json.data
  }

  async function revokeRole(email: string) {
    const res = await fetcher('/api/admin/grant', {
      method: 'POST',
      headers: { 'content-type': 'application/json', ...headers },
      body: JSON.stringify({ email, action: 'revoke' }),
    })
    const json = await res.json().catch(() => ({}))
    if (!res.ok) {
      throw new Error(json?.error?.message ?? `解除に失敗しました (${res.status})`)
    }
    return json.data
  }

  return { grantRole, revokeRole }
}
