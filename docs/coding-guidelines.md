# Coding Guidelines

本書では、本プロジェクトで採用する **コーディング規約・PR ルール・AI 生成コードの条件** をまとめる。
目的は、コード品質を揃え、保守性を最大化することである。

## 本書で扱う内容
- TypeScript / Next.js の書き方方針
- ディレクトリ構造のルール
- コード生成規約（AI 使用時の前提・注意点・責務）
- ESLint / Prettier 設定方針
- コンポーネント / hooks / features 単位での分割基準
- Conventional Commits / PR の書き方

---

## TypeScript / Next.js 方針

### 基本原則

* **TypeScript strict mode**：`tsconfig.json` で `strict: true`
* **明示的な型定義**：`any` の使用は最小限に
* **関数の戻り値**：可能な限り型を明示
* **Next.js App Router**：`app/` ディレクトリ構成

### パス alias

```json
// tsconfig.json
{
  "compilerOptions": {
    "baseUrl": ".",
    "paths": {
      "@features/*": ["src/features/*"],
      "@shared/*": ["src/shared/*"]
    }
  }
}
```

---

## ディレクトリ構造のルール

### 機能単位で分割

```
src/
├─ features/
│  ├─ auth/         (guard.ts, getSession.ts, SignInButton.tsx)
│  ├─ chat/         (sendMessage.ts, compressImage.ts, quota.ts, UI)
│  ├─ conversations/ (queries.ts, UI)
│  ├─ admin/        (search.ts, AdminTable.tsx)
│  └─ reports/      (monthlySql.ts, toCsv.ts, jobs/runMonthly.ts)
├─ shared/
│  ├─ lib/          (supabaseClient.ts, llm.ts, errors.ts, ...)
│  ├─ components/   (共通 UI コンポーネント)
│  ├─ hooks/        (共通カスタムフック)
│  ├─ types/        (共通型定義)
│  └─ utils/        (汎用ユーティリティ)
```

### ファイル命名規則

* **コンポーネント**：PascalCase（`ChatInput.tsx`）
* **ロジック**：camelCase（`sendMessage.ts`）
* **定数**：UPPER_SNAKE_CASE（`MAX_IMAGE_SIZE`）
* **型定義**：PascalCase（`AppUser`, `Conversation`）

---

## コンポーネント設計

### 関心の分離

* **Presentational Component**：UI のみ、ロジックなし
* **Container Component**：データ取得・状態管理

### 単一責任

* 1 コンポーネント = 1 つの責務
* 100 行を超える場合は分割を検討

### Props の型定義

```tsx
type ChatInputProps = {
  onSubmit: (text: string, image?: File) => Promise<void>
  disabled?: boolean
}

export function ChatInput({ onSubmit, disabled }: ChatInputProps) {
  // ...
}
```

---

## ESLint / Prettier 設定

### .eslintrc.cjs

```js
module.exports = {
  root: true,
  parser: '@typescript-eslint/parser',
  plugins: ['@typescript-eslint', 'unused-imports', 'import'],
  extends: [
    'next/core-web-vitals',
    'plugin:@typescript-eslint/recommended',
    'prettier'
  ],
  rules: {
    'unused-imports/no-unused-imports': 'error',
    '@typescript-eslint/consistent-type-imports': 'warn',
    'import/order': [
      'warn',
      {
        'newlines-between': 'always',
        alphabetize: { order: 'asc' }
      }
    ]
  }
}
```

### .prettierrc

```json
{
  "singleQuote": true,
  "semi": false,
  "trailingComma": "all"
}
```

---

## コード生成規約（AI 使用時）

### ファイル冒頭コメント

```ts
/** @file
 * 機能：チャット送信（画像+テキスト）→ LLM → 会話保存
 * 入力：FormData { text: string; image?: File }
 * 出力：{ answer: string }
 * 例外：LLM失敗=502, Storage失敗=400
 * 依存：env(LLM_API_KEY, MAX_TOKENS_OUT), supabaseAdmin, quota.ts
 * 注意：書込はService Roleのみ。userIdの出所を必ず検証（RLS考慮）。
 */
```

### 必須項目

* **入出力**：関数の引数と戻り値
* **前提**：実行前に必要な条件
* **例外**：発生しうるエラーとその対処
* **副作用**：DB/外部 API への影響
* **依存**：ENV/モジュールの依存関係
* **セキュリティ注意**：ID 検証、RLS、Service Role の扱い

---

## 重要な設定ファイル

### package.json

