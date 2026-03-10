/** @file シーケンス図 — Marubo AI 主要ユースケース */

# シーケンス図（Sequence Diagrams）

## 概要

Marubo AI の主要ユースケースについて、正常系・異常系の処理フローを記述します。

---

## 1. ユーザー認証フロー（ログイン〜セッション確立）

```mermaid
sequenceDiagram
    actor ユーザー
    participant FE as フロントエンド<br/>/login
    participant Supabase as Supabase Auth
    participant API as POST /api/sync-user
    participant DB as PostgreSQL

    Note over ユーザー,DB: 【正常系】メール/パスワードログイン

    ユーザー->>FE: メールアドレス・パスワード入力
    FE->>Supabase: signInWithPassword({email, password})
    Supabase-->>FE: session {access_token, user}

    FE->>API: POST /api/sync-user<br/>Authorization: Bearer {token}
    API->>Supabase: auth.getUser(token)
    Supabase-->>API: {user: {id, email}}

    API->>DB: SELECT FROM allowed_email<br/>WHERE email = '{email}'
    DB-->>API: {status: 'active'}

    API->>DB: UPSERT app_user<br/>SET email, auth_uid
    DB-->>API: {appUserId, role}

    API-->>FE: 200 {appUserId, role, allowedEmailStatus: 'active'}
    FE->>FE: router.push('/admin/allowlist')

    Note over ユーザー,DB: 【異常系1】認証失敗
    ユーザー->>FE: 誤ったパスワード入力
    FE->>Supabase: signInWithPassword({email, password})
    Supabase-->>FE: AuthError: Invalid login credentials
    FE->>ユーザー: エラーメッセージ表示<br/>"メールアドレスまたはパスワードが間違っています"

    Note over ユーザー,DB: 【異常系2】許可リスト未登録
    FE->>API: POST /api/sync-user
    API->>DB: SELECT FROM allowed_email
    DB-->>API: (0 rows)
    API-->>FE: 403 {code: 'ALLOWLIST_NOT_FOUND'}
    FE->>ユーザー: AccountStatusBanner<br/>"許可リストに登録されていません"

    Note over ユーザー,DB: 【異常系3】アカウント保留中
    FE->>API: POST /api/sync-user
    API->>DB: SELECT FROM allowed_email
    DB-->>API: {status: 'pending'}
    API-->>FE: 409 {code: 'ALLOWLIST_PENDING'}
    FE->>ユーザー: AllowlistGuard<br/>"利用申請中です。承認をお待ちください"
```

---

## 2. 新規ユーザー登録フロー

```mermaid
sequenceDiagram
    actor ユーザー
    participant FE as フロントエンド<br/>/login
    participant Supabase as Supabase Auth

    ユーザー->>FE: メール・パスワード入力<br/>"新規登録" ボタンクリック
    FE->>Supabase: signUp({email, password})
    Supabase->>Supabase: 確認メール送信
    Supabase-->>FE: {user, session: null}
    FE->>ユーザー: "確認メールを送信しました。<br/>メールのリンクをクリックしてください。"

    Note over ユーザー,Supabase: ユーザーがメールのリンクをクリック後、<br/>再度 /login からログイン
```

---

## 3. AI チャット送信フロー（画像添付あり）

