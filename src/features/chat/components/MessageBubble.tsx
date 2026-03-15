/** @file
 * メッセージバブルコンポーネント。
 * 機能：ユーザー/AI メッセージの表示、添付画像のサムネイル表示と拡大表示。
 * 入力：UIMessage + 添付画像メタデータ配列。
 * 依存：MemoizedMarkdown, ImageLightbox, normalizeMath, supabaseClient。
 * セキュリティ：署名 URL は期限付き（10分）。期限切れ時は自動で再署名を試行（最大2回）。
 */

'use client'

import { type UIMessage } from 'ai'
import { useCallback, useEffect, useRef, useState } from 'react'

import { normalizeMathDelimiters } from '../utils/normalizeMath'

import { ImageLightbox } from './ImageLightbox'
import { MemoizedMarkdown } from './MemoizedMarkdown'

import { getSupabaseBrowserClient } from '@shared/lib/supabaseClient'

/** API から返される添付画像メタデータ */
export type MessageAttachment = {
  id: string
  storagePath: string
  mimeType: string | null
  sizeBytes: number | null
}

/** 署名 URL の有効期間（秒）: 10 分 */
const SIGNED_URL_EXPIRES_IN = 600

/** 署名 URL 期限切れ時の最大リトライ回数 */
const MAX_RETRY_COUNT = 2

interface MessageBubbleProps {
  message: UIMessage
  attachments?: MessageAttachment[]
}

/**
 * 添付画像のサムネイルを表示するサブコンポーネント。
 * Storage の署名 URL を取得してから画像を描画する。
 * 期限切れ時は自動で再署名を試行（最大 MAX_RETRY_COUNT 回）。
 */
function AttachmentThumbnails({ items }: { items: MessageAttachment[] }) {
  const [signedUrls, setSignedUrls] = useState<Record<string, string>>({})
  const [loadingIds, setLoadingIds] = useState<Set<string>>(new Set())
  const [failedIds, setFailedIds] = useState<Set<string>>(new Set())
  const [lightboxSrc, setLightboxSrc] = useState<string | null>(null)
  const retryCountRef = useRef<Record<string, number>>({})

  useEffect(() => {
    if (items.length === 0) return

    let cancelled = false
    const toFetch = items.filter((a) => !signedUrls[a.id])
    if (toFetch.length === 0) return

    setLoadingIds(new Set(toFetch.map((a) => a.id)))

    const supabase = getSupabaseBrowserClient()

    Promise.all(
      toFetch.map(async (a) => {
        const { data } = await supabase.storage
          .from('attachments')
          .createSignedUrl(a.storagePath, SIGNED_URL_EXPIRES_IN)
        return { id: a.id, url: data?.signedUrl ?? null }
      }),
    ).then((results) => {
      if (cancelled) return
      const urls: Record<string, string> = {}
      for (const r of results) {
        if (r.url) urls[r.id] = r.url
      }
      setSignedUrls((prev) => ({ ...prev, ...urls }))
      setLoadingIds(new Set())
    })

    return () => {
      cancelled = true
    }
  }, [items, signedUrls])

  const handleImageError = useCallback(
    async (attachment: MessageAttachment) => {
      const currentRetry = retryCountRef.current[attachment.id] ?? 0
      if (currentRetry >= MAX_RETRY_COUNT) {
        setFailedIds((prev) => new Set(prev).add(attachment.id))
        return
      }

      retryCountRef.current[attachment.id] = currentRetry + 1

      const supabase = getSupabaseBrowserClient()
      const { data } = await supabase.storage
        .from('attachments')
        .createSignedUrl(attachment.storagePath, SIGNED_URL_EXPIRES_IN)

      if (data?.signedUrl) {
        setSignedUrls((prev) => ({ ...prev, [attachment.id]: data.signedUrl }))
      } else {
        setFailedIds((prev) => new Set(prev).add(attachment.id))
      }
    },
    [],
  )

  return (
    <>
      <div className="flex flex-wrap gap-2 mt-2">
        {items.map((a) => {
          const url = signedUrls[a.id]
          const isLoading = loadingIds.has(a.id)
          const isFailed = failedIds.has(a.id)

          return (
            <button
              key={a.id}
              type="button"
              onClick={() => url && !isFailed && setLightboxSrc(url)}
              className="block rounded-lg overflow-hidden border border-gray-200 bg-gray-100 hover:opacity-90 transition-opacity focus:outline-none focus:ring-2 focus:ring-blue-400"
              disabled={!url || isFailed}
              aria-label="画像を拡大表示"
            >
              {isFailed ? (
                <div className="flex w-40 h-28 items-center justify-center bg-gray-100 text-gray-400">
                  <div className="text-center">
                    <svg xmlns="http://www.w3.org/2000/svg" className="mx-auto h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 15.75l5.159-5.159a2.25 2.25 0 013.182 0l5.159 5.159m-1.5-1.5l1.409-1.409a2.25 2.25 0 013.182 0l2.909 2.909M3.75 21h16.5A2.25 2.25 0 0022.5 18.75V5.25A2.25 2.25 0 0020.25 3H3.75A2.25 2.25 0 001.5 5.25v13.5A2.25 2.25 0 003.75 21z" />
                    </svg>
                    <p className="mt-1 text-xs">読み込めません</p>
                  </div>
                </div>
              ) : isLoading || !url ? (
                <div className="w-40 h-28 animate-pulse bg-gray-200" />
              ) : (
                /* eslint-disable-next-line @next/next/no-img-element */
                <img
                  src={url}
                  alt="添付画像"
                  className="max-w-[320px] max-h-[240px] object-contain"
                  loading="lazy"
                  onError={() => handleImageError(a)}
                />
              )}
            </button>
          )
        })}
      </div>

      {lightboxSrc && (
        <ImageLightbox
          src={lightboxSrc}
          alt="添付画像（拡大）"
          onClose={() => setLightboxSrc(null)}
        />
      )}
    </>
  )
}

