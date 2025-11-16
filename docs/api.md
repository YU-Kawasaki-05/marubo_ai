# API Specification

本書では、Next.js Route Handlers で実装される **API の I/O, エラー, 認証/認可要件** をまとめる。
目的は、クライアント/サーバー間のインターフェースを安定化し、変更時の影響範囲を明確にすること。

## 本書で扱う内容
- chat / attachments/sign / reports/monthly / sync-user の仕様
- 入力・出力・バリデーション
- エラー形式 (`AppError`)
- LLM リトライとフォールバック戦略

---