```mermaid
sequenceDiagram
    actor ユーザー
    participant FE as フロントエンド<br/>ChatInterface
    participant SignAPI as POST /api/attachments/sign
    participant Storage as Supabase Storage
    participant ChatAPI as POST /api/chat
    participant RateLimit as レート制限
    participant OpenAI as OpenAI API<br/>gpt-4o-mini
    participant DB as PostgreSQL
    participant Notifier as 通知システム

    Note over ユーザー,Notifier: 【正常系】テキスト＋画像送信

    ユーザー->>FE: テキスト入力 + 画像ファイル選択（📎）
    FE->>FE: バリデーション<br/>MIME: jpeg/png/webp<br/>サイズ: 5MB以下<br/>枚数: 3枚以下
    FE->>FE: プレビュー表示（ImagePreviewBar）

    ユーザー->>FE: 送信ボタンクリック

    loop 各添付画像
        FE->>SignAPI: POST /api/attachments/sign<br/>{mimeType, size}
        SignAPI->>SignAPI: トークン検証 + バリデーション
        SignAPI->>Storage: createSignedUploadUrl<br/>path: {user_id}/{uuid}.{ext}
        Storage-->>SignAPI: {signedUrl, token}
        SignAPI-->>FE: {signedUrl, storagePath, token}

        FE->>Storage: PUT {signedUrl}<br/>Content-Type: {mimeType}<br/>Body: ファイルバイナリ
        Storage-->>FE: 200 OK
    end

    FE->>ChatAPI: POST /api/chat<br/>{messages[], attachments[{storagePath, mimeType, size}]}<br/>Authorization: Bearer {token}

    ChatAPI->>ChatAPI: トークン検証<br/>→ authUserId → appUserId

    ChatAPI->>RateLimit: checkMinuteRate(appUserId)<br/>10回/分
    RateLimit-->>ChatAPI: OK

    ChatAPI->>RateLimit: checkMonthlyQuota(appUserId)<br/>100問/月
    RateLimit-->>ChatAPI: OK

    ChatAPI->>OpenAI: streamText({model, messages, system})<br/>model: gpt-4o-mini
    OpenAI-->>ChatAPI: ストリーミングレスポンス（チャンク）

    ChatAPI-->>FE: text/stream<br/>x-conversation-id: {uuid}
    FE->>ユーザー: AIの回答をリアルタイム表示<br/>"AIが考え中..." → 逐次表示

    Note over ChatAPI,DB: onFinish コールバック（ストリーム完了後）

    ChatAPI->>DB: INSERT conversations<br/>{id, user_id, title}
    ChatAPI->>DB: INSERT messages × 2<br/>(user + assistant)
    ChatAPI->>DB: INSERT attachments<br/>{message_id, storage_path, mime_type, size_bytes}
    ChatAPI->>DB: UPSERT usage_counters<br/>questions += 1

    FE->>FE: 会話リスト再取得<br/>onConversationCreated(id)

    Note over ユーザー,Notifier: 【異常系1】レート制限超過

    FE->>ChatAPI: POST /api/chat
    ChatAPI->>RateLimit: checkMinuteRate(appUserId)
    RateLimit-->>ChatAPI: AppError(429, 'RATE_LIMIT_EXCEEDED')
    ChatAPI->>Notifier: notifyError('S2', 'レート制限発動')
    ChatAPI-->>FE: 429 {error: 'RATE_LIMIT_EXCEEDED'}
    FE->>ユーザー: alert("利用制限に達しました")

    Note over ユーザー,Notifier: 【異常系2】月間クォータ超過

    FE->>ChatAPI: POST /api/chat
    ChatAPI->>RateLimit: checkMonthlyQuota(appUserId)
    RateLimit-->>ChatAPI: AppError(429, '月間質問数の上限')
    ChatAPI-->>FE: 429 {error: '月間利用上限に達しました'}
    FE->>ユーザー: alert("今月の利用上限に達しました")

    Note over ユーザー,Notifier: 【異常系3】OpenAI エラー

    ChatAPI->>OpenAI: streamText(...)
    OpenAI-->>ChatAPI: 500 Internal Server Error
    ChatAPI->>Notifier: notifyError('S1', 'LLM 全経路失敗')
    ChatAPI-->>FE: 500 {error: 'INTERNAL_SERVER_ERROR'}
    FE->>ユーザー: alert("エラーが発生しました")

    Note over ユーザー,Notifier: 【異常系4】画像署名URL取得失敗

    FE->>SignAPI: POST /api/attachments/sign<br/>{mimeType: 'image/gif', size: 100}
    SignAPI-->>FE: 400 {code: 'INVALID_MIME_TYPE'}
    FE->>ユーザー: エラー表示 "サポートされていない画像形式です"
```

---

## 4. 会話履歴の閲覧フロー

