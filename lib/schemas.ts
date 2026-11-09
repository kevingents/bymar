import { z } from "zod";

/** Winkels waar Huisraad naar verwijst. "overig" valt terug op Google Shopping. */
export const STORE_KEYS = [
  "ikea",
  "gamma",
  "praxis",
  "karwei",
  "hornbach",
  "leenbakker",
  "kwantum",
  "jysk",
  "bol",
  "overig",
] as const;
export const StoreKey = z.enum(STORE_KEYS);
export type StoreKey = z.infer<typeof StoreKey>;

export const FURNITURE_TYPES = [
  "bank",
  "fauteuil",
  "salontafel",
  "eettafel",
  "stoel",
  "bed",
  "nachtkastje",
  "kast",
  "dressoir",
  "tv-meubel",
  "bureau",
  "vloerkleed",
  "plant",
  "lamp",
  "keukenblok",
  "overig",
] as const;
export const FurnitureType = z.enum(FURNITURE_TYPES);
export type FurnitureType = z.infer<typeof FurnitureType>;

/* ---------------------------------------------------------------- Bouwplan */

/** Deel 1 van het bouwplan: ontwerp, materialen, zaaglijst, stappen. */
export const BuildCoreSchema = z.object({
  title: z.string().describe("Korte naam van het object, bv. 'Eikenhouten wandkast'"),
  summary: z.string().describe("2-3 zinnen: wat je maakt en hoe het eruitziet"),
  difficulty: z.enum(["makkelijk", "gemiddeld", "lastig"]),
  totalTime: z.string().describe("Totale tijd, bv. '2 weekenden' of 'circa 6 uur'"),
  estimatedCost: z.number().describe("Geschatte totale materiaalkosten in euro"),
  dimensions: z.string().describe("Buitenmaten, bv. '180 x 80 x 40 cm (h x b x d)'"),
  furniture: FurnitureType.describe("Welk soort meubel het is, voor de plattegrond; 'overig' als niets past"),
  size: z
    .object({
      width: z.number().describe('Breedte in cm (van links naar rechts gezien van voren)'),
      depth: z.number().describe('Diepte in cm'),
      height: z.number().describe('Hoogte in cm'),
    })
    .describe('Buitenmaten in cm, hetzelfde als dimensions'),
  design: z.object({
    description: z.string().describe("Ontwerpkeuzes en constructie in gewone taal"),
    options: z.array(z.string()).describe("Varianten of keuzes die ze kan maken"),
  }),
  materials: z.array(
    z.object({
      name: z.string(),
      spec: z.string().describe("Specificatie: maat, dikte, soort, kleur"),
      quantity: z.number(),
      unit: z.string().describe("stuks, plaat, m1, liter, doos"),
      estPrice: z.number().describe("Geschatte prijs in euro voor de totale hoeveelheid"),
      store: StoreKey,
      searchQuery: z.string().describe("Zoekterm om het product bij die winkel te vinden"),
    }),
  ),
  cuttingList: z.array(
    z.object({
      part: z.string().describe("Onderdeel, bv. 'zijwand'"),
      material: z.string(),
      length: z.number().describe("Lengte in mm"),
      width: z.number().describe("Breedte in mm"),
      thickness: z.number().describe("Dikte in mm"),
      quantity: z.number(),
    }),
  ),
  tools: z.array(
    z.object({
      name: z.string(),
      required: z.boolean(),
      alternative: z.string().describe("Alternatief of huurtip, leeg als er geen is"),
    }),
  ),
  steps: z.array(
    z.object({
      title: z.string(),
      description: z.string().describe("Wat je precies doet, concreet en in volgorde"),
      tips: z.array(z.string()),
      warning: z.string().describe("Waarschuwing of veelgemaakte fout, leeg als er geen is"),
      duration: z.string(),
    }),
  ),
  finishing: z.array(z.string()).describe("Afwerking: schuren, lakken, olie, monteren aan de muur"),
  safety: z.array(z.string()),
});
/** Deel 2: materiaalkeuze, constructie en bevestiging (aparte aanroep; één schema samen is te groot). */
export const BuildDetailsSchema = z.object({
  materialChoice: z
    .array(
      z.object({
        option: z.string().describe("Materiaal, bv. 'Berken multiplex 18 mm'"),
        recommended: z.boolean().describe("true voor de beste keuze (precies één)"),
        why: z.string().describe("Waarom wel of niet: sterkte, uitzetten, afwerking, gewicht, gebruiksgemak"),
        pros: z.array(z.string()),
        cons: z.array(z.string()),
        priceLevel: z.enum(["€", "€€", "€€€"]),
      }),
    )
    .describe("De beste materiaalkeuze plus 2-3 alternatieven"),
  construction: z.object({
    frame: z
      .string()
      .describe("Hoe het frame/casco is opgebouwd: welke delen dragen, waar zitten bodem, top, achterwand, regels; waarom zo stevig"),
    joints: z.array(
      z.object({
        name: z.string().describe("bv. 'Deuvelverbinding', 'Pocket-hole schroef', 'Lamello', 'Hoekverbinding met lijm en schroef'"),
        where: z.string().describe("Welke onderdelen het verbindt"),
        how: z.string().describe("Stap voor stap hoe je de verbinding maakt, met maten (bv. gaten op 37 mm, 8 mm diep)"),
        why: z.string().describe("Waarom deze verbinding hier, en een eenvoudiger alternatief"),
      }),
    ),
  }),
  fasteners: z
    .array(
      z.object({
        name: z.string().describe("Exacte aanduiding, bv. 'Spaanplaatschroef 4,0 × 40 mm, verzonken kop, torx 20, deeldraad'"),
        quantity: z.number(),
        where: z.string().describe("Waar ze in komen"),
        why: z.string().describe("Waarom dit type en deze lengte (vuistregel: 2,5× de plaatdikte, niet doorschieten)"),
        alternative: z.string().describe("Alternatief, of leeg"),
      }),
    )
    .describe("Schroeven, pluggen, deuvels, lijm, scharnieren, ophangbeslag"),
});