export function MessageBubble({ message, attachments }: MessageBubbleProps) {
  const isUser = message.role === 'user'
  const legacyContentMessage = message as UIMessage & { content?: string }

  // AI SDK v6 Data Stream Protocol対応:
  // message.content が空でも message.parts にテキストが含まれている場合はそれを結合して表示する
  const rawContent =
    (typeof legacyContentMessage.content === 'string' ? legacyContentMessage.content : '') ||
    message.parts
      .flatMap((part) => (part.type === 'text' ? [part.text] : []))
      .join('') ||
    ''

  // 数式デリミタの正規化（\[...\] -> $$...$$, \(...\) -> $...$）
  // ユーザーの入力はそのまま表示したいので、AIの応答のみ正規化する（あるいは両方しても良いが、一旦は安全側に倒す）
  // ただし、ユーザーも数式を入力する場合があるため、統一的に正規化しても良い。
  // ここでは要件に従い「AI応答の数式が表示されない」問題を解決するため、単純に content 全体に適用する。
  const textContent = normalizeMathDelimiters(rawContent)

  const hasAttachments = attachments && attachments.length > 0

  return (
    <div className={`flex ${isUser ? 'justify-end' : 'justify-start'}`}>
      <div
        className={`max-w-[85%] rounded-lg p-4 ${
          isUser
            ? 'bg-blue-600 text-white'
            : 'bg-white border text-gray-800 shadow-sm'
        }`}
      >
        {isUser ? (
          // ユーザーのメッセージはそのままプレーンテキストで表示
          // テキストがない場合（画像のみ送信）は添付サムネイルのみ表示
          textContent ? (
            <div className="whitespace-pre-wrap">{textContent}</div>
          ) : hasAttachments ? (
            <p className="text-sm text-blue-200 italic">画像を送信しました</p>
          ) : (
            <div className="whitespace-pre-wrap">{textContent}</div>
          )
        ) : (
          // AIのメッセージはMarkdownとしてレンダリング
          <MemoizedMarkdown content={textContent} />
        )}

        {/* contentが空で、かつpartsがある場合のフォールバック（Tool calls等） */}
        {/* 添付画像がある場合はフォールバック表示を抑制 */}
        {!textContent && !hasAttachments && message.parts && message.parts.length > 0 && (
          <div className="text-xs text-gray-500 mt-1 italic">
            (構造化データを受信中...)
          </div>
        )}

        {/* 添付画像サムネイル */}
        {hasAttachments && <AttachmentThumbnails items={attachments} />}
      </div>
    </div>
  )
}
