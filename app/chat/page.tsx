'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useCallback, useState, useEffect } from 'react'

import { AllowlistGuard } from '@features/allowlist/components/AllowlistGuard'
import { ChatInterface } from '@features/chat/components/ChatInterface'
import { ConversationSidebar } from '@features/chat/components/ConversationSidebar'
import { UsageBadge } from '@features/chat/components/UsageBadge'
import { LogoutButton } from '@shared/components/LogoutButton'
import { SessionExpiredModal } from '@shared/components/SessionExpiredModal'
import { getSupabaseBrowserClient } from '@shared/lib/supabaseClient'

export default function ChatPage() {
  const router = useRouter()
  const [selectedId, setSelectedId] = useState<string>('')
  const [token, setToken] = useState<string | null>(null)
  const [showSessionExpired, setShowSessionExpired] = useState(false)

  // サイドバーを強制的に再レンダリングするためのキー（新規会話作成時などに更新）
  const [sidebarKey, setSidebarKey] = useState(0)
  // モバイルドロワーの開閉状態
  const [isSidebarOpen, setIsSidebarOpen] = useState(false)

  // 認証トークンの取得と監視
  useEffect(() => {
    const supabase = getSupabaseBrowserClient()

    // 初期化
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session) setToken(session.access_token)
    })

    // 変更監視: イベント種別に応じたハンドリング
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === 'SIGNED_OUT') {
        setToken(null)
        setShowSessionExpired(true)
        return
      }

      if (event === 'TOKEN_REFRESHED' && session) {
        setToken(session.access_token)
        return
      }

      // その他のイベント（SIGNED_IN, INITIAL_SESSION 等）
      if (session) {
        setToken(session.access_token)
      } else {
        setToken(null)
      }
    })

    return () => subscription.unsubscribe()
  }, [])

  // セッション切れモーダル → ログイン画面へ遷移
  const handleSessionExpiredConfirm = useCallback(() => {
    router.push('/login')
  }, [router])

  // 新規チャットが作成されたときのコールバック（サイドバー更新 + ID選択）
  const handleConversationCreated = (id: string) => {
    setSelectedId(id)
    setSidebarKey(prev => prev + 1)
  }

  // サイドバーで会話が選択されたとき（モバイルドロワーも閉じる）
  const handleSelect = (id: string) => {
    setSelectedId(id)
    setIsSidebarOpen(false)
  }

  return (
    <AllowlistGuard redirectToHome={false}>
      {/* 
        モバイルブラウザのアドレスバーによるレイアウト崩れを防ぐため 
        h-[100dvh] (Dynamic Viewport Height) を使用
      */}
      <div className="flex flex-col h-[100dvh] bg-gray-50">
        <header className="flex items-center justify-between border-b bg-white px-4 py-3 shadow-sm flex-shrink-0 z-10">
          <div className="flex items-center gap-2">
            {/* モバイル用ハンバーガーメニューボタン */}
            {token && (
              <button
                type="button"
                onClick={() => setIsSidebarOpen(true)}
                className="p-1 text-gray-600 hover:text-gray-900 md:hidden"
                aria-label="会話履歴を開く"
              >
                <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <line x1="3" y1="6" x2="21" y2="6" />
                  <line x1="3" y1="12" x2="21" y2="12" />
                  <line x1="3" y1="18" x2="21" y2="18" />
                </svg>
              </button>
            )}
            <h1 className="text-lg font-bold text-gray-800">Marubo AI</h1>
            <span className="rounded bg-blue-100 px-2 py-0.5 text-xs font-medium text-blue-700">
              Beta
            </span>
          </div>
          <div className="flex items-center gap-4">
            {token && <UsageBadge token={token} />}
            <Link
              href="/reports"
              className="text-sm font-medium text-indigo-600 hover:text-indigo-800"
            >
              レポート
            </Link>
            <LogoutButton />
            <Link
              href="/"
              className="text-sm font-medium text-gray-500 hover:text-gray-900"
            >
              ✕ 閉じる
            </Link>
          </div>
        </header>

        <div className="flex flex-1 overflow-hidden">
          {/* モバイルドロワー */}
          {token && (
            <>
              {/* オーバーレイ */}
              <div
                className={`fixed inset-0 z-40 bg-black/50 transition-opacity duration-200 md:hidden ${
                  isSidebarOpen ? 'opacity-100' : 'pointer-events-none opacity-0'
                }`}
                onClick={() => setIsSidebarOpen(false)}
              />
              {/* サイドパネル */}
              <aside
                className={`fixed left-0 top-0 z-50 flex h-full w-72 flex-col bg-white shadow-xl transition-transform duration-200 md:hidden ${
                  isSidebarOpen ? 'translate-x-0' : '-translate-x-full'
                }`}
              >
                <div className="flex items-center justify-between border-b px-4 py-3">
                  <span className="text-sm font-bold text-gray-700">会話履歴</span>
                  <button
                    type="button"
                    onClick={() => setIsSidebarOpen(false)}
                    className="p-1 text-gray-500 hover:text-gray-900"
                    aria-label="閉じる"
                  >
                    ✕
                  </button>
                </div>
                <div className="flex-1 overflow-hidden">
                  <ConversationSidebar
                    key={sidebarKey}
                    token={token}
                    selectedId={selectedId}
                    onSelect={handleSelect}
                  />
                </div>
              </aside>
            </>
          )}

          {/* デスクトップサイドバー */}
          {token && (
            <aside className="hidden md:flex w-64 flex-col border-r bg-gray-50 overflow-hidden">
              <ConversationSidebar
                key={sidebarKey}
                token={token}
                selectedId={selectedId}
                onSelect={handleSelect}
              />
            </aside>
          )}

          <main className="flex-1 overflow-hidden relative flex flex-col">
            <ChatInterface 
              token={token} 
              conversationId={selectedId || null}
              onConversationCreated={handleConversationCreated}
            />
          </main>
        </div>
      </div>
      <SessionExpiredModal
        isOpen={showSessionExpired}
        onConfirm={handleSessionExpiredConfirm}
      />
    </AllowlistGuard>
  )
}
