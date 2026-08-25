-- SEO Content Studio - fila persistente + pausa/retomada
-- Execute UMA VEZ no SQL Editor do Supabase antes de publicar esta versão.

alter table public.article_jobs
  add column if not exists pause_requested boolean not null default false;

alter table public.article_jobs
  add column if not exists paused_at timestamptz;

-- Atualiza a validação de status para aceitar gerações pausadas.
alter table public.article_jobs
  drop constraint if exists article_jobs_status_check;

alter table public.article_jobs
  add constraint article_jobs_status_check
  check (status in ('queued','processing','paused','completed','completed_with_errors','failed'));

create index if not exists article_jobs_status_created_at_idx
  on public.article_jobs(status, created_at asc);
