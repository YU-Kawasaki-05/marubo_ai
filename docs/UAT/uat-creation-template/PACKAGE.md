# UAT仕様書自動作成ツール - テンプレートパッケージ

## 📦 パッケージ内容

このパッケージには、Claude Codeを使用してUAT仕様書を自動生成するために必要なすべてのファイルが含まれています。

## 🚀 クイックスタート

```bash
# 1. ディレクトリをコピー
cp -r uat-creation-template my-project

# 2. 作業ディレクトリに移動
cd my-project

# 3. 設計書を配置
# 01-inputs/ に業務一覧表.md と設計書を配置

# 4. Claude Code を起動
claude

# 5. コマンドを実行
/make-uat-complete
```

詳細は `QUICKSTART.md` を参照してください。

## 📁 ディレクトリ構成

```
uat-creation-template/
├── .claude/                          # Claude Code設定
│   ├── agents/                       # エージェント定義（5ファイル）
│   ├── commands/                     # コマンド定義（7ファイル）
│   ├── settings.local.json           # 権限設定
│   └── uat-config.json               # プロジェクト設定
├── 01-inputs/                        # 入力ディレクトリ
│   ├── README.md                     # 入力ファイルガイド
│   └── 業務一覧表_サンプル.md         # サンプルファイル
├── AI-generated/                     # 出力ディレクトリ
│   └── README.md                     # 出力ファイルガイド
├── README.md                         # メインドキュメント
├── QUICKSTART.md                     # クイックスタート
├── CHECKLIST.md                      # 実行チェックリスト
├── CHANGELOG.md                      # 変更履歴
└── PACKAGE.md                        # 本ファイル
```

## 📄 ドキュメント

| ファイル | 用途 |
|---------|------|
| `README.md` | 完全なセットアップと実行ガイド |
| `QUICKSTART.md` | 最短5ステップの実行手順 |
| `CHECKLIST.md` | 実行前後のチェックリスト |
| `CHANGELOG.md` | バージョン履歴と変更内容 |
| `01-inputs/README.md` | 入力ファイルの説明 |
| `AI-generated/README.md` | 出力ファイルの説明 |

## 🔧 設定ファイル

| ファイル | 内容 |
|---------|------|
| `.claude/settings.local.json` | Claude Code の権限設定 |
| `.claude/uat-config.json` | プロジェクト固有の設定（カスタマイズ可） |

## 🤖 エージェント

| エージェント | 役割 |
|-------------|------|
| `file-analyzer.md` | ファイル解析 |
| `uat0-make-scope-agent.md` | スコープ定義書作成 |
| `uat1-make-temp-agent.md` | 仮UAT仕様書作成 |
| `uat2-validate-agent.md` | UAT仕様書検証 |
| `uat3-make-uat-agent.md` | UAT仕様書改善 |

## 📜 コマンド

| コマンド | 用途 |
|---------|------|
| `/input-prepare` | 入力準備（設計書選別、オプション） |
| `/make-uat-complete` | UAT作成メイン処理（End-to-End） |
| `/uat0-make-scope` | スコープ定義書作成（個別実行） |
| `/uat1-make-temp` | 仮UAT仕様書作成（個別実行） |
| `/uat2-validate` | UAT仕様書検証（個別実行） |
| `/uat3-make-uat` | UAT仕様書改善（個別実行） |
| `/tool-spec-refine` | 仕様書の洗練（ツール） |

### `/input-prepare` の詳細

未整理の設計書が多数ある場合に使用します。

**機能:**
- 業務一覧表から対象業務を抽出
- 対象業務に関連する設計書ファイルを自動検出
- 必要なファイルのみを `01-inputs/` にコピー

**使用例:**
```
1. claude 起動（docs/UAT/uat-creation-template/ で実行）
2. /input-prepare 実行
3. docs/ ディレクトリから自動的にファイルを分析・選別（docs/UAT/ は除外）
4. 01-inputs/ に選別された設計書がコピーされる
```

## ⚙️ カスタマイズ可能な設定

`.claude/uat-config.json` で以下をカスタマイズできます:

- プロジェクト名
- 業務一覧表のファイル名パターン
- 対象とする業務ステータス
- 除外する業務ステータス
- 目標業務網羅率

## 📊 処理フロー

```
入力準備（オプション）
    ↓
フェーズ1: スコープ定義書作成
    ↓
フェーズ2: 仮UAT仕様書作成（全カテゴリ）
    ↓
フェーズ3: UAT仕様書検証（全カテゴリ）
    ↓
フェーズ4: UAT仕様書改善（各カテゴリ × 改善回数）
    ↓
成果物出力
```

## 🎯 主な特徴

- ✅ **業務網羅率100%保証**: 全対象業務のUAT仕様書を生成
- ✅ **カテゴリ別分割**: トークン使用量68%削減
- ✅ **自動検証**: 品質・網羅性・実行可能性をチェック
- ✅ **繰り返し改善**: 指定回数だけ自動的に改善
- ✅ **バックアップ機能**: 改善前の内容を自動保存

## 📈 パフォーマンス

| 項目 | 値 |
|------|-----|
| トークン削減率 | 68% (200,000 → 64,000) |
| 業務網羅率 | 95%以上（目標100%） |
| 実行時間 | 30分〜2時間（規模による） |
| 対応業務数 | 70業務以上 |

## 🔄 バージョン

- **現在**: v1.0.0
- **リリース日**: 2025年10月14日
- **対応Claude Code**: v2.0.0以降

詳細は `CHANGELOG.md` を参照してください。

## 📋 前提条件

- Claude Code CLI がインストールされていること
- ターミナルから `claude` コマンドが実行可能であること
- 設計書がMarkdown形式で用意されていること

## 🆘 サポート

問題が発生した場合:

1. `README.md` のトラブルシューティングセクションを確認
2. `CHECKLIST.md` で実行手順を再確認
3. Claude Code を再起動して再実行

## 📝 ライセンス

プロジェクト内部使用

---

**作成**: Four You Inc.  
**最終更新**: 2025年10月14日  
**バージョン**: 1.0.0