```mermaid
sequenceDiagram
    actor ユーザー
    participant FE as フロントエンド<br/>ConversationSidebar
    participant ListAPI as GET /api/conversations
    participant DetailAPI as GET /api/conversations/{id}
    participant Storage as Supabase Storage
    participant DB as PostgreSQL

    Note over ユーザー,DB: 【正常系】会話一覧取得 + 詳細表示

    ユーザー->>FE: /chat にアクセス
    FE->>ListAPI: GET /api/conversations?limit=20<br/>Authorization: Bearer {token}
    ListAPI->>DB: SELECT FROM conversations<br/>WHERE user_id = auth.uid()<br/>ORDER BY created_at DESC<br/>LIMIT 20
    DB-->>ListAPI: [{id, title, created_at}, ...]
    ListAPI-->>FE: {data: [...], nextCursor: "..."}
    FE->>ユーザー: サイドバーに会話一覧表示

    ユーザー->>FE: 会話タイトルをクリック
    FE->>DetailAPI: GET /api/conversations/{id}<br/>Authorization: Bearer {token}
    DetailAPI->>DB: SELECT FROM conversations<br/>WHERE id = {id} AND user_id = auth.uid()
    DetailAPI->>DB: SELECT FROM messages<br/>WHERE conversation_id = {id}<br/>ORDER BY created_at ASC
    DetailAPI->>DB: SELECT FROM attachments<br/>WHERE message_id IN (...)
    DB-->>DetailAPI: {conversation, messages[], attachments[]}
    DetailAPI-->>FE: {data: {id, title, messages[...]}}

    FE->>FE: attachmentsByMessageId マップ構築

    loop 各添付画像
        FE->>Storage: createSignedUrl(storagePath, 600)<br/>10分間有効
        Storage-->>FE: {signedUrl}
    end

    FE->>ユーザー: メッセージ + サムネイル表示

    ユーザー->>FE: サムネイルクリック
    FE->>ユーザー: ImageLightbox モーダル表示

    Note over ユーザー,DB: 【ページネーション】もっと読む

    ユーザー->>FE: "もっと読む" ボタンクリック
    FE->>ListAPI: GET /api/conversations?limit=20&cursor={nextCursor}
    ListAPI->>DB: SELECT ... WHERE (created_at, id) < cursor
    DB-->>ListAPI: [{id, title, created_at}, ...]
    ListAPI-->>FE: {data: [...], nextCursor: "..." or null}
    FE->>FE: 既存リストに追加

    Note over ユーザー,DB: 【異常系】会話が見つからない

    FE->>DetailAPI: GET /api/conversations/{invalid-id}
    DetailAPI->>DB: SELECT ... WHERE id = {invalid-id}
    DB-->>DetailAPI: (0 rows)
    DetailAPI-->>FE: 404 {error: 'CONVERSATION_NOT_FOUND'}
```

---

## 5. 許可リスト管理フロー（スタッフ操作）

```mermaid
sequenceDiagram
    actor スタッフ
    participant FE as フロントエンド<br/>/admin/allowlist
    participant ListAPI as GET /api/admin/allowlist
    participant UpdateAPI as PATCH /api/admin/allowlist/{email}
    participant ImportAPI as POST /api/admin/allowlist/import
    participant DB as PostgreSQL

    Note over スタッフ,DB: 【正常系】一覧表示 + ステータス変更

    スタッフ->>FE: /admin/allowlist にアクセス
    FE->>ListAPI: GET /api/admin/allowlist<br/>Authorization: Bearer {token}
    ListAPI->>ListAPI: requireStaff(request)<br/>→ role === 'staff' 確認
    ListAPI->>DB: SELECT FROM allowed_email<br/>ORDER BY updated_at DESC
    DB-->>ListAPI: [{email, status, label, notes}, ...]
    ListAPI-->>FE: {data: [...]}
    FE->>スタッフ: 許可リスト一覧表示

    スタッフ->>FE: ステータスドロップダウン変更<br/>"pending → active"
    FE->>FE: window.confirm<br/>"pending から active に変更しますか？"
    スタッフ->>FE: OK

    FE->>UpdateAPI: PATCH /api/admin/allowlist/{email}<br/>{status: 'active'}
    UpdateAPI->>DB: UPDATE allowed_email<br/>SET status = 'active'
    UpdateAPI->>DB: INSERT audit_allowlist<br/>{operation: 'update', prev, next}
    DB-->>UpdateAPI: {updated row}
    UpdateAPI-->>FE: 200 {data: updated}
    FE->>FE: window.location.reload()

    Note over スタッフ,DB: 【正常系】CSV一括インポート

    スタッフ->>FE: CSVファイル選択
    FE->>FE: クライアント側パース<br/>（UTF-8 → Shift_JIS フォールバック）
    FE->>スタッフ: プレビューテーブル表示（先頭5件）

    スタッフ->>FE: "一括登録を実行" クリック
    FE->>FE: window.confirm("一括登録しますか？")
    スタッフ->>FE: OK

    FE->>ImportAPI: POST /api/admin/allowlist/import<br/>{csv: "email,status\n...", mode: 'insert'}
    ImportAPI->>ImportAPI: CSVパース + バリデーション
    ImportAPI->>DB: INSERT allowed_email (bulk)
    ImportAPI->>DB: INSERT audit_allowlist × N
    DB-->>ImportAPI: OK
    ImportAPI-->>FE: {data: {inserted: 5, updated: 0}}
    FE->>FE: window.location.reload()

    Note over スタッフ,DB: 【異常系】重複メールでinsertモード

    FE->>ImportAPI: POST {csv: "...", mode: 'insert'}
    ImportAPI->>DB: INSERT (重複チェック)
    DB-->>ImportAPI: 一意制約違反
    ImportAPI-->>FE: 409 {code: 'ALLOWLIST_EXISTS'}
    FE->>スタッフ: alert("既に登録されているメールがあります")
```

