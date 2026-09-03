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
