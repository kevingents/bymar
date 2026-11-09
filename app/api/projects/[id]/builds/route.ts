import { generateText, Output } from "ai";
import { BASE_SYSTEM, TEXT_MODEL, projectContext } from "@/lib/ai";
import { BuildCoreSchema, BuildDetailsSchema, DrillPlanSchema, type BuildGuide } from "@/lib/schemas";
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

const DRILL_SYSTEM = `${BASE_SYSTEM}

Je maakt een boorplan: per onderdeel uit de zaaglijst precies waar elk gat komt, zodat iemand die het lastig vindt het met een rolmaat en winkelhaak kan aftekenen.
- Gebruik exact de onderdelen en maten uit de zaaglijst; elk onderdeel dat gaten krijgt komt één keer voor (bij meerdere gelijke delen geldt hetzelfde boorplan).
- Coördinaten in mm. x = afstand langs de lengte vanaf het referentie-uiteinde (staande delen: vanaf de onderkant), y = afstand langs de breedte vanaf de voorkant. Teken op de kant die je noemt.
- Schroef door een plaat in de kopse kant van een andere: het gat zit op halve plaatdikte van de verbindingslijn (bij 18 mm: 9 mm), 40-50 mm uit de voor- en achterrand, en tussenin om de 200-250 mm.
- Voorboorgat 3 mm voor een schroef van 4 mm (in de kopse kant), met verzinkboor in de plaat waar de kop in komt.
- Deuvels: diameter 8, diepte half de deuvellengte + 1 mm, op dezelfde lijnen als de schroeven maar ertussen.
- Potscharnieren: 35 mm cup-boring, 12-13 mm diep, hart 22,5 mm uit de deurrand, 80-100 mm van boven en onder.
- Plankdragers: 5 mm, 10 mm diep, rij op 37 mm uit voor- en achterrand, om de 32 mm.
- Ophangbeslag en grepen alleen waar het plan ze noemt.
- Houd het overzichtelijk: liever de echte gaten dan alle denkbare.`;

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const ctx = await requireProject(id);
  if ("error" in ctx) return ctx.error;
  const { sb, project } = ctx;

  const body = (await req.json()) as { request?: string; detailsFor?: string; drillFor?: string };

  // Boorplan: waar komt elk gat, per onderdeel.
  if (body.drillFor) {
    const { data: existing } = await sb.from("builds").select("*").eq("id", body.drillFor).eq("project_id", project.id).maybeSingle();
    if (!existing) return Response.json({ error: "Bouwplan niet gevonden." }, { status: 404 });
    const limited = await guardAi(sb, "text");
    if (limited) return limited;
    try {
      const g = existing.data as BuildGuide;
      const { output: drillPlan } = await generateText({
        model: TEXT_MODEL,
        system: DRILL_SYSTEM,
        reasoning: "medium",
        maxOutputTokens: 16000,
        output: Output.object({ schema: DrillPlanSchema }),
        prompt: JSON.stringify({
          titel: g.title,
          maten: g.dimensions,
          zaaglijst: g.cuttingList,
          constructie: g.construction ?? g.design,
          bevestiging: g.fasteners?.map((f) => `${f.quantity}x ${f.name}: ${f.where}`),
          stappen: g.steps.map((s) => `${s.title}: ${s.description}`),
        }),
      });
      const data = { ...g, drillPlan };
      const { data: build, error } = await sb.from("builds").update({ data }).eq("id", existing.id).select("*").single();
      if (error) throw error;
      return Response.json({ build });
    } catch (e) {
      console.error("boorplan mislukt", e);
      return Response.json({ error: "Het boorplan kon niet worden gemaakt. Probeer het opnieuw." }, { status: 502 });
    }
  }

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
