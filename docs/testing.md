# Testing Guidelines

本書では、本プロジェクトの **ユニット/E2E テスト戦略と方針** をまとめる。
目的は、変更によるバグ混入を最小化し、CI で安定した品質を保つこと。

## 本書で扱う内容
- Vitest の構成とコーディング規約
- describe 日本語方針
- 境界値/エラー系の網羅基準
- React Testing Library の使用基準
- E2E（必要に応じて Playwright）方針

---

## テスト戦略

### ユニットテスト

* **各機能に必ずユニットテスト**（Vitest）
* **実装ファイルと同じファイル**に `import.meta.vitest` で併記
* `describe` は **日本語**、境界/エラー系も含める
* 変更時は **`pnpm test` が常時パス**

### 統合テスト

* API Route のテスト（モック Supabase クライアント使用）
* LLM のフォールバック動作確認
* レート制限・クォータ制限の動作確認

### E2E テスト（任意）

* Playwright を使用
* ログイン → チャット投稿（テキスト + 数式）→ レンダリング → 履歴表示までの最低限のシナリオ

---

## Vitest 設定

### vitest.config.ts

```ts
import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    environment: 'jsdom',
    globals: true,
    include: ['src/**/*.ts', 'src/**/*.tsx', 'app/**/*.ts', 'app/**/*.tsx'],
    coverage: { reporter: ['text', 'lcov'] }
  }
})
```

### package.json スクリプト

```json
{
  "scripts": {
    "test": "vitest run",
    "test:watch": "vitest",
    "test:cov": "vitest run --coverage"
  }
}
```

---

## テストコーディング規約

### describe は日本語

```ts
import { describe, it, expect } from 'vitest'

describe('sendMessage', () => {
  describe('正常系', () => {
    it('テキストのみの質問が送信できる', async () => {
      // ...
    })
    
    it('画像付き質問が送信できる', async () => {
      // ...
    })
  })
  
  describe('異常系', () => {
    it('画像サイズが上限を超える場合はエラーを返す', async () => {
      // ...
    })
    
    it('クォータ超過時は429を返す', async () => {
      // ...
    })
  })
})
```

### 境界値/エラー系を網羅

* **境界値**：画像サイズ上限、トークン数上限、クォータ上限など
* **エラー系**：LLM API 失敗、DB 接続失敗、認証エラーなど
* **エッジケース**：空文字列、null、undefined、配列の空/1要素/多要素など

---

## RLS テスト

### 学生は自分の会話のみ取得

```ts
import { createClient } from '@supabase/supabase-js'

describe('RLS: 学生は自分の会話のみ取得', () => {
  it('自分の会話は取得できる', async () => {
    const supabase = createClient(url, anonKey, {
      global: { headers: { Authorization: `Bearer ${studentJWT}` } }
    })
    const { data, error } = await supabase.from('conversation').select('*')
    expect(error).toBeNull()
    expect(data).toHaveLength(1) // 自分の会話のみ
  })

  it('他人の会話は取得できない', async () => {
    const supabase = createClient(url, anonKey, {
      global: { headers: { Authorization: `Bearer ${studentJWT}` } }
    })
    const { data } = await supabase
      .from('conversation')
      .select('*')
      .eq('user_id', 'other-user-uuid')
    expect(data).toHaveLength(0) // RLS で弾かれる
  })
})
```

### スタッフは全件取得

```ts
describe('RLS: スタッフは全件取得', () => {
  it('全ユーザーの会話を取得できる', async () => {
    const supabase = createClient(url, anonKey, {
      global: { headers: { Authorization: `Bearer ${staffJWT}` } }
    })
    const { data, error } = await supabase.from('conversation').select('*')
    expect(error).toBeNull()
    expect(data.length).toBeGreaterThan(1) // 複数ユーザー分
  })
})
```

---

## レート制限テスト

