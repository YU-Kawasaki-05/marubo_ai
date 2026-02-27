-- BE-13: audit_grant テーブル（スタッフ権限付与/解除の監査ログ）
create table if not exists audit_grant (
  id uuid primary key default gen_random_uuid(),
  request_id text not null,
  operator_user_id uuid not null references app_user(id) on delete cascade,
  target_user_id uuid not null references app_user(id) on delete cascade,
  action text not null check (action in ('grant', 'revoke')),
  prev_role text not null,
  new_role text not null,
  created_at timestamptz not null default now()
);

create index if not exists idx_audit_grant_target on audit_grant(target_user_id, created_at desc);

alter table audit_grant enable row level security;
-- ポリシーなし = anon/authenticated は全拒否。Service Role のみアクセス可。
