# Google OAuth 設定ガイド（Supabase 連携）

本ガイドは、Marubo AI に Google ログインを導入するための
Google Cloud Console と Supabase Dashboard の設定手順をまとめたものです。

**前提条件:**
- Google アカウントを持っていること
- Supabase Dashboard（https://supabase.com/dashboard）にアクセスできること
- Supabase プロジェクト URL: `https://lpftxjpbwtdpelgxsrlj.supabase.co`

**所要時間:** 約 15〜30 分

---

## Step 1: Google Cloud Console でプロジェクトを新規作成する

1. https://console.cloud.google.com にアクセスし、Google アカウントでログインする
2. 画面上部のプロジェクトセレクタ（「プロジェクトの選択」または既存のプロジェクト名が表示されている箇所）をクリック
3. 「新しいプロジェクト」をクリック
4. 以下を入力して「作成」をクリック:
   - **プロジェクト名**: `Marubo AI`（任意の名前でOK）
   - **組織**: なし（個人アカウントの場合は表示されない）
   - **場所**: デフォルトのまま
5. 作成完了まで数秒〜数十秒待つ
6. 通知（画面右上のベルアイコン）に「プロジェクト "Marubo AI" を作成しました」と表示されたら、「プロジェクトを選択」をクリックして移動する

---

## Step 2: OAuth 同意画面を設定する

> **重要**: OAuth Client ID を作成する前に、同意画面の設定が必要です。
> これを先にやらないと、Step 3 で Client ID を作成できません。

1. 左メニューの **「APIとサービス」>「OAuth 同意画面」** をクリック
   - 左メニューが表示されていない場合、左上のハンバーガーメニュー（≡）をクリック
2. **「OAuth consent screen」** ページが表示される

### 2-1. User Type の選択

- **「外部」（External）** を選択して「作成」をクリック
  - 「内部」は Google Workspace 組織内のユーザーのみ対象。
    β版では外部ユーザー（生徒のGmailアカウント等）もログインするため「外部」を選ぶ

### 2-2. アプリ情報の入力

| 項目 | 入力値 | 備考 |
|------|--------|------|
| **アプリ名** | `Marubo AI` | ログイン画面に表示される名前 |
| **ユーザー サポートメール** | 自分のメールアドレス | Google が連絡用に使う |
| **アプリのロゴ** | （空欄でOK） | 後から設定可能 |

### 2-3. アプリのドメイン（省略可）

- 「アプリケーションのホームページ」「プライバシーポリシー」「利用規約」は
  β版では空欄でOK（後から追加可能）

### 2-4. 承認済みドメイン（Authorized domains）

- 「ドメインを追加」をクリックして以下を追加:
  - `supabase.co`
- 本番デプロイ後に独自ドメインがある場合はそれも追加する

### 2-5. デベロッパーの連絡先情報

- 自分のメールアドレスを入力

### 2-6. 「保存して次へ」をクリック

### 2-7. スコープ（Scopes）

- 「スコープを追加または削除」をクリック
- 以下のスコープを選択して「更新」をクリック:
  - `email` — ユーザーのメールアドレス
  - `profile` — ユーザーの基本プロフィール（名前等）
  - `openid` — OpenID Connect（認証の基盤）
- 「保存して次へ」をクリック

> **注意**: これらは「機密でないスコープ」なので、Google の審査は不要です。

### 2-8. テストユーザー（Test users）

- 「外部」を選んだ場合、アプリは「テスト」ステータスで作成される
- テストユーザーを追加する:
  - 「ユーザーを追加」をクリック
  - β版で使用する生徒・スタッフのGmailアドレスを追加
  - **重要**: テストステータスでは、ここに追加したユーザーのみがログインできる
- 「保存して次へ」をクリック

### 2-9. 概要

- 内容を確認し、「ダッシュボードに戻る」をクリック

### 2-10. 公開ステータスの変更（β版リリース時）

- テストステータスのままだと、登録したテストユーザーしかログインできない
- β版の全ユーザーがログインできるようにするには:
  1. 「OAuth 同意画面」ページに戻る
  2. 「公開ステータス」セクションの **「アプリを公開」** をクリック
  3. 確認ダイアログで「確認」をクリック
- **注意**: email / profile / openid スコープのみなので、Google の審査なしで即座に公開される

---

## Step 3: OAuth 2.0 Client ID を作成する

1. 左メニューの **「APIとサービス」>「認証情報」（Credentials）** をクリック
2. 画面上部の **「＋ 認証情報を作成」** をクリック
3. **「OAuth クライアント ID」** を選択
4. 以下を入力:

| 項目 | 入力値 |
|------|--------|
| **アプリケーションの種類** | `ウェブ アプリケーション` |
| **名前** | `Marubo AI Web Client`（任意） |

### 3-1. 承認済みの JavaScript 生成元（Authorized JavaScript origins）

- 「URI を追加」をクリックして以下を追加:
  - `http://localhost:3000`（ローカル開発用）
  - 本番ドメインがある場合はそれも追加（例: `https://marubo-ai.vercel.app`）

### 3-2. 承認済みのリダイレクト URI（Authorized redirect URIs）

- 「URI を追加」をクリックして以下を追加:

```
https://lpftxjpbwtdpelgxsrlj.supabase.co/auth/v1/callback
```

- **これが最も重要な設定**。Supabase が Google からの OAuth コールバックを受け取る URL
- URI を間違えると「redirect_uri_mismatch」エラーが発生する

