/** @file
 * HEIC/HEIF → JPEG 変換ロジックおよび関連定数のテスト。
 * 入力: HEIC MIME タイプのファイル。
 * 出力: JPEG に変換された File オブジェクト。
 * 依存: attachmentValidation 定数。
 */

import { describe, expect, it } from 'vitest'

import {
  ALLOWED_MIME_TYPES,
  CONVERTIBLE_MIME_TYPES,
  HEIC_CONVERSION_QUALITY,
  INPUT_ACCEPT_TYPES,
} from '../../src/shared/lib/attachmentValidation'

describe('HEIC conversion constants', () => {
  it('CONVERTIBLE_MIME_TYPES contains HEIC and HEIF', () => {
    expect(CONVERTIBLE_MIME_TYPES).toContain('image/heic')
    expect(CONVERTIBLE_MIME_TYPES).toContain('image/heif')
  })

  it('INPUT_ACCEPT_TYPES includes both ALLOWED and CONVERTIBLE types', () => {
    for (const mime of ALLOWED_MIME_TYPES) {
      expect(INPUT_ACCEPT_TYPES).toContain(mime)
    }
    for (const mime of CONVERTIBLE_MIME_TYPES) {
      expect(INPUT_ACCEPT_TYPES).toContain(mime)
    }
  })

  it('ALLOWED_MIME_TYPES does not include HEIC (server-side remains unchanged)', () => {
    expect(ALLOWED_MIME_TYPES).not.toContain('image/heic')
    expect(ALLOWED_MIME_TYPES).not.toContain('image/heif')
  })

  it('HEIC_CONVERSION_QUALITY is between 0 and 1', () => {
    expect(HEIC_CONVERSION_QUALITY).toBeGreaterThan(0)
    expect(HEIC_CONVERSION_QUALITY).toBeLessThanOrEqual(1)
  })
})
