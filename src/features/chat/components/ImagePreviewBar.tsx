/** @file
 * 添付画像プレビューバー。
 * 機能：選択済み画像のサムネイル・ファイル名・サイズ表示、個別削除ボタン。
 * 依存：useImageAttachments が返す AttachmentItem 配列
 */

'use client'

import type { AttachmentItem } from '../hooks/useImageAttachments'

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

type Props = {
  items: AttachmentItem[]
  onRemove: (id: string) => void
}

export function ImagePreviewBar({ items, onRemove }: Props) {
  if (items.length === 0) return null

  return (
    <div className="flex gap-2 overflow-x-auto px-4 py-2">
      {items.map((item) => (
        <div
          key={item.id}
          className="relative flex-shrink-0 w-20 group"
        >
          {/* サムネイル */}
          <div className="relative w-20 h-20 rounded-lg overflow-hidden border border-gray-200 bg-gray-50">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={item.previewUrl}
              alt={item.file.name}
              className="w-full h-full object-cover"
            />

            {/* ステータスオーバーレイ */}
            {item.status === 'uploading' && (
              <div className="absolute inset-0 bg-black/40 flex items-center justify-center">
                <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
              </div>
            )}
            {item.status === 'error' && (
              <div className="absolute inset-0 bg-red-500/40 flex items-center justify-center">
                <span className="text-white text-xs font-bold">!</span>
              </div>
            )}

            {/* ✕ 削除ボタン */}
            <button
              type="button"
              onClick={() => onRemove(item.id)}
              className="absolute -top-1 -right-1 w-5 h-5 bg-gray-700 text-white rounded-full flex items-center justify-center text-xs hover:bg-red-600 transition-colors opacity-0 group-hover:opacity-100 focus:opacity-100"
              aria-label={`${item.file.name} を削除`}
            >
              ✕
            </button>
          </div>

          {/* ファイル名・サイズ */}
          <div className="mt-1 text-center">
            <p className="text-[10px] text-gray-500 truncate w-20" title={item.file.name}>
              {item.file.name}
            </p>
            <p className="text-[10px] text-gray-400">
              {formatFileSize(item.file.size)}
            </p>
          </div>

          {/* エラーメッセージ */}
          {item.status === 'error' && item.error && (
            <p className="text-[10px] text-red-500 truncate w-20 mt-0.5" title={item.error}>
              {item.error}
            </p>
          )}
        </div>
      ))}
    </div>
  )
}
