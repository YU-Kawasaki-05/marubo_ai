/** @file
 * Custom error helpers for API handlers.
 * Input: domain-specific error metadata.
 * Output: standardized HTTP responses `{ requestId, error }`.
 * Dependencies: none (Node/Next only).
 * Security: avoid leaking sensitive details; details are limited to safe context data.
 */

export type ErrorDetails = Record<string, string | number | boolean | null>

export class AppError extends Error {
  public readonly status: number
  public readonly code: string
  public readonly details?: ErrorDetails

  constructor(status: number, code: string, message: string, details?: ErrorDetails) {
    super(message)
    this.name = 'AppError'
    this.status = status
    this.code = code
    this.details = details
  }
}

export function errorResponse(requestId: string, error: AppError | Error) {
  if (error instanceof AppError) {
    return new Response(
      JSON.stringify({
        requestId,
        error: {
          code: error.code,
          message: error.message,
          details: error.details,
        },
      }),
      {
        status: error.status,
        headers: { 'content-type': 'application/json' },
      },
    )
  }

  return new Response(
    JSON.stringify({
      requestId,
      error: {
        code: 'INTERNAL_SERVER_ERROR',
        message: '予期しないエラーが発生しました。',
      },
    }),
    {
      status: 500,
      headers: { 'content-type': 'application/json' },
    },
  )
}
