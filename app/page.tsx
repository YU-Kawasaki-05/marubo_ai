import Link from 'next/link'

export default function HomePage() {
  return (
    <main className="mx-auto flex min-h-screen max-w-3xl flex-col gap-8 px-6 py-16">
      <section>
        <p className="text-sm font-semibold uppercase text-slate-500">Marubo AI</p>
        <h1 className="mt-2 text-3xl font-bold text-slate-900">塾向けチャットボット（β）</h1>
        <p className="mt-4 text-base text-slate-600">
          生徒の質問を AI が一次回答し、スタッフが監督・レポートを受け取るアプリです。
          Supabase Auth + Next.js App Router をベースに開発を進めます。
        </p>
      </section>
      <section className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
        <h2 className="text-lg font-semibold text-slate-900">次に進む</h2>
        <ol className="mt-4 list-inside list-decimal space-y-2 text-slate-700">
          <li>Supabase / Resend の環境変数を `.env.local` に設定する</li>
          <li>
            <code className="rounded bg-slate-100 px-2 py-1">pnpm install</code> 後、{' '}
            <code className="rounded bg-slate-100 px-2 py-1">pnpm dev</code> で起動を確認
          </li>
          <li>管理画面 `/admin` と API 連携の実装を進める</li>
        </ol>
        <div className="mt-6 flex flex-wrap gap-4 text-sm font-medium text-primary-600">
          <Link href="/admin" className="text-indigo-600 hover:underline">
            管理画面プレースホルダー
          </Link>
          <Link href="https://github.com/" className="text-indigo-600 hover:underline">
            リポジトリ
          </Link>
        </div>
      </section>
    </main>
  )
}
