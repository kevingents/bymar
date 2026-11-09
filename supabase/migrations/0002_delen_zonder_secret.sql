-- Delen zonder service-sleutel: de deellink leest via security-definer functies
-- die altijd zelf op share_token + share_enabled filteren.

create or replace function public.is_shared_project(p_id text) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.projects p
    where p.id::text = p_id and p.share_enabled and p.share_token is not null
  );
$$;

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
      'shopping', proj.shopping, 'updated_at', proj.updated_at
    ),
    'images', coalesce((
      select jsonb_agg(jsonb_build_object('id', i.id, 'kind', i.kind, 'prompt', i.prompt, 'path', i.path, 'source_path', i.source_path, 'created_at', i.created_at) order by i.created_at desc)
      from (select * from public.project_images where project_id = proj.id order by created_at desc limit 60) i
    ), '[]'::jsonb),
    'builds', coalesce((
      select jsonb_agg(jsonb_build_object('id', b.id, 'title', b.title, 'request', b.request, 'data', b.data, 'image_path', b.image_path, 'created_at', b.created_at) order by b.created_at desc)
      from public.builds b where b.project_id = proj.id
    ), '[]'::jsonb),
    'comments', coalesce((
      select jsonb_agg(jsonb_build_object('id', c.id, 'author_name', c.author_name, 'body', c.body, 'created_at', c.created_at) order by c.created_at)
      from public.comments c where c.project_id = proj.id
    ), '[]'::jsonb)
  );
end;
$$;

create or replace function public.add_shared_comment(p_token text, p_name text, p_body text) returns jsonb
language plpgsql volatile security definer set search_path = '' as $$
declare
  pid uuid;
  n int;
  row public.comments;
begin
  p_name := left(btrim(coalesce(p_name, '')), 60);
  p_body := left(btrim(coalesce(p_body, '')), 2000);
  if p_name = '' or p_body = '' then
    raise exception 'Vul je naam en een reactie in.' using errcode = '22023';
  end if;
  select id into pid from public.projects where share_token = p_token and share_enabled;
  if pid is null then
    raise exception 'Deze link werkt niet (meer).' using errcode = 'P0002';
  end if;
  select count(*) into n from public.comments where project_id = pid;
  if n >= 500 then
    raise exception 'Er kunnen geen reacties meer bij.' using errcode = '54000';
  end if;
  insert into public.comments (project_id, author_name, body) values (pid, p_name, p_body) returning * into row;
  return jsonb_build_object('id', row.id, 'author_name', row.author_name, 'body', row.body, 'created_at', row.created_at);
end;
$$;

revoke all on function public.shared_project(text) from public;
revoke all on function public.add_shared_comment(text, text, text) from public;
revoke all on function public.is_shared_project(text) from public;
grant execute on function public.shared_project(text) to anon, authenticated;
grant execute on function public.add_shared_comment(text, text, text) to anon, authenticated;
grant execute on function public.is_shared_project(text) to anon, authenticated;

-- Foto's van gedeelde projecten mogen (via ondertekende URL) gelezen worden.
create policy "gedeelde bestanden lezen" on storage.objects
  for select to anon, authenticated
  using (bucket_id = 'huisraad' and public.is_shared_project((storage.foldername(name))[2]));
