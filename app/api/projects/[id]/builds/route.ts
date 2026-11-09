import { generateText, Output } from "ai";
import { BASE_SYSTEM, TEXT_MODEL, projectContext } from "@/lib/ai";
import { BuildGuideSchema } from "@/lib/schemas";
import { requireProject } from "@/lib/supabase/server";
import { guardAi } from "@/lib/usage";

export const maxDuration = 300;

const BUILD_SYSTEM = `${BASE_SYSTEM}

Je schrijft nu een volledig bouwplan van A tot Z voor iets dat iemand zelf wil maken (bv. een kast, bank, wandplank, bed, tafel, kastombouw, wandpaneel, verlichting).
Regels:
- Ga uit van een hobbyist met basisgereedschap. Is iets lastig, geef dan een eenvoudiger alternatief (bv. hout laten zagen bij de bouwmarkt).
- Materialen: alles wat ze moet kopen, inclusief schroeven, pluggen, lijm, scharnieren, schuurpapier en afwerking. Gebruik gangbare Nederlandse plaatmaten (bv. 244 x 122 cm, 250 x 125 cm) en geef een realistische prijs.
- Zaaglijst: elk onderdeel met exacte maten in mm, consistent met de buitenmaten en de plaatdikte.
- Stappen: in de juiste volgorde, van voorbereiden en zagen tot monteren, ophangen en afwerken. Elke stap concreet genoeg om zonder video te volgen.
- Kies per materiaal de winkel waar het logisch te koop is (plaatmateriaal en hout: HORNBACH/GAMMA/Praxis/Karwei; beslag: ook IKEA of bol).`;

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const ctx = await requireProject(id);
  if ("error" in ctx) return ctx.error;
  const { sb, project } = ctx;

  const { request } = (await req.json()) as { request?: string };
  const wish = request?.trim();
  if (!wish) return Response.json({ error: "Wat wil je maken?" }, { status: 400 });

  const limited = await guardAi(sb, "text");
  if (limited) return limited;

  try {
    const { output } = await generateText({
      model: TEXT_MODEL,
      system: BUILD_SYSTEM,
      reasoning: "medium",
      maxOutputTokens: 32000,
      output: Output.object({ schema: BuildGuideSchema }),
      prompt: `${projectContext(project)}\n\nWat ze wil maken:\n${wish}`,
    });

    const { data: build, error } = await sb
      .from("builds")
      .insert({ project_id: project.id, title: output.title, request: wish, data: output })
      .select("*")
      .single();
    if (error) throw error;
    return Response.json({ build });
  } catch (e) {
    console.error("bouwplan mislukt", e);
    return Response.json({ error: "Het bouwplan kon niet worden gemaakt. Probeer het opnieuw." }, { status: 502 });
  }
}
