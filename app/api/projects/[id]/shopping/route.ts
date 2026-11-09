import { generateText, Output } from "ai";
import { BASE_SYSTEM, TEXT_MODEL, projectContext } from "@/lib/ai";
import { floorplanSummary } from "@/lib/floorplan";
import { ShoppingSuggestionSchema, type ShoppingItem } from "@/lib/schemas";
import { requireProject } from "@/lib/supabase/server";

export const maxDuration = 120;

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const ctx = await requireProject(id);
  if ("error" in ctx) return ctx.error;
  const { sb, project } = ctx;

  const { wish } = (await req.json()) as { wish?: string };
  const existing = ((project.shopping ?? []) as ShoppingItem[]).map((i) => `- ${i.name}`).join("\n");
  const plan = floorplanSummary(project.floorplan);

  try {
    const { output } = await generateText({
      model: TEXT_MODEL,
      system: `${BASE_SYSTEM}\n\nStel een inkooplijst samen voor dit interieurproject: concrete producten met een realistische prijs per stuk en de winkel waar het te koop is. Houd rekening met het budget. 6 tot 14 items.`,
      reasoning: "medium",
      maxOutputTokens: 12000,
      output: Output.object({ schema: ShoppingSuggestionSchema }),
      prompt: [
        projectContext(project),
        plan && `Plattegrond:\n${plan}`,
        existing && `Staat al op de lijst (niet herhalen):\n${existing}`,
        wish?.trim() && `Extra wens: ${wish.trim()}`,
      ]
        .filter(Boolean)
        .join("\n\n"),
    });

    const added: ShoppingItem[] = output.items.map((i) => ({ ...i, id: crypto.randomUUID(), bought: false }));
    const shopping = [...((project.shopping ?? []) as ShoppingItem[]), ...added];
    const { error } = await sb.from("projects").update({ shopping }).eq("id", project.id);
    if (error) throw error;
    return Response.json({ shopping });
  } catch (e) {
    console.error("inkooplijst mislukt", e);
    return Response.json({ error: "De inkooplijst kon niet worden gemaakt. Probeer het opnieuw." }, { status: 502 });
  }
}
