/** @file
 * 画像添付を管理するカスタムフック。
 * 機能：ファイル選択・バリデーション・プレビューURL管理・署名URLアップロード・削除
 * 依存：attachmentValidation（共有定数）
 * セキュリティ：MIME タイプ・サイズ・枚数をクライアント側でも検証。
 */

'use client'

import { useCallback, useRef, useState } from 'react'

import {
  ALLOWED_MIME_TYPES,
  MAX_ATTACHMENTS_PER_MESSAGE,
  MAX_FILE_SIZE_BYTES,
} from '@shared/lib/attachmentValidation'

/** 添付画像 1 件の状態 */
export type AttachmentItem = {
  id: string
  file: File
  previewUrl: string
  /** アップロード完了後に設定される Storage パス */
  storagePath: string | null
  /** 'pending' | 'uploading' | 'done' | 'error' */
  status: 'pending' | 'uploading' | 'done' | 'error'
  error?: string
}

/** /api/chat に渡す送信用メタデータ */
export type AttachmentMeta = {
  storagePath: string
  mimeType: string
  size: number
}

const ACCEPT = ALLOWED_MIME_TYPES.join(',')

function generateId() {
  return crypto.randomUUID()
}

function validateFile(file: File): string | null {
  if (!(ALLOWED_MIME_TYPES as readonly string[]).includes(file.type)) {
    return '対応している画像形式は JPEG / PNG / WebP です。'
  }
  if (file.size > MAX_FILE_SIZE_BYTES) {
    return '画像は 1 枚あたり 5MB 以下にしてください。'
  }
  return null
}

export function useImageAttachments(token: string) {
  const [items, setItems] = useState<AttachmentItem[]>([])
  const [globalError, setGlobalError] = useState<string | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  /** ファイル選択ダイアログを開く */
  const openFilePicker = useCallback(() => {
    fileInputRef.current?.click()
  }, [])

  /** ファイルを追加する（input onChange / drop 共通） */
  const addFiles = useCallback(
    (files: FileList | File[]) => {
      setGlobalError(null)
      const fileArray = Array.from(files)

      setItems((prev) => {
        const remaining = MAX_ATTACHMENTS_PER_MESSAGE - prev.length
        if (remaining <= 0) {
          setGlobalError(`1 回の送信で添付できる画像は ${MAX_ATTACHMENTS_PER_MESSAGE} 枚までです。`)
          return prev
        }

        const toAdd = fileArray.slice(0, remaining)
        if (fileArray.length > remaining) {
          setGlobalError(`1 回の送信で添付できる画像は ${MAX_ATTACHMENTS_PER_MESSAGE} 枚までです。`)
        }

        const newItems: AttachmentItem[] = []
        for (const file of toAdd) {
          const error = validateFile(file)
          if (error) {
            setGlobalError(error)
            continue
          }
          newItems.push({
            id: generateId(),
            file,
            previewUrl: URL.createObjectURL(file),
            storagePath: null,
            status: 'pending',
          })
        }
        return [...prev, ...newItems]
      })
    },
    [],
  )

  /** 添付を 1 件削除する */
  const removeItem = useCallback((id: string) => {
    setItems((prev) => {
      const target = prev.find((item) => item.id === id)
      if (target) {
        URL.revokeObjectURL(target.previewUrl)
      }
      return prev.filter((item) => item.id !== id)
    })
  }, [])

  /** 全添付をクリアする（送信後のリセット用） */
  const clearAll = useCallback(() => {
    setItems((prev) => {
      prev.forEach((item) => URL.revokeObjectURL(item.previewUrl))
      return []
    })
    setGlobalError(null)
  }, [])

  /** 全画像を署名 URL でアップロードし、メタデータ配列を返す */
  const uploadAll = useCallback(async (): Promise<AttachmentMeta[]> => {
    const pending = items.filter((item) => item.status === 'pending')
    if (pending.length === 0) {
      // 既にアップロード済みの場合はそのまま返す
      return items
        .filter((item) => item.status === 'done' && item.storagePath)
        .map((item) => ({
          storagePath: item.storagePath!,
          mimeType: item.file.type,
          size: item.file.size,
        }))
    }

    const results: AttachmentMeta[] = []

    for (const item of pending) {
      // uploading に更新
      setItems((prev) =>
        prev.map((i) => (i.id === item.id ? { ...i, status: 'uploading' as const } : i)),
      )

      try {
        // 1. 署名 URL 取得
        const signRes = await fetch('/api/attachments/sign', {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${token}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            filename: item.file.name,
            mimeType: item.file.type,
            size: item.file.size,
          }),
        })

        if (!signRes.ok) {
          const errBody = await signRes.json().catch(() => ({}))
          throw new Error(
            (errBody as { error?: { message?: string } }).error?.message ??
              '署名 URL の取得に失敗しました。',
          )
        }

        const signData = (await signRes.json()) as {
          data: { signedUrl: string; storagePath: string; token: string }
        }

        // 2. Storage に PUT アップロード
        const uploadRes = await fetch(signData.data.signedUrl, {
          method: 'PUT',
          headers: {
            'Content-Type': item.file.type,
          },
          body: item.file,
        })

        if (!uploadRes.ok) {
          throw new Error('画像のアップロードに失敗しました。もう一度お試しください。')
        }

        // done に更新
        setItems((prev) =>
          prev.map((i) =>
            i.id === item.id
              ? { ...i, status: 'done' as const, storagePath: signData.data.storagePath }
              : i,
          ),
        )

        results.push({
          storagePath: signData.data.storagePath,
          mimeType: item.file.type,
          size: item.file.size,
        })
      } catch (err) {
        const message = err instanceof Error ? err.message : 'アップロードに失敗しました。'
        setItems((prev) =>
          prev.map((i) =>
            i.id === item.id ? { ...i, status: 'error' as const, error: message } : i,
          ),
        )
      }
    }

    // 既にアップロード済みのものも含めて返す
    const alreadyDone = items
      .filter((item) => item.status === 'done' && item.storagePath)
      .map((item) => ({
        storagePath: item.storagePath!,
        mimeType: item.file.type,
        size: item.file.size,
      }))

    return [...alreadyDone, ...results]
  }, [items, token])

  /** アップロード中かどうか */
  const isUploading = items.some((item) => item.status === 'uploading')

  /** エラーがあるかどうか */
  const hasError = items.some((item) => item.status === 'error')

  return {
    items,
    globalError,
    isUploading,
    hasError,
    fileInputRef,
    accept: ACCEPT,
    addFiles,
    removeItem,
    clearAll,
    openFilePicker,
    uploadAll,
  }
}
