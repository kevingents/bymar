import type { BuildGuide } from "./schemas";

/** Zaagplan: verdeelt onderdelen uit de zaaglijst over platen (of latten) met zo weinig mogelijk afval. */

export type Placed = { part: string; x: number; y: number; w: number; h: number; rotated: boolean };
export type Sheet = { w: number; h: number; parts: Placed[]; used: number };
export type LinearBar = { length: number; parts: { part: string; at: number; length: number }[]; used: number };
export type MaterialPlan =
  | { kind: "sheet"; material: string; thickness: number; sheetW: number; sheetH: number; sheets: Sheet[]; tooBig: string[] }
  | { kind: "linear"; material: string; thickness: number; stock: number; bars: LinearBar[]; tooBig: string[] };

const KERF = 4; // zaagsnede in mm
const LINEAR = /\b(lat|latten|balk|regel|plint|lijst|stok|rondhout|vierkant)\b/i;

type Piece = { part: string; l: number; w: number };

/** Plankjes in rijen (shelf-packing), langste eerst; draaien mag. */
function packSheets(pieces: Piece[], W: number, H: number) {
  const sorted = [...pieces].sort((a, b) => Math.max(b.l, b.w) - Math.max(a.l, a.w) || b.l * b.w - a.l * a.w);
  const sheets: { sheet: Sheet; rows: { y: number; h: number; x: number }[]; yNext: number }[] = [];
  const tooBig: string[] = [];

  for (const p of sorted) {
    // oriëntaties: liggend (lang langs plaatlengte) eerst
    const options = [
      { w: Math.max(p.l, p.w), h: Math.min(p.l, p.w), rotated: p.w > p.l },
      { w: Math.min(p.l, p.w), h: Math.max(p.l, p.w), rotated: p.l > p.w },
    ].filter((o) => o.w <= W && o.h <= H);
    if (options.length === 0) {
      tooBig.push(p.part);
      continue;
    }
    let placed = false;
    for (const s of sheets) {
      for (const o of options) {
        const row = s.rows.find((r) => o.h <= r.h && r.x + o.w <= W);
        if (row) {
          s.sheet.parts.push({ part: p.part, x: row.x, y: row.y, w: o.w, h: o.h, rotated: o.rotated });
          row.x += o.w + KERF;
          placed = true;
          break;
        }
        if (s.yNext + o.h <= H) {
          s.rows.push({ y: s.yNext, h: o.h, x: o.w + KERF });
          s.sheet.parts.push({ part: p.part, x: 0, y: s.yNext, w: o.w, h: o.h, rotated: o.rotated });
          s.yNext += o.h + KERF;
          placed = true;
          break;
        }
      }
      if (placed) break;
    }
    if (!placed) {
      const o = options[0];
      sheets.push({
        sheet: { w: W, h: H, parts: [{ part: p.part, x: 0, y: 0, w: o.w, h: o.h, rotated: o.rotated }], used: 0 },
        rows: [{ y: 0, h: o.h, x: o.w + KERF }],
        yNext: o.h + KERF,
      });
    }
  }
  return {
    sheets: sheets.map(({ sheet }) => ({ ...sheet, used: sheet.parts.reduce((s, p) => s + p.w * p.h, 0) / (W * H) })),
    tooBig,
  };
}

/** Latten/balken: eendimensionaal, first-fit decreasing. */
function packLinear(pieces: Piece[], stock: number) {
  const sorted = [...pieces].sort((a, b) => b.l - a.l);
  const bars: LinearBar[] = [];
  const tooBig: string[] = [];
  for (const p of sorted) {
    if (p.l > stock) {
      tooBig.push(p.part);
      continue;
    }
    const bar = bars.find((b) => b.parts.reduce((s, x) => s + x.length + KERF, 0) + p.l <= stock);
    if (bar) bar.parts.push({ part: p.part, at: bar.parts.reduce((s, x) => s + x.length + KERF, 0), length: p.l });
    else bars.push({ length: stock, parts: [{ part: p.part, at: 0, length: p.l }], used: 0 });
  }
  return { bars: bars.map((b) => ({ ...b, used: b.parts.reduce((s, x) => s + x.length, 0) / stock })), tooBig };
}

export function makeCutPlan(guide: BuildGuide, sheet: { w: number; h: number } = { w: 2440, h: 1220 }, linearStock = 2700): MaterialPlan[] {
  const groups = new Map<string, { material: string; thickness: number; pieces: Piece[] }>();
  for (const c of guide.cuttingList) {
    const key = `${c.material.trim().toLowerCase()}|${c.thickness}`;
    const g = groups.get(key) ?? { material: c.material.trim(), thickness: c.thickness, pieces: [] };
    for (let i = 0; i < Math.max(1, Math.round(c.quantity)); i++) g.pieces.push({ part: c.part, l: c.length, w: c.width });
    groups.set(key, g);
  }
  return [...groups.values()].map((g) => {
    const linear = LINEAR.test(g.material) || g.pieces.every((p) => Math.min(p.l, p.w) <= 70 && Math.max(p.l, p.w) > 600);
    if (linear) {
      const { bars, tooBig } = packLinear(g.pieces, linearStock);
      return { kind: "linear", material: g.material, thickness: g.thickness, stock: linearStock, bars, tooBig };
    }
    const { sheets, tooBig } = packSheets(g.pieces, sheet.w, sheet.h);
    return { kind: "sheet", material: g.material, thickness: g.thickness, sheetW: sheet.w, sheetH: sheet.h, sheets, tooBig };
  });
}
