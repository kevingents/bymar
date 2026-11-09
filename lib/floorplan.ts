import type { FloorItem, Floorplan, FurnitureType, Opening, Room, Wall } from "./schemas";

export const uid = () =>
  typeof crypto !== "undefined" && "randomUUID" in crypto
    ? crypto.randomUUID()
    : Math.random().toString(36).slice(2) + Date.now().toString(36);

export const WALL_THICKNESS = 10; // cm
export const DOOR_HEIGHT = 210;
export const WINDOW_SILL = 90;
export const WINDOW_HEIGHT = 130;

export const FLOORS: { key: string; label: string; color: string }[] = [
  { key: "eiken", label: "Eiken", color: "#C8A27A" },
  { key: "licht-eiken", label: "Licht eiken", color: "#DCC3A1" },
  { key: "noten", label: "Noten", color: "#7A5638" },
  { key: "beton", label: "Beton", color: "#B9B6B0" },
  { key: "tegel-wit", label: "Witte tegel", color: "#ECEAE6" },
  { key: "terrazzo", label: "Terrazzo", color: "#E2DCD2" },
  { key: "tapijt", label: "Tapijt", color: "#A9A08F" },
];
export const floorColor = (key: string) => FLOORS.find((f) => f.key === key)?.color ?? "#D9C6AA";

/** Standaardmaten (cm) en kleur per meubeltype. */
export const FURNITURE: Record<FurnitureType, { label: string; w: number; d: number; h: number; color: string }> = {
  bank: { label: "Bank", w: 220, d: 95, h: 80, color: "#B9AE9C" },
  fauteuil: { label: "Fauteuil", w: 85, d: 85, h: 80, color: "#A88C6E" },
  salontafel: { label: "Salontafel", w: 110, d: 60, h: 40, color: "#8A6A4B" },
  eettafel: { label: "Eettafel", w: 180, d: 90, h: 75, color: "#9C7A55" },
  stoel: { label: "Stoel", w: 45, d: 50, h: 85, color: "#6E5A47" },
  bed: { label: "Bed", w: 160, d: 210, h: 50, color: "#E6DED2" },
  nachtkastje: { label: "Nachtkastje", w: 45, d: 40, h: 50, color: "#9C7A55" },
  kast: { label: "Kast", w: 100, d: 60, h: 200, color: "#E8E2D8" },
  dressoir: { label: "Dressoir", w: 180, d: 45, h: 80, color: "#8A6A4B" },
  "tv-meubel": { label: "Tv-meubel", w: 180, d: 40, h: 50, color: "#5E4B3A" },
  bureau: { label: "Bureau", w: 140, d: 70, h: 75, color: "#B08C66" },
  vloerkleed: { label: "Vloerkleed", w: 200, d: 290, h: 1, color: "#D8CBB6" },
  plant: { label: "Plant", w: 50, d: 50, h: 140, color: "#6F8A5E" },
  lamp: { label: "Vloerlamp", w: 40, d: 40, h: 160, color: "#D9B98A" },
  keukenblok: { label: "Keukenblok", w: 240, d: 62, h: 90, color: "#D6D0C6" },
  overig: { label: "Overig", w: 60, d: 60, h: 60, color: "#B5ADA3" },
};

export function emptyFloorplan(): Floorplan {
  return {
    wallHeight: 260,
    wallColor: "#F2EEE8",
    rooms: [{ id: uid(), name: "Woonkamer", x: 0, y: 0, w: 600, h: 450, floor: "eiken" }],
    openings: [],
    items: [],
  };
}

/** Voetafdruk op de plattegrond (na rotatie), linksboven blijft (x, y). */
export function footprint(i: Pick<FloorItem, "w" | "d" | "rotation">) {
  const turned = Math.round(i.rotation / 90) % 2 !== 0;
  return turned ? { w: i.d, h: i.w } : { w: i.w, h: i.d };
}

/** Absolute lijn van een wand van een ruimte. */
export function wallLine(r: Room, wall: Wall) {
  switch (wall) {
    case "n":
      return { x1: r.x, y1: r.y, x2: r.x + r.w, y2: r.y };
    case "s":
      return { x1: r.x, y1: r.y + r.h, x2: r.x + r.w, y2: r.y + r.h };
    case "w":
      return { x1: r.x, y1: r.y, x2: r.x, y2: r.y + r.h };
    case "e":
      return { x1: r.x + r.w, y1: r.y, x2: r.x + r.w, y2: r.y + r.h };
  }
}

export const wallLength = (r: Room, wall: Wall) => (wall === "n" || wall === "s" ? r.w : r.h);

/** Opening als absoluut lijnstuk. */
export function openingLine(o: Opening, rooms: Room[]) {
  const r = rooms.find((x) => x.id === o.roomId);
  if (!r) return null;
  const l = wallLine(r, o.wall);
  const horizontal = l.y1 === l.y2;
  return horizontal
    ? { horizontal, fixed: l.y1, a: l.x1 + o.offset, b: l.x1 + o.offset + o.width, o }
    : { horizontal, fixed: l.x1, a: l.y1 + o.offset, b: l.y1 + o.offset + o.width, o };
}

export type WallSegment = {
  horizontal: boolean;
  fixed: number; // y voor horizontaal, x voor verticaal
  a: number;
  b: number;
  /** "full" = dicht, "door" = alleen boven de deur, "window" = onder- en bovenstuk */
  kind: "full" | "door" | "window";
};

/**
 * Bouwt wandstukken voor 3D: dedupliceert gedeelde wanden tussen ruimtes en
 * knipt deuren en ramen eruit (ook als ze op de wand van de buurkamer zijn gezet).
 */
