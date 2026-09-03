begin;

alter table public.articles
  add column if not exists run_version integer not null default 0,
  add column if not exists paused_at timestamptz,
  add column if not exists generation_plan jsonb not null default '{}'::jsonb;

alter table public.articles drop constraint if exists articles_status_check;
alter table public.articles
  add constraint articles_status_check
  check (status in ('queued','processing','paused','completed','error','cancelled'));

create index if not exists idx_articles_user_status_created
  on public.articles(user_id, status, created_at);

commit;