/** Oudere bouwplannen hebben deel 2 (en maten/type) nog niet. */
export type BuildGuide = z.infer<typeof BuildCoreSchema> & Partial<z.infer<typeof BuildDetailsSchema>>;
export type BuildDetails = z.infer<typeof BuildDetailsSchema>;

/* ------------------------------------------------------------ Inkooplijst */

export const ShoppingSuggestionSchema = z.object({
  items: z.array(
    z.object({
      name: z.string(),
      category: z.string().describe("bv. Meubels, Verlichting, Textiel, Verf, Decoratie, Planten"),
      quantity: z.number(),
      estPrice: z.number().describe("Geschatte prijs per stuk in euro"),
      store: StoreKey,
      searchQuery: z.string(),
      note: z.string().describe("Waarom dit past, of waar je op moet letten"),
    }),
  ),
});
export type ShoppingSuggestion = z.infer<typeof ShoppingSuggestionSchema>;

export type ShoppingItem = ShoppingSuggestion["items"][number] & {
  id: string;
  bought: boolean;
};

/* ------------------------------------------------------------- Plattegrond */



export type Room = { id: string; name: string; x: number; y: number; w: number; h: number; floor: string };
export type Wall = "n" | "e" | "s" | "w";
export type Opening = {
  id: string;
  type: "door" | "window";
  roomId: string;
  wall: Wall;
  offset: number;
  width: number;
};
export type FloorItem = {
  id: string;
  type: FurnitureType;
  name: string;
  x: number;
  y: number;
  w: number;
  d: number;
  h: number;
  rotation: number;
  color: string;
};
export type Floorplan = {
  wallHeight: number;
  wallColor: string;
  rooms: Room[];
  openings: Opening[];
  items: FloorItem[];
};

