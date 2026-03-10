# 配布用パッケージの作成方法

## ZIPファイルの作成

他者に配布する場合、以下の手順でZIPファイルを作成してください。

### macOS / Linux

```bash
cd /path/to/evaluation
zip -r uat-creation-template-v1.0.0.zip uat-creation-template/ -x "*.DS_Store" -x "__pycache__/*" -x "*.pyc"
```

### Windows（PowerShell）

```powershell
Compress-Archive -Path uat-creation-template -DestinationPath uat-creation-template-v1.0.0.zip
```

## パッケージの展開

受け取った人は以下の手順で展開してください。

### macOS / Linux

```bash
unzip uat-creation-template-v1.0.0.zip
cd uat-creation-template
```

### Windows（PowerShell）

```powershell
Expand-Archive -Path uat-creation-template-v1.0.0.zip -DestinationPath .
cd uat-creation-template
```

## パッケージの確認

展開後、以下を確認してください:

```bash
# ディレクトリ構造の確認
ls -la

# 期待される出力:
# .claude/
# 01-inputs/
# AI-generated/
# README.md
# QUICKSTART.md
# CHECKLIST.md
# など
```

## 配布時の注意事項

1. `.DS_Store` などのシステムファイルを除外する
2. バージョン番号をファイル名に含める
3. `README.md` を最初に読むよう案内する
4. Claude Code のインストールが必要であることを伝える

## 配布パッケージに含めるべきファイル

✅ 含める:
- `.claude/` ディレクトリ全体
- `01-inputs/` ディレクトリ（サンプル含む）
- `AI-generated/` ディレクトリ（README のみ）
- すべての `.md` ドキュメント

❌ 除外する:
- `.DS_Store`
- `__pycache__/`
- `*.pyc`
- 個人的なメモやログファイル
- 実際のプロジェクトデータ

---

**推奨ファイル名形式**: `uat-creation-template-v{バージョン}.zip`
