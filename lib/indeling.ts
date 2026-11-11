import type { FloorItem, Floorplan, FurnitureType, Room } from "./schemas";
import { FURNITURE, centroid, footprint, openingGeom, pointInPolygon, roomEdges, roomOf, roomPoints, uid, type P } from "./floorplan";

/* ------------------------------------------------------------------ Geometrie */

const rad = (deg: number) => (deg * Math.PI) / 180;

/** Midden van een meubel (de footprint is altijd om het midden heen). */
export function itemCenter(it: Pick<FloorItem, "x" | "y" | "w" | "d" | "rotation">): P {
  const f = footprint(it);
  return { x: it.x + f.w / 2, y: it.y + f.h / 2 };
}

/** Van meubel-coördinaten (midden = 0,0; -y = achterkant) naar de plattegrond. */
function toWorld(it: Pick<FloorItem, "x" | "y" | "w" | "d" | "rotation">, p: P): P {
  const c = itemCenter(it);
  const t = rad(it.rotation);
  return { x: c.x + p.x * Math.cos(t) - p.y * Math.sin(t), y: c.y + p.x * Math.sin(t) + p.y * Math.cos(t) };
}

/** Omtrek van een meubel als veelhoek (rond = ovaal met 20 punten). */
export function itemPolygon(it: FloorItem): P[] {
  const round = it.shape === "round" || it.type === "plant" || it.type === "lamp";
  if (round) {
    return Array.from({ length: 20 }, (_, i) => {
      const a = (i / 20) * Math.PI * 2;
      return toWorld(it, { x: (Math.cos(a) * it.w) / 2, y: (Math.sin(a) * it.d) / 2 });
    });
  }
  return rectLocal(it, -it.w / 2, -it.d / 2, it.w / 2, it.d / 2);
}

/** Rechthoek in meubel-coördinaten, als veelhoek in de plattegrond. */
function rectLocal(it: Pick<FloorItem, "x" | "y" | "w" | "d" | "rotation">, x1: number, y1: number, x2: number, y2: number): P[] {
  return [
    { x: x1, y: y1 },
    { x: x2, y: y1 },
    { x: x2, y: y2 },
    { x: x1, y: y2 },
  ].map((p) => toWorld(it, p));
}

function cross(o: P, a: P, b: P) {
  return (a.x - o.x) * (b.y - o.y) - (a.y - o.y) * (b.x - o.x);
}

function segIntersect(a: P, b: P, c: P, d: P) {
  const d1 = cross(c, d, a);
  const d2 = cross(c, d, b);
  const d3 = cross(a, b, c);
  const d4 = cross(a, b, d);
  return ((d1 > 0 && d2 < 0) || (d1 < 0 && d2 > 0)) && ((d3 > 0 && d4 < 0) || (d3 < 0 && d4 > 0));
}

function edgesOf(poly: P[]) {
  return poly.map((a, i) => [a, poly[(i + 1) % poly.length]] as const);
}

export function polysOverlap(A: P[], B: P[]) {
  for (const [a, b] of edgesOf(A)) for (const [c, d] of edgesOf(B)) if (segIntersect(a, b, c, d)) return true;
  return pointInPolygon(A[0], B) || pointInPolygon(B[0], A);
}

function pointSegDist(p: P, a: P, b: P) {
  const vx = b.x - a.x;
  const vy = b.y - a.y;
  const L2 = vx * vx + vy * vy || 1;
  const t = Math.max(0, Math.min(1, ((p.x - a.x) * vx + (p.y - a.y) * vy) / L2));
  return Math.hypot(p.x - (a.x + vx * t), p.y - (a.y + vy * t));
}

export function polyDistance(A: P[], B: P[]) {
  if (polysOverlap(A, B)) return 0;
  let best = Infinity;
  for (const p of A) for (const [a, b] of edgesOf(B)) best = Math.min(best, pointSegDist(p, a, b));
  for (const p of B) for (const [a, b] of edgesOf(A)) best = Math.min(best, pointSegDist(p, a, b));
  return best;
}

