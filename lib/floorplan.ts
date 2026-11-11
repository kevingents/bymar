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

/** Voetafdruk op de plattegrond (omhullende na rotatie, elke hoek); linksboven blijft (x, y). */
export function footprint(i: Pick<FloorItem, "w" | "d" | "rotation">) {
  const t = ((((i.rotation % 360) + 360) % 360) * Math.PI) / 180;
  const c = Math.abs(Math.cos(t));
  const sn = Math.abs(Math.sin(t));
  const r1 = (v: number) => Math.round(v * 10) / 10;
  return { w: r1(i.w * c + i.d * sn), h: r1(i.w * sn + i.d * c) };
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

/* ------------------------------------------------------------------ Vrije vormen */

export type P = { x: number; y: number };
const sub = (a: P, b: P) => ({ x: a.x - b.x, y: a.y - b.y });
const len = (v: P) => Math.hypot(v.x, v.y);

/** Hoekpunten van een ruimte, met de klok mee (rechthoek: linksboven, rechtsboven, rechtsonder, linksonder). */
export function roomPoints(r: Room): P[] {
  if (r.points && r.points.length >= 3) return r.points;
  return [
    { x: r.x, y: r.y },
    { x: r.x + r.w, y: r.y },
    { x: r.x + r.w, y: r.y + r.h },
    { x: r.x, y: r.y + r.h },
  ];
}

export function isPolygon(r: Room) {
  return !!r.points && r.points.length >= 3;
}

/** Omhullende rechthoek, zodat x/y/w/h altijd blijven kloppen. */
export function bboxOf(points: P[]) {
  const xs = points.map((p) => p.x);
  const ys = points.map((p) => p.y);
  const x = Math.min(...xs);
  const y = Math.min(...ys);
  return { x, y, w: Math.max(...xs) - x, h: Math.max(...ys) - y };
}

export function withPoints(r: Room, points: P[]): Room {
  return { ...r, ...bboxOf(points), points };
}

export function polygonArea(points: P[]) {
  let a = 0;
  for (let i = 0; i < points.length; i++) {
    const p = points[i];
    const q = points[(i + 1) % points.length];
    a += p.x * q.y - q.x * p.y;
  }
  return a / 2; // positief = met de klok mee (y naar beneden)
}

export function roomArea(r: Room) {
  return Math.abs(polygonArea(roomPoints(r)));
}

export function roomPerimeter(r: Room) {
  const pts = roomPoints(r);
  return pts.reduce((s, p, i) => s + len(sub(pts[(i + 1) % pts.length], p)), 0);
}

export function centroid(points: P[]): P {
  const a = polygonArea(points);
  if (Math.abs(a) < 1) return { x: points.reduce((s, p) => s + p.x, 0) / points.length, y: points.reduce((s, p) => s + p.y, 0) / points.length };
  let cx = 0;
  let cy = 0;
  for (let i = 0; i < points.length; i++) {
    const p = points[i];
    const q = points[(i + 1) % points.length];
    const f = p.x * q.y - q.x * p.y;
    cx += (p.x + q.x) * f;
    cy += (p.y + q.y) * f;
  }
  return { x: cx / (6 * a), y: cy / (6 * a) };
}

export function pointInPolygon(p: P, pts: P[]) {
  let inside = false;
  for (let i = 0, j = pts.length - 1; i < pts.length; j = i++) {
    const a = pts[i];
    const b = pts[j];
    if (a.y > p.y !== b.y > p.y && p.x < ((b.x - a.x) * (p.y - a.y)) / (b.y - a.y) + a.x) inside = !inside;
  }
  return inside;
}

/** Wanden van een ruimte als lijnstukken. */
export function roomEdges(r: Room) {
  const pts = roomPoints(r);
  return pts.map((a, i) => ({ i, a, b: pts[(i + 1) % pts.length] }));
}

export function edgeLength(r: Room, edge: number) {
  const e = roomEdges(r)[edge];
  return e ? len(sub(e.b, e.a)) : 0;
}

/** Lengte van de wand waar een opening in zit (oude of nieuwe manier). */
export function openingWallLength(o: Opening, r: Room) {
  return o.edge !== undefined && isPolygon(r) ? edgeLength(r, o.edge) : wallLength(r, o.wall);
}

/** Opening als lijnstuk (a → b) met de normaal die de ruimte in wijst. */
export function openingGeom(o: Opening, rooms: Room[]) {
  const r = rooms.find((x) => x.id === o.roomId);
  if (!r) return null;
  let A: P;
  let B: P;
  if (o.edge !== undefined && isPolygon(r)) {
    const e = roomEdges(r)[o.edge];
    if (!e) return null;
    const L = len(sub(e.b, e.a)) || 1;
    const d = { x: (e.b.x - e.a.x) / L, y: (e.b.y - e.a.y) / L };
    A = { x: e.a.x + d.x * o.offset, y: e.a.y + d.y * o.offset };
    B = { x: A.x + d.x * o.width, y: A.y + d.y * o.width };
  } else {
    const l = wallLine(r, o.wall);
    const horizontal = l.y1 === l.y2;
    A = horizontal ? { x: l.x1 + o.offset, y: l.y1 } : { x: l.x1, y: l.y1 + o.offset };
    B = horizontal ? { x: A.x + o.width, y: A.y } : { x: A.x, y: A.y + o.width };
  }
  const L = len(sub(B, A)) || 1;
  const dir = { x: (B.x - A.x) / L, y: (B.y - A.y) / L };
  // normaal naar binnen: test welke kant in de ruimte ligt
  const mid = { x: (A.x + B.x) / 2, y: (A.y + B.y) / 2 };
  const n1 = { x: -dir.y, y: dir.x };
  const inside = pointInPolygon({ x: mid.x + n1.x * 5, y: mid.y + n1.y * 5 }, roomPoints(r));
  const n = inside ? n1 : { x: -n1.x, y: -n1.y };
  return { a: A, b: B, dir, n, room: r, o };
}

/** Zet openingen over naar de dichtstbijzijnde wand van een (nieuwe) veelhoek. */
export function remapOpenings(plan: Floorplan, roomId: string, nextRoom: Room): Opening[] {
  return plan.openings.map((o) => {
    if (o.roomId !== roomId) return o;
    const g = openingGeom(o, plan.rooms);
    if (!g) return o;
    const mid = { x: (g.a.x + g.b.x) / 2, y: (g.a.y + g.b.y) / 2 };
    let best = { edge: 0, dist: Infinity, t: 0, L: 0 };
    for (const e of roomEdges(nextRoom)) {
      const v = sub(e.b, e.a);
      const L = len(v) || 1;
      const t = ((mid.x - e.a.x) * v.x + (mid.y - e.a.y) * v.y) / (L * L);
      const tc = Math.max(0, Math.min(1, t));
      const proj = { x: e.a.x + v.x * tc, y: e.a.y + v.y * tc };
      const dd = len(sub(mid, proj));
      if (dd < best.dist) best = { edge: e.i, dist: dd, t: tc, L };
    }
    const width = Math.min(o.width, Math.max(40, best.L - 10));
    const offset = Math.max(0, Math.min(best.L - width, best.t * best.L - width / 2));
    return isPolygon(nextRoom) ? { ...o, edge: best.edge, offset: Math.round(offset), width } : { ...o, edge: undefined };
  });
}

export type WallSegment = {
  a: P;
  b: P;
  /** "full" = dicht, "door" = alleen boven de deur, "window" = onder- en bovenstuk */
  kind: "full" | "door" | "window";
};

/**
 * Bouwt wandstukken voor 3D (ook schuine wanden): dedupliceert gedeelde wanden tussen ruimtes en
 * knipt deuren en ramen eruit, ook als ze op de wand van de buurkamer zijn gezet.
 */
export function wallSegments(plan: Floorplan): WallSegment[] {
  const r1 = (v: number) => Math.round(v);
  const lines = new Map<string, { a: P; b: P }>();
  for (const r of plan.rooms) {
    for (const e of roomEdges(r)) {
      const [p, q] = [e.a, e.b].sort((u, v) => u.x - v.x || u.y - v.y);
      lines.set(`${r1(p.x)},${r1(p.y)}|${r1(q.x)},${r1(q.y)}`, { a: p, b: q });
    }
  }
  const openings = plan.openings.map((o) => openingGeom(o, plan.rooms)).filter((x) => x !== null);

  const out: WallSegment[] = [];
  for (const line of lines.values()) {
    const v = sub(line.b, line.a);
    const L = len(v);
    if (L < 1) continue;
    const d = { x: v.x / L, y: v.y / L };
    const along = (p: P) => (p.x - line.a.x) * d.x + (p.y - line.a.y) * d.y;
    const off = (p: P) => Math.abs((p.x - line.a.x) * d.y - (p.y - line.a.y) * d.x);
    const cuts = openings
      .filter((g) => off(g.a) < 2 && off(g.b) < 2)
      .map((g) => {
        const t1 = along(g.a);
        const t2 = along(g.b);
        return { s: Math.max(0, Math.min(t1, t2)), e: Math.min(L, Math.max(t1, t2)), kind: g.o.type };
      })
      .filter((c) => c.e - c.s > 1)
      .sort((p, q) => p.s - q.s);
    const at = (t: number) => ({ x: line.a.x + d.x * t, y: line.a.y + d.y * t });
    let cursor = 0;
    for (const c of cuts) {
      if (c.s > cursor) out.push({ a: at(cursor), b: at(c.s), kind: "full" });
      out.push({ a: at(c.s), b: at(c.e), kind: c.kind === "door" ? "door" : "window" });
      cursor = Math.max(cursor, c.e);
    }
    if (cursor < L) out.push({ a: at(cursor), b: at(L), kind: "full" });
  }
  return out;
}

/** Voorgemaakte vormen voor een ruimte, op basis van de omhullende rechthoek. */
export function shapePreset(r: Room, kind: "rect" | "free" | "l" | "corner" | "bay"): P[] | undefined {
  const { x, y, w, h } = r;
  const c = Math.round(Math.min(150, Math.min(w, h) / 3) / 5) * 5;
  const r5 = (v: number) => Math.round(v / 5) * 5;
  switch (kind) {
    case "rect":
      return undefined;
    case "free":
      return roomPoints(r).map((p) => ({ ...p }));
    case "l":
      return [
        { x, y },
        { x: r5(x + w * 0.55), y },
        { x: r5(x + w * 0.55), y: r5(y + h * 0.45) },
        { x: x + w, y: r5(y + h * 0.45) },
        { x: x + w, y: y + h },
        { x, y: y + h },
      ];
    case "corner":
      return [
        { x, y },
        { x: x + w - c, y },
        { x: x + w, y: y + c },
        { x: x + w, y: y + h },
        { x, y: y + h },
      ];
    case "bay": {
      // de erker valt binnen de totale maat, zodat nog eens kiezen niets laat groeien
      const b = r5(y + h - Math.min(90, h / 4));
      return [
        { x, y },
        { x: x + w, y },
        { x: x + w, y: b },
        { x: r5(x + w * 0.7), y: b },
        { x: r5(x + w * 0.62), y: y + h },
        { x: r5(x + w * 0.38), y: y + h },
        { x: r5(x + w * 0.3), y: b },
        { x, y: b },
      ];
    }
  }
}

export function bounds(plan: Floorplan) {
  if (plan.rooms.length === 0) return { minX: 0, minY: 0, maxX: 600, maxY: 450 };
  let minX = Infinity,
    minY = Infinity,
    maxX = -Infinity,
    maxY = -Infinity;
  for (const p of plan.rooms.flatMap((r) => roomPoints(r))) {
    minX = Math.min(minX, p.x);
    minY = Math.min(minY, p.y);
    maxX = Math.max(maxX, p.x);
    maxY = Math.max(maxY, p.y);
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
      isPolygon(r)
        ? `Ruimte "${r.name}": vrije vorm, ${(roomArea(r) / 10000).toFixed(1)} m2, hoekpunten (cm) ${roomPoints(r).map((p) => `(${Math.round(p.x)},${Math.round(p.y)})`).join(" ")}, vloer ${r.floor}.`
        : `Ruimte "${r.name}": ${r.w} x ${r.h} cm (${((r.w * r.h) / 10000).toFixed(1)} m2), x ${r.x}-${r.x + r.w}, y ${r.y}-${r.y + r.h}, vloer ${r.floor}.`,
    );
    for (const o of plan.openings.filter((x) => x.roomId === r.id)) {
      lines.push(
        o.edge !== undefined && isPolygon(r)
          ? `  ${o.type === "door" ? "Deur" : "Raam"} in wand ${o.edge + 1} (van hoekpunt ${o.edge + 1}), ${o.width} cm breed, vanaf ${o.offset} cm.`
          : `  ${o.type === "door" ? "Deur" : "Raam"} in wand ${WALL_NAMES[o.wall]}, ${o.width} cm breed, vanaf ${o.offset} cm.`,
      );
    }
  }
  if (plan.items.length) {
    lines.push("Meubels:");
    for (const i of plan.items) {
      const f = footprint(i);
      lines.push(`  ${i.name} (${i.type}${i.shape === "round" ? ", rond" : ""}) op x ${i.x}, y ${i.y}, ${f.w} x ${f.h} cm, ${i.h} cm hoog, gedraaid ${i.rotation}°.`);
    }
  }
  return lines.join("\n");
}