---

## 6. スタッフ権限管理フロー

```mermaid
sequenceDiagram
    actor 特権スタッフ
    participant FE as フロントエンド<br/>/admin/grant
    participant API as /api/admin/grant
    participant DB as PostgreSQL
    participant Auth as Supabase Auth Admin

    Note over 特権スタッフ,Auth: 【正常系】スタッフ権限付与

    特権スタッフ->>FE: メールアドレス入力 + "付与する"
    FE->>FE: window.confirm<br/>"{email} にスタッフ権限を付与しますか？"
    特権スタッフ->>FE: OK

    FE->>API: POST /api/admin/grant<br/>{email: "target@example.com", action: 'grant'}
    API->>API: requireStaff(request)
    API->>API: assertGrantAllowed(operatorEmail)<br/>→ GRANT_ALLOWED_EMAILS に含まれるか確認

    API->>DB: SELECT FROM app_user<br/>WHERE email = 'target@example.com'
    DB-->>API: {id, role: 'student'}

    API->>DB: UPDATE app_user<br/>SET role = 'staff'
    API->>Auth: auth.admin.updateUserById(authUid,<br/>{app_metadata: {role: 'staff'}})
    Auth-->>API: OK

    API->>DB: INSERT audit_grant<br/>{operator, target, action: 'grant', prev: 'student', new: 'staff'}
    DB-->>API: OK

    API-->>FE: 200 {email, previousRole: 'student', newRole: 'staff',<br/>note: '対象ユーザーは再ログインが必要です'}
    FE->>特権スタッフ: alert("付与しました")
    FE->>FE: window.location.reload()

    Note over 特権スタッフ,Auth: 【異常系1】権限不足（GRANT_ALLOWED_EMAILS外）

    FE->>API: POST /api/admin/grant {email, action: 'grant'}
    API->>API: assertGrantAllowed(operatorEmail)
    API-->>FE: 403 {code: 'GRANT_NOT_ALLOWED'}
    FE->>特権スタッフ: alert("この操作を行う権限がありません")

    Note over 特権スタッフ,Auth: 【異常系2】自身の権限解除

    FE->>API: POST {email: "自分のメール", action: 'revoke'}
    API-->>FE: 409 {code: 'SELF_REVOKE_FORBIDDEN'}
    FE->>特権スタッフ: alert("自身の権限は解除できません")
```

---

## 7. 月次レポート生成フロー（スタッフ手動 / Cron）