/** Ligt de veelhoek helemaal binnen de ruimte (met een paar cm speling)? */
function insideRoom(poly: P[], room: Room, slack = 3) {
  const pts = roomPoints(room);
  const c = centroid(poly);
  for (const p of poly) {
    const L = Math.hypot(p.x - c.x, p.y - c.y) || 1;
    const q = { x: p.x - ((p.x - c.x) / L) * slack, y: p.y - ((p.y - c.y) / L) * slack };
    if (!pointInPolygon(q, pts)) return false;
  }
  // een wand die er dwars doorheen loopt (L-vorm) telt ook als "buiten"
  for (const [a, b] of edgesOf(pts)) for (const [c2, d] of edgesOf(poly)) if (segIntersect(a, b, c2, d)) return false;
  return true;
}

/** Het kwart cirkel waarin een deur openslaat. */
function doorSwing(plan: Floorplan, doorId: string): P[] | null {
  const o = plan.openings.find((x) => x.id === doorId);
  if (!o || o.type !== "door") return null;
  const g = openingGeom(o, plan.rooms);
  if (!g) return null;
  const pts: P[] = [g.a];
  for (let i = 0; i <= 8; i++) {
    const phi = (i / 8) * (Math.PI / 2);
    pts.push({
      x: g.a.x + o.width * (Math.cos(phi) * g.n.x + Math.sin(phi) * g.dir.x),
      y: g.a.y + o.width * (Math.cos(phi) * g.n.y + Math.sin(phi) * g.dir.y),
    });
  }
  return pts;
}

/* ------------------------------------------------------------------ Regels */

/** Telt niet mee als obstakel. */
const FLAT = new Set<FurnitureType>(["vloerkleed"]);
/** Kleine of verplaatsbare dingen: geen doorloop-controle. */
const SMALL = new Set<FurnitureType>(["vloerkleed", "plant", "lamp", "stoel", "nachtkastje", "salontafel"]);
/** Mag onder of tegen een tafel/bureau staan. */
const TUCK = new Set<FurnitureType>(["stoel"]);
const TABLES = new Set<FurnitureType>(["eettafel", "bureau"]);
/** Heeft vrije ruimte voor nodig (cm). */
const FRONT: Partial<Record<FurnitureType, number>> = { kast: 70, dressoir: 60, keukenblok: 100, "tv-meubel": 40, bureau: 70 };

export type Check = { level: "warn" | "tip"; text: string; ids: string[] };

const cm = (v: number) => `${Math.round(v)} cm`;

