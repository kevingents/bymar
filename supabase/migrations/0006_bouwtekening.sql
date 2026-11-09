-- Bouwtekening (exploded view) bij een bouwplan.
alter table public.builds add column diagram_path text;
alter table public.project_images drop constraint project_images_kind_check;
alter table public.project_images add constraint project_images_kind_check
  check (kind in ('generated', 'restyle', 'upload', 'progress', 'build', 'render', 'moodboard', 'diagram'));

-- Deelweergave: bouwplannen met bouwtekening; bouwtekeningen niet tussen de beelden.
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
      from (select * from public.project_images where project_id = proj.id and kind not in ('moodboard', 'diagram') order by created_at desc limit 80) i
    ), '[]'::jsonb),
    'builds', coalesce((
      select jsonb_agg(jsonb_build_object('id', b.id, 'title', b.title, 'request', b.request, 'data', b.data,
                                          'image_path', b.image_path, 'diagram_path', b.diagram_path, 'created_at', b.created_at) order by b.created_at desc)
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
