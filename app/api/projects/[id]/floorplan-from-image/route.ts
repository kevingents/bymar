import { generateText, Output } from "ai";
import { TEXT_MODEL } from "@/lib/ai";
import { FloorplanFromImageSchema } from "@/lib/schemas";
import { BUCKET, inProject, requireProject } from "@/lib/supabase/server";
import { guardAi } from "@/lib/usage";

export const maxDuration = 180;

/** Leest een plattegrond (Funda, makelaar, schets op papier) en zet hem om in ruimtes, deuren en ramen. */
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const ctx = await requireProject(id);
  if ("error" in ctx) return ctx.error;
  const { sb } = ctx;

  const { imagePath, hint } = (await req.json()) as { imagePath?: string; hint?: string };
  if (!imagePath || !inProject(imagePath, ctx.project.id)) return Response.json({ error: "Upload eerst een foto." }, { status: 400 });
  const { data: blob } = await sb.storage.from(BUCKET).download(imagePath);
  if (!blob) return Response.json({ error: "De foto kon niet worden geladen." }, { status: 400 });

  const limited = await guardAi(sb, "text");
  if (limited) return limited;

  try {
    const { output } = await generateText({
      model: TEXT_MODEL,
      reasoning: "medium",
      maxOutputTokens: 12000,
      output: Output.object({ schema: FloorplanFromImageSchema }),
      system: `Je zet een foto of scan van een plattegrond om in rechthoekige ruimtes voor een tekenprogramma.
- Coördinaten in centimeters, x naar rechts, y naar beneden, (0,0) linksboven van de hele woning.
- Gebruik maten die op de tekening staan; schat anders met realistische maten (deur 80-90 cm breed, gang ±100 cm).
- Ruimtes die aan elkaar grenzen delen exact dezelfde wandcoördinaat. Benader L-vormige ruimtes met twee rechthoeken.
- Geef iedere ruimte een Nederlandse naam (Woonkamer, Keuken, Slaapkamer 1, Badkamer, Hal, Toilet, Berging, Balkon).
- Deuren en ramen: per wand van de ruimte waar ze in zitten; offset vanaf de linkerhoek (boven- en onderwand) of bovenhoek (linker- en rechterwand).
- Alleen één verdieping: de grootste of de gevraagde.`,
      messages: [
        {
          role: "user",
          content: [
            { type: "file", data: new Uint8Array(await blob.arrayBuffer()), mediaType: blob.type || "image/jpeg" },
            { type: "text", text: hint?.trim() ? `Let op: ${hint.trim()}` : "Zet deze plattegrond om." },
          ],
        },
      ],
    });
    return Response.json({ detected: output });
  } catch (e) {
    console.error("plattegrond uit foto mislukt", e);
    return Response.json({ error: "De plattegrond kon niet worden gelezen. Probeer een scherpere foto." }, { status: 502 });
  }
}
