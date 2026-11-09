import { generateText, Output } from "ai";
import { BASE_SYSTEM, TEXT_MODEL, projectContext } from "@/lib/ai";
import { floorplanSummary } from "@/lib/floorplan";
import { LayoutSuggestionSchema, type Floorplan } from "@/lib/schemas";
import { requireProject } from "@/lib/supabase/server";
import { guardAi } from "@/lib/usage";

export const maxDuration = 120;

/** Laat Claude een kamer inrichten: geeft meubels met posities terug, de app voegt ze toe. */
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const ctx = await requireProject(id);
  if ("error" in ctx) return ctx.error;
  const { sb, project } = ctx;

  const { floorplan, roomId, wish } = (await req.json()) as {
    floorplan: Floorplan;
    roomId: string;
    wish?: string;
  };
  const room = floorplan?.rooms?.find((r) => r.id === roomId);
  if (!room) return Response.json({ error: "Kies eerst een ruimte." }, { status: 400 });

  const limited = await guardAi(sb, "text");
  if (limited) return limited;

  try {
    const { output } = await generateText({
      model: TEXT_MODEL,
      system: `${BASE_SYSTEM}

Je richt een ruimte in op een plattegrond. Coördinaten in cm, x naar rechts, y naar beneden, (0,0) linksboven van de hele plattegrond.
Een meubel staat met zijn linkerbovenhoek op (x, y) en is w breed en d diep vóór rotatie. Bij rotatie 90 of 270 wisselen breedte en diepte op de plattegrond.
Regels: alles moet volledig binnen de ruimte vallen, niets mag overlappen (behalve een vloerkleed onder meubels), houd minstens 70 cm looppad vrij, blokkeer geen deuren (houd 90 cm vrij voor een deur) en zet hoge kasten niet voor ramen. Gebruik realistische maten.`,
      reasoning: "medium",
      maxOutputTokens: 8000,
      output: Output.object({ schema: LayoutSuggestionSchema }),
      prompt: [
        projectContext(project),
        `Plattegrond:\n${floorplanSummary(floorplan)}`,
        `Richt deze ruimte in: "${room.name}" (x ${room.x} tot ${room.x + room.w}, y ${room.y} tot ${room.y + room.h}).`,
        wish?.trim() && `Wens: ${wish.trim()}`,
        "Laat bestaande meubels in deze ruimte weg uit je antwoord; je antwoord vervangt ze.",
      ]
        .filter(Boolean)
        .join("\n\n"),
    });
    return Response.json({ suggestion: output });
  } catch (e) {
    console.error("indeling mislukt", e);
    return Response.json({ error: "De indeling kon niet worden gemaakt. Probeer het opnieuw." }, { status: 502 });
  }
}
