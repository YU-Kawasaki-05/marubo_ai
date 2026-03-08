/** @file
 * Next.js Middleware — 認証ガード + /chat-test 本番遮断
 * 機能: 保護ページ(/chat, /admin/*, /reports)への未認証アクセスを /login にリダイレクト。
 *       本番環境で /chat-test を 404 として遮断。
 * 入力: リクエスト (cookie 内の Supabase セッション)
 * 出力: NextResponse (通過 / リダイレクト / rewrite)
 * 依存: @supabase/ssr, env(NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_ANON_KEY)
 * セキュリティ: Edge Runtime で動作。getUser() でトークンを Auth サーバーに検証。
 *   クライアントサイドの AllowlistGuard は二重チェックとして維持される。
 */

import { createServerClient } from '@supabase/ssr'
import { type NextRequest, NextResponse } from 'next/server'

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl

  // /chat-test を本番環境で遮断 (GAP-11)
  if (pathname.startsWith('/chat-test') && process.env.NODE_ENV === 'production') {
    const notFoundUrl = request.nextUrl.clone()
    notFoundUrl.pathname = '/not-found'
    return NextResponse.rewrite(notFoundUrl)
  }

  // Supabase 環境変数チェック
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

  if (!supabaseUrl || !supabaseAnonKey) {
    // 環境変数未設定時はガードをスキップ（開発初期セットアップ対応）
    return NextResponse.next()
  }

  // レスポンスを先に作成し、cookie の読み書きを仲介
  let response = NextResponse.next({
    request: { headers: request.headers },
  })

  const supabase = createServerClient(supabaseUrl, supabaseAnonKey, {
    cookies: {
      getAll() {
        return request.cookies.getAll()
      },
      setAll(cookiesToSet) {
        // リクエスト側にも cookie をセット（下流の Server Component 用）
        cookiesToSet.forEach(({ name, value }) => {
          request.cookies.set(name, value)
        })
        // レスポンスを再作成して cookie を反映
        response = NextResponse.next({
          request: { headers: request.headers },
        })
        cookiesToSet.forEach(({ name, value, options }) => {
          response.cookies.set(name, value, options)
        })
      },
    },
  })

  // getUser() で Auth サーバーにトークンを検証（getSession() は未検証なので使わない）
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    // 未認証 → /login にリダイレクト
    const loginUrl = request.nextUrl.clone()
    loginUrl.pathname = '/login'
    return NextResponse.redirect(loginUrl)
  }

  return response
}

export const config = {
  matcher: [
    '/chat/:path*',
    '/reports/:path*',
    '/admin/:path*',
    '/chat-test/:path*',
  ],
}
