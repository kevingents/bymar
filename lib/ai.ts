import "server-only";
import { generateText } from "ai";

/**
 * Alle AI loopt via de Vercel AI Gateway (één sleutel: AI_GATEWAY_API_KEY,
 * of automatisch via OIDC als de app op Vercel draait).
 * Modellen zijn te overschrijven met een env-var, zonder codewijziging.
 */
export const TEXT_MODEL = process.env.HUISRAAD_TEXT_MODEL ?? "anthropic/claude-opus-5.5";
// Gekozen na een vergelijking van zes modellen op dezelfde restyle (9 nov 2026):
// Gemini 3 Pro Image behoudt de ruimte het best en geeft de mooiste details.
export const IMAGE_MODEL = process.env.HUISRAAD_IMAGE_MODEL ?? "google/gemini-3-pro-image";
export const IMAGE_FALLBACK_MODEL = process.env.HUISRAAD_IMAGE_FALLBACK_MODEL ?? "google/gemini-3.1-flash-image";

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

type ImageInput = { data: Uint8Array; mediaType: string };

/** Volgorde van beeldmodellen: beste kwaliteit eerst, snelle terugval als het eerste faalt. */
const IMAGE_MODELS = [IMAGE_MODEL, IMAGE_FALLBACK_MODEL].filter((m, i, a) => a.indexOf(m) === i);

async function runImageModel(model: string, inputs: ImageInput[], text: string) {
  const result = await generateText({
    model,
    providerOptions: { google: { responseModalities: ["TEXT", "IMAGE"] } },
    messages: [
      {
        role: "user",
        content: [...inputs.map((i) => ({ type: "file" as const, data: i.data, mediaType: i.mediaType })), { type: "text" as const, text }],
      },
    ],
  });
  const file = result.files.find((f) => f.mediaType.startsWith("image/"));
  if (!file) throw new Error("Het beeldmodel gaf geen afbeelding terug.");
  return { data: file.uint8Array, mediaType: file.mediaType };
}

/** Roept het beste beeldmodel aan en valt terug op het snelle model als dat misgaat. */
export async function imageWithFallback(inputs: ImageInput[], text: string) {
  let last: unknown;
  for (const model of IMAGE_MODELS) {
    try {
      return await runImageModel(model, inputs, text);
    } catch (e) {
      last = e;
      console.error(`beeldmodel ${model} faalde`, e);
    }
  }
  throw last instanceof Error ? last : new Error("Het beeld kon niet worden gemaakt. Probeer een andere omschrijving.");
}

/** Maakt of bewerkt een beeld. Met `source` wordt de bestaande foto omgevormd. */
export async function createImage(opts: { prompt: string; source?: ImageInput; mode?: "render" | "place" | "diagram" }) {
  const instruction =
    opts.mode === "diagram"
      ? `Maak een technische bouwtekening als exploded view (uit elkaar getrokken) in isometrisch perspectief: nette zwarte lijntekening op een witte achtergrond, vlakken wit gevuld, lijndikte gelijkmatig, hulplijnen gestippeld en lichtgrijs. Laat zien hoe de onderdelen van het frame op hun plek komen, met stippellijnen naar waar ze aansluiten, en kleine details van deuvels en schroeven bij de verbindingen. Geen kleur, geen schaduw, geen tekst, geen cijfers, geen maten, geen watermerk. Het object: ${opts.prompt}`
      : opts.mode === "place"
      ? `Dit is een foto van een bestaande kamer. Plaats er dit zelfgemaakte meubel in: ${opts.prompt}. Zet het op een logische plek (op de vloer of tegen een vrije muur), op realistische schaal volgens de genoemde maten, met kloppend perspectief, licht en schaduw. Verander verder niets aan de kamer: muren, ramen, vloer en andere meubels blijven precies zoals ze zijn. Fotorealistisch, geen tekst of watermerk.`
      : opts.mode === "render"
      ? `Dit is een eenvoudige 3D-schets van een ingerichte ruimte. Maak er een fotorealistische interieurfoto van vanuit precies hetzelfde standpunt: behoud de indeling, de positie en de maat van de meubels, de ramen en deuren en het perspectief. Geef materialen, licht en details een realistische, mooie uitwerking. Wens: ${opts.prompt}. Geen tekst of watermerk.`
      : opts.source
        ? `Bewerk deze foto van een bestaande ruimte. Behoud de architectuur, ramen, deuren, perspectief en lichtinval precies; verander alleen inrichting, kleuren, materialen en styling. Wens: ${opts.prompt}. Fotorealistisch interieurbeeld, natuurlijk licht, geen tekst of watermerk in het beeld.`
        : `Maak een fotorealistisch interieurbeeld: ${opts.prompt}. Natuurlijk licht, realistische materialen en verhoudingen, editorial interieurfotografie, geen tekst of watermerk in het beeld.`;
  return imageWithFallback(opts.source ? [opts.source] : [], instruction);
}
