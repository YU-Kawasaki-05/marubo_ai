-- GFX-29: messages テーブルに seq 列を追加（メッセージの時系列順序を保証）
-- BIGSERIAL は INSERT 順に自動採番されるため、同一タイムスタンプでも
-- user → assistant の順序が保証される。

ALTER TABLE messages ADD COLUMN seq BIGSERIAL;

CREATE INDEX idx_messages_conversation_seq
  ON messages(conversation_id, seq ASC);
