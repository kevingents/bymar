-- Uitbreidingen: AI-limieten, shop the look, kleurpaletten, moodboard, stemmen, 3D-renders.

-- Instellingen per gebruiker ------------------------------------------------
create table public.user_settings (
  user_id           uuid primary key default auth.uid() references auth.users (id) on delete cascade,
  daily_image_limit int not null default 40 check (daily_image_limit between 0 and 500),
  daily_text_limit  int not null default 150 check (daily_text_limit between 0 and 2000),
  updated_at        timestamptz not null default now()
);
alter table public.user_settings enable row level security;
create policy "eigen instellingen" on public.user_settings
  for all to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

-- AI-gebruik per dag ---------------------------------------------------------
create table public.ai_usage (
  user_id uuid not null references auth.users (id) on delete cascade,
  day     date not null default (now() at time zone 'Europe/Amsterdam')::date,
  images  int not null default 0,
  texts   int not null default 0,
  primary key (user_id, day)
);
alter table public.ai_usage enable row level security;
create policy "eigen gebruik lezen" on public.ai_usage
  for select to authenticated using (user_id = (select auth.uid()));

/** Telt één AI-aanroep op en weigert als de daglimiet bereikt is. */
create or replace function public.use_ai(p_kind text) returns jsonb
language plpgsql volatile security definer set search_path = '' as $$
declare
  uid uuid := auth.uid();
  today date := (now() at time zone 'Europe/Amsterdam')::date;
  lim_img int;
  lim_txt int;
  cur public.ai_usage;
begin
  if uid is null then
    raise exception 'Niet ingelogd' using errcode = '28000';
  end if;
  if p_kind not in ('image', 'text') then
    raise exception 'Onbekend soort' using errcode = '22023';
  end if;
  select coalesce(s.daily_image_limit, 40), coalesce(s.daily_text_limit, 150)
    into lim_img, lim_txt
    from (select 1) x left join public.user_settings s on s.user_id = uid;
  insert into public.ai_usage (user_id, day) values (uid, today) on conflict do nothing;
  select * into cur from public.ai_usage where user_id = uid and day = today for update;
  if p_kind = 'image' and cur.images >= lim_img then
    return jsonb_build_object('ok', false, 'kind', p_kind, 'used', cur.images, 'limit', lim_img);
  end if;
  if p_kind = 'text' and cur.texts >= lim_txt then
    return jsonb_build_object('ok', false, 'kind', p_kind, 'used', cur.texts, 'limit', lim_txt);
  end if;
  update public.ai_usage
     set images = images + (case when p_kind = 'image' then 1 else 0 end),
         texts  = texts  + (case when p_kind = 'text'  then 1 else 0 end)
   where user_id = uid and day = today
   returning * into cur;
  return jsonb_build_object('ok', true, 'kind', p_kind, 'used', case when p_kind = 'image' then cur.images else cur.texts end,
                            'limit', case when p_kind = 'image' then lim_img else lim_txt end);
end;
$$;
revoke all on function public.use_ai(text) from public;
grant execute on function public.use_ai(text) to authenticated;

-- Beelden: shop the look + 3D-render als soort ------------------------------
alter table public.project_images add column shop jsonb;
alter table public.project_images drop constraint project_images_kind_check;
alter table public.project_images add constraint project_images_kind_check
  check (kind in ('generated', 'restyle', 'upload', 'progress', 'build', 'render', 'moodboard'));

-- Kleurpaletten op het project ----------------------------------------------
alter table public.projects add column palettes jsonb not null default '[]'::jsonb;

-- Moodboard ------------------------------------------------------------------
create table public.moodboard_items (
  id         uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects (id) on delete cascade,
  owner_id   uuid not null default auth.uid() references auth.users (id) on delete cascade,
  kind       text not null check (kind in ('image', 'link', 'color', 'note')),
  title      text,
  url        text,
  image_path text,
  image_url  text,
  color      text,
  note       text,
  created_at timestamptz not null default now()
);
create index moodboard_project_idx on public.moodboard_items (project_id, created_at desc);
alter table public.moodboard_items enable row level security;
create policy "eigen moodboard" on public.moodboard_items
  for all to authenticated
  using (owner_id = (select auth.uid()))
  with check (
    owner_id = (select auth.uid())
    and exists (select 1 from public.projects p where p.id = project_id and p.owner_id = (select auth.uid()))
  );

