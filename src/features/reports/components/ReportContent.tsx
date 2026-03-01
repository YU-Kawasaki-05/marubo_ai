/** @file
 * レポート本文表示コンポーネント（記事風 Markdown レンダリング）。
 * 入力: StudentReport オブジェクト。
 * 出力: note/Zenn 風の記事表示 UI。
 * 依存: react-markdown, remark-gfm。
 * セキュリティ: ユーザー入力は含まない（LLM 生成テキストのみ）。
 */

import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'

import type { StudentReport } from '../hooks/useStudentReport'

type ReportContentProps = {
  report: StudentReport
}

function formatDate(iso: string): string {
  const d = new Date(iso)
  return d.toLocaleDateString('ja-JP', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

function formatMonth(month: string): string {
  const [y, m] = month.split('-')
  return `${y}年${parseInt(m, 10)}月`
}

export function ReportContent({ report }: ReportContentProps) {
  if (report.status === 'generating') {
    return (
      <div className="rounded-xl border border-amber-200 bg-amber-50 p-8 text-center">
        <p className="text-lg font-medium text-amber-800">レポートを生成中です...</p>
        <p className="mt-2 text-sm text-amber-600">
          しばらくお待ちください。生成完了後にこのページで閲覧できます。
        </p>
      </div>
    )
  }

  if (report.status === 'failed') {
    return (
      <div className="rounded-xl border border-red-200 bg-red-50 p-8 text-center">
        <p className="text-lg font-medium text-red-800">レポートの生成に失敗しました</p>
        <p className="mt-2 text-sm text-red-600">
          スタッフが再生成を行います。しばらくお待ちください。
        </p>
      </div>
    )
  }

  if (report.status === 'pending') {
    return (
      <div className="rounded-xl border border-slate-200 bg-slate-50 p-8 text-center">
        <p className="text-lg font-medium text-slate-700">レポートはまだ生成されていません</p>
        <p className="mt-2 text-sm text-slate-500">
          月末にレポートが自動生成されます。
        </p>
      </div>
    )
  }

  return (
    <article className="rounded-xl border border-slate-200 bg-white shadow-sm">
      {/* ヘッダー */}
      <div className="border-b border-slate-200 px-6 py-4">
        <h2 className="text-xl font-bold text-slate-900">
          {formatMonth(report.month)} 学習レポート
        </h2>
        {report.generatedAt && (
          <p className="mt-1 text-xs text-slate-500">
            生成日時: {formatDate(report.generatedAt)}
          </p>
        )}
      </div>

      {/* 利用統計 */}
      {report.stats && (
        <div className="grid grid-cols-2 gap-4 border-b border-slate-200 px-6 py-4 sm:grid-cols-4">
          <div>
            <p className="text-xs text-slate-500">質問数</p>
            <p className="text-lg font-bold text-slate-900">{report.stats.questions}件</p>
          </div>
          <div>
            <p className="text-xs text-slate-500">会話数</p>
            <p className="text-lg font-bold text-slate-900">{report.stats.conversations}件</p>
          </div>
          <div>
            <p className="text-xs text-slate-500">利用日数</p>
            <p className="text-lg font-bold text-slate-900">{report.stats.activeDays}日</p>
          </div>
          <div>
            <p className="text-xs text-slate-500">最も活発な日</p>
            <p className="text-lg font-bold text-slate-900">
              {report.stats.mostActiveDay ?? '-'}
            </p>
          </div>
        </div>
      )}

      {/* レポート本文（Markdown） */}
      {report.content && (
        <div className="px-6 py-6">
          <ReactMarkdown
            className="prose prose-slate max-w-none prose-headings:text-slate-900 prose-p:leading-relaxed prose-li:leading-relaxed"
            remarkPlugins={[remarkGfm]}
            components={{
              h2: ({ children }) => (
                <h2 className="mb-3 mt-6 border-b border-slate-200 pb-2 text-lg font-bold text-slate-900 first:mt-0">
                  {children}
                </h2>
              ),
              p: ({ children }) => (
                <p className="mb-3 leading-relaxed text-slate-700">{children}</p>
              ),
              ul: ({ children }) => (
                <ul className="mb-4 list-disc space-y-1 pl-5 text-slate-700">{children}</ul>
              ),
              li: ({ children }) => (
                <li className="leading-relaxed">{children}</li>
              ),
            }}
          >
            {report.content}
          </ReactMarkdown>
        </div>
      )}
    </article>
  )
}
