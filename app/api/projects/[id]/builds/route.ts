import { generateText, Output } from "ai";
import { BASE_SYSTEM, TEXT_MODEL, projectContext } from "@/lib/ai";
import { BuildCoreSchema, BuildDetailsSchema, type BuildGuide } from "@/lib/schemas";
import { requireProject } from "@/lib/supabase/server";
import { guardAi } from "@/lib/usage";

export const maxDuration = 600;

const CORE_SYSTEM = `${BASE_SYSTEM}

Je schrijft nu een volledig bouwplan van A tot Z voor iets dat iemand zelf wil maken (bv. een kast, bank, wandplank, bed, tafel, kastombouw, wandpaneel, verlichting).
Regels:
- Ga uit van een hobbyist met basisgereedschap. Is iets lastig, geef dan een eenvoudiger alternatief (bv. hout laten zagen bij de bouwmarkt).
- Materialen: alles wat ze moet kopen, inclusief schroeven, pluggen, lijm, scharnieren, schuurpapier en afwerking. Gebruik gangbare Nederlandse plaatmaten (bv. 244 x 122 cm, 250 x 125 cm) en geef een realistische prijs.
- Zaaglijst: elk onderdeel met exacte maten in mm, consistent met de buitenmaten en de plaatdikte.
- Stappen: in de juiste volgorde, van voorbereiden en zagen tot monteren, ophangen en afwerken. Elke stap concreet genoeg om zonder video te volgen.
- Kies per materiaal de winkel waar het logisch te koop is (plaatmateriaal en hout: HORNBACH/GAMMA/Praxis/Karwei; beslag: ook IKEA of bol).`;

const DETAILS_SYSTEM = `${BASE_SYSTEM}

Je krijgt een bouwplan en legt de techniek erachter uit, zodat een beginner snapt wat ze doet en waarom.
- Materiaalkeuze: de beste keuze (precies één met recommended=true, passend bij het plan) en 2-3 alternatieven (bv. multiplex, MDF, massief grenen/eiken, meubelpaneel, OSB) met eerlijke voor- en nadelen voor dít meubel.
- Constructie: hoe het frame/casco dragend wordt (bodem/top tussen of op de zijwanden, achterwand voor stijfheid, regels of plint, hoe het tegen de muur hangt) en elke verbinding met maten. Kies verbindingen die een beginner met een accuboormachine kan maken; noem een sterkere optie als die er is.
- Bevestiging: exacte schroeven (type, kop, diameter × lengte, aantal), pluggen voor de muur, deuvels, lijm, scharnieren en ophangbeslag, met waarom. Houd het consistent met de plaatdiktes in de zaaglijst.`;

/** Deel 2 (techniek) bij een bestaand plan; apart omdat één schema samen te groot is voor gestructureerde uitvoer. */
async function details(core: BuildGuide) {
  const { output } = await generateText({
    model: TEXT_MODEL,
    system: DETAILS_SYSTEM,
    reasoning: "medium",
    maxOutputTokens: 16000,
    output: Output.object({ schema: BuildDetailsSchema }),
    prompt: JSON.stringify({
      titel: core.title,
      samenvatting: core.summary,
      maten: core.dimensions,
      ontwerp: core.design,
      materialen: core.materials.map((m) => `${m.quantity} ${m.unit} ${m.name} (${m.spec})`),
      zaaglijst: core.cuttingList,
      stappen: core.steps.map((s) => s.title),
    }),
  });
  return output;
}

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const ctx = await requireProject(id);
  if ("error" in ctx) return ctx.error;
  const { sb, project } = ctx;

  const body = (await req.json()) as { request?: string; detailsFor?: string };

  // Alleen techniek aanvullen bij een bestaand (ouder) plan.
  if (body.detailsFor) {
    const { data: existing } = await sb.from("builds").select("*").eq("id", body.detailsFor).eq("project_id", project.id).maybeSingle();
    if (!existing) return Response.json({ error: "Bouwplan niet gevonden." }, { status: 404 });
    const limited = await guardAi(sb, "text");
    if (limited) return limited;
    try {
      const data = { ...(existing.data as BuildGuide), ...(await details(existing.data as BuildGuide)) };
      const { data: build, error } = await sb.from("builds").update({ data }).eq("id", existing.id).select("*").single();
      if (error) throw error;
      return Response.json({ build });
    } catch (e) {
      console.error("bouwplan aanvullen mislukt", e);
      return Response.json({ error: "Aanvullen lukte niet. Probeer het opnieuw." }, { status: 502 });
    }
  }

  const wish = body.request?.trim();
  if (!wish) return Response.json({ error: "Wat wil je maken?" }, { status: 400 });

  const limited = await guardAi(sb, "text");
  if (limited) return limited;

  try {
    const { output: core } = await generateText({
      model: TEXT_MODEL,
      system: CORE_SYSTEM,
      reasoning: "medium",
      maxOutputTokens: 32000,
      output: Output.object({ schema: BuildCoreSchema }),
      prompt: `${projectContext(project)}\n\nWat ze wil maken:\n${wish}`,
    });

    // De techniek (deel 2) haalt de app direct daarna op met { detailsFor }, zodat je het plan sneller ziet.
    const data: BuildGuide = core;

    const { data: build, error } = await sb
      .from("builds")
      .insert({ project_id: project.id, title: data.title, request: wish, data })
      .select("*")
      .single();
    if (error) throw error;
    return Response.json({ build });
  } catch (e) {
    console.error("bouwplan mislukt", e);
    return Response.json({ error: "Het bouwplan kon niet worden gemaakt. Probeer het opnieuw." }, { status: 502 });
  }
}