/** Controleert de indeling: overlap, door de muur, deuren, ramen en loopruimte. */
export function checkLayout(plan: Floorplan): Check[] {
  const out: Check[] = [];
  const solid = plan.items.filter((i) => !FLAT.has(i.type));
  const poly = new Map(plan.items.map((i) => [i.id, itemPolygon(i)]));

  // door de muur of buiten elke ruimte
  for (const it of plan.items) {
    const room = roomOf(plan, it);
    if (!room) out.push({ level: "warn", text: `${it.name} staat buiten de ruimtes.`, ids: [it.id] });
    else if (!insideRoom(poly.get(it.id)!, room)) out.push({ level: "warn", text: `${it.name} steekt door de muur van ${room.name}.`, ids: [it.id] });
  }

  // over elkaar heen
  for (let i = 0; i < solid.length; i++) {
    for (let j = i + 1; j < solid.length; j++) {
      const a = solid[i];
      const b = solid[j];
      if ((TUCK.has(a.type) && TABLES.has(b.type)) || (TUCK.has(b.type) && TABLES.has(a.type))) continue;
      if (polysOverlap(poly.get(a.id)!, poly.get(b.id)!)) out.push({ level: "warn", text: `${a.name} en ${b.name} staan over elkaar heen.`, ids: [a.id, b.id] });
    }
  }

  // deuren
  for (const o of plan.openings.filter((x) => x.type === "door")) {
    const swing = doorSwing(plan, o.id);
    if (!swing) continue;
    const room = plan.rooms.find((r) => r.id === o.roomId);
    for (const it of solid) {
      if (polysOverlap(swing, poly.get(it.id)!)) out.push({ level: "warn", text: `De deur van ${room?.name ?? "de ruimte"} slaat tegen ${it.name}.`, ids: [it.id] });
    }
  }

  // ramen achter hoge meubels
  for (const o of plan.openings.filter((x) => x.type === "window")) {
    const g = openingGeom(o, plan.rooms);
    if (!g) continue;
    for (const it of solid.filter((i) => i.h > 110)) {
      const p = poly.get(it.id)!;
      const near = Math.min(...p.map((q) => pointSegDist(q, g.a, g.b)));
      if (near < 25) out.push({ level: "tip", text: `${it.name} (${cm(it.h)} hoog) staat voor een raam en houdt licht tegen.`, ids: [it.id] });
    }
  }

  // ruimte vóór kasten, keukenblok en bureau
  for (const it of solid) {
    const need = FRONT[it.type];
    const room = roomOf(plan, it);
    if (!need || !room) continue;
    const strip = rectLocal(it, -it.w / 2 + 5, it.d / 2 + 1, it.w / 2 - 5, it.d / 2 + need);
    const hit = solid.find((o) => o.id !== it.id && !TUCK.has(o.type) && polysOverlap(strip, poly.get(o.id)!));
    if (hit) out.push({ level: "tip", text: `Vóór ${it.name} is minder dan ${cm(need)} vrij: ${hit.name} staat in de weg.`, ids: [it.id, hit.id] });
    else if (!insideRoom(strip, room, 1)) out.push({ level: "tip", text: `Vóór ${it.name} is minder dan ${cm(need)} vrij tot de muur.`, ids: [it.id] });
  }

  // bed: bereikbaar van de zijkant
  for (const it of solid.filter((i) => i.type === "bed")) {
    const room = roomOf(plan, it);
    if (!room) continue;
    const side = (sx: number) => {
      const y1 = -it.d / 2 + it.d * 0.35;
      const strip = sx < 0 ? rectLocal(it, -it.w / 2 - 50, y1, -it.w / 2 - 1, it.d / 2) : rectLocal(it, it.w / 2 + 1, y1, it.w / 2 + 50, it.d / 2);
      return insideRoom(strip, room, 1) && !solid.some((o) => o.id !== it.id && polysOverlap(strip, poly.get(o.id)!));
    };
    const free = [side(-1), side(1)].filter(Boolean).length;
    if (free === 0) out.push({ level: "warn", text: `${it.name} is van geen enkele kant goed bereikbaar; 50 cm naast het bed is prettig.`, ids: [it.id] });
    else if (free === 1 && it.w >= 140) out.push({ level: "tip", text: `${it.name} is maar aan één kant bereikbaar. Voor twee personen is aan beide kanten 50 cm fijn.`, ids: [it.id] });
  }

  // eettafel: ruimte voor stoelen
  for (const it of solid.filter((i) => i.type === "eettafel")) {
    const room = roomOf(plan, it);
    if (!room) continue;
    const sides = [
      rectLocal(it, -it.w / 2, -it.d / 2 - 60, it.w / 2, -it.d / 2 - 1),
      rectLocal(it, -it.w / 2, it.d / 2 + 1, it.w / 2, it.d / 2 + 60),
    ];
    const blocked = sides.filter((s) => !insideRoom(s, room, 1) || solid.some((o) => o.id !== it.id && !TUCK.has(o.type) && polysOverlap(s, poly.get(o.id)!))).length;
    if (blocked > 0) out.push({ level: "tip", text: `Rond ${it.name} is niet overal 60 cm om een stoel naar achteren te schuiven.`, ids: [it.id] });
  }

  // krappe doorgangen tussen grote meubels
  const big = solid.filter((i) => !SMALL.has(i.type));
  for (let i = 0; i < big.length; i++) {
    for (let j = i + 1; j < big.length; j++) {
      const a = big[i];
      const b = big[j];
      if (roomOf(plan, a)?.id !== roomOf(plan, b)?.id) continue;
      if ([a.type, b.type].every((t) => t === "bank" || t === "fauteuil")) continue;
      const d = polyDistance(poly.get(a.id)!, poly.get(b.id)!);
      if (d > 3 && d < 60) out.push({ level: "tip", text: `Tussen ${a.name} en ${b.name} is maar ${cm(d)}; 70 cm loopt prettig.`, ids: [a.id, b.id] });
    }
  }

  // dubbele meldingen weg
  const seen = new Set<string>();
  return out
    .filter((c) => (seen.has(c.text) ? false : (seen.add(c.text), true)))
    .sort((a, b) => (a.level === b.level ? 0 : a.level === "warn" ? -1 : 1));
}

