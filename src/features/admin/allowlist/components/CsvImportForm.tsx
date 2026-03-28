/** @file
 * CSV 一括登録フォーム。
 * 機能：CSV ファイルの文字コード自動検出・変換 → プレビュー → インポート実行。
 * 入力：CSV ファイル（UTF-8 / Shift_JIS / EUC-JP / ISO-2022-JP 等に対応）
 * 出力：onImport コールバックへ CSV テキストを渡す。
 * 依存：encoding-japanese（文字コード検出・変換）
 * セキュリティ：クライアント側のみ。ファイル内容はブラウザ内で処理。
 */
'use client'

import Encoding from 'encoding-japanese'
import type { ChangeEvent } from 'react'
import { useState } from 'react'

type ParseResult = {
  header: string[]
  rows: string[][]
  error?: string
}

export function CsvImportForm({ onImport }: { onImport: (csv: string, mode: 'insert' | 'upsert') => Promise<void> }) {
  const [file, setFile] = useState<File | null>(null)
  const [preview, setPreview] = useState<ParseResult | null>(null)
  const [isParsing, setIsParsing] = useState(false)
  const [csvText, setCsvText] = useState<string>('')
  const [isImporting, setIsImporting] = useState(false)
  const [isUpsert, setIsUpsert] = useState(false)
  const [detectedEncoding, setDetectedEncoding] = useState<string>('')

  const handleFileChange = (e: ChangeEvent<HTMLInputElement>) => {
    const selected = e.target.files?.[0]
    setFile(selected || null)
    setPreview(null) // ファイルが変わったらプレビューをリセット
    setCsvText('')
    setIsUpsert(false) // ファイル変更時にリセット
    setDetectedEncoding('')
  }

  const handleClearFile = () => {
    setFile(null)
    setCsvText('')
    setPreview(null)
    setIsUpsert(false)
    setDetectedEncoding('')
    if (document.querySelector('input[type="file"]') instanceof HTMLInputElement) {
      (document.querySelector('input[type="file"]') as HTMLInputElement).value = ''
    }
  }

  const handlePreview = async () => {
    if (!file) return

    setIsParsing(true)
    try {
      // encoding-japanese で文字コードを自動検出し、Unicode に変換する
      const buffer = await file.arrayBuffer()
      const uint8 = new Uint8Array(buffer)
      const detected = Encoding.detect(uint8)
      const encodingName = typeof detected === 'string' ? detected : 'UTF8'
      setDetectedEncoding(encodingName)

      // Unicode コードポイント配列に変換してから文字列化
      const unicodeArray = Encoding.convert(uint8, {
        to: 'UNICODE',
        from: encodingName,
      })
      let text = Encoding.codeToString(unicodeArray)

      // BOM 付き UTF-8 の先頭 BOM を除去
      if (text.charCodeAt(0) === 0xfeff) {
        text = text.slice(1)
      }

      setCsvText(text)
      const result = parseCsvClient(text)
      setPreview(result)
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unknown error'
      alert(`CSV読み込みに失敗しました: ${message}`)
    } finally {
      setIsParsing(false)
    }
  }

  const handleImport = async () => {
    if (!csvText) return
    if (!confirm(isUpsert ? '既存のデータを上書き更新します。よろしいですか？' : 'この内容で登録しますか？')) return

    setIsImporting(true)
    try {
      await onImport(csvText, isUpsert ? 'upsert' : 'insert')
      alert('一括登録が完了しました')
      setFile(null)
      setPreview(null)
      setCsvText('')
      setIsUpsert(false)
      setDetectedEncoding('')
      if (document.querySelector('input[type="file"]') instanceof HTMLInputElement) {
        (document.querySelector('input[type="file"]') as HTMLInputElement).value = ''
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unknown error'
      alert(`登録エラー: ${message}`)
    } finally {
      setIsImporting(false)
    }
  }

  return (
    <section className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
      <h2 className="text-lg font-bold text-slate-900">CSV 一括登録</h2>
      <p className="mt-1 text-sm text-slate-600">
        CSVファイルをアップロードして、許可メールを一括で登録・更新できます。
      </p>

      <div className="mt-4">
        <label className="block text-sm font-medium text-slate-700">
          CSVファイルを選択
        </label>
        <div className="mt-2 text-sm text-slate-500">
          <p className="mb-2">
            ※ ヘッダー行 (email, status, label...) が必要です。
            <a href="/manual/csv_import" target="_blank" className="ml-2 text-indigo-600 underline">
              マニュアルを見る
            </a>
          </p>
          <input
            type="file"
            accept=".csv"
            onChange={handleFileChange}
            className="block w-full text-sm text-slate-500 file:mr-4 file:rounded-full file:border-0 file:bg-indigo-50 file:px-4 file:py-2 file:text-sm file:font-semibold file:text-indigo-700 hover:file:bg-indigo-100"
          />
        </div>
      </div>
      
      {file && (
        <div className="mt-4 flex items-center rounded bg-slate-50 p-4 text-sm text-slate-600">
          <span>
            選択中: <strong>{file.name}</strong> ({(file.size / 1024).toFixed(1)} KB)
            {detectedEncoding && (
              <span className="ml-2 rounded bg-slate-200 px-2 py-0.5 text-xs font-medium text-slate-600">
                {detectedEncoding}
              </span>
            )}
          </span>
          <button
            type="button"
            onClick={handleClearFile}
            className="ml-3 text-sm text-slate-400 hover:text-red-500"
            title="ファイル選択を取り消す"
          >
            ✕
          </button>
        </div>
      )}

      {/* プレビューボタン */}
      <div className="mt-6 flex flex-col gap-4 sm:flex-row sm:items-center">
        <button
          type="button"
          disabled={!file || isParsing || isImporting}
          onClick={handlePreview}
          className="rounded bg-slate-200 px-4 py-2 text-sm font-bold text-slate-700 hover:bg-slate-300 disabled:opacity-50"
        >
          {isParsing ? '解析中...' : 'プレビュー'}
        </button>

        {preview && !preview.error && (
          <>
            <div className="flex items-center gap-2">
              <input
                type="checkbox"
                id="upsert-mode"
                checked={isUpsert}
                onChange={(e) => setIsUpsert(e.target.checked)}
                className="h-4 w-4 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
              />
              <label htmlFor="upsert-mode" className="text-sm font-medium text-slate-700 select-none">
                既に登録済みのメールがあれば上書き更新する
              </label>
            </div>
            <button
              type="button"
              disabled={isImporting}
              onClick={handleImport}
              className="rounded bg-indigo-600 px-4 py-2 text-sm font-bold text-white hover:bg-indigo-700 disabled:opacity-50"
            >
              {isImporting ? '登録中...' : '一括登録を実行'}
            </button>
          </>
        )}
      </div>

      {/* プレビュー表示エリア */}
      {preview && (
        <div className="mt-6">
          {preview.error ? (
            <p className="text-red-600 font-bold">{preview.error}</p>
          ) : (
            <div className="overflow-x-auto rounded border border-slate-200">
              <table className="min-w-full divide-y divide-slate-200 text-sm">
                <thead className="bg-slate-50">
                  <tr>
                    {preview.header.map((h, i) => (
                      <th key={i} className="px-4 py-2 text-left font-semibold text-slate-700">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200 bg-white">
                  {preview.rows.slice(0, 5).map((row, i) => (
                    <tr key={i}>
                      {row.map((cell, j) => {
                        const isRoleCol = preview.header[j]?.trim().toLowerCase() === 'initial_role'
                        const isStaff = isRoleCol && cell.trim().toLowerCase() === 'staff'
                        return (
                          <td key={j} className="px-4 py-2 text-slate-600">
                            {isStaff ? (
                              <span className="rounded bg-purple-100 px-1.5 py-0.5 text-xs font-medium text-purple-700">
                                staff
                              </span>
                            ) : cell}
                          </td>
                        )
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
              {preview.rows.length > 5 && (
                <p className="bg-slate-50 px-4 py-2 text-xs text-slate-500 text-center">
                  ...他 {preview.rows.length - 5} 件
                </p>
              )}
            </div>
          )}
        </div>
      )}
    </section>
  )
}

/**
 * 簡易的なCSVパーサー (クライアントサイド用)
 * ※ 本格的なパースはサーバー側(API)で行うため、ここはあくまでプレビュー用の簡易実装です。
 */
function parseCsvClient(text: string): ParseResult {
  const lines = text.split(/\r?\n/).filter(line => line.trim() !== '')
  if (lines.length < 2) {
    return { header: [], rows: [], error: 'データ行が見つかりません (ヘッダーのみ、または空です)' }
  }

  // 1行目をヘッダーとみなす
  const header = lines[0].split(',').map(c => c.trim())
  
  // 2行目以降をデータとみなす
  const rows = lines.slice(1).map(line => line.split(',').map(c => c.trim()))

  if (!header.includes('email')) {
    return { header, rows, error: '必須列 "email" が見つかりません' }
  }

  return { header, rows }
}
