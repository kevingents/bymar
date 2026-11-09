import "server-only";
import { generateText } from "ai";

/**
 * Alle AI loopt via de Vercel AI Gateway (één sleutel: AI_GATEWAY_API_KEY,
 * of automatisch via OIDC als de app op Vercel draait).
 * Modellen zijn te overschrijven met een env-var, zonder codewijziging.
 */
export const TEXT_MODEL = process.env.HUISRAAD_TEXT_MODEL ?? "anthropic/claude-opus-5.5";
export const IMAGE_MODEL = process.env.HUISRAAD_IMAGE_MODEL ?? "google/gemini-3.1-flash-image";

export const BASE_SYSTEM = `Je bent de interieurstylist en klusexpert van Huisraad, een app voor mensen die hun huis willen inrichten en dingen zelf willen maken.
Je praat Nederlands, warm en concreet, zoals een goede vriendin die interieurontwerper én timmervrouw is.
- Geef praktische, uitvoerbare adviezen met maten in cm, kleuren (bij voorkeur met een verfkleur-voorbeeld), materialen en prijsindicaties in euro.
- Verwijs naar winkels die in Nederland makkelijk te vinden zijn: IKEA, GAMMA, Praxis, Karwei, HORNBACH, Leen Bakker, Kwantum, JYSK, bol.
- Bij klussen: noem gereedschap, volgorde, veiligheid, en wanneer je beter een vakman inschakelt (elektra, gas, dragende muren).
- Houd antwoorden overzichtelijk met korte kopjes en opsommingen. Geen emoji's.`;

export function projectContext(p: {
  title: string;
  room_type: string | null;
  style: string | null;
  budget: number | null;
  description: string | null;
}) {
  return [
    `Project: ${p.title}`,
    p.room_type && `Ruimte: ${p.room_type}`,
    p.style && `Gewenste stijl: ${p.style}`,
    p.budget != null && `Budget: ongeveer € ${p.budget}`,
    p.description && `Omschrijving: ${p.description}`,
  ]
    .filter(Boolean)
    .join("\n");
}

/** Maakt of bewerkt een beeld. Met `source` wordt de bestaande foto omgevormd. */
export async function createImage(opts: { prompt: string; source?: { data: Uint8Array; mediaType: string } }) {
  const instruction = opts.source
    ? `Bewerk deze foto van een bestaande ruimte. Behoud de architectuur, ramen, deuren, perspectief en lichtinval precies; verander alleen inrichting, kleuren, materialen en styling. Wens: ${opts.prompt}. Fotorealistisch interieurbeeld, natuurlijk licht, geen tekst of watermerk in het beeld.`
    : `Maak een fotorealistisch interieurbeeld: ${opts.prompt}. Natuurlijk licht, realistische materialen en verhoudingen, editorial interieurfotografie, geen tekst of watermerk in het beeld.`;

  const result = await generateText({
    model: IMAGE_MODEL,
    providerOptions: { google: { responseModalities: ["TEXT", "IMAGE"] } },
    messages: [
      {
        role: "user",
        content: opts.source
          ? [
              { type: "file", data: opts.source.data, mediaType: opts.source.mediaType },
              { type: "text", text: instruction },
            ]
          : [{ type: "text", text: instruction }],
      },
    ],
  });

  const file = result.files.find((f) => f.mediaType.startsWith("image/"));
  if (!file) throw new Error("Het beeldmodel gaf geen afbeelding terug. Probeer een andere omschrijving.");
  return { data: file.uint8Array, mediaType: file.mediaType };
}