/* ------------------------------------------------------------------ Past het? */

export type FitResult =
  | { ok: true; item: FloorItem; roomy: boolean; note: string }
  | { ok: false; note: string };

/**
 * Zoekt een plek voor een meubel in een ruimte: liefst met de rug tegen een wand, niet over andere meubels,
 * niet in de draaicirkel van een deur en met ruimte ervoor.
 */
export function findSpot(
  plan: Floorplan,
  roomId: string,
  spec: { type: FurnitureType; name: string; w: number; d: number; h: number; color?: string; shape?: "rect" | "round" },
): FitResult {
  const room = plan.rooms.find((r) => r.id === roomId);
  if (!room) return { ok: false, note: "Kies eerst een ruimte." };
  const pts = roomPoints(room);
  const base: FloorItem = {
    id: uid(),
    type: spec.type,
    name: spec.name,
    w: Math.round(spec.w),
    d: Math.round(spec.d),
    h: Math.round(spec.h),
    color: spec.color ?? FURNITURE[spec.type]?.color ?? "#B9AE9C",
    rotation: 0,
    x: 0,
    y: 0,
    ...(spec.shape ? { shape: spec.shape } : {}),
  };

  const longest = Math.max(...roomEdges(room).map((e) => Math.hypot(e.b.x - e.a.x, e.b.y - e.a.y)));
  if (Math.min(base.w, base.d) > Math.min(room.w, room.h) || Math.max(base.w, base.d) > Math.max(longest, room.w, room.h)) {
    return { ok: false, note: `${spec.name} (${base.w} × ${base.d} cm) is groter dan ${room.name}.` };
  }

  const others = plan.items.filter((i) => !FLAT.has(i.type));
  const otherPolys = others.map(itemPolygon);
  const swings = plan.openings.filter((o) => o.type === "door").map((o) => doorSwing(plan, o.id)).filter((s): s is P[] => !!s);
  const need = FRONT[spec.type] ?? (spec.type === "bank" || spec.type === "bed" ? 60 : 40);
  const flat = FLAT.has(spec.type);

  const place = (cx: number, cy: number, rotation: number): FloorItem => {
    const f = footprint({ w: base.w, d: base.d, rotation });
    return { ...base, rotation, x: Math.round(cx - f.w / 2), y: Math.round(cy - f.h / 2) };
  };
  const fits = (it: FloorItem) => {
    const p = itemPolygon(it);
    if (!insideRoom(p, room)) return false;
    if (flat) return true;
    if (otherPolys.some((o) => polysOverlap(p, o))) return false;
    return !swings.some((s) => polysOverlap(p, s));
  };
  const roomyFront = (it: FloorItem) => {
    if (flat) return true;
    const strip = rectLocal(it, -it.w / 2, it.d / 2 + 1, it.w / 2, it.d / 2 + need);
    return insideRoom(strip, room, 1) && !otherPolys.some((o) => polysOverlap(strip, o)) && !swings.some((s) => polysOverlap(strip, s));
  };

  const c = centroid(pts);
  let best: { it: FloorItem; score: number } | null = null;
  const consider = (it: FloorItem, bonus: number) => {
    if (!fits(it)) return;
    const roomy = roomyFront(it);
    const ic = itemCenter(it);
    const score = (roomy ? 1000 : 0) + bonus - Math.hypot(ic.x - c.x, ic.y - c.y) / 10;
    if (!best || score > best.score) best = { it, score };
  };

  if (!flat) {
    // tegen elke wand, rug naar de muur
    for (const e of roomEdges(room)) {
      const L = Math.hypot(e.b.x - e.a.x, e.b.y - e.a.y);
      if (L < base.w) continue;
      const dir = { x: (e.b.x - e.a.x) / L, y: (e.b.y - e.a.y) / L };
      let n = { x: -dir.y, y: dir.x };
      const mid = { x: (e.a.x + e.b.x) / 2, y: (e.a.y + e.b.y) / 2 };
      if (!pointInPolygon({ x: mid.x + n.x * 5, y: mid.y + n.y * 5 }, pts)) n = { x: -n.x, y: -n.y };
      // achterkant (lokaal -y) wijst naar de muur: (sin t, -cos t) = -n
      const rotation = Math.round(((Math.atan2(-n.x, n.y) * 180) / Math.PI + 360) % 360);
      for (let s = base.w / 2 + 2; s <= L - base.w / 2 - 2; s += 10) {
        const p = { x: e.a.x + dir.x * s + n.x * (base.d / 2 + 2), y: e.a.y + dir.y * s + n.y * (base.d / 2 + 2) };
        consider(place(p.x, p.y, rotation), 200);
      }
    }
  }
  // vrij in de ruimte
  if (!best || flat) {
    for (let x = room.x; x <= room.x + room.w; x += 10) {
      for (let y = room.y; y <= room.y + room.h; y += 10) {
        consider(place(x, y, 0), flat ? 300 - Math.hypot(x - c.x, y - c.y) : 0);
        if (!flat) consider(place(x, y, 90), 0);
      }
    }
  }

  const found = best as { it: FloorItem; score: number } | null;
  if (!found) return { ok: false, note: `Er is in ${room.name} nu geen vrije plek van ${base.w} × ${base.d} cm. Schuif iets op, of kies een kleiner formaat.` };
  const roomy = roomyFront(found.it);
  return {
    ok: true,
    item: found.it,
    roomy,
    note: roomy
      ? `Past in ${room.name}, met genoeg ruimte ervoor.`
      : `Past in ${room.name}, maar ervoor wordt het krap (minder dan ${cm(need)}).`,
  };
}