/** Wat Claude teruggeeft als het een kamer inricht (posities in cm, linksboven = 0,0). */
export const LayoutSuggestionSchema = z.object({
  explanation: z.string().describe("Korte uitleg van de indeling, 2-4 zinnen"),
  items: z.array(
    z.object({
      type: FurnitureType,
      name: z.string(),
      x: z.number().describe("Linkerkant in cm, absolute plattegrondcoördinaat"),
      y: z.number().describe("Bovenkant in cm, absolute plattegrondcoördinaat"),
      w: z.number().describe("Breedte in cm (langs x, vóór rotatie)"),
      d: z.number().describe("Diepte in cm (langs y, vóór rotatie)"),
      h: z.number().describe("Hoogte in cm"),
      rotation: z.number().describe("0, 90, 180 of 270 graden"),
      color: z.string().describe("Hex-kleur passend bij de stijl, bv. #C9B79C"),
    }),
  ),
});
export type LayoutSuggestion = z.infer<typeof LayoutSuggestionSchema>;

/* -------------------------------------------------------------- Shop the look */

export const ShopLookSchema = z.object({
  items: z.array(
    z.object({
      name: z.string().describe("Wat het is, bv. 'Linnen hoekbank'"),
      category: z.string().describe("bv. Meubels, Verlichting, Textiel, Decoratie, Planten"),
      description: z.string().describe("Kleur, materiaal en stijl, kort"),
      estPrice: z.number().describe("Realistische prijs in euro voor een vergelijkbaar product"),
      store: StoreKey,
      searchQuery: z.string().describe("Zoekterm waarmee je iets vergelijkbaars vindt bij die winkel"),
      x: z.number().describe("Middelpunt van het object, horizontaal in procent van de beeldbreedte (0-100)"),
      y: z.number().describe("Middelpunt van het object, verticaal in procent van de beeldhoogte (0-100)"),
    }),
  ),
});
export type ShopLook = z.infer<typeof ShopLookSchema>;

/* ------------------------------------------------------ Plattegrond uit beeld */

export const FloorplanFromImageSchema = z.object({
  note: z.string().describe("Korte toelichting: wat je hebt herkend en wat onzeker is"),
  rooms: z.array(
    z.object({
      name: z.string(),
      x: z.number().describe("Linkerkant in cm"),
      y: z.number().describe("Bovenkant in cm"),
      w: z.number().describe("Breedte in cm"),
      h: z.number().describe("Diepte in cm"),
    }),
  ),
  openings: z.array(
    z.object({
      room: z.string().describe("Naam van de ruimte waar de wand bij hoort"),
      type: z.enum(["door", "window"]),
      wall: z.enum(["n", "e", "s", "w"]).describe("n = boven, e = rechts, s = onder, w = links"),
      offset: z.number().describe("Afstand in cm vanaf de linker- of bovenhoek van die wand"),
      width: z.number().describe("Breedte in cm"),
    }),
  ),
});
export type FloorplanFromImage = z.infer<typeof FloorplanFromImageSchema>;

/* ------------------------------------------------------------- Kleurpalet */

export const PaletteSchema = z.object({
  name: z.string().describe("Naam voor het palet, bv. 'Zachte zandtinten'"),
  colors: z.array(
    z.object({
      hex: z.string().describe("Hex-kleur zoals #C9B79C"),
      name: z.string().describe("Nederlandse kleurnaam"),
      role: z.string().describe("Waar te gebruiken: muur, accentmuur, houtwerk, textiel, accent"),
      paint: z.string().describe("Een verfkleur die er dichtbij zit, met merk, bv. 'Flexa Creations Warm Linnen' — als suggestie"),
    }),
  ),
  advice: z.string().describe("2-3 zinnen hoe je dit palet in de ruimte verdeelt"),
});
export type Palette = z.infer<typeof PaletteSchema>;
