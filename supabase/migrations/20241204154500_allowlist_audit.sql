-- Allowlist and audit log tables
-- This migration can be applied via `supabase db push` or `supabase db reset`

create extension if not exists "pgcrypto";

create table if not exists app_user (
  id uuid primary key default gen_random_uuid(),
  auth_uid uuid not null unique,
  email text not null unique,
  display_name text,
  role text not null default 'student' check (role in ('student','staff')),
  created_at timestamptz not null default now(),
  constraint app_user_email_lowercase check (email = lower(email))
);

create table if not exists allowed_email (
  email text primary key,
  status text not null check (status in ('active','pending','revoked')),
  label text,
  invited_at timestamptz,
  expires_at timestamptz,
  notes text,
  created_by uuid references app_user(id) on delete set null,
  updated_by uuid references app_user(id) on delete set null,
  updated_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  constraint allowed_email_lowercase check (email = lower(email))
);

create index if not exists idx_allowed_email_status on allowed_email(status);

create table if not exists audit_allowlist (
  id uuid primary key default gen_random_uuid(),
  request_id text not null,
  email text not null references allowed_email(email) on delete cascade,
  prev jsonb,
  next jsonb,
  operation text not null check (operation in ('insert','update','csv-import')),
  staff_user_id uuid not null references app_user(id) on delete cascade,
  created_at timestamptz not null default now()
);

create index if not exists idx_audit_allowlist_email_created
  on audit_allowlist(email, created_at desc);