```ts
describe('レート制限', () => {
  it('上限直前までは許可される', async () => {
    for (let i = 0; i < 10; i++) {
      const res = await fetch('/api/chat', { method: 'POST', body: '{}' })
      expect(res.status).toBe(200)
    }
  })

  it('上限を超えると429を返す', async () => {
    for (let i = 0; i < 10; i++) {
      await fetch('/api/chat', { method: 'POST', body: '{}' })
    }
    const res = await fetch('/api/chat', { method: 'POST', body: '{}' })
    expect(res.status).toBe(429)
  })
})
```

---

## Markdown/LaTeX サニタイズテスト

```ts
import ReactMarkdown from 'react-markdown'
import rehypeSanitize from 'rehype-sanitize'
import { render } from '@testing-library/react'

describe('Markdown サニタイズ', () => {
  it('<script> タグが除去される', () => {
    const { container } = render(
      <ReactMarkdown rehypePlugins={[rehypeSanitize]}>
        {'<script>alert("XSS")</script>'}
      </ReactMarkdown>
    )
    expect(container.querySelector('script')).toBeNull()
  })

  it('KaTeX のクラスは残る', () => {
    const { container } = render(
      <ReactMarkdown rehypePlugins={[rehypeSanitize]}>
        {'<span class="katex">x^2</span>'}
      </ReactMarkdown>
    )
    expect(container.querySelector('.katex')).not.toBeNull()
  })
})
```

---

## LLM フォールバックテスト

```ts
describe('LLM フォールバック', () => {
  it('プライマリが429の場合、フォールバックが呼ばれる', async () => {
    // プライマリ API をモックして 429 を返す
    // フォールバック API は 200 を返す
    const res = await callLLM('質問')
    expect(res.model).toBe('fallback-model')
  })

  it('両方失敗時は適切なエラーを返す', async () => {
    // プライマリもフォールバックも 500 を返すようモック
    await expect(callLLM('質問')).rejects.toThrow('LLM API が利用できません')
  })
})
```

---

## UI テスト（React Testing Library）

```ts
import { render, screen, fireEvent } from '@testing-library/react'
import ChatInput from '@features/chat/ChatInput'

describe('ChatInput', () => {
  it('テキスト入力ができる', () => {
    render(<ChatInput onSubmit={vi.fn()} />)
    const input = screen.getByPlaceholderText('質問を入力')
    fireEvent.change(input, { target: { value: 'テスト質問' } })
    expect(input).toHaveValue('テスト質問')
  })

  it('送信ボタンをクリックするとonSubmitが呼ばれる', () => {
    const onSubmit = vi.fn()
    render(<ChatInput onSubmit={onSubmit} />)
    const button = screen.getByRole('button', { name: '送信' })
    fireEvent.click(button)
    expect(onSubmit).toHaveBeenCalled()
  })
})
```

---

## E2E テスト（Playwright）

### 基本シナリオ

```ts
import { test, expect } from '@playwright/test'

test('ログイン → 質問 → 回答表示', async ({ page }) => {
  // ログイン
  await page.goto('/login')
  await page.click('text=Google でログイン')
  
  // チャット画面
  await page.goto('/chat')
  await page.fill('[placeholder="質問を入力"]', '数学の質問です: $x^2 + y^2 = r^2$')
  await page.click('text=送信')
  
  // 回答を待つ
  await page.waitForSelector('.markdown-content')
  
  // LaTeX がレンダリングされているか確認
  const katex = await page.locator('.katex')
  await expect(katex).toBeVisible()
})
```

---

## テスト実行

```bash
# すべてのテストを実行
pnpm test

# watch モード
pnpm test:watch

# カバレッジ付き
pnpm test:cov

# E2E（Playwright）
pnpm test:e2e
```

---

## カバレッジ目標

* **ライン**：80% 以上
* **関数**：80% 以上
* **ブランチ**：70% 以上
* 重要な機能（認証、RLS、LLM 呼び出し、レート制限）は 90% 以上

---

## 関連ドキュメント

* [RLS ポリシー](./rls.md)
* [コーディングガイドライン](./coding-guidelines.md)
* [アーキテクチャ](./architecture.md)
* [トラブルシューティング](./troubleshooting.md)
