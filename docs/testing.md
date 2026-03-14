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

* API Route のテスト（モック Supabase クライアント使用。`MOCK_SUPABASE=true` でネットワーク不要のモードに切り替え可能。**本番/実DBでは必ず無効にすること**）
* LLM のフォールバック動作確認
* レート制限・クォータ制限の動作確認

### E2E テスト

* 手動テスト計画書: [E2E 手動テスト計画書](./e2e-manual-test-plan.md)（9 シナリオ、全受け入れ基準をカバー）
* Playwright による自動化は β 版スコープ外（将来対応）
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
    const { data, error } = await supabase.from('conversations').select('*')
    expect(error).toBeNull()
    expect(data).toHaveLength(1) // 自分の会話のみ
  })

  it('他人の会話は取得できない', async () => {
    const supabase = createClient(url, anonKey, {
      global: { headers: { Authorization: `Bearer ${studentJWT}` } }
    })
    const { data } = await supabase
      .from('conversations')
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
    const { data, error } = await supabase.from('conversations').select('*')
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

## 画像添付テスト

### 自動テスト（Vitest）

画像添付関連は以下のテストファイルでカバーされている:

| ファイル | 内容 |
|---------|------|
| `tests/api/attachments-sign.test.ts` | 署名 URL API (`/api/attachments/sign`) の認証・バリデーション・正常系・Storage エラー |
| `tests/api/attachments-flow.integration.test.ts` | 署名→チャット保存→会話詳細取得の一連フロー（単一・複数・添付なし・署名失敗・パス一貫性） |
| `tests/api/chat-persistence.test.ts` | チャット永続化（添付あり/なし両パターン含む） |

### 手動確認ポイント

自動テストではカバーしきれないブラウザ依存の動作:

1. **ファイル選択**: 📎 ボタンから画像を選択し、プレビューバーにサムネイル・ファイル名・サイズが表示される
2. **ドラッグ&ドロップ**: 画像をチャットエリアにドロップし、プレビューに追加される
3. **バリデーション**: 5MB 超の画像や非対応形式（GIF 等）を選択した場合にエラーメッセージが表示される
4. **枚数制限**: 4 枚目の画像を追加しようとした場合にエラーメッセージが表示される
5. **アップロード & 送信**: テキスト + 画像でメッセージ送信し、AI 応答が返る
6. **サムネイル表示**: ユーザーメッセージに添付画像のサムネイルが表示される（スケルトンローディング→画像）
7. **ライトボックス**: サムネイルをクリックし、拡大表示される。Escape / 背景クリックで閉じる
8. **履歴復元**: サイドバーから過去の会話を選択し、添付画像付きメッセージのサムネイルが再表示される
9. **HEIC 変換**: iPhone から HEIC 画像を添付した場合、自動的に JPEG に変換されてアップロードされる（変換中インジケータが表示される）

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

## GFX 追加テスト対象

Sprint 1〜4（GFX-01〜18）で追加された機能のテスト対象:

| 機能 | テスト対象 | テスト種別 |
|------|----------|-----------|
| Middleware 認証ガード (GFX-02) | 未認証時の `/chat`、`/admin/*` リダイレクト。`/chat-test` の本番ブロック | 手動 + 統合テスト |
| ログアウト (GFX-03) | `signOut()` 後のセッションクリア・リダイレクト | 手動 |
| Error Boundary (GFX-04) | `app/error.tsx` のフォールバック表示。意図的な例外での復旧動作 | 手動 |
| セッション管理 (GFX-05) | `SIGNED_OUT` イベントで `SessionExpiredModal` が表示される | 手動 |
| オフラインハンドリング (GFX-06) | `OfflineBanner` の表示/非表示。ネットワーク復帰後の自動消去 | 手動 |
| モバイルサイドバー (GFX-07) | ハンバーガーメニューでドロワー開閉。会話選択後の自動クローズ | 手動 |
| loading/not-found (GFX-08) | ページ遷移時のスピナー。存在しない URL でカスタム 404 | 手動 |
| ConfirmDialog (GFX-09) | `window.confirm` 置き換え。キャンセル/確定の動作 | 手動 |
| 会話削除 (GFX-10) | `DELETE /api/conversations/[id]` の 204/401/403/404 応答。CASCADE DELETE | API テスト |
| 管理ダッシュボード (GFX-11) | `/admin` の 4 カードリンク表示。スタッフ認証ガード | 手動 |
| パスワードリセット (GFX-12) | メール送信 → `PASSWORD_RECOVERY` イベント → パスワード更新 | 手動 |
| 署名 URL リフレッシュ (GFX-13) | `onError` での自動再署名（1 回リトライ） | 手動 |
| N+1 最適化 (GFX-14) | `COUNT() GROUP BY` + `OFFSET/LIMIT` のクエリ正常動作 | API テスト |
| サーバーサイド検証 (GFX-15) | 添付 4 枚で 400、2001 文字で 400 | API テスト |
| 利用状況表示 (GFX-16) | `GET /api/usage` の正常レスポンス。ヘッダー表示 | API テスト + 手動 |
| textarea (GFX-17) | 自動リサイズ。Shift+Enter 改行。Enter 送信 | 手動 |
| 管理添付表示 (GFX-18) | `ConversationDetail` 内の `AttachmentThumbnails` 表示 | 手動 |

---

## 関連ドキュメント

* [RLS ポリシー](./rls.md)
* [コーディングガイドライン](./coding-guidelines.md)
* [アーキテクチャ](./architecture.md)
* [トラブルシューティング](./troubleshooting.md)
