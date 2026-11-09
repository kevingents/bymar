/** Stijlen met kleurpalet en vorm-varianten. Voedt de geïllustreerde kamerscènes. */

export type StyleLook = {
  name: string;
  tagline: string;
  colors: {
    wall: string;
    floor: string;
    floorLine: string;
    sofa: string;
    sofaDark: string;
    cushion: string;
    accent: string;
    wood: string;
    metal: string;
    plant: string;
    rug: string;
    art1: string;
    art2: string;
    sky: string;
  };
  sofa: "low" | "boxy" | "curvy" | "tufted";
  lamp: "paper" | "arc" | "cage" | "dome" | "tripod";
  window: "square" | "arch" | "tall";
  extras: ("brick" | "beams" | "panels" | "mirror" | "macrame" | "shelf" | "vase" | "texture" | "gallery" | "curtain")[];
};

export const LOOKS: Record<string, StyleLook> = {
  Japandi: {
    name: "Japandi",
    tagline: "Rust, licht hout, natuurlijke tinten",
    colors: { wall: "#EDE6DB", floor: "#C9A57E", floorLine: "#B48F68", sofa: "#D8CDBB", sofaDark: "#C2B6A2", cushion: "#8E9A7B", accent: "#3B3631", wood: "#A57C55", metal: "#3B3631", plant: "#6E8160", rug: "#E3D8C6", art1: "#3B3631", art2: "#B79D7A", sky: "#F6F1E7" },
    sofa: "low",
    lamp: "paper",
    window: "tall",
    extras: ["vase", "shelf"],
  },
  Scandinavisch: {
    name: "Scandinavisch",
    tagline: "Licht, wit, functioneel en gezellig",
    colors: { wall: "#F4F2EE", floor: "#E2CDAE", floorLine: "#D2BA97", sofa: "#B9C0C6", sofaDark: "#A3ABB2", cushion: "#E7B9A4", accent: "#2F3A44", wood: "#D9BC93", metal: "#2F3A44", plant: "#5E8A6A", rug: "#ECE6DC", art1: "#E7B9A4", art2: "#8FA6B6", sky: "#E9F1F6" },
    sofa: "boxy",
    lamp: "tripod",
    window: "square",
    extras: ["shelf", "gallery"],
  },
  Modern: {
    name: "Modern",
    tagline: "Strak, contrastrijk, open",
    colors: { wall: "#E8E6E3", floor: "#9E958B", floorLine: "#8C8379", sofa: "#4A4E54", sofaDark: "#3A3D42", cushion: "#C9A35B", accent: "#1F2124", wood: "#6B5544", metal: "#1F2124", plant: "#4E7457", rug: "#D4D0CB", art1: "#C9A35B", art2: "#1F2124", sky: "#E3EAF0" },
    sofa: "boxy",
    lamp: "arc",
    window: "tall",
    extras: ["gallery"],
  },
  Industrieel: {
    name: "Industrieel",
    tagline: "Baksteen, staal, leer en hout",
    colors: { wall: "#B5714F", floor: "#6F5B4B", floorLine: "#5E4C3E", sofa: "#7A4E33", sofaDark: "#633E28", cushion: "#C9B79C", accent: "#232323", wood: "#5B4636", metal: "#232323", plant: "#4F6B47", rug: "#3F3A36", art1: "#E8DFD0", art2: "#232323", sky: "#DCE3E6" },
    sofa: "tufted",
    lamp: "cage",
    window: "square",
    extras: ["brick", "shelf"],
  },
  Landelijk: {
    name: "Landelijk",
    tagline: "Warm, robuust, hout en linnen",
    colors: { wall: "#EFE8DC", floor: "#A47C55", floorLine: "#8E6A46", sofa: "#E6DCC9", sofaDark: "#D3C6AF", cushion: "#9DAA8C", accent: "#6B5340", wood: "#7B5B3E", metal: "#4A4038", plant: "#6C8A5A", rug: "#C9B79C", art1: "#9DAA8C", art2: "#C98F6B", sky: "#F2EEE4" },
    sofa: "curvy",
    lamp: "dome",
    window: "square",
    extras: ["beams", "curtain"],
  },
  Boho: {
    name: "Boho",
    tagline: "Rotan, planten, warme kleuren",
    colors: { wall: "#F1E4D3", floor: "#C69C72", floorLine: "#B08660", sofa: "#D98F5F", sofaDark: "#C47A4B", cushion: "#E8C77A", accent: "#7E4B2E", wood: "#B9895A", metal: "#7E4B2E", plant: "#5F8653", rug: "#C9725A", art1: "#D98F5F", art2: "#5F8653", sky: "#FBF1E2" },
    sofa: "curvy",
    lamp: "dome",
    window: "arch",
    extras: ["mirror", "macrame", "curtain"],
  },
  "Mid-century": {
    name: "Mid-century",
    tagline: "Teak, organische vormen, okergeel",
    colors: { wall: "#EAE2D2", floor: "#B5895E", floorLine: "#9F7550", sofa: "#2F5D5A", sofaDark: "#244A47", cushion: "#E0A33A", accent: "#8A4F2A", wood: "#8A5A35", metal: "#C79A3D", plant: "#4F7A4E", rug: "#E7D7BB", art1: "#E0A33A", art2: "#C2552F", sky: "#EEF0E8" },
    sofa: "curvy",
    lamp: "arc",
    window: "square",
    extras: ["gallery"],
  },
  Minimalistisch: {
    name: "Minimalistisch",
    tagline: "Weinig, maar alles klopt",
    colors: { wall: "#F5F4F1", floor: "#DAD4CB", floorLine: "#CCC5BB", sofa: "#ECEAE6", sofaDark: "#DAD7D1", cushion: "#ECEAE6", accent: "#2B2B2B", wood: "#CDB89C", metal: "#2B2B2B", plant: "#7E8F74", rug: "#EFEDE9", art1: "#2B2B2B", art2: "#CDB89C", sky: "#F2F4F5" },
    sofa: "low",
    lamp: "arc",
    window: "tall",
    extras: [],
  },
  Klassiek: {
    name: "Klassiek",
    tagline: "Lijstwerk, fluweel, symmetrie",
    colors: { wall: "#D9D4C7", floor: "#7B5A3E", floorLine: "#684A32", sofa: "#3E5466", sofaDark: "#2F4152", cushion: "#C7A462", accent: "#B08D4A", wood: "#5E4330", metal: "#B08D4A", plant: "#4C6B4E", rug: "#8C3F3A", art1: "#B08D4A", art2: "#3E5466", sky: "#E6E9EA" },
    sofa: "tufted",
    lamp: "dome",
    window: "tall",
    extras: ["panels", "curtain"],
  },
  "Wabi-sabi": {
    name: "Wabi-sabi",
    tagline: "Kalkverf, imperfectie, aarde",
    colors: { wall: "#DCCFBF", floor: "#B79D80", floorLine: "#A58A6D", sofa: "#CBB9A2", sofaDark: "#B9A68E", cushion: "#9C8164", accent: "#4D4036", wood: "#7D6249", metal: "#4D4036", plant: "#7C7F62", rug: "#D4C6B4", art1: "#9C8164", art2: "#4D4036", sky: "#EFE8DD" },
    sofa: "low",
    lamp: "paper",
    window: "arch",
    extras: ["texture", "vase"],
  },
  Mediterraan: {
    name: "Mediterraan",
    tagline: "Zon, wit stucwerk, terracotta",
    colors: { wall: "#F6EFE3", floor: "#C8774E", floorLine: "#B36843", sofa: "#F2E9DA", sofaDark: "#E2D6C2", cushion: "#3E6E8E", accent: "#3E6E8E", wood: "#9A6B42", metal: "#3E3A35", plant: "#5E7F4A", rug: "#E9DCC6", art1: "#3E6E8E", art2: "#C8774E", sky: "#D7EAF5" },
    sofa: "curvy",
    lamp: "dome",
    window: "arch",
    extras: ["vase", "curtain"],
  },
  Eclectisch: {
    name: "Eclectisch",
    tagline: "Kleur, contrast, verzameld",
    colors: { wall: "#2F5A54", floor: "#A9784F", floorLine: "#93673F", sofa: "#C2577A", sofaDark: "#A84866", cushion: "#E7C14E", accent: "#E7C14E", wood: "#7A4F2F", metal: "#D4A23F", plant: "#7DA35D", rug: "#E0B57C", art1: "#E7C14E", art2: "#F2E6D4", sky: "#F3E3C8" },
    sofa: "tufted",
    lamp: "tripod",
    window: "square",
    extras: ["gallery", "mirror"],
  },
};

/** De "voor"-kamer voor de voor/na-demo: kaal en wat gedateerd. */
export const BEFORE_LOOK: StyleLook = {
  name: "Voor",
  tagline: "",
  colors: { wall: "#D7D3CB", floor: "#A39B8E", floorLine: "#968E81", sofa: "#8C8A86", sofaDark: "#7A7874", cushion: "#8C8A86", accent: "#5A5856", wood: "#8B7E6E", metal: "#5A5856", plant: "#8A8F7C", rug: "#A39B8E", art1: "#BDB8AE", art2: "#BDB8AE", sky: "#E2E5E7" },
  sofa: "boxy",
  lamp: "tripod",
  window: "square",
  extras: [],
};

export function lookFor(style: string | null | undefined): StyleLook {
  if (style && LOOKS[style]) return LOOKS[style];
  if (style) {
    const key = Object.keys(LOOKS).find((k) => style.toLowerCase().includes(k.toLowerCase()));
    if (key) return LOOKS[key];
  }
  return LOOKS.Japandi;
}
