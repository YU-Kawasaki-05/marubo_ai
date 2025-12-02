/** @file
 * 環境変数の取得を一元化するヘルパー。
 * 入力：環境変数名（string）
 * 出力：必須値なら string、任意なら string | undefined
 * 依存：Node.js runtime（process.env）
 * セキュリティ：欠落時の例外では値をログせずキー名のみを表示する。
 */

const cache = new Map<string, string>()

export function requireEnv(key: string): string {
  if (cache.has(key)) {
    return cache.get(key)!
  }

  const value = process.env[key]
  if (!value) {
    throw new Error(`Missing required environment variable: ${key}`)
  }
  cache.set(key, value)
  return value
}

export function optionalEnv(key: string): string | undefined {
  if (cache.has(key)) {
    return cache.get(key)
  }

  const value = process.env[key]
  if (typeof value === 'string') {
    cache.set(key, value)
  }
  return value
}
