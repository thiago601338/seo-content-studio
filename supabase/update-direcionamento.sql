-- Execute uma única vez no SQL Editor do Supabase se o projeto já existe.
-- Adiciona o campo que guarda o direcionamento editorial de cada lote.

alter table public.article_jobs
add column if not exists instructions text;
