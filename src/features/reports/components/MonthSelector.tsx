/** @file
 * 月選択ドロップダウンコンポーネント。
 * 入力: selectedMonth（YYYY-MM）、onChange コールバック。
 * 出力: select 要素（直近 12 ヶ月分の選択肢）。
 * 依存: なし。
 * セキュリティ: なし（表示のみ）。
 */

type MonthSelectorProps = {
  selectedMonth: string
  onChange: (month: string) => void
}

function generateMonthOptions(): { value: string; label: string }[] {
  const options: { value: string; label: string }[] = []
  const now = new Date()
  const jst = new Date(now.getTime() + 9 * 60 * 60 * 1000)

  for (let i = 0; i < 12; i++) {
    const d = new Date(Date.UTC(jst.getUTCFullYear(), jst.getUTCMonth() - i, 1))
    const y = d.getUTCFullYear()
    const m = d.getUTCMonth() + 1
    const value = `${y}-${String(m).padStart(2, '0')}`
    const label = `${y}年${m}月`
    options.push({ value, label })
  }

  return options
}

export function MonthSelector({ selectedMonth, onChange }: MonthSelectorProps) {
  const options = generateMonthOptions()

  return (
    <select
      value={selectedMonth}
      onChange={(e) => onChange(e.target.value)}
      className="rounded border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900"
    >
      {options.map((opt) => (
        <option key={opt.value} value={opt.value}>
          {opt.label}
        </option>
      ))}
    </select>
  )
}
