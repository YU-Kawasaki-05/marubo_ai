-- BE-17: usage_counters + rate_limiter テーブル
-- レート制限（分間）と月間クォータ管理用

-- 利用カウンタ（クォータ/レート制限用）
create table if not exists usage_counters (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references app_user(id) on delete cascade,
  day date not null,
  questions int not null default 0 check (questions >= 0),
  tokens_in int not null default 0 check (tokens_in >= 0),
  tokens_out int not null default 0 check (tokens_out >= 0),
  created_at timestamptz default now(),
  unique(user_id, day)
);

create index if not exists idx_usage_user_day on usage_counters(user_id, day desc);

-- レート制限（N リクエスト / window）
create table if not exists rate_limiter (
  key text not null,
  window_start timestamptz not null,
  count int not null default 0 check (count >= 0),
  primary key (key, window_start)
);

create index if not exists idx_rate_limiter_key on rate_limiter(key);
