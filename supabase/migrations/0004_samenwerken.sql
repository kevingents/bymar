-- Samenwerken: meerdere mensen in één project, via een uitnodigingslink.

create table public.project_members (
  project_id uuid not null references public.projects (id) on delete cascade,
  user_id    uuid not null references auth.users (id) on delete cascade,
  email      text,
  created_at timestamptz not null default now(),
  primary key (project_id, user_id)
);
alter table public.project_members enable row level security;

alter table public.projects add column invite_token text unique;

/** Mag de huidige gebruiker bij dit project? Eigenaar of lid. */
create or replace function public.can_access(p uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.projects where id = p and owner_id = auth.uid())
      or exists (select 1 from public.project_members where project_id = p and user_id = auth.uid());
$$;
revoke all on function public.can_access(uuid) from public;
grant execute on function public.can_access(uuid) to authenticated;

create or replace function public.can_access_text(p text) returns boolean
language plpgsql stable security definer set search_path = '' as $$
begin
  return public.can_access(p::uuid);
exception when others then
  return false;
end;
$$;
revoke all on function public.can_access_text(text) from public;
grant execute on function public.can_access_text(text) to authenticated;

-- Leden: iedereen in het project ziet wie er meedoet; eigenaar mag verwijderen, lid mag zelf vertrekken.
create policy "leden zien" on public.project_members
  for select to authenticated using (public.can_access(project_id));
create policy "leden verwijderen" on public.project_members
  for delete to authenticated
  using (user_id = (select auth.uid()) or exists (select 1 from public.projects p where p.id = project_id and p.owner_id = (select auth.uid())));

-- Uitnodiging accepteren via de geheime invite_token.
create or replace function public.accept_invite(p_token text) returns uuid
language plpgsql volatile security definer set search_path = '' as $$
declare
  pid uuid;
  owner uuid;
begin
  if auth.uid() is null then
    raise exception 'Niet ingelogd' using errcode = '28000';
  end if;
  select id, owner_id into pid, owner from public.projects where invite_token = p_token;
  if pid is null then
    raise exception 'Deze uitnodiging werkt niet (meer).' using errcode = 'P0002';
  end if;
  if owner <> auth.uid() then
    insert into public.project_members (project_id, user_id, email)
    values (pid, auth.uid(), auth.jwt() ->> 'email')
    on conflict do nothing;
  end if;
  return pid;
end;
$$;
revoke all on function public.accept_invite(text) from public;
grant execute on function public.accept_invite(text) to authenticated;

-- Projecten: leden mogen lezen en bewerken; alleen de eigenaar mag verwijderen of aanmaken op eigen naam.
drop policy "eigen projecten" on public.projects;
create policy "projecten lezen" on public.projects
  for select to authenticated using (owner_id = (select auth.uid()) or public.can_access(id));
create policy "projecten maken" on public.projects
  for insert to authenticated with check (owner_id = (select auth.uid()));
create policy "projecten bewerken" on public.projects
  for update to authenticated using (public.can_access(id)) with check (public.can_access(id));
create policy "projecten verwijderen" on public.projects
  for delete to authenticated using (owner_id = (select auth.uid()));

-- Onderdelen van een project: iedereen met toegang.
drop policy "eigen beelden" on public.project_images;
create policy "beelden in project" on public.project_images
  for all to authenticated
  using (public.can_access(project_id))
  with check (public.can_access(project_id));

drop policy "eigen berichten" on public.messages;
create policy "berichten in project" on public.messages
  for all to authenticated
  using (public.can_access(project_id))
  with check (public.can_access(project_id));

drop policy "eigen bouwplannen" on public.builds;
create policy "bouwplannen in project" on public.builds
  for all to authenticated
  using (public.can_access(project_id))
  with check (public.can_access(project_id));

drop policy "eigen moodboard" on public.moodboard_items;
create policy "moodboard in project" on public.moodboard_items
  for all to authenticated
  using (public.can_access(project_id))
  with check (public.can_access(project_id));

drop policy "reacties lezen" on public.comments;
drop policy "reacties verwijderen" on public.comments;
create policy "reacties lezen" on public.comments for select to authenticated using (public.can_access(project_id));
create policy "reacties verwijderen" on public.comments for delete to authenticated using (public.can_access(project_id));

drop policy "stemmen op eigen beelden lezen" on public.image_votes;
create policy "stemmen lezen" on public.image_votes
  for select to authenticated
  using (exists (select 1 from public.project_images i where i.id = image_id and public.can_access(i.project_id)));

-- Opslag: bestanden staan onder <maker>/<project>/...; iedereen in het project mag ze lezen en opruimen.
create policy "projectbestanden lezen" on storage.objects
  for select to authenticated
  using (bucket_id = 'huisraad' and public.can_access_text((storage.foldername(name))[2]));
create policy "projectbestanden verwijderen" on storage.objects
  for delete to authenticated
  using (bucket_id = 'huisraad' and public.can_access_text((storage.foldername(name))[2]));

-- Live bijwerken voor wie tegelijk in een project zit.
alter publication supabase_realtime add table public.projects;
