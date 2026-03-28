import Link from 'next/link'

export default function CsvImportManualPage() {
  return (
    <div className="mx-auto max-w-3xl px-4 py-8">
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-3xl font-bold text-slate-800">CSV一括登録マニュアル</h1>
        <Link
          href="/admin/allowlist"
          className="rounded-lg bg-slate-100 px-4 py-2 text-sm font-medium text-slate-600 transition hover:bg-slate-200"
        >
          ← 管理画面に戻る
        </Link>
      </div>

      <div className="space-y-12">
        <section>
          <h2 className="mb-4 border-b border-slate-200 pb-2 text-xl font-bold text-slate-800">
            1. CSVファイルの形式
          </h2>
          <p className="mb-4 text-slate-600">
            1行目に必ず<strong>ヘッダー（列名）</strong>が必要です。<br />
            2行目以降にデータを入力してください。
          </p>

          <div className="overflow-hidden rounded-lg border border-slate-200">
            <table className="min-w-full divide-y divide-slate-200 text-sm">
              <thead className="bg-slate-50">
                <tr>
                  <th className="px-4 py-2 text-left font-bold text-slate-700">列名 (必須/任意)</th>
                  <th className="px-4 py-2 text-left font-bold text-slate-700">説明</th>
                  <th className="px-4 py-2 text-left font-bold text-slate-700">入力例</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200 bg-white">
                <tr>
                  <td className="px-4 py-2 font-mono text-indigo-600">email (必須)</td>
                  <td className="px-4 py-2 text-slate-600">許可するメールアドレス</td>
                  <td className="px-4 py-2 text-slate-500">user@example.com</td>
                </tr>
                <tr>
                  <td className="px-4 py-2 font-mono text-slate-700">status</td>
                  <td className="px-4 py-2 text-slate-600">
                    状態を指定します。<br />
                    <span className="text-xs text-slate-400">※ 空欄の場合は pending (承認待ち) になります</span>
                  </td>
                  <td className="px-4 py-2 text-slate-500">
                    active, pending, revoked
                  </td>
                </tr>
                <tr>
                  <td className="px-4 py-2 font-mono text-slate-700">label</td>
                  <td className="px-4 py-2 text-slate-600">表示名や分類ラベル</td>
                  <td className="px-4 py-2 text-slate-500">佐藤, 1年A組</td>
                </tr>
                <tr>
                  <td className="px-4 py-2 font-mono text-slate-700">notes</td>
                  <td className="px-4 py-2 text-slate-600">管理者用メモ</td>
                  <td className="px-4 py-2 text-slate-500">2024/04 入学</td>
                </tr>
                <tr>
                  <td className="px-4 py-2 font-mono text-slate-700">initial_role</td>
                  <td className="px-4 py-2 text-slate-600">
                    初回ログイン時のロール<br />
                    <span className="text-xs text-slate-400">※ 空欄の場合は student (生徒) になります</span><br />
                    <span className="text-xs text-slate-400">※ 初回ログイン時のみ適用。ログイン後は権限管理で変更</span>
                  </td>
                  <td className="px-4 py-2 text-slate-500">
                    student, staff
                  </td>
                </tr>
              </tbody>
            </table>
          </div>

          <div className="mt-6 rounded-md bg-blue-50 p-4">
            <h3 className="mb-2 font-bold text-blue-800">💡 Excel で作成する場合</h3>
            <p className="text-sm text-blue-700">
              Excel で作成して「CSV (コンマ区切り)」で保存してください。<br />
              <strong>Shift_JIS (日本語Windows標準)</strong> の文字コードに対応しているため、文字化けを気にせずそのままアップロードできます。
            </p>
          </div>
        </section>

        <section>
          <h2 className="mb-4 border-b border-slate-200 pb-2 text-xl font-bold text-slate-800">
            2. 登録モードについて
          </h2>
          <div className="grid gap-6 md:grid-cols-2">
            <div className="rounded-xl border border-slate-200 p-6">
              <span className="mb-2 inline-block rounded bg-green-100 px-2 py-1 text-xs font-bold text-green-700">
                通常モード（デフォルト）
              </span>
              <h3 className="mb-2 font-bold text-slate-800">新規登録のみ</h3>
              <p className="text-sm text-slate-600">
                新しいメールアドレスのみを登録します。<br />
                もしCSV内に<strong>既に登録済みのメールアドレス</strong>が含まれている場合、エラーとなり登録は行われません。
              </p>
            </div>

            <div className="rounded-xl border border-slate-200 p-6">
              <span className="mb-2 inline-block rounded bg-orange-100 px-2 py-1 text-xs font-bold text-orange-700">
                上書きモード (Upsert)
              </span>
              <h3 className="mb-2 font-bold text-slate-800">新規登録 ＋ 更新</h3>
              <p className="text-sm text-slate-600">
                既に登録済みのメールアドレスがあれば、CSVの内容（ステータスやラベルなど）で<strong>上書き更新</strong>します。<br />
                一度に大量のデータを最新の状態に合わせたい場合に便利です。
              </p>
            </div>
          </div>
        </section>

        <section>
          <h2 className="mb-4 border-b border-slate-200 pb-2 text-xl font-bold text-slate-800">
            3. サンプルデータ
          </h2>
          <p className="mb-2 text-sm text-slate-600">
            以下のテキストをコピーして、メモ帳などに貼り付けて <code>allowlist.csv</code> として保存するとテストに使えます。
          </p>
          <pre className="overflow-x-auto rounded bg-slate-800 p-4 text-sm text-slate-200">
{`email,status,label,notes,initial_role
test1@example.com,active,鈴木一郎,バドミントン部,student
test2@example.com,active,田中花子,スタッフ,staff
test3@example.com,pending,佐藤健,,
new_student@example.com,,1年A組,,`}
          </pre>
        </section>
      </div>
    </div>
  )
}