```mermaid
sequenceDiagram
    actor スタッフ
    participant FE as フロントエンド<br/>/admin/reports
    participant API as /api/reports/monthly
    participant DB as PostgreSQL
    participant OpenAI as OpenAI API<br/>gpt-4o-mini
    participant Notifier as 通知システム
    participant Cron as Vercel Cron

    Note over スタッフ,Cron: 【正常系A】スタッフによる手動生成

    スタッフ->>FE: 月を選択 + "一括生成" クリック
    FE->>FE: window.confirm<br/>"一括生成しますか？（数分かかる場合があります）"
    スタッフ->>FE: OK

    FE->>API: POST /api/reports/monthly<br/>{month: '2026-03', dryRun: false}
    API->>API: requireStaff(request)

    API->>DB: SELECT FROM app_user<br/>(全ユーザー取得)
    DB-->>API: [{id, email}, ...]

    loop 各ユーザー
        API->>DB: SELECT FROM conversations + messages<br/>WHERE user_id = {userId}<br/>AND month = '2026-03'
        DB-->>API: {conversations[], messages[]}

        alt 会話あり
            API->>OpenAI: streamText({model, system: レポートプロンプト,<br/>messages: 学習内容要約})
            OpenAI-->>API: レポートMarkdownテキスト
            API->>DB: UPSERT monthly_report<br/>{userId, month, status: 'generated',<br/>content, stats, llm_tokens}
        else 会話なし
            API->>DB: UPSERT monthly_report<br/>{userId, month, status: 'generated',<br/>content: 'データなし'}
        end
    end

    API-->>FE: 200 {month, results: {total: 20,<br/>generated: 18, failed: 1, skipped: 1}}
    FE->>スタッフ: alert("生成: 18件, 失敗: 1件, スキップ: 1件")
    FE->>FE: window.location.reload()

    Note over スタッフ,Cron: 【正常系B】Cron による自動生成

    Cron->>API: POST /api/reports/monthly<br/>Authorization: Bearer {CRON_SECRET}
    API->>API: verifyCronAuth()
    API->>API: isLastDayOfMonth() チェック

    alt 月末
        API->>API: 全ユーザーのレポート生成<br/>（上記と同じフロー）
        API-->>Cron: 200 {results: {...}}
    else 月末以外
        API-->>Cron: 200 {skipped: true, reason: 'not_last_day'}
    end

    Note over スタッフ,Cron: 【正常系C】Dry Run（プレビュー）

    スタッフ->>FE: "Dry Run" クリック
    FE->>API: POST /api/reports/monthly<br/>{month: '2026-03', dryRun: true}
    API->>DB: 対象ユーザーカウント（LLM呼び出しなし）
    API-->>FE: 200 {dryRun: true, targetCount: 20, skippedCount: 2}
    FE->>スタッフ: alert("対象: 20件, スキップ: 2件")

    Note over スタッフ,Cron: 【異常系】LLM生成失敗

    API->>OpenAI: streamText(...)
    OpenAI-->>API: 500 Error
    API->>DB: UPDATE monthly_report<br/>SET status = 'failed', error_message = '...'
    API->>Notifier: notifyError('S1', 'レポート生成失敗')
    Notifier->>Notifier: 管理者にメール送信
```

---

## 8. 生徒のレポート閲覧フロー

```mermaid
sequenceDiagram
    actor 生徒
    participant FE as フロントエンド<br/>/reports
    participant API as GET /api/reports/monthly
    participant DB as PostgreSQL

    Note over 生徒,DB: 【正常系】レポート閲覧

    生徒->>FE: /reports にアクセス
    FE->>FE: AllowlistGuard → status = 'active' 確認

    FE->>API: GET /api/reports/monthly?month=2026-03<br/>Authorization: Bearer {token}
    API->>API: requireAuth(request)<br/>→ role = 'student'
    API->>DB: SELECT FROM monthly_report<br/>WHERE user_id = {appUserId}<br/>AND month = '2026-03'
    DB-->>API: {id, status: 'generated', content: '## ...', stats: {...}}
    API-->>FE: {report: {id, month, status, content, stats, generatedAt}}

    FE->>生徒: レポート表示<br/>・質問数/会話数/利用日数<br/>・AI分析テキスト（Markdown）

    Note over 生徒,DB: 【状態別表示】

    alt status = 'generating'
        FE->>生徒: 黄色バナー "レポートを生成中です..."
    else status = 'failed'
        FE->>生徒: 赤バナー "レポートの生成に失敗しました"
    else status = 'pending' or null
        FE->>生徒: 灰色バナー "レポートはまだ生成されていません"
    end
```