export function roomOf(plan: Floorplan, item: Pick<FloorItem, "x" | "y" | "w" | "d" | "rotation">) {
  const f = footprint(item);
  const cx = item.x + f.w / 2;
  const cy = item.y + f.h / 2;
  return plan.rooms.find((r) => pointInPolygon({ x: cx, y: cy }, roomPoints(r))) ?? null;
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

/** Maten (cm) en soort meubel uit een bouwplan; oudere plannen hebben alleen een tekst met maten. */
export function buildFurniture(guide: import("./schemas").BuildGuide) {
  const type = (guide.furniture ?? "kast") as FurnitureType;
  if (guide.size?.width && guide.size?.depth && guide.size?.height) {
    return { type, w: Math.round(guide.size.width), d: Math.round(guide.size.depth), h: Math.round(guide.size.height) };
  }
  const nums = (guide.dimensions.match(/\d+(?:[.,]\d+)?/g) ?? []).map((n) => parseFloat(n.replace(",", "."))).slice(0, 3);
  const mm = /mm/i.test(guide.dimensions);
  const cm = nums.map((n) => (mm ? n / 10 : n)).sort((a, b) => b - a);
  const [h = 80, w = 60, d = 40] = cm;
  return { type, w: Math.round(w), d: Math.round(d), h: Math.round(h) };
}

/** Kleur in de plattegrond op basis van het materiaal in het bouwplan. */
export function buildColor(guide: import("./schemas").BuildGuide) {
  const text = (guide.materials.map((m) => m.name + " " + m.spec).join(" ") + " " + guide.summary).toLowerCase();
  if (/zwart|antraciet/.test(text)) return "#2F2B28";
  if (/wit|gelakt wit|white/.test(text)) return "#F1EEE8";
  if (/noten|walnoot/.test(text)) return "#7A5638";
  if (/eiken/.test(text)) return "#C8A27A";
  if (/berken|multiplex|populier/.test(text)) return "#E3CDA8";
  if (/grenen|vuren|steigerhout/.test(text)) return "#D9B98A";
  return FURNITURE[guide.furniture ?? "kast"]?.color ?? "#CDB48F";
}

/** Houdt deuren en ramen binnen hun wand, ook nadat een hoekpunt of maat is veranderd. */
export function fitOpenings(plan: Floorplan): Floorplan {
  let changed = false;
  const openings = plan.openings.map((o) => {
    const r = plan.rooms.find((x) => x.id === o.roomId);
    if (!r) return o;
    let edge = o.edge;
    if (edge !== undefined && isPolygon(r) && edge >= roomPoints(r).length) edge = roomPoints(r).length - 1;
    const L = openingWallLength({ ...o, edge }, r);
    const width = Math.max(Math.min(40, L), Math.min(o.width, L - 10));
    const offset = Math.max(0, Math.min(o.offset, L - width));
    if (edge === o.edge && width === o.width && offset === o.offset) return o;
    changed = true;
    return { ...o, edge, width: Math.round(width), offset: Math.round(offset) };
  });
  return changed ? { ...plan, openings } : plan;
}
