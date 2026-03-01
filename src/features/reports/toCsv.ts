/** @file
 * CSV 変換ユーティリティ（月次レポート用）。
 * 入力: CsvReportRow[] 配列。
 * 出力: UTF-8 CSV 文字列（BOM 付き、Excel 互換）。
 * 依存: なし。
 * セキュリティ: フィールド値をエスケープし CSV インジェクションを防止。
 */

import type { CsvReportRow } from '@shared/lib/reportRead'

const CSV_HEADERS = [
  'email',
  'display_name',
  'conversations',
  'questions',
  'first_activity',
  'last_activity',
  'report_status',
] as const

function escapeCsvField(value: string | number | null): string {
  if (value === null || value === undefined) return ''
  const str = String(value)
  if (str.includes('"') || str.includes(',') || str.includes('\n') || str.includes('\r')) {
    return `"${str.replace(/"/g, '""')}"`
  }
  return str
}

export function toCsv(rows: CsvReportRow[]): string {
  const BOM = '\uFEFF'
  const header = CSV_HEADERS.join(',')

  const lines = rows.map((row) =>
    [
      escapeCsvField(row.email),
      escapeCsvField(row.displayName),
      escapeCsvField(row.conversations),
      escapeCsvField(row.questions),
      escapeCsvField(row.firstActivity),
      escapeCsvField(row.lastActivity),
      escapeCsvField(row.reportStatus),
    ].join(','),
  )

  return BOM + [header, ...lines].join('\r\n') + '\r\n'
}
