# CSV インポート手順 (管理者向け)

許可メール管理機能で使用する一括登録用CSVファイルの仕様と、インポート手順について説明します。

## 1. CSV ファイルの形式

インポートに使用する CSV ファイルは、以下のルールに従って作成してください。

*   **文字コード**: UTF-8 (BOMなし推奨)
*   **改行コード**: LF または CRLF
*   **ヘッダー行**: **必須** (1行目にカラム名を記述)

### カラム定義

以下のカラム名が使用できます。`email` は必須で、それ以外は任意です。

| カラム名 | 必須 | 説明 | 例 |
| :--- | :---: | :--- | :--- |
| **`email`** | ✅ | 登録するメールアドレス | `student1@example.com` |
| **`status`** | - | 初期ステータス (`active`, `pending`, `revoked`)。<br>省略時は `active` になります。 | `active` |
| **`label`** | - | クラス名や学年などのラベル | `2024-ClassA` |
| **`notes`** | - | スタッフ向けメモ | `鈴木太郎` |
| **`initial_role`** | - | 初回ログイン時のロール (`student`, `staff`)。<br>省略時は `student` になります。<br>※ 初回ログイン時のみ適用。ログイン後は権限管理で変更。 | `student` |

### サンプル

```csv
email,status,label,notes,initial_role
student1@example.com,active,ClassA,Math,student
staff1@example.com,active,スタッフ,管理者,staff
student2@example.com,pending,ClassB,,
new_student@example.com,,ClassA,,
```

> **Note**: `initial_role` 列を省略した CSV で upsert（上書き更新）しても、既存エントリの `initial_role` は変更されません。

---

## 2. インポート手順

1. **管理画面へアクセス**
    * メニューから「許可メール一覧 (`/admin/allowlist`)」を開きます。

2. **CSVファイルの選択**
    * 画面下部にある「CSV インポート」セクションを探します。
    * 「ファイルを選択」ボタンを押し、作成した CSV ファイルを選択します。

3. **プレビュー確認**
    * ファイルを選択すると、取り込まれるデータの内容が一覧表示されます。
    * 意図しないデータが含まれていないか確認してください。
    * **注意**: 同じメールアドレスが既に登録されている場合、CSVの内容で**上書き**されます。

4. **インポート実行**
    * 「インポートを実行」ボタンを押すと、システムへの登録が開始されます。
    * 処理が完了すると完了メッセージが表示され、一覧が自動的に更新されます。

## 3. よくあるエラー

* **"Missing required columns: email"**
    * 1行目のヘッダーに `email` という列が含まれていません。スペルを確認してください。
* **"Invalid status"**
    * `status` 列に `active`, `pending`, `revoked` 以外の文字が入っています。
* **文字化けする**
    * CSVファイルが `Shift_JIS` などで保存されている可能性があります。Excelで保存する場合は「CSV UTF-8 (コンマ区切り)」を選択してください。
