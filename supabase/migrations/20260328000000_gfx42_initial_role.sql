-- GFX-42: allowed_email に initial_role カラムを追加
-- 初回ログイン時に app_user.role に設定されるロール（デフォルト student）
ALTER TABLE allowed_email
  ADD COLUMN initial_role text NOT NULL DEFAULT 'student'
  CHECK (initial_role IN ('student', 'staff'));

COMMENT ON COLUMN allowed_email.initial_role IS
  '初回ログイン時に app_user.role に設定されるロール。デフォルト student。';
