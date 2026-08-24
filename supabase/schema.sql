-- SEO Content Studio - Supabase
-- Execute este arquivo uma única vez no SQL Editor do Supabase.

create extension if not exists pgcrypto;

create table if not exists public.article_jobs (
  id uuid primary key default gen_random_uuid(),
  quantity integer not null check (quantity between 1 and 20),
  keyword text not null,
  link_url text not null,
  create_cover boolean not null default true,
  keyword_in_title boolean not null default true,
  status text not null default 'queued' check (status in ('queued','processing','completed','completed_with_errors','failed')),
  completed_count integer not null default 0,
  failed_count integer not null default 0,
  error_message text,
  created_at timestamptz not null default now(),
  started_at timestamptz,
  completed_at timestamptz
);

create table if not exists public.articles (
  id uuid primary key default gen_random_uuid(),
  job_id uuid references public.article_jobs(id) on delete set null,
  title text not null,
  slug text not null,
  keyword text not null,
  link_url text not null,
  meta_description text,
  excerpt text,
  html_content text not null,
  plain_text text,
  cover_image_url text,
  cover_image_path text,
  word_count integer not null default 0,
  created_at timestamptz not null default now()
);

create index if not exists articles_created_at_idx on public.articles(created_at desc);
create index if not exists articles_keyword_idx on public.articles(keyword);
create index if not exists article_jobs_created_at_idx on public.article_jobs(created_at desc);

alter table public.article_jobs enable row level security;
alter table public.articles enable row level security;

-- Nenhum acesso direto pelo navegador. Todo acesso passa pelas Netlify Functions
-- usando a Secret Key do Supabase, que fica somente no backend.
revoke all on table public.article_jobs from anon, authenticated;
revoke all on table public.articles from anon, authenticated;
grant all on table public.article_jobs to service_role;
grant all on table public.articles to service_role;

-- Bucket público somente para leitura das imagens já geradas.
-- Upload e exclusão continuam sendo feitos exclusivamente pelo backend.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'article-images',
  'article-images',
  true,
  10485760,
  array['image/webp','image/png','image/jpeg']
)
on conflict (id) do update set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;