```json
{
  "scripts": {
    "dev": "next dev",
    "build": "next build",
    "start": "next start",
    "lint": "eslint .",
    "format": "prettier -w .",
    "typecheck": "tsc --noEmit",
    "test": "vitest run",
    "test:watch": "vitest",
    "test:cov": "vitest run --coverage"
  },
  "dependencies": {
    "next": "^14.0.0",
    "@supabase/supabase-js": "^2.0.0",
    "react": "^18.0.0",
    "react-markdown": "^9.0.0",
    "remark-gfm": "^4.0.0",
    "remark-math": "^6.0.0",
    "rehype-katex": "^7.0.0",
    "rehype-sanitize": "^6.0.0",
    "katex": "^0.16.0",
    "zustand": "^4.0.0"
  },
  "devDependencies": {
    "@types/node": "^20.0.0",
    "@types/react": "^18.0.0",
    "typescript": "^5.0.0",
    "vitest": "^1.0.0",
    "@testing-library/react": "^14.0.0",
    "eslint": "^8.0.0",
    "prettier": "^3.0.0"
  }
}
```

### tsconfig.json

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "lib": ["dom", "dom.iterable", "es2022"],
    "jsx": "preserve",
    "module": "esnext",
    "moduleResolution": "bundler",
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "forceConsistentCasingInFileNames": true,
    "baseUrl": ".",
    "paths": {
      "@features/*": ["src/features/*"],
      "@shared/*": ["src/shared/*"]
    },
    "plugins": [{ "name": "next" }]
  },
  "include": ["next-env.d.ts", "**/*.ts", "**/*.tsx"],
  "exclude": ["node_modules"]
}
```

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

### next.config.js

```js
const isDev = process.env.NODE_ENV !== 'production'

const IMG = ["'self'", 'https://*.supabase.co']
const CONNECT = ["'self'", 'https://*.supabase.co']

const csp = [
  "default-src 'self'",
  "base-uri 'none'",
  "object-src 'none'",
  isDev
    ? "script-src 'self' 'unsafe-eval' 'unsafe-inline'"
    : "script-src 'self'",
  `img-src ${IMG.join(' ')}`,
  `connect-src ${CONNECT.join(' ')}`,
  "style-src 'self' 'unsafe-inline'",
  "font-src 'self'",
  "frame-ancestors 'none'",
].join('; ')

module.exports = {
  async headers() {
    return [
      {
        source: '/(.*)',
        headers: [
          { key: 'Content-Security-Policy', value: csp },
          { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          { key: 'Strict-Transport-Security', value: 'max-age=31536000; includeSubDomains; preload' },
          { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=()' },
          { key: 'X-Frame-Options', value: 'DENY' },
        ],
      },
    ]
  },
}
```

---

## Conventional Commits

### フォーマット

```
<type>(<scope>): <subject>

<body>

<footer>
```

### type 一覧

* **feat**：新機能
* **fix**：バグ修正
* **docs**：ドキュメント変更
* **style**：コードスタイル（フォーマットなど）
* **refactor**：リファクタリング
* **test**：テスト追加・修正
* **chore**：ビルド・設定変更

### 例

```
feat(chat): 画像圧縮機能を追加

MAX_IMAGE_LONGEDGEを超える画像を自動圧縮する機能を実装。
クライアント側でCanvasを使用してリサイズ。

Closes #123
```

---

## PR（Pull Request）の書き方

### テンプレート

```markdown
## 概要
このPRの目的を簡潔に説明

## 変更内容
- 機能A を追加
- バグB を修正

## スクリーンショット / 動画
（UI変更がある場合）

## テスト結果
- [ ] `pnpm test` が通過
- [ ] `pnpm typecheck` が通過
- [ ] `pnpm lint` が通過

## 影響範囲
- RLS への影響：なし
- コスト（トークン/画像）への影響：なし
- UX への影響：画像アップロード時の待ち時間が短縮

## レビュー観点
- RLS が破壊されていないか
- コスト暴走のリスクはないか
- UX が劣化していないか
```

### レビュー観点

* **RLS 破壊**：学生が他人のデータにアクセスできないか
* **コスト暴走**：トークン数/画像サイズの上限チェック
* **UX 劣化**：応答時間、エラーメッセージの分かりやすさ
* **テストカバレッジ**：重要な機能に対するテストが追加されているか

---

## 関連ドキュメント

* [テストガイドライン](./testing.md)
* [アーキテクチャ](./architecture.md)
* [セキュリティポリシー](./security.md)
* [デプロイメント](./deployment.md)
