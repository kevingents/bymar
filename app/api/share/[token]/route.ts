import { BUCKET, supabasePublic } from "@/lib/supabase/server";

type SharedData = {
  project: { cover_path: string | null } & Record<string, unknown>;
  images: { path: string; source_path: string | null }[];
  builds: { image_path: string | null }[];
  moodboard?: { image_path: string | null }[];
  comments: unknown[];
};

/** Openbare weergave van een gedeeld project. De databasefunctie checkt token en share_enabled. */
export async function GET(_req: Request, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const sb = supabasePublic();
  const { data, error } = await sb.rpc("shared_project", { p_token: token });
  if (error) console.error("deellink laden mislukt", error);
  const shared = data as SharedData | null;
  if (!shared) return Response.json({ error: "Deze link werkt niet (meer)." }, { status: 404 });

  const paths = [
    shared.project.cover_path,
    ...shared.images.flatMap((i) => [i.path, i.source_path]),
    ...shared.builds.map((b) => b.image_path),
    ...(shared.moodboard ?? []).map((m) => m.image_path),
  ].filter((p): p is string => !!p);
  const urls: Record<string, string> = {};
  if (paths.length) {
    const { data: signed } = await sb.storage.from(BUCKET).createSignedUrls([...new Set(paths)], 3600);
    for (const row of signed ?? []) if (row.path && row.signedUrl) urls[row.path] = row.signedUrl;
  }

  return Response.json({ ...shared, urls });
}
