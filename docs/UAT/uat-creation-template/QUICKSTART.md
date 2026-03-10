# クイックスタートガイド

## 最短5ステップで実行

### 1. ディレクトリをコピー

```bash
cp -r uat-creation-template my-uat-project
cd my-uat-project
```

### 2. 設計書を配置

`01-inputs/` に以下を配置:
- `業務一覧表.md` (必須)
- その他の設計書 (Markdown形式)

**オプション: docs/ ディレクトリから自動選別する場合**

```bash
# Claude Code起動後、選別コマンドを実行
/input-prepare
```

プロジェクトの `docs/` ディレクトリ（`docs/UAT/` は除外）から必要な設計書のみが `01-inputs/` に自動的にコピーされます。

### 3. Claude Codeを起動

```bash
claude
```

### 4. コマンドを実行

Claude Codeのプロンプトで入力:

```
/make-uat-complete
```

### 5. 成果物を確認

`AI-generated/` ディレクトリを確認:
- `UAT仕様書_統合レポート.md` - サマリー
- `uat_specs/` - 各カテゴリのUAT仕様書

---

## 詳細な説明

詳しくは `README.md` を参照してください。

## サンプルコマンド

```bash
# 基本実行
/make-uat-complete

# 改善3回繰り返し
/make-uat-complete 3

# 改善5回繰り返し
/make-uat-complete 5
```

## トラブル時

1. Claude Codeを再起動
2. `/make-uat-complete` を再実行
3. `README.md` のトラブルシューティングセクションを参照

---

**所要時間**: 30分〜2時間（プロジェクト規模による）
