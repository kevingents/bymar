import type { Floorplan } from "./schemas";

/** Ingerichte voorbeeldwoning voor de 3D-showroom op de startpagina. */
export const DEMO_PLAN: Floorplan = {
  wallHeight: 260,
  wallColor: "#F2EEE8",
  rooms: [
    { id: "r1", name: "Woonkamer", x: 0, y: 0, w: 620, h: 450, floor: "eiken" },
    { id: "r2", name: "Keuken", x: 620, y: 0, w: 320, h: 300, floor: "terrazzo" },
  ],
  openings: [
    { id: "o1", type: "door", roomId: "r2", wall: "w", offset: 180, width: 90 },
    { id: "o2", type: "window", roomId: "r1", wall: "n", offset: 150, width: 220 },
    { id: "o3", type: "door", roomId: "r1", wall: "s", offset: 60, width: 90 },
    { id: "o4", type: "window", roomId: "r2", wall: "e", offset: 80, width: 140 },
    { id: "o5", type: "window", roomId: "r1", wall: "w", offset: 140, width: 160 },
  ],
  items: [
    { id: "i0", type: "vloerkleed", name: "Vloerkleed", x: 140, y: 170, w: 290, d: 200, h: 1, rotation: 0, color: "#D8CBB6" },
    { id: "i1", type: "bank", name: "Bank", x: 170, y: 290, w: 230, d: 95, h: 80, rotation: 180, color: "#B9AE9C" },
    { id: "i2", type: "salontafel", name: "Salontafel", x: 230, y: 200, w: 110, d: 60, h: 40, rotation: 0, color: "#8A6A4B" },
    { id: "i3", type: "tv-meubel", name: "Dressoir", x: 190, y: 10, w: 180, d: 40, h: 50, rotation: 0, color: "#5E4B3A" },
    { id: "i4", type: "plant", name: "Plant", x: 20, y: 20, w: 50, d: 50, h: 140, rotation: 0, color: "#6F8A5E" },
    { id: "i5", type: "eettafel", name: "Eettafel", x: 470, y: 120, w: 90, d: 180, h: 75, rotation: 0, color: "#9C7A55" },
    { id: "i9", type: "stoel", name: "Stoel", x: 425, y: 160, w: 45, d: 50, h: 85, rotation: 90, color: "#6E5A47" },
    { id: "i10", type: "stoel", name: "Stoel", x: 425, y: 230, w: 45, d: 50, h: 85, rotation: 90, color: "#6E5A47" },
    { id: "i11", type: "stoel", name: "Stoel", x: 560, y: 160, w: 45, d: 50, h: 85, rotation: 270, color: "#6E5A47" },
    { id: "i12", type: "stoel", name: "Stoel", x: 560, y: 230, w: 45, d: 50, h: 85, rotation: 270, color: "#6E5A47" },
    { id: "i6", type: "keukenblok", name: "Keukenblok", x: 640, y: 10, w: 280, d: 62, h: 90, rotation: 0, color: "#D6D0C6" },
    { id: "i13", type: "kast", name: "Hoge kast", x: 860, y: 90, w: 60, d: 62, h: 220, rotation: 0, color: "#D6D0C6" },
    { id: "i7", type: "lamp", name: "Lamp", x: 420, y: 340, w: 40, d: 40, h: 160, rotation: 0, color: "#D9B98A" },
    { id: "i8", type: "kast", name: "Boekenkast", x: 10, y: 330, w: 120, d: 40, h: 200, rotation: 270, color: "#E8E2D8" },
    { id: "i14", type: "plant", name: "Plant", x: 700, y: 230, w: 45, d: 45, h: 110, rotation: 0, color: "#6F8A5E" },
  ],
};
