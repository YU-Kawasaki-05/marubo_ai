/** @file
 * Supabase 型定義（許可メール周辺のみ）
 * 入力：Supabase テーブルのスキーマ情報
 * 出力：`Database` 型 + テーブルごとの Row/Insert/Update typedef
 * 依存：なし（TS のみ）
 * セキュリティ：Service Role での操作対象テーブルを型で縛り、不正列更新を防ぐ
 */

export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type AllowedEmailStatus = 'active' | 'pending' | 'revoked'

export type AllowedEmailRow = {
  email: string
  status: AllowedEmailStatus
  label: string | null
  invited_at: string | null
  expires_at: string | null
  notes: string | null
  created_by: string | null
  updated_at: string
  created_at: string
}

export type AllowedEmailInsert = {
  email: string
  status?: AllowedEmailStatus
  label?: string | null
  invited_at?: string | null
  expires_at?: string | null
  notes?: string | null
  created_by?: string | null
  updated_at?: string
  created_at?: string
}

export type AllowedEmailUpdate = Partial<Omit<AllowedEmailInsert, 'email'>> & {
  status?: AllowedEmailStatus
}

export type AppUserRole = 'student' | 'staff'

export type AppUserRow = {
  id: string
  auth_uid: string
  email: string
  display_name: string | null
  role: AppUserRole
  created_at: string
}

export type AuditAllowlistRow = {
  id: string
  request_id: string
  email: string
  prev: Json | null
  next: Json | null
  operation: 'insert' | 'update' | 'csv-import'
  staff_user_id: string
  created_at: string
}

export type AuditAllowlistInsert = Omit<AuditAllowlistRow, 'id' | 'created_at'> & {
  id?: string
  created_at?: string
}

export type Database = {
  public: {
    Tables: {
      allowed_email: {
        Row: AllowedEmailRow
        Insert: AllowedEmailInsert
        Update: AllowedEmailUpdate
        Relationships: []
      }
      app_user: {
        Row: AppUserRow
        Insert: {
          id?: string
          auth_uid: string
          email: string
          display_name?: string | null
          role?: AppUserRole
          created_at?: string
        }
        Update: Partial<AppUserRow>
        Relationships: []
      }
      audit_allowlist: {
        Row: AuditAllowlistRow
        Insert: AuditAllowlistInsert
        Update: Partial<AuditAllowlistRow>
        Relationships: [
          {
            foreignKeyName: 'audit_allowlist_staff_user_id_fkey'
            columns: ['staff_user_id']
            referencedRelation: 'app_user'
            referencedColumns: ['id']
          },
        ]
      }
    }
    Views: Record<string, never>
    Functions: Record<string, never>
    Enums: Record<string, never>
    CompositeTypes: Record<string, never>
  }
}
