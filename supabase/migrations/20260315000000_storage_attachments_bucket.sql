-- @file
-- Supabase Storage: attachments バケット作成 + アクセスポリシー設定
-- 機能：画像添付機能に必要な Storage バケットと RLS ポリシーを構成
-- 依存：supabase storage 拡張（デフォルトで有効）
-- セキュリティ：
--   - バケットは非公開（public = false）
--   - SELECT/INSERT はユーザー自身のフォルダ（{user_id}/...）のみ許可
--   - スタッフは全ユーザーの画像を閲覧可能
--   - ファイルサイズ上限 5MB、MIME タイプ制限で二重防御

-- ========================================
-- 1. attachments バケットの作成
-- ========================================
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'attachments',
  'attachments',
  false,
  5242880,  -- 5MB = 5 * 1024 * 1024
  ARRAY['image/jpeg', 'image/png', 'image/webp']
)
ON CONFLICT (id) DO UPDATE SET
  public = EXCLUDED.public,
  file_size_limit = EXCLUDED.file_size_limit,
  allowed_mime_types = EXCLUDED.allowed_mime_types;

-- ========================================
-- 2. Storage ポリシー — SELECT（本人の画像読み取り）
-- ========================================
-- ユーザーが自分のフォルダ配下の画像のみ読み取り可能
-- Storage パス規約: {user_id}/{uuid}.{ext}
CREATE POLICY "Users can read own attachments"
  ON storage.objects
  FOR SELECT
  TO authenticated
  USING (
    bucket_id = 'attachments'
    AND auth.uid()::text = (storage.foldername(name))[1]
  );

-- ========================================
-- 3. Storage ポリシー — INSERT（本人フォルダへの書き込み）
-- ========================================
-- ユーザーが自分のフォルダにのみアップロード可能
CREATE POLICY "Users can upload own attachments"
  ON storage.objects
  FOR INSERT
  TO authenticated
  WITH CHECK (
    bucket_id = 'attachments'
    AND auth.uid()::text = (storage.foldername(name))[1]
  );

-- ========================================
-- 4. Storage ポリシー — SELECT（スタッフ用、全ユーザー閲覧）
-- ========================================
-- スタッフ（app_metadata.role = 'staff'）は全ユーザーの添付画像を閲覧可能
CREATE POLICY "Staff can read all attachments"
  ON storage.objects
  FOR SELECT
  TO authenticated
  USING (
    bucket_id = 'attachments'
    AND (auth.jwt() -> 'app_metadata' ->> 'role') = 'staff'
  );