---

## 9. 会話検索フロー（スタッフ操作）

```mermaid
sequenceDiagram
    actor スタッフ
    participant FE as フロントエンド<br/>/admin/conversations
    participant SearchAPI as GET /api/admin/conversations
    participant DetailAPI as GET /api/admin/conversations/{id}
    participant DB as PostgreSQL

    Note over スタッフ,DB: 【正常系】会話検索 + 詳細表示

    スタッフ->>FE: 検索条件入力<br/>メール / キーワード / 日付範囲
    スタッフ->>FE: "検索" ボタンクリック

    FE->>SearchAPI: GET /api/admin/conversations<br/>?email=tanaka&keyword=数学&from=2026-03-01&page=1&limit=20
    SearchAPI->>SearchAPI: requireStaff(request)
    SearchAPI->>DB: SELECT conversations<br/>JOIN app_user ON user_id<br/>WHERE email ILIKE '%tanaka%'<br/>AND title ILIKE '%数学%'<br/>AND created_at >= '2026-03-01'
    SearchAPI->>DB: COUNT messages per conversation
    DB-->>SearchAPI: [{id, title, createdAt, messageCount, user}, ...]
    SearchAPI-->>FE: {conversations: [...], pagination: {page:1, total:42, totalPages:3}}

    FE->>スタッフ: 検索結果テーブル表示（20件/ページ）

    スタッフ->>FE: テーブル行クリック
    FE->>DetailAPI: GET /api/admin/conversations/{id}
    DetailAPI->>DB: SELECT conversation + messages + attachments
    DB-->>DetailAPI: {id, title, user, messages[]}
    DetailAPI-->>FE: {data: {id, title, messages[...]}}

    FE->>スタッフ: ConversationDetail パネル表示<br/>（メッセージ一覧 + 添付情報）

    Note over スタッフ,DB: 【ページネーション】

    スタッフ->>FE: "次へ →" クリック
    FE->>SearchAPI: GET ...?page=2&limit=20
    SearchAPI-->>FE: {conversations: [...], pagination: {page:2}}
    FE->>スタッフ: 2ページ目表示
```

---

## 10. CSV ダウンロードフロー

```mermaid
sequenceDiagram
    actor スタッフ
    participant FE as フロントエンド<br/>/admin/reports
    participant API as GET /api/reports/monthly/csv
    participant DB as PostgreSQL

    Note over スタッフ,DB: 【正常系】CSV出力

    スタッフ->>FE: "CSV ダウンロード" クリック
    FE->>API: GET /api/reports/monthly/csv?month=2026-03<br/>Authorization: Bearer {token}
    API->>API: requireStaff(request)
    API->>DB: SELECT monthly_report<br/>JOIN app_user<br/>WHERE month = '2026-03'
    DB-->>API: [{email, displayName, status, stats, ...}]
    API->>API: CSV文字列生成<br/>Content-Disposition: attachment
    API-->>FE: text/csv<br/>marubo_ai_report_2026-03.csv
    FE->>FE: ブラウザがファイルダウンロード
    FE->>スタッフ: ダウンロード完了
```

---

## 補足: 共通エラーハンドリングパターン

```mermaid
sequenceDiagram
    participant FE as フロントエンド
    participant API as APIエンドポイント
    participant Notifier as 通知システム

    Note over FE,Notifier: 全APIエンドポイント共通パターン

    FE->>API: リクエスト

    alt 認証エラー（401）
        API-->>FE: 401 {code: 'UNAUTHORIZED'}
        FE->>FE: ログイン画面にリダイレクト
    else 認可エラー（403）
        API-->>FE: 403 {code: 'FORBIDDEN'}
        FE->>FE: エラーメッセージ表示
    else バリデーションエラー（400）
        API-->>FE: 400 {code: '...', message: '...'}
        FE->>FE: フィールドエラー表示
    else サーバーエラー（500）
        API->>Notifier: notifyError('S1', title, detail)
        Notifier->>Notifier: debounce(5分/コード)<br/>管理者メール送信（Resend）
        API-->>FE: 500 {code: 'INTERNAL_SERVER_ERROR'}
        FE->>FE: alert("エラーが発生しました")
    end
```