export function wallSegments(plan: Floorplan): WallSegment[] {
  const lines = new Map<string, { horizontal: boolean; fixed: number; a: number; b: number }>();
  for (const r of plan.rooms) {
    for (const w of ["n", "e", "s", "w"] as Wall[]) {
      const l = wallLine(r, w);
      const horizontal = l.y1 === l.y2;
      const fixed = horizontal ? l.y1 : l.x1;
      const a = horizontal ? Math.min(l.x1, l.x2) : Math.min(l.y1, l.y2);
      const b = horizontal ? Math.max(l.x1, l.x2) : Math.max(l.y1, l.y2);
      lines.set(`${horizontal ? "h" : "v"}:${fixed}:${a}:${b}`, { horizontal, fixed, a, b });
    }
  }
  const openings = plan.openings.map((o) => openingLine(o, plan.rooms)).filter((x) => x !== null);

  const out: WallSegment[] = [];
  for (const line of lines.values()) {
    const cuts = openings
      .filter((o) => o.horizontal === line.horizontal && Math.abs(o.fixed - line.fixed) < 1 && o.b > line.a && o.a < line.b)
      .map((o) => ({ a: Math.max(o.a, line.a), b: Math.min(o.b, line.b), kind: o.o.type }))
      .sort((p, q) => p.a - q.a);
    let cursor = line.a;
    for (const c of cuts) {
      if (c.a > cursor) out.push({ ...line, a: cursor, b: c.a, kind: "full" });
      out.push({ ...line, a: c.a, b: c.b, kind: c.kind === "door" ? "door" : "window" });
      cursor = Math.max(cursor, c.b);
    }
    if (cursor < line.b) out.push({ ...line, a: cursor, b: line.b, kind: "full" });
  }
  return out;
}

export function bounds(plan: Floorplan) {
  if (plan.rooms.length === 0) return { minX: 0, minY: 0, maxX: 600, maxY: 450 };
  let minX = Infinity,
    minY = Infinity,
    maxX = -Infinity,
    maxY = -Infinity;
  for (const r of plan.rooms) {
    minX = Math.min(minX, r.x);
    minY = Math.min(minY, r.y);
    maxX = Math.max(maxX, r.x + r.w);
    maxY = Math.max(maxY, r.y + r.h);
  }
  return { minX, minY, maxX, maxY };
}

const WALL_NAMES: Record<Wall, string> = { n: "boven", e: "rechts", s: "onder", w: "links" };

/** Tekstuele samenvatting voor de AI. */
export function floorplanSummary(plan: Floorplan | null | undefined) {
  if (!plan || plan.rooms.length === 0) return "";
  const lines: string[] = [`Wandhoogte ${plan.wallHeight} cm.`];
  for (const r of plan.rooms) {
    lines.push(
      `Ruimte "${r.name}": ${r.w} x ${r.h} cm (${((r.w * r.h) / 10000).toFixed(1)} m2), x ${r.x}-${r.x + r.w}, y ${r.y}-${r.y + r.h}, vloer ${r.floor}.`,
    );
    for (const o of plan.openings.filter((x) => x.roomId === r.id)) {
      lines.push(
        `  ${o.type === "door" ? "Deur" : "Raam"} in wand ${WALL_NAMES[o.wall]}, ${o.width} cm breed, vanaf ${o.offset} cm.`,
      );
    }
  }
  if (plan.items.length) {
    lines.push("Meubels:");
    for (const i of plan.items) {
      const f = footprint(i);
      lines.push(`  ${i.name} (${i.type}) op x ${i.x}, y ${i.y}, ${f.w} x ${f.h} cm, ${i.h} cm hoog.`);
    }
  }
  return lines.join("\n");
}

export function roomOf(plan: Floorplan, item: Pick<FloorItem, "x" | "y" | "w" | "d" | "rotation">) {
  const f = footprint(item);
  const cx = item.x + f.w / 2;
  const cy = item.y + f.h / 2;
  return plan.rooms.find((r) => cx >= r.x && cx <= r.x + r.w && cy >= r.y && cy <= r.y + r.h) ?? null;
}

/** Zet de herkenning uit een foto om naar een bruikbare plattegrond (genormaliseerd en op 5 cm afgerond). */
export function floorplanFromDetected(
  det: import("./schemas").FloorplanFromImage,
  base?: Pick<Floorplan, "wallHeight" | "wallColor">,
): Floorplan {
  const r5 = (v: number) => Math.round(v / 5) * 5;
  const valid = det.rooms.filter((r) => r.w >= 50 && r.h >= 50);
  const minX = Math.min(...valid.map((r) => r.x), 0);
  const minY = Math.min(...valid.map((r) => r.y), 0);
  const rooms: Room[] = valid.map((r) => {
    const name = r.name.toLowerCase();
    const floor = /bad|toilet|wc|keuken/.test(name) ? "tegel-wit" : /balkon|terras/.test(name) ? "beton" : "eiken";
    return { id: uid(), name: r.name, x: r5(r.x - minX), y: r5(r.y - minY), w: r5(r.w), h: r5(r.h), floor };
  });
  const openings: Opening[] = [];
  for (const o of det.openings) {
    const room = rooms.find((r) => r.name.toLowerCase() === o.room.toLowerCase());
    if (!room) continue;
    const len = wallLength(room, o.wall);
    const width = Math.min(r5(o.width), len - 10);
    if (width < 40) continue;
    openings.push({ id: uid(), type: o.type, roomId: room.id, wall: o.wall, width, offset: Math.max(0, Math.min(len - width, r5(o.offset))) });
  }
  return { wallHeight: base?.wallHeight ?? 260, wallColor: base?.wallColor ?? "#F2EEE8", rooms, openings, items: [] };
}
