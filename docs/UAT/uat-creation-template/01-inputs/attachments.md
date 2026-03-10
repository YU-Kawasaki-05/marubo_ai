# 画像添付仕様

本書は、チャットにおける画像添付機能の仕様を定義する。  
β 版（約 20 名）の規模とコスト効率を考慮し、シンプルかつ実用的な設計とする。

---

## 1. 対応画像フォーマット

| フォーマット | MIME タイプ | 備考 |
|-------------|-----------|------|
| JPEG | `image/jpeg` | 写真・スキャン画像の標準 |
| PNG | `image/png` | スクリーンショット・図表に適する |
| WebP | `image/webp` | 高圧縮率。モダンブラウザで対応済み |

**非対応**: GIF（アニメーション不要）、HEIC（ブラウザ互換性）、SVG（XSS リスク）、PDF

---

## 2. サイズ・枚数制限

| 項目 | 上限値 | 理由 |
|------|--------|------|
| **1 枚あたりの最大ファイルサイズ** | **5 MB**（圧縮前） | スマホカメラの一般的な写真サイズをカバー |
| **1 メッセージあたりの添付枚数** | **3 枚** | 問題文 + 自分の回答 + 参考資料の典型パターンに対応 |
| **1 メッセージあたりの合計サイズ** | **10 MB**（圧縮前） | Vercel の Serverless Function ボディ制限を考慮 |

---

## 3. 画像圧縮（クライアントサイド）

アップロード前にブラウザで圧縮を行い、転送量と Storage コストを削減する。

| 項目 | 値 |
|------|-----|
| **最大長辺** | **1280 px** |
| **圧縮形式** | JPEG（品質 0.8） |
| **処理方法** | Canvas API で縮小 → `toBlob('image/jpeg', 0.8)` |

**圧縮ルール**:
- 長辺が 1280 px を超える場合のみ縮小する（小さい画像はそのまま）
- PNG/WebP も JPEG に変換して圧縮する（透過が必要なケースは教育用途では稀）
- 圧縮後のサイズが元より大きくなる場合は元画像を使用する

**環境変数**: `MAX_IMAGE_LONGEDGE=1280`（`deployment.md` に既記載）

---

## 4. アップロードフロー

```
[ブラウザ]
  1. ユーザーがファイルを選択（or ドラッグ&ドロップ）
  2. クライアントでバリデーション（形式/サイズ/枚数）
  3. Canvas API で圧縮
  4. POST /api/attachments/sign に { filename, mimeType, size } を送信
  ↓
[サーバー /api/attachments/sign]
  5. 認証チェック（Bearer トークン）
  6. MIME / サイズの再検証
  7. Storage パス生成: {user_id}/{conversation_id}/{message_id}/{uuid}.{ext}
  8. Supabase Storage の署名 URL を発行（有効期限: 60 秒）
  9. { signedUrl, storagePath } を返却
  ↓
[ブラウザ]
  10. 署名 URL に PUT で画像をアップロード
  11. アップロード完了後、storagePath をチャット送信に含める
  ↓
[サーバー /api/chat]
  12. メッセージ保存時に `attachments` レコードを INSERT
  13. LLM に画像 URL を渡す（Vision 対応モデルの場合）
```

---

## 5. Storage 設計

### バケット

- **バケット名**: `attachments`
- **公開設定**: **非公開**（`public: false`）
- **アクセス**: 署名 URL（読み取り時も短寿命の署名 URL を都度発行）

### パス規約

```
{user_id}/{conversation_id}/{message_id}/{uuid}.{ext}
```

例: `e6a5-xxxx/conv_123/msg_456/a1b2c3d4.jpg`

### RLS / Storage ポリシー

`docs/database.md` に記載済みの Storage ポリシーを適用する。  
自分のパス配下 or スタッフロールのみ読み取り可。書き込みは署名 URL 経由のみ。

---

## 6. attachments テーブル

`docs/database.md` に記載済みの定義に準拠する。

