/** @file
 * Small helpers for building JSON HTTP responses with requestId.
 * Input: arbitrary payloads and HTTP status codes.
 * Output: standardized `{ requestId, data }` responses.
 * Dependencies: none.
 * Security: ensures `content-type` header is JSON to avoid leaking data via unexpected types.
 */

export function jsonResponse<T>(requestId: string, data: T, status = 200) {
  return new Response(JSON.stringify({ requestId, data }), {
    status,
    headers: { 'content-type': 'application/json' },
  })
}
