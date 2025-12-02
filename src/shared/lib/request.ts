/** @file
 * Request helper utilities shared by API routes.
 * Input: Next.js `Request` objects.
 * Output: parsed Authorization header, JSON body parsing, requestId helpers.
 * Dependencies: Web Crypto API (built-in) only.
 * Security: trims sensitive headers from thrown errors and enforces JSON parsing limits.
 */

export function generateRequestId(prefix: string) {
  const suffix = crypto.randomUUID().replace(/-/g, '').slice(0, 12)
  return `${prefix}_${suffix}`
}

export function getBearerToken(request: Request): string {
  const auth = request.headers.get('authorization') || ''
  if (!auth.toLowerCase().startsWith('bearer ')) {
    throw new Error('Missing bearer token')
  }

  const token = auth.slice(7).trim()
  if (!token) {
    throw new Error('Missing bearer token')
  }
  return token
}

export async function parseJsonBody<T>(request: Request): Promise<T> {
  const bodyString = await request.text()
  if (!bodyString) {
    return {} as T
  }

  return JSON.parse(bodyString) as T
}