> **注意**: `http://localhost:3000` のリダイレクト URI は**追加しない**。
> ローカル開発でも、OAuth コールバックは Supabase のサーバーが受け取り、
> その後 localhost にリダイレクトされる仕組みのため。

### 3-3. 「作成」をクリック

5. 作成完了ダイアログに **Client ID** と **Client Secret** が表示される
6. **両方をコピーして安全な場所に保存する**（後で Supabase に貼り付ける）

> Client Secret は一度しか表示されない場合がある。
> 閉じてしまった場合は「認証情報」一覧から該当クライアントをクリックして確認できる。

**コピーする値（例）:**
```
Client ID:     123456789-abcdefg.apps.googleusercontent.com
Client Secret: GOCSPX-xxxxxxxxxxxxxxxxxxxxxxxxx
```

---

## Step 4: Supabase Dashboard で Google Provider を有効化する

1. https://supabase.com/dashboard にログイン
2. 対象プロジェクト（`lpftxjpbwtdpelgxsrlj`）を選択
3. 左メニューの **「Authentication」>「Providers」** をクリック
4. プロバイダ一覧から **「Google」** を見つけてクリック（展開する）
5. **「Enable Google provider」** トグルを **ON** にする
6. 以下を入力:

| 項目 | 入力値 |
|------|--------|
| **Client ID** | Step 3 でコピーした Client ID |
| **Client Secret** | Step 3 でコピーした Client Secret |

7. その他の設定はデフォルトのまま:
   - **Authorized Client IDs**: 空欄でOK（iOS/Android 用）
   - **Skip nonce checks**: OFF のまま

8. **「Save」** をクリック

---

## Step 5: Supabase の Redirect URL を確認する

1. Supabase Dashboard > **「Authentication」>「URL Configuration」** をクリック
2. **「Site URL」** が正しいか確認:
   - ローカル開発: `http://localhost:3000`
   - 本番: 本番ドメイン（例: `https://marubo-ai.vercel.app`）
3. **「Redirect URLs」** に以下が含まれていることを確認（なければ追加）:
   - `http://localhost:3000/**`（ローカル開発用ワイルドカード）
   - 本番ドメインがある場合: `https://marubo-ai.vercel.app/**`

> **Site URL** は OAuth 認証後にユーザーがリダイレクトされる先のベース URL。
> ローカルで開発中は `http://localhost:3000` に設定しておく。
> 本番デプロイ時に変更する。

---

## Step 6: 動作確認

### ローカル環境での確認

1. `pnpm dev` でローカルサーバーを起動
2. `http://localhost:3000/login` にアクセス
3. 「Google でログイン」ボタンをクリック
4. Google のログイン画面が表示される
5. テストユーザー（Step 2-8 で登録したアカウント）でログイン
6. `/chat` にリダイレクトされることを確認

### 確認ポイント

- [ ] Google ログイン画面に「Marubo AI」のアプリ名が表示される
- [ ] ログイン後、`/api/sync-user` が呼ばれて allowlist 照合が行われる
- [ ] allowlist に登録済み（active）のメールでログインすると `/chat` に遷移する
- [ ] allowlist に未登録のメールでログインすると「許可されていないメールアドレスです」が表示される
- [ ] Email/Password によるログインも引き続き動作する

---

## トラブルシューティング

### 「redirect_uri_mismatch」エラー

- **原因**: Google Cloud Console の「承認済みのリダイレクト URI」が正しくない
- **対処**: Step 3-2 のリダイレクト URI を再確認。末尾のスラッシュやスペースに注意

### 「access_denied」エラー

- **原因**: OAuth 同意画面がテストステータスで、ログインしようとしたユーザーがテストユーザーに登録されていない
- **対処**: Step 2-8 でテストユーザーを追加するか、Step 2-10 でアプリを公開する

### 「This app isn't verified」警告画面

- **原因**: OAuth 同意画面が未検証状態
- **対処**: β版では「Advanced」>「Go to Marubo AI (unsafe)」で続行可能。
  気になる場合は Step 2-10 でアプリを公開する（email/profile/openid のみなら審査不要）

### Google ログイン後に allowlist エラーが出る

- **原因**: Google アカウントのメールが allowlist に登録されていない
- **対処**: `/admin/allowlist` で該当メールを active で登録する

### ログイン後にレポートで「ユーザーロールを特定できません」

- **原因**: GFX-35 未適用の場合、app_metadata.role が設定されない
- **対処**: GFX-35 を先に適用する（sync-user で app_metadata.role を自動設定）

---

## 本番デプロイ時のチェックリスト

- [ ] Google Cloud Console の「承認済みの JavaScript 生成元」に本番ドメインを追加
- [ ] Supabase Dashboard の「Site URL」を本番ドメインに変更
- [ ] Supabase Dashboard の「Redirect URLs」に本番ドメインのワイルドカードを追加
- [ ] OAuth 同意画面のステータスを「公開」に変更（Step 2-10）
- [ ] 全テストユーザー（β版の約20名）が allowlist に active で登録されていることを確認

---

*このドキュメントは 2026-03-15 に作成されました。*
*Google Cloud Console や Supabase Dashboard の UI は更新される場合があります。*
*手順通りに進められない場合は、各サービスの公式ドキュメントも参照してください。*

- Google Identity: https://developers.google.com/identity/protocols/oauth2
- Supabase Auth (Google): https://supabase.com/docs/guides/auth/social-login/auth-google
