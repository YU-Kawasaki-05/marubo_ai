# 変更履歴

## v1.0.0 (2025-10-14)

### 初回リリース

- UAT仕様書自動作成ツールのテンプレートパッケージを作成

### 含まれる機能

- Claude Code エージェント定義（5ファイル）
  - file-analyzer.md
  - uat0-make-scope-agent.md
  - uat1-make-temp-agent.md
  - uat2-validate-agent.md
  - uat3-make-uat-agent.md

- Claude Code コマンド定義（7ファイル）
  - input-prepare.md
  - make-uat-complete.md
  - tool-spec-refine.md
  - uat0-make-scope.md
  - uat1-make-temp.md
  - uat2-validate.md
  - uat3-make-uat.md

- 設定ファイル
  - settings.local.json（権限設定）
  - uat-config.json（プロジェクト設定）

- ドキュメント
  - README.md（メインドキュメント）
  - QUICKSTART.md（クイックスタートガイド）
  - CHANGELOG.md（本ファイル）
  - 01-inputs/README.md（入力ファイルガイド）
  - AI-generated/README.md（出力ファイルガイド）

- サンプルファイル
  - 01-inputs/業務一覧表_サンプル.md

### 特徴

- 業務カテゴリ別分割戦略を採用
- トークン使用量を68%削減（200,000 → 64,000）
- 業務網羅率95%以上を目標（100%達成可能）
- 4フェーズの自動処理フロー
  1. スコープ定義書作成
  2. 仮UAT仕様書作成
  3. UAT仕様書検証
  4. UAT仕様書改善

### ディレクトリ構成

```
uat-creation-template/
├── .claude/
│   ├── agents/         # 5エージェント
│   ├── commands/       # 7コマンド
│   ├── settings.local.json
│   └── uat-config.json
├── 01-inputs/          # 入力ディレクトリ（README付き）
├── AI-generated/       # 出力ディレクトリ（README付き）
├── README.md           # メインドキュメント
├── QUICKSTART.md       # クイックスタート
└── CHANGELOG.md        # 本ファイル
```

### 対応Claude Codeバージョン

- v2.0.0以降

### 既知の制限事項

- 改善回数2回以上の動作検証が未完了
- カテゴリ数が6を超える場合の対応が必要な場合がある

---

## 今後の予定

### v1.1.0（予定）

- [ ] 改善回数2回以上の動作検証
- [ ] カテゴリ数制限の緩和
- [ ] パフォーマンス最適化
- [ ] エラーハンドリング強化

### v1.2.0（予定）

- [ ] 部分再生成機能
- [ ] カスタムテンプレート対応
- [ ] 多言語対応

---

**メンテナンス**: Four you Inc.
**ライセンス**: プロジェクト内部使用
