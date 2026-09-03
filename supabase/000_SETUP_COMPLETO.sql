-- REVISTA IDEAL IA STUDIO 3.0.1 - INSTALACAO COMPLETA / COMPATIVEL COM BANCO ANTIGO

-- Pode ser executado em projeto NOVO ou no Supabase usado pelo SEO Content Studio anterior.

-- Ele consolida as migrations 001, 002 e 003.

begin;

-- COMPATIBILIDADE COM O SEO CONTENT STUDIO ANTIGO
-- Se este Supabase ja tiver a tabela public.articles do sistema anterior
-- (que nao possuia user_id), ela e arquivada em vez de ser apagada.
do $$
declare
  suffix text := to_char(clock_timestamp(), 'YYYYMMDD_HH24MISS');
  legacy_articles_name text;
  legacy_jobs_name text;
  old_articles_detected boolean := false;
begin
  if to_regclass('public.articles') is not null
     and not exists (
       select 1
       from information_schema.columns
       where table_schema = 'public'
         and table_name = 'articles'
         and column_name = 'user_id'
     ) then
    legacy_articles_name := 'articles_legacy_' || suffix;
    execute format('alter table public.articles rename to %I', legacy_articles_name);
    old_articles_detected := true;
    raise notice 'Tabela antiga public.articles arquivada como public.%', legacy_articles_name;
  end if;

  -- O sistema antigo tambem usava article_jobs. O app novo nao usa esse nome,
  -- mas arquivamos junto para deixar claro que pertence ao sistema anterior.
  if old_articles_detected and to_regclass('public.article_jobs') is not null then
    legacy_jobs_name := 'article_jobs_legacy_' || suffix;
    execute format('alter table public.article_jobs rename to %I', legacy_jobs_name);
    raise notice 'Tabela antiga public.article_jobs arquivada como public.%', legacy_jobs_name;
  end if;
end $$;

create extension if not exists pgcrypto;

create or replace function public.set_updated_at()
returns trigger
language plpgsql
security invoker
set search_path = public
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create table if not exists public.sites (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  base_url text not null,
  wp_username text not null,
  default_category_id bigint,
  default_author_id bigint,
  metadata jsonb not null default '{}'::jsonb,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(user_id, base_url)
);

create table if not exists public.site_secrets (
  site_id uuid primary key references public.sites(id) on delete cascade,
  encrypted_app_password text not null,
  updated_at timestamptz not null default now()
);

create table if not exists public.presets (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  config jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(user_id, name)
);

create table if not exists public.batches (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null default 'Novo lote',
  config jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.articles (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  batch_id uuid references public.batches(id) on delete set null,
  site_id uuid not null references public.sites(id) on delete restrict,
  keyword text not null default '',
  target_url text not null default '',
  requested_title text not null default '',
  topic text not null default '',
  support_keywords text[] not null default '{}'::text[],
  outline jsonb not null default '{}'::jsonb,
  config jsonb not null default '{}'::jsonb,
  generated_title text,
  generated_html text,
  excerpt text,
  seo_title text,
  seo_description text,
  generated_tags jsonb not null default '[]'::jsonb,
  status text not null default 'queued' check (status in ('queued','processing','completed','error','cancelled')),
  progress smallint not null default 0 check (progress between 0 and 100),
  progress_label text not null default 'Na fila',
  error text,
  wp_post_id bigint,
  wp_post_url text,
  wp_featured_media_id bigint,
  scheduled_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_sites_user on public.sites(user_id);
create index if not exists idx_presets_user on public.presets(user_id);
create index if not exists idx_batches_user_created on public.batches(user_id, created_at desc);
create index if not exists idx_articles_user_created on public.articles(user_id, created_at desc);
create index if not exists idx_articles_status_created on public.articles(status, created_at);

alter table public.sites enable row level security;
alter table public.site_secrets enable row level security;
alter table public.presets enable row level security;
alter table public.batches enable row level security;
alter table public.articles enable row level security;

drop policy if exists "sites_own_rows" on public.sites;
create policy "sites_own_rows" on public.sites
  for all to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

drop policy if exists "presets_own_rows" on public.presets;
create policy "presets_own_rows" on public.presets
  for all to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

drop policy if exists "batches_own_rows" on public.batches;
create policy "batches_own_rows" on public.batches
  for all to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

drop policy if exists "articles_own_rows" on public.articles;
create policy "articles_own_rows" on public.articles
  for all to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- site_secrets e deliberadamente invisivel ao navegador.
revoke all on table public.site_secrets from anon, authenticated;
grant all on table public.site_secrets to service_role;

grant select, insert, update, delete on table public.sites to authenticated;
grant select, insert, update, delete on table public.presets to authenticated;
grant select, insert, update, delete on table public.batches to authenticated;
grant select, insert, update, delete on table public.articles to authenticated;

-- A role anon nao precisa acessar dados da aplicacao.
revoke all on table public.sites from anon;
revoke all on table public.presets from anon;
revoke all on table public.batches from anon;
revoke all on table public.articles from anon;

drop trigger if exists trg_sites_updated_at on public.sites;
create trigger trg_sites_updated_at before update on public.sites
for each row execute function public.set_updated_at();

drop trigger if exists trg_presets_updated_at on public.presets;
create trigger trg_presets_updated_at before update on public.presets
for each row execute function public.set_updated_at();

drop trigger if exists trg_batches_updated_at on public.batches;
create trigger trg_batches_updated_at before update on public.batches
for each row execute function public.set_updated_at();

drop trigger if exists trg_articles_updated_at on public.articles;
create trigger trg_articles_updated_at before update on public.articles
for each row execute function public.set_updated_at();


-- Habilita atualizacoes da fila em tempo real quando a publicacao existir.
do $$
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime')
     and not exists (
       select 1 from pg_publication_tables
       where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'articles'
     ) then
    alter publication supabase_realtime add table public.articles;
  end if;
end $$;

commit;


-- ============================================================
-- MIGRATION 002
-- ============================================================

begin;

-- Permite gerar artigos sem escolher WordPress.
alter table public.articles alter column site_id drop not null;

alter table public.articles
  add column if not exists publish_to_wordpress boolean not null default true,
  add column if not exists save_to_drive boolean not null default false,
  add column if not exists drive_file_id text,
  add column if not exists drive_doc_url text,
  add column if not exists cover_image_url text,
  add column if not exists generated_media jsonb not null default '[]'::jsonb;

create table if not exists public.drive_connections (
  user_id uuid primary key references auth.users(id) on delete cascade,
  email text,
  display_name text,
  encrypted_access_token text,
  encrypted_refresh_token text,
  token_expires_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.drive_oauth_states (
  state text primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  expires_at timestamptz not null,
  created_at timestamptz not null default now()
);

alter table public.drive_connections enable row level security;
alter table public.drive_oauth_states enable row level security;

-- Tokens OAuth ficam acessiveis somente ao backend com service_role.
revoke all on table public.drive_connections from anon, authenticated;
revoke all on table public.drive_oauth_states from anon, authenticated;
grant all on table public.drive_connections to service_role;
grant all on table public.drive_oauth_states to service_role;

drop trigger if exists trg_drive_connections_updated_at on public.drive_connections;
create trigger trg_drive_connections_updated_at before update on public.drive_connections
for each row execute function public.set_updated_at();

-- Bucket publico somente para as midias geradas pela propria aplicacao.
-- O upload continua restrito ao backend (service_role).
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'article-media',
  'article-media',
  true,
  20971520,
  array['image/png','image/jpeg','image/webp']
)
on conflict (id) do update set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

commit;


-- ============================================================
-- MIGRATION 003
-- ============================================================

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
