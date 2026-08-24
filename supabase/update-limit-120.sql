-- Execute uma vez no SQL Editor do Supabase se o projeto já estava instalado.
alter table public.article_jobs drop constraint if exists article_jobs_quantity_check;
alter table public.article_jobs add constraint article_jobs_quantity_check check (quantity between 1 and 120);
