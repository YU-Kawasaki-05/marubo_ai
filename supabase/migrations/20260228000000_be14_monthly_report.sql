-- BE-14 Step1: monthly_report テーブル（LLM 分析結果 + 利用統計）
-- 仕様: docs/reports/monthly.md §7, docs/database.md §7

create table if not exists monthly_report (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references app_user(id) on delete cascade,
  month text not null,               -- 'YYYY-MM'
  status text not null default 'pending'
    check (status in ('pending', 'generating', 'generated', 'failed')),
  content text,                      -- LLM 生成の Markdown テキスト（レポート本文）
  stats jsonb,                       -- 利用統計 { questions, conversations, activeDays, mostActiveDay }
  llm_model text,                    -- 使用した LLM モデル名
  llm_tokens_in int default 0,       -- 入力トークン数（コスト追跡用）
  llm_tokens_out int default 0,      -- 出力トークン数（コスト追跡用）
  error_message text,                -- 失敗時のエラーメッセージ
  generated_at timestamptz,          -- 生成完了日時
  created_at timestamptz default now(),
  unique(user_id, month)
);

create index if not exists idx_monthly_report_month on monthly_report(month);
create index if not exists idx_monthly_report_user_month on monthly_report(user_id, month);

-- RLS: 生徒=自分のレポートのみ閲覧、スタッフ=全件閲覧。書込は Service Role のみ
alter table monthly_report enable row level security;

create policy monthly_report_select on monthly_report
for select to authenticated
using (
  exists (
    select 1 from app_user u
    where u.id = monthly_report.user_id
      and u.auth_uid = auth.uid()
  )
  or (auth.jwt() -> 'app_metadata' ->> 'role') = 'staff'
);
