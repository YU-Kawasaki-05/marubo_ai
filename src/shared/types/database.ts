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

export type AuditGrantAction = 'grant' | 'revoke'

export type AuditGrantRow = {
  id: string
  request_id: string
  operator_user_id: string
  target_user_id: string
  action: AuditGrantAction
  prev_role: string
  new_role: string
  created_at: string
}

export type AuditGrantInsert = Omit<AuditGrantRow, 'id' | 'created_at'> & {
  id?: string
  created_at?: string
}

export type MonthlyReportStatus = 'pending' | 'generating' | 'generated' | 'failed'

export type MonthlyReportRow = {
  id: string
  user_id: string
  month: string
  status: MonthlyReportStatus
  content: string | null
  stats: Json | null
  llm_model: string | null
  llm_tokens_in: number
  llm_tokens_out: number
  error_message: string | null
  generated_at: string | null
  created_at: string
}

export type MonthlyReportInsert = {
  id?: string
  user_id: string
  month: string
  status?: MonthlyReportStatus
  content?: string | null
  stats?: Json | null
  llm_model?: string | null
  llm_tokens_in?: number
  llm_tokens_out?: number
  error_message?: string | null
  generated_at?: string | null
  created_at?: string
}

export type MonthlyReportUpdate = Partial<Omit<MonthlyReportRow, 'id' | 'user_id' | 'month'>>

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
      audit_grant: {
        Row: AuditGrantRow
        Insert: AuditGrantInsert
        Update: Partial<AuditGrantRow>
        Relationships: [
          {
            foreignKeyName: 'audit_grant_operator_user_id_fkey'
            columns: ['operator_user_id']
            referencedRelation: 'app_user'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'audit_grant_target_user_id_fkey'
            columns: ['target_user_id']
            referencedRelation: 'app_user'
            referencedColumns: ['id']
          },
        ]
      }
      conversations: {
        Row: {
          id: string
          user_id: string
          title: string
          created_at: string
        }
        Insert: {
          id?: string
          user_id: string
          title: string
          created_at?: string
        }
        Update: Partial<{
          id: string
          user_id: string
          title: string
          created_at: string
        }>
        Relationships: []
      }
      messages: {
        Row: {
          id: string
          conversation_id: string
          role: 'user' | 'assistant'
          content: string
          created_at: string
        }
        Insert: {
          id?: string
          conversation_id: string
          role: 'user' | 'assistant'
          content: string
          created_at?: string
        }
        Update: Partial<{
          id: string
          conversation_id: string
          role: 'user' | 'assistant'
          content: string
          created_at: string
        }>
        Relationships: [
          {
            foreignKeyName: 'messages_conversation_id_fkey'
            columns: ['conversation_id']
            referencedRelation: 'conversations'
            referencedColumns: ['id']
          },
        ]
      }
      attachments: {
        Row: {
          id: string
          message_id: string
          user_id: string
          storage_path: string
          mime_type: string | null
          size_bytes: number | null
          created_at: string
        }
        Insert: {
          id?: string
          message_id: string
          user_id: string
          storage_path: string
          mime_type?: string | null
          size_bytes?: number | null
          created_at?: string
        }
        Update: Partial<{
          id: string
          message_id: string
          user_id: string
          storage_path: string
          mime_type: string | null
          size_bytes: number | null
          created_at: string
        }>
        Relationships: [
          {
            foreignKeyName: 'attachments_message_id_fkey'
            columns: ['message_id']
            referencedRelation: 'messages'
            referencedColumns: ['id']
          },
        ]
      }
      monthly_report: {
        Row: MonthlyReportRow
        Insert: MonthlyReportInsert
        Update: MonthlyReportUpdate
        Relationships: [
          {
            foreignKeyName: 'monthly_report_user_id_fkey'
            columns: ['user_id']
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
