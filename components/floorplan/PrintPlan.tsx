"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase/client";
import {
  DOOR_HEIGHT,
  FURNITURE,
  WINDOW_HEIGHT,
  WINDOW_SILL,
  bounds,
  centroid,
  edgeNormal,
  footprint,
  isPolygon,
  openingGeom,
  roomArea,
  roomEdges,
  roomOf,
  roomPoints,
  slopeDistanceAt,
} from "@/lib/floorplan";
import type { Floorplan } from "@/lib/schemas";
import type { Project } from "@/lib/types";
import { Icon } from "@/components/ui/Icon";

const SCALES = [20, 25, 50, 75, 100, 150, 200, 250];
// tekenruimte op A4 liggend (mm), na marges, titel en schaalstok
const AREA = { w: 277, h: 158 };
const nl = (v: number, d = 2) => v.toLocaleString("nl-NL", { maximumFractionDigits: d });
const pathOf = (pts: { x: number; y: number }[]) => `M${pts.map((p) => `${p.x} ${p.y}`).join(" L")} Z`;

/** Plattegrond op schaal, om te printen of als pdf te bewaren (voor winkel, aannemer of schilder). */
export function PrintPlan() {
  const { id } = useParams<{ id: string }>();
  const [project, setProject] = useState<Project | null | undefined>(undefined);

  useEffect(() => {
    supabase()
      .from("projects")
      .select("*")
      .eq("id", id)
      .maybeSingle()
      .then(({ data }) => setProject((data as Project) ?? null));
  }, [id]);

  if (project === undefined)
    return (
      <div className="grid min-h-dvh place-items-center text-ink-3">
        <Icon name="loader" size={28} />
      </div>
    );
  const plan = project?.floorplan;
  if (!project || !plan || plan.rooms.length === 0)
    return (
      <div className="mx-auto max-w-md p-8 text-center">
        <p className="text-ink-2">Er is nog geen plattegrond om af te drukken.</p>
        <Link href={`/projecten/${id}#plattegrond`} className="btn-outline mt-4">
          Naar de plattegrond
        </Link>
      </div>
    );

  return (
    <div className="print-root min-h-dvh bg-surface-2 py-4 print:bg-white print:py-0">
      <style>{`
        @page { size: A4 landscape; margin: 10mm; }
        @media print {
          html, body { background: #fff !important; }
          .no-print { display: none !important; }
          .sheet { box-shadow: none !important; margin: 0 !important; width: auto !important; }
          .sheet + .sheet { break-before: page; }
        }
      `}</style>
      <div className="no-print mx-auto mb-4 flex max-w-[297mm] flex-wrap items-center gap-2 px-3">
        <Link href={`/projecten/${id}#plattegrond`} className="btn-ghost px-2.5">
          <Icon name="arrow-left" size={18} /> Terug
        </Link>
        <p className="min-w-0 flex-1 text-sm text-ink-2">Kies bij afdrukken &ldquo;Opslaan als pdf&rdquo; om hem te bewaren of te mailen.</p>
        <button className="btn-primary" onClick={() => window.print()}>
          <Icon name="download" size={18} /> Afdrukken of pdf
        </button>
      </div>
      <Sheet1 project={project} plan={plan} />
      <Sheet2 project={project} plan={plan} />
    </div>
  );
}

function SheetFrame({ children }: { children: React.ReactNode }) {
  return (
    <div className="sheet mx-auto mb-4 w-[min(297mm,calc(100vw-24px))] overflow-hidden bg-white p-[min(8mm,3vw)] text-[#2a2520] shadow-sm print:p-0">
      {children}
    </div>
  );
}

