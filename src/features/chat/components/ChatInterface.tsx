/** @file
 * チャット機能のメインUIコンポーネント (Basic Implementation)
 * 機能：メッセージの表示、入力、送信、AI応答のストリーミング表示、画像添付
 * 依存：Vercel AI SDK (useChat), Supabase Client, useImageAttachments
 */

'use client'

import { useChat } from '@ai-sdk/react'
import { type UIMessage } from 'ai'
import { useCallback, useEffect, useRef, useState } from 'react'

import { useImageAttachments } from '../hooks/useImageAttachments'
import { useNetworkStatus } from '../hooks/useNetworkStatus'

import { ImagePreviewBar } from './ImagePreviewBar'
import { MessageBubble, type MessageAttachment } from './MessageBubble'
import { OfflineBanner } from './OfflineBanner'

import { MAX_MESSAGE_LENGTH } from '@shared/lib/attachmentValidation'
import { getSupabaseBrowserClient } from '@shared/lib/supabaseClient'

export interface ChatInterfaceProps {
  token?: string | null
  conversationId?: string | null
  onConversationCreated?: (id: string) => void
  /** AI 応答完了後に呼ばれるコールバック（UsageBadge 更新トリガー等） */
  onMessageComplete?: () => void
}

/**
 * チャットセッション（1つの会話）を管理するコンポーネント
 * useChat フックを内包し、特定の conversationId (または新規) に対するやり取りを行う
 */
