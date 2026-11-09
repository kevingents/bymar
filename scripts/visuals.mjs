// Genereert de sfeerbeelden van de site via de Vercel AI Gateway en zet ze als WebP in public/visuals.
// Gebruik:  node --env-file=.env.local scripts/visuals.mjs [naam ...]
// Zonder namen worden alleen ontbrekende beelden gemaakt; met namen worden die opnieuw gemaakt.
import { generateText } from "ai";
import sharp from "sharp";
import { existsSync, mkdirSync, readFileSync } from "node:fs";
import { join } from "node:path";

const MODEL = process.env.HUISRAAD_IMAGE_MODEL ?? "google/gemini-3.1-flash-image";
const OUT = join(process.cwd(), "public", "visuals");
mkdirSync(OUT, { recursive: true });

const STYLE = "Fotorealistische editorial interieurfotografie, natuurlijk daglicht, 35mm, zachte schaduwen, realistische materialen, geen mensen, geen tekst, geen watermerk.";

const JOBS = [
  { name: "hero", ratio: "16:9", prompt: `Ruime japandi-woonkamer in een Nederlands herenhuis met hoge plafonds en grote ramen, lage linnen bank, eiken salontafel, rijstpapieren lamp, olijfboom, warme ochtendzon. ${STYLE}` },
  { name: "stijl-japandi", ratio: "4:3", prompt: `Japandi-slaapkamer met laag eiken bed, linnen beddengoed in zandtinten, papieren lamp, kalkverf muur. ${STYLE}` },
  { name: "stijl-scandinavisch", ratio: "4:3", prompt: `Scandinavische woonkamer, witte muren, lichtgrijze bank, berkenhouten meubels, schapenvacht, veel licht. ${STYLE}` },
  { name: "stijl-industrieel", ratio: "4:3", prompt: `Industriële loft-eethoek met bakstenen muur, stalen raam, robuuste houten tafel, zwarte hanglampen, cognac leren stoelen. ${STYLE}` },
  { name: "stijl-boho", ratio: "4:3", prompt: `Boho-woonkamer met rotan stoel, macramé aan de muur, veel planten, terracotta en mosterd kussens, kelim vloerkleed. ${STYLE}` },
  { name: "stijl-mid-century", ratio: "4:3", prompt: `Mid-century woonkamer met teakhouten dressoir, petrolblauwe bank, okergele fauteuil, booglamp, parketvloer. ${STYLE}` },
  { name: "stijl-mediterraan", ratio: "4:3", prompt: `Mediterrane woonkamer met wit stucwerk, boogvormige doorgang, terracotta tegelvloer, linnen bank, olijftakken in een kruik. ${STYLE}` },
  { name: "voor", ratio: "4:3", prompt: `Gedateerde, wat kale Nederlandse woonkamer uit de jaren 2000: grijze laminaatvloer, beige muren, oude donkergrijze hoekbank, kale plafondlamp, kaal raam met lamellen. Zelfde camerahoek recht op de bank, raam links. ${STYLE}` },
  { name: "na", ratio: "4:3", from: "voor", prompt: `Restyle deze woonkamer naar warm japandi: lichte eiken vloer, kalkverf in zandkleur, lage linnen bank, rijstpapieren lamp, linnen gordijnen, grote plant, eiken salontafel. Behoud exact de ruimte, het raam, het perspectief en de camerahoek. ${STYLE}` },
  { name: "zelf-maken", ratio: "4:3", prompt: `Zelfgemaakte boekenkast van berken multiplex in een nis naast een schoorsteen, gevuld met boeken, keramiek en een plant, op de voorgrond een accuboormachine, een rolmaat en een potlood op de vloer. ${STYLE}` },
];

async function make(job) {
  const content = [];
  if (job.from) {
    const src = join(OUT, `${job.from}.webp`);
    if (!existsSync(src)) throw new Error(`${job.from}.webp ontbreekt voor ${job.name}`);
    const png = await sharp(readFileSync(src)).png().toBuffer();
    content.push({ type: "file", data: new Uint8Array(png), mediaType: "image/png" });
  }
  content.push({ type: "text", text: job.prompt });
  const res = await generateText({
    model: MODEL,
    providerOptions: { google: { responseModalities: ["TEXT", "IMAGE"], imageConfig: { aspectRatio: job.ratio } } },
    messages: [{ role: "user", content }],
  });
  const file = res.files.find((f) => f.mediaType.startsWith("image/"));
  if (!file) throw new Error(`geen beeld voor ${job.name}`);
  const out = join(OUT, `${job.name}.webp`);
  const info = await sharp(Buffer.from(file.uint8Array)).resize({ width: 1600, withoutEnlargement: true }).webp({ quality: 80 }).toFile(out);
  console.log(`klaar  ${job.name}.webp  ${info.width}x${info.height}  ${Math.round(info.size / 1024)} kB`);
}

const wanted = process.argv.slice(2);
const todo = JOBS.filter((j) => (wanted.length ? wanted.includes(j.name) : !existsSync(join(OUT, `${j.name}.webp`))));
// eerst alles zonder bron parallel, daarna de afgeleide beelden (zoals "na" uit "voor")
for (const batch of [todo.filter((j) => !j.from), todo.filter((j) => j.from)]) {
  const results = await Promise.allSettled(batch.map(make));
  results.forEach((r, i) => r.status === "rejected" && console.error(`mislukt ${batch[i].name}: ${r.reason?.message ?? r.reason}`));
}