export function Sheet1({ project, plan }: { project: Project; plan: Floorplan }) {
  const b = bounds(plan);
  const pad = 90; // cm rondom voor maatlijnen
  const wCm = b.maxX - b.minX + pad * 2;
  const hCm = b.maxY - b.minY + pad * 2;
  const scale = SCALES.find((s) => (wCm * 10) / s <= AREA.w && (hCm * 10) / s <= AREA.h) ?? SCALES[SCALES.length - 1];
  const mm = (cm: number) => (cm * 10) / scale; // papier-mm
  const pc = (paperMm: number) => (paperMm * scale) / 10; // papier-mm naar cm in de tekening
  const font = pc(2.6);
  const thin = pc(0.18);

  // maatlijnen: elke wand één keer, aan de buitenkant
  const dims: { a: { x: number; y: number }; b: { x: number; y: number }; n: { x: number; y: number }; L: number; key: string }[] = [];
  const seen = new Set<string>();
  for (const r of plan.rooms) {
    for (const e of roomEdges(r)) {
      const L = Math.hypot(e.b.x - e.a.x, e.b.y - e.a.y);
      if (L < 40) continue;
      const key = [e.a, e.b]
        .map((p) => `${Math.round(p.x)},${Math.round(p.y)}`)
        .sort()
        .join("|");
      if (seen.has(key)) continue;
      seen.add(key);
      const n = edgeNormal(r, e.i);
      dims.push({ a: e.a, b: e.b, n: { x: -n.x, y: -n.y }, L, key });
    }
  }

  const today = new Date().toLocaleDateString("nl-NL", { day: "numeric", month: "long", year: "numeric" });

  return (
    <SheetFrame>
      <div className="flex items-end justify-between border-b border-[#2a2520] pb-2">
        <div>
          <p className="font-display text-2xl leading-tight">{project.title}</p>
          <p className="text-xs">Plattegrond · {today}</p>
        </div>
        <div className="text-right text-xs">
          <p className="font-medium">Schaal 1:{scale} (op A4)</p>
          <p>Maten in meters · wandhoogte {nl(plan.wallHeight / 100)} m</p>
        </div>
      </div>

      <div className="flex justify-center py-3">
        <svg
          viewBox={`${b.minX - pad} ${b.minY - pad} ${wCm} ${hCm}`}
          style={{ width: `${mm(wCm)}mm`, maxWidth: "100%", height: "auto" }}
          role="img"
          aria-label="Plattegrond op schaal"
        >
          {/* vloeren */}
          {plan.rooms.map((r) => (
            <path key={`f-${r.id}`} d={pathOf(roomPoints(r))} fill="#f3efe8" />
          ))}

          {/* schuine daken */}
          {plan.rooms.flatMap((r) =>
            (r.slopes ?? []).map((sl) => {
              const e = roomEdges(r)[sl.edge];
              if (!e) return null;
              const n = edgeNormal(r, sl.edge);
              const d = slopeDistanceAt(sl, plan.wallHeight, 180);
              const a2 = { x: e.a.x + n.x * d, y: e.a.y + n.y * d };
              const b2 = { x: e.b.x + n.x * d, y: e.b.y + n.y * d };
              return (
                <g key={`sl-${r.id}-${sl.edge}`}>
                  <path d={pathOf([e.a, e.b, b2, a2])} fill="#2a2520" fillOpacity={0.07} />
                  <line x1={a2.x} y1={a2.y} x2={b2.x} y2={b2.y} stroke="#2a2520" strokeWidth={thin * 1.5} strokeDasharray={`${pc(1.5)} ${pc(1)}`} />
                </g>
              );
            }),
          )}

          {/* meubels */}
          {plan.items.map((it) => {
            const f = footprint(it);
            const cx = it.x + f.w / 2;
            const cy = it.y + f.h / 2;
            const round = it.shape === "round" || it.type === "plant" || it.type === "lamp";
            const rot = ((it.rotation % 360) + 360) % 360;
            const textRot = rot > 90 && rot <= 270 ? rot - 180 : rot;
            const style = { fill: "#fff", stroke: "#6b6158", strokeWidth: thin * 1.4, strokeDasharray: it.type === "vloerkleed" ? `${pc(1)} ${pc(0.7)}` : undefined };
            return (
              <g key={it.id}>
                <g transform={`rotate(${rot} ${cx} ${cy})`}>
                  {round ? (
                    <ellipse cx={cx} cy={cy} rx={it.w / 2} ry={it.d / 2} {...style} fill={it.type === "vloerkleed" ? "none" : "#fff"} />
                  ) : (
                    <rect x={cx - it.w / 2} y={cy - it.d / 2} width={it.w} height={it.d} {...style} fill={it.type === "vloerkleed" ? "none" : "#fff"} />
                  )}
                </g>
                <text
                  x={cx}
                  y={cy}
                  textAnchor="middle"
                  dominantBaseline="central"
                  fontSize={Math.min(font * 0.85, it.w / Math.max(4, it.name.length * 0.6))}
                  fill="#6b6158"
                  transform={`rotate(${textRot} ${cx} ${cy})`}
                >
                  {it.name}
                </text>
              </g>
            );
          })}

          {/* wanden */}
          {plan.rooms.map((r) => (
            <path key={`w-${r.id}`} d={pathOf(roomPoints(r))} fill="none" stroke="#2a2520" strokeWidth={10} strokeLinejoin="miter" />
          ))}

          {/* deuren en ramen */}
          {plan.openings.map((o) => {
            const g = openingGeom(o, plan.rooms);
            if (!g) return null;
            const { a, b: bb, n } = g;
            const leaf = { x: a.x + n.x * o.width, y: a.y + n.y * o.width };
            const cross = (leaf.x - a.x) * (bb.y - a.y) - (leaf.y - a.y) * (bb.x - a.x);
            return (
              <g key={o.id}>
                <line x1={a.x} y1={a.y} x2={bb.x} y2={bb.y} stroke="#fff" strokeWidth={12} />
                {o.type === "window" ? (
                  <>
                    <line x1={a.x - n.x * 4} y1={a.y - n.y * 4} x2={bb.x - n.x * 4} y2={bb.y - n.y * 4} stroke="#2a2520" strokeWidth={thin * 1.4} />
                    <line x1={a.x + n.x * 4} y1={a.y + n.y * 4} x2={bb.x + n.x * 4} y2={bb.y + n.y * 4} stroke="#2a2520" strokeWidth={thin * 1.4} />
                    <line x1={a.x} y1={a.y} x2={bb.x} y2={bb.y} stroke="#2a2520" strokeWidth={thin} />
                  </>
                ) : (
                  <path
                    d={`M${a.x} ${a.y} L${leaf.x} ${leaf.y} A${o.width} ${o.width} 0 0 ${cross > 0 ? 1 : 0} ${bb.x} ${bb.y}`}
                    fill="none"
                    stroke="#2a2520"
                    strokeWidth={thin * 1.4}
                  />
                )}
              </g>
            );
          })}

          {/* maatlijnen */}
          {dims.map((d) => {
            const off = pc(7);
            const a = { x: d.a.x + d.n.x * off, y: d.a.y + d.n.y * off };
            const bb = { x: d.b.x + d.n.x * off, y: d.b.y + d.n.y * off };
            const mid = { x: (a.x + bb.x) / 2 + d.n.x * pc(2), y: (a.y + bb.y) / 2 + d.n.y * pc(2) };
            let ang = (Math.atan2(bb.y - a.y, bb.x - a.x) * 180) / Math.PI;
            if (ang > 90) ang -= 180;
            if (ang < -90) ang += 180;
            const t = pc(1.2);
            const dir = { x: (bb.x - a.x) / d.L, y: (bb.y - a.y) / d.L };
            const tick = (p: { x: number; y: number }) => (
              <line
                x1={p.x - (dir.x + d.n.x) * t}
                y1={p.y - (dir.y + d.n.y) * t}
                x2={p.x + (dir.x + d.n.x) * t}
                y2={p.y + (dir.y + d.n.y) * t}
                stroke="#2a2520"
                strokeWidth={thin * 1.2}
              />
            );
            return (
              <g key={d.key}>
                <line x1={d.a.x + d.n.x * pc(1.5)} y1={d.a.y + d.n.y * pc(1.5)} x2={a.x + d.n.x * pc(1)} y2={a.y + d.n.y * pc(1)} stroke="#9a8f84" strokeWidth={thin} />
                <line x1={d.b.x + d.n.x * pc(1.5)} y1={d.b.y + d.n.y * pc(1.5)} x2={bb.x + d.n.x * pc(1)} y2={bb.y + d.n.y * pc(1)} stroke="#9a8f84" strokeWidth={thin} />
                <line x1={a.x} y1={a.y} x2={bb.x} y2={bb.y} stroke="#2a2520" strokeWidth={thin} />
                {tick(a)}
                {tick(bb)}
                <text x={mid.x} y={mid.y} textAnchor="middle" dominantBaseline="central" fontSize={font * 0.9} fill="#2a2520" transform={`rotate(${ang} ${mid.x} ${mid.y})`}>
                  {nl(d.L / 100)}
                </text>
              </g>
            );
          })}

          {/* namen en oppervlakte */}
          {plan.rooms.map((r) => {
            const c = centroid(roomPoints(r));
            return (
              <g key={`n-${r.id}`}>
                <text x={c.x} y={c.y - font * 0.6} textAnchor="middle" fontSize={font * 1.15} fontWeight={600} fill="#2a2520" stroke="#fff" strokeWidth={font * 0.25} paintOrder="stroke">
                  {r.name}
                </text>
                <text x={c.x} y={c.y + font * 0.8} textAnchor="middle" fontSize={font * 0.9} fill="#2a2520" stroke="#fff" strokeWidth={font * 0.25} paintOrder="stroke">
                  {nl(roomArea(r) / 10000, 1)} m²
                </text>
              </g>
            );
          })}
        </svg>
      </div>

      <div className="flex items-end justify-between border-t border-[#2a2520] pt-2 text-xs">
        {/* schaalstok: 0-1-2 m */}
        <div>
          <svg width={`${mm(200) + 8}mm`} height="8mm" viewBox={`0 0 ${mm(200) + 8} 8`}>
            <rect x={1} y={1} width={mm(100)} height={1.6} fill="#2a2520" />
            <rect x={1 + mm(100)} y={1} width={mm(100)} height={1.6} fill="none" stroke="#2a2520" strokeWidth={0.25} />
            {[0, 1, 2].map((m) => (
              <text key={m} x={1 + mm(100 * m)} y={6.5} fontSize={2.4} textAnchor="middle" fill="#2a2520">
                {m} m
              </text>
            ))}
          </svg>
        </div>
        {plan.north !== undefined && (
          <svg width="12mm" height="12mm" viewBox="0 0 24 24" aria-label="Noorden">
            <g transform={`rotate(${plan.north} 12 12)`}>
              <path d="M12 2l4 12h-8z" fill="#2a2520" />
              <path d="M12 22l4-8h-8z" fill="none" stroke="#2a2520" strokeWidth={0.8} />
            </g>
            <text x="12" y="13.5" fontSize="4" textAnchor="middle" fill="#fff" fontWeight={700} transform={`rotate(${plan.north} 12 12)`}>
              N
            </text>
          </svg>
        )}
        <p className="text-right text-[10px] text-[#6b6158]">
          Gemaakt met Huisraad · deuren {DOOR_HEIGHT} cm hoog · ramen vanaf {WINDOW_SILL} cm, {WINDOW_HEIGHT} cm hoog
          <br />
          Meet altijd zelf na voordat je iets bestelt of laat maken.
        </p>
      </div>
    </SheetFrame>
  );
}

