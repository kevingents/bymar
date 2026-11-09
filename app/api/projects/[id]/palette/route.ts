import { generateText, Output } from "ai";
import { BASE_SYSTEM, TEXT_MODEL, projectContext } from "@/lib/ai";
import { PaletteSchema } from "@/lib/schemas";
import { BUCKET, inProject, requireProject } from "@/lib/supabase/server";
import { guardAi } from "@/lib/usage";

export const maxDuration = 120;

/** Maakt een kleurpalet uit een foto (of uit de projectstijl) met verfkleur-suggesties. */
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const ctx = await requireProject(id);
  if ("error" in ctx) return ctx.error;
  const { sb, project } = ctx;

  const { imagePath, wish } = (await req.json()) as { imagePath?: string | null; wish?: string };
  let file: { data: Uint8Array; mediaType: string } | null = null;
  if (imagePath) {
    if (!inProject(imagePath, project.id)) return Response.json({ error: "Deze foto hoort niet bij dit project." }, { status: 403 });
    const { data: blob } = await sb.storage.from(BUCKET).download(imagePath);
    if (!blob) return Response.json({ error: "De foto kon niet worden geladen." }, { status: 400 });
    file = { data: new Uint8Array(await blob.arrayBuffer()), mediaType: blob.type || "image/jpeg" };
  }

  const limited = await guardAi(sb, "text");
  if (limited) return limited;

  try {
    const ask = file
      ? "Haal uit deze foto een kleurpalet van 5 tot 6 kleuren dat de sfeer vangt."
      : "Stel een kleurpalet van 5 tot 6 kleuren voor dat bij dit project past.";
    const { output } = await generateText({
      model: TEXT_MODEL,
      reasoning: "low",
      maxOutputTokens: 4000,
      output: Output.object({ schema: PaletteSchema }),
      system: `${BASE_SYSTEM}\n\nJe bent kleurexpert. Geef per kleur een exacte hex-waarde, een Nederlandse naam, waar je hem gebruikt en een verfkleur van een merk dat in Nederland te koop is (Flexa, Histor, Sikkens, Farrow & Ball, Little Greene) die er dichtbij zit. Zeg erbij dat het een suggestie is als je het niet zeker weet.`,
      messages: [
        {
          role: "user",
          content: [
            ...(file ? [{ type: "file" as const, data: file.data, mediaType: file.mediaType }] : []),
            { type: "text" as const, text: `${projectContext(project)}\n\n${ask}${wish?.trim() ? `\nWens: ${wish.trim()}` : ""}` },
          ],
        },
      ],
    });
    const palette = { id: crypto.randomUUID(), ...output, source_path: imagePath ?? null, created_at: new Date().toISOString() };
    const palettes = [palette, ...((project.palettes as unknown[]) ?? [])];
    await sb.from("projects").update({ palettes }).eq("id", project.id);
    return Response.json({ palette, palettes });
  } catch (e) {
    console.error("palet mislukt", e);
    return Response.json({ error: "Het kleurpalet kon niet worden gemaakt." }, { status: 502 });
  }
}
