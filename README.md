# Huisraad

Een app die je helpt met elk interieurproject, van idee tot klaar.

- **Beelden met AI**: beschrijf je droomkamer, of restyle een foto van je eigen ruimte (met voor/na-schuif). Een beeld kun je steeds verder bewerken.
- **Advies**: chat met een stylist/klusexpert die je project, stijl, budget en plattegrond kent. Je kunt er een foto bij sturen.
- **Zelf maken, A tot Z**: een compleet bouwplan voor bijvoorbeeld een kast: ontwerp, materialen met prijs en winkel, zaaglijst, gereedschap, montagestappen (af te vinken), afwerking en veiligheid. Ook af te drukken.
- **Plattegrond en 3D**: teken ruimtes, deuren, ramen en meubels. Laat AI een ruimte inrichten, bekijk het in 3D en loop er doorheen.
- **Inkooplijst**: AI-voorstel met prijzen per winkel (IKEA, GAMMA, Praxis, Karwei, HORNBACH, Leen Bakker, Kwantum, JYSK, bol) en een budgetbalk.
- **Opslaan en delen**: projecten worden opgeslagen; via een deellink kunnen anderen meekijken (ook in 3D) en reageren.

## Techniek

- Next.js 16 (App Router) + Tailwind 4, te installeren als app op de telefoon (PWA).
- **Supabase** voor inloggen (e-mailcode), database en foto-opslag. Alles is per gebruiker afgeschermd met row level security.
- **Vercel AI Gateway** via de AI SDK:
  - tekst: `anthropic/claude-opus-5-5` (advies, bouwplannen, inkooplijst, indeling)
  - beeld: `google/gemini-3.1-flash-image-preview` (nieuw beeld en foto restylen)
  - andere modellen kies je met `HUISRAAD_TEXT_MODEL` / `HUISRAAD_IMAGE_MODEL`.
- 3D met three.js / React Three Fiber.

## Opzetten

1. **Supabase-project**: voer de migraties in `supabase/migrations/` op volgorde uit (SQL editor of `supabase db push`). Een geheime service-sleutel is niet nodig: de deellink loopt via beveiligde databasefuncties.
2. **Inlogmail**: zet in Supabase bij *Authentication → Email Templates → Magic Link* de code in de mail, bijvoorbeeld:
   `Je inlogcode voor Huisraad: {{ .Token }}`. De app logt in met die code, zodat het ook in de geïnstalleerde app werkt.
3. **Env-variabelen**: kopieer `.env.example` naar `.env.local` en vul de Supabase-sleutels in.
   Voor AI: koppel het project aan Vercel en draai `vercel env pull` (OIDC), of zet een `AI_GATEWAY_API_KEY`.
4. `npm install` en `npm run dev`, open http://localhost:3000.

## Structuur

```
app/                    pagina's en API-routes
  api/projects/[id]/    images, chat, builds, shopping, layout
  api/share/[token]/    openbare deelweergave + reacties
components/
  workspace/            tabbladen van een project
  floorplan/            2D-editor en 3D-wandeling
  builds/               weergave van een bouwplan
lib/
  ai.ts                 AI Gateway: modellen, prompts, beeldgeneratie
  schemas.ts            zod-schema's voor gestructureerde AI-output
  floorplan.ts          rekenwerk voor plattegrond en 3D-wanden
  stores.ts             zoeklinks naar winkels
supabase/migrations/    databaseschema, RLS en opslag
```