-- Stemmen op beelden via de deellink ----------------------------------------
create table public.image_votes (
  image_id   uuid not null references public.project_images (id) on delete cascade,
  voter      text not null check (length(voter) between 8 and 64),
  created_at timestamptz not null default now(),
  primary key (image_id, voter)
);
alter table public.image_votes enable row level security;
create policy "stemmen op eigen beelden lezen" on public.image_votes
  for select to authenticated
  using (exists (select 1 from public.project_images i where i.id = image_id and i.owner_id = (select auth.uid())));

create or replace function public.vote_shared_image(p_token text, p_image uuid, p_voter text, p_on boolean) returns int
language plpgsql volatile security definer set search_path = '' as $$
declare
  ok boolean;
  n int;
begin
  select exists (
    select 1 from public.project_images i join public.projects p on p.id = i.project_id
    where i.id = p_image and p.share_token = p_token and p.share_enabled
  ) into ok;
  if not ok then
    raise exception 'Deze link werkt niet (meer).' using errcode = 'P0002';
  end if;
  if p_on then
    insert into public.image_votes (image_id, voter) values (p_image, p_voter) on conflict do nothing;
  else
    delete from public.image_votes where image_id = p_image and voter = p_voter;
  end if;
  select count(*) into n from public.image_votes where image_id = p_image;
  return n;
end;
$$;
revoke all on function public.vote_shared_image(text, uuid, text, boolean) from public;
grant execute on function public.vote_shared_image(text, uuid, text, boolean) to anon, authenticated;

-- Deelweergave uitbreiden: stemmen, moodboard, paletten ----------------------
create or replace function public.shared_project(p_token text) returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare
  proj public.projects;
begin
  if p_token is null or length(p_token) < 20 then
    return null;
  end if;
  select * into proj from public.projects where share_token = p_token and share_enabled;
  if not found then
    return null;
  end if;
  return jsonb_build_object(
    'project', jsonb_build_object(
      'title', proj.title, 'room_type', proj.room_type, 'style', proj.style, 'budget', proj.budget,
      'description', proj.description, 'cover_path', proj.cover_path, 'floorplan', proj.floorplan,
      'shopping', proj.shopping, 'palettes', proj.palettes, 'updated_at', proj.updated_at
    ),
    'images', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', i.id, 'kind', i.kind, 'prompt', i.prompt, 'path', i.path, 'source_path', i.source_path,
        'created_at', i.created_at,
        'votes', (select count(*) from public.image_votes v where v.image_id = i.id)
      ) order by i.created_at desc)
      from (select * from public.project_images where project_id = proj.id and kind <> 'moodboard' order by created_at desc limit 80) i
    ), '[]'::jsonb),
    'builds', coalesce((
      select jsonb_agg(jsonb_build_object('id', b.id, 'title', b.title, 'request', b.request, 'data', b.data, 'image_path', b.image_path, 'created_at', b.created_at) order by b.created_at desc)
      from public.builds b where b.project_id = proj.id
    ), '[]'::jsonb),
    'moodboard', coalesce((
      select jsonb_agg(jsonb_build_object('id', m.id, 'kind', m.kind, 'title', m.title, 'url', m.url, 'image_path', m.image_path,
                                          'image_url', m.image_url, 'color', m.color, 'note', m.note) order by m.created_at desc)
      from public.moodboard_items m where m.project_id = proj.id
    ), '[]'::jsonb),
    'comments', coalesce((
      select jsonb_agg(jsonb_build_object('id', c.id, 'author_name', c.author_name, 'body', c.body, 'created_at', c.created_at) order by c.created_at)
      from public.comments c where c.project_id = proj.id
    ), '[]'::jsonb)
  );
end;
$$;