export function Sheet2({ project, plan }: { project: Project; plan: Floorplan }) {
  return (
    <SheetFrame>
      <p className="border-b border-[#2a2520] pb-2 font-display text-xl">{project.title}: maten en inrichting</p>
      <div className="mt-3 grid gap-6 text-xs sm:grid-cols-2 print:grid-cols-2">
        <div>
          <p className="mb-1 font-semibold uppercase tracking-wider">Ruimtes</p>
          <table className="w-full border-collapse">
            <thead>
              <tr className="border-b border-[#2a2520] text-left">
                <th className="py-1 pr-2">Ruimte</th>
                <th className="py-1 pr-2">Maten</th>
                <th className="py-1 pr-2 text-right">m²</th>
              </tr>
            </thead>
            <tbody>
              {plan.rooms.map((r) => (
                <tr key={r.id} className="border-b border-[#e2d9cc] align-top">
                  <td className="py-1 pr-2 font-medium">{r.name}</td>
                  <td className="py-1 pr-2">
                    {isPolygon(r)
                      ? roomEdges(r)
                          .map((e) => nl(Math.hypot(e.b.x - e.a.x, e.b.y - e.a.y) / 100))
                          .join(" · ") + " m"
                      : `${nl(r.w / 100)} × ${nl(r.h / 100)} m`}
                    {(r.slopes ?? []).map((s) => (
                      <span key={s.edge} className="block text-[#6b6158]">
                        schuin dak: knieschot {s.knee} cm, {s.angle}°
                      </span>
                    ))}
                    {plan.openings
                      .filter((o) => o.roomId === r.id)
                      .map((o) => (
                        <span key={o.id} className="block text-[#6b6158]">
                          {o.type === "door" ? "deur" : "raam"} {o.width} cm breed, {o.offset} cm uit de hoek
                        </span>
                      ))}
                  </td>
                  <td className="py-1 pr-2 text-right tabular-nums">{nl(roomArea(r) / 10000, 1)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div>
          <p className="mb-1 font-semibold uppercase tracking-wider">Meubels</p>
          {plan.items.length === 0 ? (
            <p className="text-[#6b6158]">Nog geen meubels.</p>
          ) : (
            <table className="w-full border-collapse">
              <thead>
                <tr className="border-b border-[#2a2520] text-left">
                  <th className="py-1 pr-2">Meubel</th>
                  <th className="py-1 pr-2">Ruimte</th>
                  <th className="py-1 pr-2 text-right">b × d × h (cm)</th>
                </tr>
              </thead>
              <tbody>
                {plan.items.map((it) => (
                  <tr key={it.id} className="border-b border-[#e2d9cc]">
                    <td className="py-1 pr-2">
                      {it.name}
                      {it.name !== FURNITURE[it.type]?.label && <span className="text-[#6b6158]"> ({FURNITURE[it.type]?.label.toLowerCase()})</span>}
                    </td>
                    <td className="py-1 pr-2">{roomOf(plan, it)?.name ?? "–"}</td>
                    <td className="py-1 pr-2 text-right tabular-nums">
                      {it.w} × {it.d} × {it.h}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </SheetFrame>
  );
}
