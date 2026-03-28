/** @file
 * 新規チャット時のウェルカム画面コンポーネント。
 * 機能：親しみやすい挨拶メッセージと、中学生向けサジェストボタンを表示。
 * 入力：onSuggestionClick コールバック。
 * 出力：サジェストテキストを入力欄にセットするためのコールバック呼び出し。
 * 依存：なし（純粋な表示コンポーネント）。
 */

'use client'

const SUGGESTIONS = [
  '二次方程式の解き方を教えて',
  '英語の現在完了形って何？',
  '光合成のしくみを簡単に説明して',
  '読書感想文の書き方のコツ',
  '歴史の年号を覚えるコツ',
]

interface WelcomeScreenProps {
  onSuggestionClick: (text: string) => void
}

export function WelcomeScreen({ onSuggestionClick }: WelcomeScreenProps) {
  return (
    <div className="flex flex-col items-center justify-center h-full px-6 text-center">
      <div className="text-4xl mb-3">👋</div>
      <h2 className="text-xl font-bold text-gray-800">
        何でも聞いてね！
      </h2>
      <p className="mt-2 text-sm text-gray-500 max-w-sm">
        勉強でわからないことがあったら、ここで質問できるよ。
        <br />
        画像を送って「この問題を解説して」もOK！
      </p>

      <div className="mt-8 flex flex-wrap justify-center gap-2 max-w-md">
        {SUGGESTIONS.map((s) => (
          <button
            key={s}
            type="button"
            onClick={() => onSuggestionClick(s)}
            className="rounded-full border border-gray-200 bg-white px-4 py-2 text-sm text-gray-700 shadow-sm hover:bg-gray-50 active:bg-gray-100 transition-colors"
          >
            {s}
          </button>
        ))}
      </div>
    </div>
  )
}
