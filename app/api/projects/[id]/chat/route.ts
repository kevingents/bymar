import { streamText, type ModelMessage } from "ai";
import { BASE_SYSTEM, TEXT_MODEL, projectContext } from "@/lib/ai";
import { floorplanSummary } from "@/lib/floorplan";
import { BUCKET, requireProject } from "@/lib/supabase/server";
import { guardAi } from "@/lib/usage";
import type { ChatMessage } from "@/lib/types";

export const maxDuration = 120;

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const ctx = await requireProject(id);
  if ("error" in ctx) return ctx.error;
  const { sb, user, project } = ctx;

  const { message, imagePath } = (await req.json()) as { message?: string; imagePath?: string | null };
  const text = message?.trim();
  if (!text) return Response.json({ error: "Leeg bericht." }, { status: 400 });
  if (imagePath && !imagePath.startsWith(`${user.id}/`)) {
    return Response.json({ error: "Deze foto hoort niet bij jouw account." }, { status: 403 });
  }

  const limited = await guardAi(sb, "text");
  if (limited) return limited;

  const { data: history } = await sb
    .from("messages")
    .select("*")
    .eq("project_id", project.id)
    .order("created_at", { ascending: false })
    .limit(30);

  const { error: insertError } = await sb
    .from("messages")
    .insert({ project_id: project.id, role: "user", content: text, image_path: imagePath ?? null });
  if (insertError) return Response.json({ error: "Bericht kon niet worden opgeslagen." }, { status: 500 });

  const messages: ModelMessage[] = ((history ?? []) as ChatMessage[])
    .reverse()
    .map((m) => ({ role: m.role, content: m.content }));

  if (imagePath) {
    const { data: blob } = await sb.storage.from(BUCKET).download(imagePath);
    if (blob) {
      messages.push({
        role: "user",
        content: [
          { type: "file", data: new Uint8Array(await blob.arrayBuffer()), mediaType: blob.type || "image/jpeg" },
          { type: "text", text },
        ],
      });
    } else {
      messages.push({ role: "user", content: text });
    }
  } else {
    messages.push({ role: "user", content: text });
  }

  const plan = floorplanSummary(project.floorplan);
  const system = `${BASE_SYSTEM}\n\nDit is het project waar je over adviseert:\n${projectContext(project)}${
    plan ? `\n\nPlattegrond:\n${plan}` : ""
  }`;

  const result = streamText({
    model: TEXT_MODEL,
    system,
    messages,
    reasoning: "low",
    maxOutputTokens: 8000,
    onError({ error }) {
      console.error("advies mislukt", error);
    },
    async onFinish({ text: answer }) {
      if (answer.trim()) {
        await sb.from("messages").insert({ project_id: project.id, role: "assistant", content: answer });
      }
    },
  });

  return result.toTextStreamResponse();
}
