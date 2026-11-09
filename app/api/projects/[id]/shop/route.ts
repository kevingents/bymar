import { generateText, Output } from "ai";
import { TEXT_MODEL } from "@/lib/ai";
import { ShopLookSchema } from "@/lib/schemas";
import { BUCKET, requireProject } from "@/lib/supabase/server";
import { guardAi } from "@/lib/usage";

export const maxDuration = 120;

/** Shop the look: herkent meubels en accessoires in een beeld en zoekt vergelijkbare producten. */
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const ctx = await requireProject(id);
  if ("error" in ctx) return ctx.error;
  const { sb, project } = ctx;

  const { imageId, refresh } = (await req.json()) as { imageId?: string; refresh?: boolean };
  const { data: image } = await sb.from("project_images").select("*").eq("id", imageId).eq("project_id", project.id).maybeSingle();
  if (!image) return Response.json({ error: "Beeld niet gevonden." }, { status: 404 });
  if (image.shop && !refresh) return Response.json({ shop: image.shop });

  const { data: blob } = await sb.storage.from(BUCKET).download(image.path);
  if (!blob) return Response.json({ error: "Het beeld kon niet worden geladen." }, { status: 400 });

  const limited = await guardAi(sb, "text");
  if (limited) return limited;

  try {
    const { output } = await generateText({
      model: TEXT_MODEL,
      reasoning: "low",
      maxOutputTokens: 6000,
      output: Output.object({ schema: ShopLookSchema }),
      system: `Je bent een interieurstylist die mensen helpt een look na te kopen in Nederland.
Herken in de foto de 5 tot 10 belangrijkste meubels, lampen, textiel en accessoires die je kunt kopen (geen muren, vloer of ramen).
Kies per item de winkel waar iets vergelijkbaars logisch te vinden is (IKEA, Leen Bakker, Kwantum, JYSK, bol, GAMMA, Praxis, Karwei, HORNBACH) en een realistische prijs.
Geef de positie als middelpunt in procenten van de beeldbreedte en -hoogte. Schrijf Nederlands, geen emoji's.`,
      messages: [
        {
          role: "user",
          content: [
            { type: "file", data: new Uint8Array(await blob.arrayBuffer()), mediaType: blob.type || "image/png" },
            { type: "text", text: `Stijl van het project: ${project.style ?? "onbekend"}. Budget: ${project.budget ?? "onbekend"} euro.` },
          ],
        },
      ],
    });
    const shop = { items: output.items.map((i) => ({ ...i, x: Math.min(97, Math.max(3, i.x)), y: Math.min(97, Math.max(3, i.y)) })) };
    await sb.from("project_images").update({ shop }).eq("id", image.id);
    return Response.json({ shop });
  } catch (e) {
    console.error("shop the look mislukt", e);
    return Response.json({ error: "Producten zoeken lukte niet. Probeer het opnieuw." }, { status: 502 });
  }
}
