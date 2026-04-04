/** @file
 * `GET /api/registration-status` — 新規登録の可否を返す公開エンドポイント。
 * 機能: 環境変数 OPEN_REGISTRATION の値に基づいて新規登録が有効かどうかを返す。
 * 入力: なし（認証不要）
 * 出力: { openRegistration: boolean }
 * セキュリティ: 認証不要。返す情報はサービス設定のみで機密情報なし。
 */

import { NextResponse } from 'next/server'

export const runtime = 'nodejs'

export function GET() {
  const openRegistration = process.env.OPEN_REGISTRATION === 'true'
  return NextResponse.json({ openRegistration })
}
