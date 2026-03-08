'use client'

import Link from 'next/link'
import { useState, useEffect } from 'react'

import { AllowlistGuard } from '@features/allowlist/components/AllowlistGuard'
import { ChatInterface } from '@features/chat/components/ChatInterface'
import { ConversationSidebar } from '@features/chat/components/ConversationSidebar'
import { LogoutButton } from '@shared/components/LogoutButton'
import { getSupabaseBrowserClient } from '@shared/lib/supabaseClient'

export default function ChatPage() {
  const [selectedId, setSelectedId] = useState<string>('')
  const [token, setToken] = useState<string | null>(null)
  
  // サイドバーを強制的に再レンダリングするためのキー（新規会話作成時などに更新）
  const [sidebarKey, setSidebarKey] = useState(0)

  // 認証トークンの取得と監視
  useEffect(() => {
    const supabase = getSupabaseBrowserClient()
    
    // 初期化
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session) setToken(session.access_token)
    })
    
    // 変更監視
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_, session) => {
      if (session) setToken(session.access_token)
      else setToken(null)
    })

    return () => subscription.unsubscribe()
  }, [])

  // 新規チャットが作成されたときのコールバック（サイドバー更新 + ID選択）
  const handleConversationCreated = (id: string) => {
    setSelectedId(id)
    setSidebarKey(prev => prev + 1)
  }

  // サイドバーで会話が選択されたとき
  const handleSelect = (id: string) => {
    setSelectedId(id)
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
            <h1 className="text-lg font-bold text-gray-800">Marubo AI</h1>
            <span className="rounded bg-blue-100 px-2 py-0.5 text-xs font-medium text-blue-700">
              Beta
            </span>
          </div>
          <div className="flex items-center gap-4">
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
    </AllowlistGuard>
  )
}