/** Raadt het soort meubel uit een productnaam. */
export function guessFurniture(name: string, category = ""): FurnitureType | null {
  const t = `${name} ${category}`.toLowerCase();
  const rules: [RegExp, FurnitureType][] = [
    [/hoekbank|bank|sofa|loveseat/, "bank"],
    [/fauteuil|stoel met armleuning|lounge ?stoel|leesstoel/, "fauteuil"],
    [/salontafel|koffietafel/, "salontafel"],
    [/eettafel|keukentafel/, "eettafel"],
    [/bureau|werktafel/, "bureau"],
    [/stoel|kruk/, "stoel"],
    [/nachtkast/, "nachtkastje"],
    [/bed|boxspring/, "bed"],
    [/tv[- ]?meubel|tv[- ]?kast/, "tv-meubel"],
    [/dressoir|ladekast|commode/, "dressoir"],
    [/kast|vakkenkast|boekenkast|wandkast/, "kast"],
    [/vloerkleed|kleed|tapijt/, "vloerkleed"],
    [/plant|boom/, "plant"],
    [/lamp|verlichting/, "lamp"],
    [/keuken/, "keukenblok"],
  ];
  for (const [re, type] of rules) if (re.test(t)) return type;
  return /meubel/.test(t) ? "overig" : null;
}
