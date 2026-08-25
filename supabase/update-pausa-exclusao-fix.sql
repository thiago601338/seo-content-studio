-- SEO Content Studio - correção de pausa imediata e execuções antigas
-- Execute UMA VEZ no SQL Editor do Supabase antes de publicar esta versão.

alter table public.article_jobs
  add column if not exists run_version integer not null default 0;

-- Corrige gerações que ficaram presas em "Pausando" na versão anterior.
-- Ao incrementar run_version, qualquer worker antigo deixa de ser válido.
update public.article_jobs
set
  status = 'paused',
  pause_requested = false,
  paused_at = coalesce(paused_at, now()),
  run_version = coalesce(run_version, 0) + 1
where status in ('queued', 'processing')
  and pause_requested = true;