function ChatSession({
  token,
  initialMessages = [],
  conversationId,
  onConversationCreated,
  onMessageComplete,
  attachmentsByMessageId = {},
}: {
  token: string // 必須
  initialMessages?: UIMessage[]
  conversationId?: string | null
  onConversationCreated?: (id: string) => void
  onMessageComplete?: () => void
  attachmentsByMessageId?: Record<string, MessageAttachment[]>
}) {
  // Vercel AI SDK の useChat (v6系) は input 管理を提供しないため、自前で管理する
  const [input, setInput] = useState('')
  const [chatError, setChatError] = useState<string | null>(null)

  // 送信直後の添付画像メタをメッセージ ID にマッピング（リロード前のサムネイル表示用）
  const [localAttachments, setLocalAttachments] = useState<Record<string, MessageAttachment[]>>({})
  const pendingAttachmentsRef = useRef<{ storagePath: string; mimeType: string; size: number }[] | null>(null)

  // ネットワーク状態監視
  const { isOnline } = useNetworkStatus()

  // 画像添付フック
  const attachments = useImageAttachments(token)

  const { messages, sendMessage, status, setMessages, stop } = useChat({
    // api: '/api/chat', // デフォルト
    onError: (error) => {
      console.error('Chat API Error:', error)

      // ネットワークエラーの判定
      if (error instanceof TypeError && error.message.includes('fetch')) {
        setChatError('ネットワークに接続できません。接続を確認して再送信してください。')
        return
      }

      // 認証エラー（401）— セッション失効として扱い signOut でモーダルを発火させる
      if (error.message.includes('401')) {
        const supabase = getSupabaseBrowserClient()
        supabase.auth.signOut()
        return
      }

      // レート制限エラー（429）
      if (error.message.includes('429')) {
        setChatError('送信頻度が制限を超えました。しばらく待ってから再送信してください。')
        return
      }

      // その他のエラー
      setChatError('エラーが発生しました: ' + error.message)
    },
  })

  // 初期メッセージの設定
  useEffect(() => {
    if (initialMessages.length > 0) {
      setMessages(initialMessages)
    }
  }, [initialMessages, setMessages]) // 親から切り替わった初期メッセージを反映

  // 送信直後の添付画像メタを最新の user メッセージに紐付ける
  useEffect(() => {
    if (!pendingAttachmentsRef.current) return
    const lastUserMsg = [...messages].reverse().find((m) => m.role === 'user')
    if (lastUserMsg && !localAttachments[lastUserMsg.id]) {
      const meta = pendingAttachmentsRef.current
      setLocalAttachments((prev) => ({
        ...prev,
        [lastUserMsg.id]: meta.map((a) => ({
          id: crypto.randomUUID(),
          storagePath: a.storagePath,
          mimeType: a.mimeType,
          sizeBytes: a.size,
        })),
      }))
      pendingAttachmentsRef.current = null
    }
  }, [messages, localAttachments])

  // DEBUG: messages ステートの変化を詳細にログ出力 (必要に応じてコメント解除)
  /*
  useEffect(() => {
    console.log('ChatInterfaceInner: Messages Updated. Count:', messages.length);
    console.log('Full messages array:', messages);
    if (messages.length > 0) {
      const lastMsg = messages[messages.length - 1];
      console.log('Last Message Detail:', {
        id: lastMsg.id,
        role: lastMsg.role,
        content: lastMsg.content,
        // @ts-ignore
        parts: lastMsg.parts,
      });
    }
  }, [messages]);
  */

  // status から isLoading を判定 ('submitted' または 'streaming' の間はロード中)
  const isLoading = status === 'submitted' || status === 'streaming'
  const isOverLimit = input.length > MAX_MESSAGE_LENGTH

  // textarea ref（自動リサイズ用）
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  // 入力ハンドラ（自動リサイズ付き）
  const handleInputChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setInput(e.target.value)
    const el = e.target
    el.style.height = 'auto'
    el.style.height = `${el.scrollHeight}px`
  }

  // Enter で送信、Shift+Enter で改行
  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey && !e.nativeEvent.isComposing) {
      e.preventDefault()
      e.currentTarget.form?.requestSubmit()
    }
  }

  // ドラッグ&ドロップ
  const [isDragging, setIsDragging] = useState(false)

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    setIsDragging(true)
  }, [])

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    setIsDragging(false)
  }, [])

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    setIsDragging(false)
    if (e.dataTransfer.files.length > 0) {
      attachments.addFiles(e.dataTransfer.files)
    }
  }, [attachments])

  // メッセージ送信時のハンドラ
  const onSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    if (!input.trim() && attachments.items.length === 0) return

    const userMessage = input
    setInput('') // 入力欄をクリア
    setChatError(null) // 前回のエラーをクリア

    // textarea の高さをリセット
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto'
    }

    try {
      // 添付画像がある場合はアップロードしてからメッセージ送信
      let attachmentMeta: { storagePath: string; mimeType: string; size: number }[] = []
      if (attachments.items.length > 0) {
        attachmentMeta = await attachments.uploadAll()
        if (attachmentMeta.length === 0 && attachments.hasError) {
          // アップロード全件失敗の場合は送信中止
          return
        }
      }

      // 添付メタを一時保存（sendMessage 後の useEffect で紐付ける）
      if (attachmentMeta.length > 0) {
        pendingAttachmentsRef.current = attachmentMeta
      }

      // sendMessage を使ってメッセージを追加・送信
      // headers はここで渡す（認証トークンを API に送る）
      // body に conversationId を含めることで、サーバー側で既存会話への追記が可能
      const bodyPayload: Record<string, unknown> = {}
      if (conversationId) {
        bodyPayload.conversationId = conversationId
      }
      if (attachmentMeta.length > 0) {
        bodyPayload.attachments = attachmentMeta
      }
      await sendMessage({
        text: userMessage,
      }, {
        headers: {
          'Authorization': `Bearer ${token}`,
        },
        body: Object.keys(bodyPayload).length > 0 ? bodyPayload : undefined,
      })

      // アップロード完了後にプレビューをクリア
      attachments.clearAll()

      // sendMessage 完了後、最新の会話一覧を取得して
      // 新しく作成された会話のIDを親に通知する
      // （API は x-conversation-id ヘッダーで返すが、useChat 経由では取得できないため、
      //   会話一覧APIから最新の会話IDを取得する）
      if (!conversationId && onConversationCreated) {
        try {
          const res = await globalThis.fetch('/api/conversations?limit=1', {
            headers: { Authorization: `Bearer ${token}` },
          })
          if (res.ok) {
            const json = await res.json()
            // API レスポンス形式: { data: [...], nextCursor }
            const firstConv = json.data?.[0]
            if (firstConv?.id) {
              onConversationCreated(firstConv.id)
            }
          }
        } catch {
          // 会話ID取得の失敗はチャット自体には影響させない
          console.warn('Could not fetch latest conversation id')
        }
      }
    } catch (err) {
      console.error(err)
    } finally {
      // UsageBadge 更新トリガー（サーバー側 incrementUsage との遅延を考慮し 1s 後に発火）
      // sendMessage の成否にかかわらず呼ぶ（サーバー側でカウント済みの場合に表示を同期）
      if (onMessageComplete) {
        setTimeout(onMessageComplete, 1000)
      }
    }
  }

  return (
    <div
      className="flex flex-col h-full bg-white max-w-4xl mx-auto"
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
    >
      {/* オフラインバナー */}
      <OfflineBanner isOnline={isOnline} />

      {/* ドラッグ&ドロップオーバーレイ */}
      {isDragging && (
        <div className="absolute inset-0 z-50 bg-blue-50/80 border-2 border-dashed border-blue-400 rounded-lg flex items-center justify-center pointer-events-none">
          <p className="text-blue-600 font-medium text-lg">画像をドロップして添付</p>
        </div>
      )}

      {/* メッセージ表示エリア */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {messages.length === 0 && (
          <div className="text-center text-gray-500 mt-20">
            <h2 className="text-xl font-bold mb-2">こんにちは！</h2>
            <p>学習に関する質問を自由にしてください。</p>
            <div className="mt-8 grid grid-cols-1 md:grid-cols-2 gap-4 max-w-lg mx-auto text-sm text-left">
              <button
                onClick={() => { setInput('二次方程式の解の公式を教えて'); }}
                className="p-3 border rounded-lg hover:bg-gray-50 transition text-gray-700"
              >
                「二次方程式の解の公式を教えて」
              </button>
              <button
                 onClick={() => { setInput('英単語の効率的な覚え方は？'); }}
                 className="p-3 border rounded-lg hover:bg-gray-50 transition text-gray-700"
              >
                「英単語の効率的な覚え方は？」
              </button>
            </div>
          </div>
        )}

        {messages.map((m) => (
          <MessageBubble
            key={m.id}
            message={m}
            attachments={attachmentsByMessageId[m.id] ?? localAttachments[m.id]}
          />
        ))}

        {isLoading && (
          <div className="flex items-center gap-2 justify-start">
            <div className="bg-gray-100 rounded-lg p-3 text-gray-500 animate-pulse text-sm">
              AIが考え中...
            </div>
            <button
              type="button"
              onClick={stop}
              className="rounded-lg bg-red-50 border border-red-200 px-3 py-1.5 text-xs font-medium text-red-700 hover:bg-red-100 transition-colors"
              aria-label="回答の生成を停止"
            >
              停止
            </button>
          </div>
        )}

        {/* チャットエラーメッセージ（インライン表示） */}
        {chatError && (
          <div className="flex justify-center">
            <div className="flex items-center gap-2 rounded-lg bg-red-50 border border-red-200 px-4 py-2 text-sm text-red-700">
              <span>{chatError}</span>
              <button
                type="button"
                onClick={() => setChatError(null)}
                className="ml-2 text-red-400 hover:text-red-600"
                aria-label="エラーを閉じる"
              >
                ✕
              </button>
            </div>
          </div>
        )}
      </div>

      {/* 入力フォームエリア */}
      <div className="border-t bg-white sticky bottom-0 z-10 pb-safe">
        {/* エラーメッセージ */}
        {attachments.globalError && (
          <div className="px-4 pt-2">
            <p className="text-sm text-red-500">{attachments.globalError}</p>
          </div>
        )}

        {/* 画像プレビュー */}
        <ImagePreviewBar items={attachments.items} onRemove={attachments.removeItem} />

        <form onSubmit={onSubmit} className="flex gap-2 max-w-4xl mx-auto p-4 pt-2">
          {/* 隠しファイル入力 */}
          <input
            ref={attachments.fileInputRef}
            type="file"
            accept={attachments.accept}
            multiple
            className="hidden"
            onChange={(e) => {
              if (e.target.files) {
                attachments.addFiles(e.target.files)
              }
              e.target.value = ''
            }}
          />

          {/* 📎 クリップボタン */}
          <button
            type="button"
            onClick={attachments.openFilePicker}
            className="p-3 min-h-[44px] min-w-[44px] flex items-center justify-center text-gray-500 hover:text-blue-600 hover:bg-gray-100 rounded-lg transition-colors"
            disabled={isLoading || attachments.isUploading || attachments.isConverting}
            title="画像を添付"
          >
            <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M21.44 11.05l-9.19 9.19a6 6 0 01-8.49-8.49l9.19-9.19a4 4 0 015.66 5.66l-9.2 9.19a2 2 0 01-2.83-2.83l8.49-8.48" />
            </svg>
          </button>

          <textarea
            ref={textareaRef}
            className={`flex-1 p-3 text-base border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 shadow-sm max-h-32 overflow-y-auto resize-none ${isOverLimit ? 'border-red-400' : ''}`}
            value={input}
            onChange={handleInputChange}
            onKeyDown={handleKeyDown}
            placeholder="メッセージを入力..."
            disabled={isLoading || attachments.isUploading || attachments.isConverting}
            rows={1}
          />
          <button
            type="submit"
            className="px-6 py-3 min-h-[44px] bg-blue-600 text-white font-medium rounded-lg disabled:bg-gray-300 disabled:cursor-not-allowed hover:bg-blue-700 transition-colors shadow-sm"
            disabled={isLoading || attachments.isUploading || attachments.isConverting || isOverLimit || (!input?.trim() && attachments.items.length === 0)}
          >
            {attachments.isConverting ? '変換中...' : attachments.isUploading ? '送信中...' : '送信'}
          </button>
        </form>
        {input.length > MAX_MESSAGE_LENGTH * 0.8 && (
          <div className={`px-4 pb-2 text-xs text-right ${isOverLimit ? 'text-red-500 font-medium' : 'text-gray-400'}`}>
            {input.length} / {MAX_MESSAGE_LENGTH}
          </div>
        )}
      </div>
    </div>
  )
}

