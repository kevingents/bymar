import { createImage } from "@/lib/ai";
import { BUCKET, inProject, requireProject } from "@/lib/supabase/server";
import { guardAi } from "@/lib/usage";

export const maxDuration = 120;

type Body = {
  prompt?: string;
  sourcePath?: string | null;
  kind?: "generated" | "restyle" | "build" | "render";
  buildId?: string;
};

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const ctx = await requireProject(id);
  if ("error" in ctx) return ctx.error;
  const { sb, user, project } = ctx;

  const body = (await req.json()) as Body;
  const prompt = body.prompt?.trim();
  if (!prompt) return Response.json({ error: "Beschrijf wat je wilt zien." }, { status: 400 });

  let source: { data: Uint8Array; mediaType: string } | undefined;
  if (body.sourcePath) {
    if (!inProject(body.sourcePath, project.id)) {
      return Response.json({ error: "Deze foto hoort niet bij dit project." }, { status: 403 });
    }
    const { data: blob, error } = await sb.storage.from(BUCKET).download(body.sourcePath);
    if (error || !blob) return Response.json({ error: "De foto kon niet worden geladen." }, { status: 400 });
    source = { data: new Uint8Array(await blob.arrayBuffer()), mediaType: blob.type || "image/jpeg" };
  }

  if (body.kind === "render" && !source) return Response.json({ error: "Geen 3D-beeld ontvangen." }, { status: 400 });
  const limited = await guardAi(sb, "image");
  if (limited) return limited;

  const styleHint = [project.style && `stijl ${project.style}`, project.room_type && `ruimte: ${project.room_type}`]
    .filter(Boolean)
    .join(", ");

  try {
    const image = await createImage({
      prompt: styleHint ? `${prompt} (${styleHint})` : prompt,
      source,
      mode: body.kind === "render" ? "render" : undefined,
    });
    const ext = image.mediaType.split("/")[1]?.replace("jpeg", "jpg") ?? "png";
    const path = `${user.id}/${project.id}/${crypto.randomUUID()}.${ext}`;
    const up = await sb.storage.from(BUCKET).upload(path, image.data, { contentType: image.mediaType });
    if (up.error) throw up.error;

    const kind = body.kind ?? (source ? "restyle" : "generated");
    const { data: row, error } = await sb
      .from("project_images")
      .insert({ project_id: project.id, kind, prompt, source_path: body.sourcePath ?? null, path })
      .select("*")
      .single();
    if (error) throw error;

    if (kind === "build" && body.buildId) {
      await sb.from("builds").update({ image_path: path }).eq("id", body.buildId);
    }
    if (!project.cover_path) {
      await sb.from("projects").update({ cover_path: path }).eq("id", project.id);
    }
    return Response.json({ image: row });
  } catch (e) {
    console.error("beeld genereren mislukt", e);
    const message = e instanceof Error ? e.message : "Onbekende fout";
    return Response.json({ error: `Het beeld kon niet worden gemaakt: ${message}` }, { status: 502 });
  }
}