```sql
CREATE TABLE IF NOT EXISTS attachments (
  id            UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  message_id    UUID NOT NULL REFERENCES messages(id) ON DELETE CASCADE,
  user_id       UUID NOT NULL,                -- auth.uid() を保存（Storage パス生成・RLS 用）
  storage_path  TEXT NOT NULL,
  mime_type     TEXT,
  size_bytes    INT,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);
```

- `ON DELETE CASCADE`: メッセージ削除時に添付情報も自動削除
- Storage オブジェクトの物理削除は、DB 削除時にベストエフォートで実行（`docs/operational/runbook.md` 参照）

---

## 7. 保存期間

| 項目 | 期間 | 備考 |
|------|------|------|
| **DB レコード（`attachments` 行）** | 会話データと同じ（論理削除方針に準拠） | `docs/database.md` のデータ削除ポリシー参照 |
| **Storage オブジェクト** | **1 年** | Supabase Storage 無料枠内で運用。1 年経過後に手動確認して削除を検討 |

β 版の規模（約 20 名）では、1 年で見積もった Storage 使用量:
- 仮定: 1 人あたり月 30 枚 × 圧縮後平均 200 KB = 6 MB/月/人
- 20 人 × 12 ヶ月 = 約 **1.4 GB/年**（Supabase 無料枠 1 GB に収まる見込み。超過時は Pro プラン or 古い画像の削除で対応）

---

## 8. エラーハンドリング

| エラー | HTTP | メッセージ（UI 表示） |
|--------|------|----------------------|
| 非対応フォーマット | 400 | 「対応している画像形式は JPEG / PNG / WebP です」 |
| ファイルサイズ超過 | 400 | 「画像は 1 枚あたり 5MB 以下にしてください」 |
| 添付枚数超過 | 400 | 「1 回の送信で添付できる画像は 3 枚までです」 |
| 添付枚数超過（サーバー） | 400 | `TOO_MANY_ATTACHMENTS` — サーバーサイドでも `attachments.length > 3` を検証（GFX-15） |
| メッセージ文字数超過（サーバー） | 400 | `MESSAGE_TOO_LONG` — 最新メッセージが 2000 文字超の場合（GFX-15） |
| 署名 URL 期限切れ | 403 | `AttachmentThumbnails` の `onError` ハンドラで自動検知し、1 回だけ再署名を試行（GFX-13）。失敗時は「もう一度お試しください」 |
| Storage アップロード失敗 | 500 | 「画像のアップロードに失敗しました。もう一度お試しください」 |

---

## 9. UI 仕様（概要）

### 添付操作
- メッセージ入力欄の横に **📎（クリップ）アイコン** を配置
- クリックでファイル選択ダイアログを表示（`accept="image/jpeg,image/png,image/webp"`）
- ドラッグ & ドロップにも対応

### プレビュー
- 選択後、送信前にサムネイルプレビューを表示
- 各画像に **✕ ボタン** で個別削除可能
- ファイル名とサイズを表示

### メッセージ内の画像表示
- 送信済みメッセージ内でサムネイル表示（最大幅 320px）
- クリックで拡大表示（モーダル or 新規タブ）
- 読み込み中はスケルトンプレースホルダーを表示

---

### スタッフ用添付画像表示

スタッフが `/admin/conversations` で会話詳細を閲覧する際、添付画像のサムネイルも表示される（GFX-18）。

* `ConversationDetail` コンポーネントに `AttachmentThumbnails` を統合
* スタッフ用の署名 URL は `POST /api/admin/attachments/signed-url`（Service Role）で生成
* Storage の RLS は `app_metadata.role = 'staff'` で全パス閲覧を許可

---

## 関連ドキュメント

- [データベース設計](./database.md)（`attachments` テーブル、Storage ポリシー）
- [セキュリティポリシー](./security.md)（MIME チェック、署名 URL）
- [API 仕様](./api.md)（`/api/attachments/sign`、`/api/admin/attachments/signed-url`）
- [TODO / Roadmap](./todo.md)（BE-08 〜 BE-11, FE-05 〜 FE-06）
