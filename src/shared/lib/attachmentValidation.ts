/** @file
 * 画像添付のバリデーション定数と検証関数。
 * 入力：ファイル名・MIME タイプ・サイズ
 * 出力：バリデーション結果（合格 or AppError をスロー）
 * 依存：AppError
 * セキュリティ：許可された MIME タイプのみ受け付け、サイズ上限を厳密にチェック。
 */

import { AppError } from './errors'

/** 許可する MIME タイプ（docs/attachments.md §1 準拠） */
export const ALLOWED_MIME_TYPES = [
  'image/jpeg',
  'image/png',
  'image/webp',
] as const

/** MIME タイプ → 拡張子マッピング */
const MIME_TO_EXT: Record<string, string> = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
}

/** 1 枚あたりの最大ファイルサイズ（バイト）: 5 MB */
export const MAX_FILE_SIZE_BYTES = 5 * 1024 * 1024

/** 1 メッセージあたりの最大添付枚数 */
export const MAX_ATTACHMENTS_PER_MESSAGE = 3

/** 署名 URL の有効期限（秒） */
export const SIGNED_URL_EXPIRES_IN = 60

export type AllowedMimeType = (typeof ALLOWED_MIME_TYPES)[number]

/**
 * MIME タイプが許可リストに含まれるか検証する。
 * 不正な場合は AppError(400) をスロー。
 */
export function assertAllowedMimeType(mimeType: string): asserts mimeType is AllowedMimeType {
  if (!(ALLOWED_MIME_TYPES as readonly string[]).includes(mimeType)) {
    throw new AppError(400, 'INVALID_MIME_TYPE', '対応している画像形式は JPEG / PNG / WebP です。', {
      mimeType,
    })
  }
}

/**
 * ファイルサイズが上限以内か検証する。
 * 超過の場合は AppError(400) をスロー。
 */
export function assertFileSize(sizeBytes: number): void {
  if (typeof sizeBytes !== 'number' || sizeBytes <= 0) {
    throw new AppError(400, 'INVALID_FILE_SIZE', 'ファイルサイズが不正です。')
  }
  if (sizeBytes > MAX_FILE_SIZE_BYTES) {
    throw new AppError(400, 'FILE_TOO_LARGE', '画像は 1 枚あたり 5MB 以下にしてください。', {
      sizeBytes,
      maxBytes: MAX_FILE_SIZE_BYTES,
    })
  }
}

/**
 * MIME タイプから拡張子を取得する。
 */
export function extFromMimeType(mimeType: AllowedMimeType): string {
  return MIME_TO_EXT[mimeType] ?? 'bin'
}
