-- Huisraad: projecten, beelden, adviesgesprekken, bouwplannen, reacties.
-- Alles is per eigenaar afgeschermd met row level security.
-- Delen loopt via de server (service role) op basis van een geheime share_token.

create extension if not exists pgcrypto;

-- Projecten -----------------------------------------------------------------
create table public.projects (
  id            uuid primary key default gen_random_uuid(),
  owner_id      uuid not null default auth.uid() references auth.users (id) on delete cascade,
  title         text not null,
  room_type     text,
  style         text,
  budget        numeric,
  description   text,
  cover_path    text,
  floorplan     jsonb,
  shopping      jsonb not null default '[]'::jsonb,
  share_enabled boolean not null default false,
  share_token   text unique,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);
create index projects_owner_idx on public.projects (owner_id, updated_at desc);

-- Beelden (AI-gegenereerd, restyle van eigen foto, upload, voortgang, bouwresultaat)
create table public.project_images (
  id          uuid primary key default gen_random_uuid(),
  project_id  uuid not null references public.projects (id) on delete cascade,
  owner_id    uuid not null default auth.uid() references auth.users (id) on delete cascade,
  kind        text not null check (kind in ('generated', 'restyle', 'upload', 'progress', 'build')),
  prompt      text,
  source_path text,
  path        text not null,
  created_at  timestamptz not null default now()
);
create index project_images_project_idx on public.project_images (project_id, created_at desc);

-- Adviesgesprek -------------------------------------------------------------
create table public.messages (
  id          uuid primary key default gen_random_uuid(),
  project_id  uuid not null references public.projects (id) on delete cascade,
  owner_id    uuid not null default auth.uid() references auth.users (id) on delete cascade,
  role        text not null check (role in ('user', 'assistant')),
  content     text not null,
  image_path  text,
  created_at  timestamptz not null default now()
);
create index messages_project_idx on public.messages (project_id, created_at);

-- Zelf maken: bouwplannen van A tot Z ---------------------------------------
create table public.builds (
  id          uuid primary key default gen_random_uuid(),
  project_id  uuid not null references public.projects (id) on delete cascade,
  owner_id    uuid not null default auth.uid() references auth.users (id) on delete cascade,
  title       text not null,
  request     text not null,
  data        jsonb not null,
  progress    jsonb not null default '{}'::jsonb,
  image_path  text,
  created_at  timestamptz not null default now()
);
create index builds_project_idx on public.builds (project_id, created_at desc);

-- Reacties via de deellink --------------------------------------------------
create table public.comments (
  id          uuid primary key default gen_random_uuid(),
  project_id  uuid not null references public.projects (id) on delete cascade,
  author_name text not null,
  body        text not null,
  created_at  timestamptz not null default now()
);
create index comments_project_idx on public.comments (project_id, created_at);

-- updated_at bijhouden ------------------------------------------------------
create or replace function public.touch_updated_at() returns trigger
language plpgsql set search_path = '' as $$
begin
  new.updated_at := now();
  return new;
end;
$$;
create trigger projects_touch before update on public.projects
  for each row execute function public.touch_updated_at();

-- Row level security --------------------------------------------------------
alter table public.projects       enable row level security;
alter table public.project_images enable row level security;
alter table public.messages       enable row level security;
alter table public.builds         enable row level security;
alter table public.comments       enable row level security;

create policy "eigen projecten" on public.projects
  for all to authenticated
  using (owner_id = (select auth.uid()))
  with check (owner_id = (select auth.uid()));

create policy "eigen beelden" on public.project_images
  for all to authenticated
  using (owner_id = (select auth.uid()))
  with check (
    owner_id = (select auth.uid())
    and exists (select 1 from public.projects p where p.id = project_id and p.owner_id = (select auth.uid()))
  );

create policy "eigen berichten" on public.messages
  for all to authenticated
  using (owner_id = (select auth.uid()))
  with check (
    owner_id = (select auth.uid())
    and exists (select 1 from public.projects p where p.id = project_id and p.owner_id = (select auth.uid()))
  );

create policy "eigen bouwplannen" on public.builds
  for all to authenticated
  using (owner_id = (select auth.uid()))
  with check (
    owner_id = (select auth.uid())
    and exists (select 1 from public.projects p where p.id = project_id and p.owner_id = (select auth.uid()))
  );

-- Reacties: eigenaar van het project mag lezen en verwijderen.
-- Plaatsen gaat via de server-route met service role (deellink).
create policy "reacties lezen" on public.comments
  for select to authenticated
  using (exists (select 1 from public.projects p where p.id = project_id and p.owner_id = (select auth.uid())));
create policy "reacties verwijderen" on public.comments
  for delete to authenticated
  using (exists (select 1 from public.projects p where p.id = project_id and p.owner_id = (select auth.uid())));

-- Opslag: privé bucket, elk bestand onder <user-id>/... ---------------------
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('huisraad', 'huisraad', false, 15728640, array['image/png', 'image/jpeg', 'image/webp', 'image/heic'])
on conflict (id) do nothing;

create policy "eigen bestanden lezen" on storage.objects
  for select to authenticated
  using (bucket_id = 'huisraad' and (storage.foldername(name))[1] = (select auth.uid())::text);
create policy "eigen bestanden schrijven" on storage.objects
  for insert to authenticated
  with check (bucket_id = 'huisraad' and (storage.foldername(name))[1] = (select auth.uid())::text);
create policy "eigen bestanden wijzigen" on storage.objects
  for update to authenticated
  using (bucket_id = 'huisraad' and (storage.foldername(name))[1] = (select auth.uid())::text);
create policy "eigen bestanden verwijderen" on storage.objects
  for delete to authenticated
  using (bucket_id = 'huisraad' and (storage.foldername(name))[1] = (select auth.uid())::text);