/** API から返されるメッセージの型（attachments 含む） */
type RawApiMessage = {
  id: string
  role: string
  content: string
  createdAt: string
  attachments?: Array<{
    id: string
    storagePath: string
    mimeType: string | null
    sizeBytes: number | null
  }>
}

function ChatLoader({
  token,
  conversationId,
  onConversationCreated,
  onMessageComplete,
}: {
  token: string
  conversationId?: string | null
  onConversationCreated?: (id: string) => void
  onMessageComplete?: () => void
}) {
  const [messages, setMessages] = useState<UIMessage[]>([])
  const [attachmentsMap, setAttachmentsMap] = useState<Record<string, MessageAttachment[]>>({})
  const [loading, setLoading] = useState(false)

  // ChatSession の key 管理:
  // null → ID（新規チャットが会話に確定）の場合は再マウントしない
  // ID → null / ID → 別ID の場合は再マウントする
  const prevConversationIdRef = useRef(conversationId)
  const [sessionKey, setSessionKey] = useState(conversationId || 'new')

  useEffect(() => {
    const prev = prevConversationIdRef.current
    const curr = conversationId

    if (!prev && curr) {
      // null → ID: 新規チャットが会話に確定（再マウント不要）
      prevConversationIdRef.current = curr
      return
    }

    if (prev !== curr) {
      // ID → null: 新規チャットへ切替 / ID → 別ID: 会話切替（再マウント必要）
      setSessionKey(curr || `new-${Date.now()}`)
      prevConversationIdRef.current = curr
    }
  }, [conversationId])

  useEffect(() => {
    if (!conversationId) {
      setMessages([])
      setAttachmentsMap({})
      return
    }

    setLoading(true)
    fetch(`/api/conversations/${conversationId}`, {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then((res) => (res.ok ? res.json() : Promise.reject(res.statusText)))
      .then((json) => {
        // API レスポンス形式: { data: { id, title, createdAt, messages: [{id, role, content, createdAt, attachments}] } }
        const rawMessages: RawApiMessage[] = json?.data?.messages ?? []

        // DB のメッセージ形式を UIMessage 形式に変換
        const uiMessages: UIMessage[] = rawMessages.map((m) => ({
          id: m.id,
          role: m.role as 'user' | 'assistant',
          content: m.content ?? '',
          parts: [{ type: 'text' as const, text: m.content ?? '' }],
          createdAt: new Date(m.createdAt),
        }))

        // 添付画像をメッセージ ID ごとにマップ化
        const aMap: Record<string, MessageAttachment[]> = {}
        for (const m of rawMessages) {
          if (m.attachments && m.attachments.length > 0) {
            aMap[m.id] = m.attachments
          }
        }

        setMessages(uiMessages)
        setAttachmentsMap(aMap)
      })
      .catch((err) => {
        console.error('Failed to load conversation', err)
      })
      .finally(() => setLoading(false))
  }, [conversationId, token])

  if (loading) {
    return (
      <div className="flex justify-center items-center h-full text-gray-400">
        読み込み中...
      </div>
    )
  }

  return (
    <ChatSession
      key={sessionKey}
      token={token}
      initialMessages={messages}
      conversationId={conversationId}
      onConversationCreated={onConversationCreated}
      onMessageComplete={onMessageComplete}
      attachmentsByMessageId={attachmentsMap}
    />
  )
}

/**
 * メインコンポーネント: 認証状態を管理するためのラッパー
 */
export function ChatInterface({
  token: externalToken,
  conversationId,
  onConversationCreated,
  onMessageComplete,
}: ChatInterfaceProps) {
  const [internalToken, setInternalToken] = useState<string | null>(null)
  const [isAuthChecking, setIsAuthChecking] = useState(!externalToken)

  const activeToken = externalToken || internalToken

  // マウント時にセッシュントークンを取得し、変更を監視する
  useEffect(() => {
    if (externalToken) {
      setIsAuthChecking(false)
      return
    }

    const supabase = getSupabaseBrowserClient()
    
    // 初期化: 現在のセッションを取得
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session) {
        setInternalToken(session.access_token)
      }
      setIsAuthChecking(false)
    })

    // 監視: 認証状態（トークンリフレッシュ等）の変化をリッスン
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      if (session) {
        setInternalToken(session.access_token)
      } else {
        setInternalToken(null)
      }
    })

    return () => {
      subscription.unsubscribe()
    }
  }, [externalToken])

  // まだ認証情報の取得が終わっていない場合
  if (isAuthChecking) {
    return <div className="p-4 text-center">読み込み中... (ログイン状態を確認しています)</div>
  }

  // ログインしていない場合（トークンがない場合）
  if (!activeToken) {
    return <div className="p-4 text-center text-red-500 font-bold">チャットを利用するにはログインが必要です。</div>
  }

  // トークンがある場合のみ Loader コンポーネントをマウント
  return (
    <ChatLoader
      token={activeToken}
      conversationId={conversationId}
      onConversationCreated={onConversationCreated}
      onMessageComplete={onMessageComplete}
    />
  )
}
