"use client";

import { useState } from "react";
import type { DrillPlan } from "@/lib/schemas";
import { Icon } from "@/components/ui/Icon";
import { CameraTool } from "@/components/tools/CameraTool";

const INK = "#2a2520";
const SOFT = "#9a8f84";

const TYPES: Record<string, { label: string; color: string; hint: string }> = {
  schroef: { label: "Schroefgat", color: "#a4593b", hint: "voorboren, kop verzinken" },
  voorboren: { label: "Voorboorgat", color: "#c9783f", hint: "klein gat zodat het hout niet splijt" },
  deuvel: { label: "Deuvelgat", color: "#5f6b4e", hint: "loodrecht boren, diepte afplakken" },
  scharnier: { label: "Scharnierpot", color: "#3e6e8e", hint: "35 mm potboor, niet te diep" },
  plankdrager: { label: "Plankdrager", color: "#7a6a5a", hint: "boormal of diepte-aanslag" },
  ophang: { label: "Ophangpunt", color: "#2a2520", hint: "in de muur: plug en schroef" },
  greep: { label: "Greepgat", color: "#8c3f3a", hint: "van voor naar achter, plankje erachter" },
};

function Mark({ type, cx, cy, r, s }: { type: string; cx: number; cy: number; r: number; s: number }) {
  const c = TYPES[type]?.color ?? INK;
  if (type === "scharnier") return <circle cx={cx} cy={cy} r={r} fill="#fff" stroke={c} strokeWidth={2 * s} />;
  if (type === "deuvel") return <circle cx={cx} cy={cy} r={Math.max(r, 3 * s)} fill={c} />;
  if (type === "ophang") return <rect x={cx - 4 * s} y={cy - 4 * s} width={8 * s} height={8 * s} fill={c} />;
  if (type === "plankdrager") return <circle cx={cx} cy={cy} r={Math.max(r, 2.2 * s)} fill={c} />;
  const R = Math.max(r, 3.5 * s);
  return (
    <g stroke={c} strokeWidth={1.4 * s}>
      <circle cx={cx} cy={cy} r={R} fill="#fff" />
      <path d={`M${cx - R * 1.6} ${cy}H${cx + R * 1.6}M${cx} ${cy - R * 1.6}V${cy + R * 1.6}`} />
    </g>
  );
}

/** Eén onderdeel op schaal; x langs de lengte (links = 0), y vanaf de voorkant (onder = 0). */
function PartDrawing({ part }: { part: DrillPlan["parts"][number] }) {
  const L = Math.max(1, part.length);
  const W = Math.max(1, part.width);
  const s = Math.max(L, W) / 700;
  const padL = 70 * s;
  const padT = 60 * s;
  const padB = 40 * s;
  const Y = (y: number) => W - y; // voorkant onderaan
  const xs = [...new Set(part.holes.map((h) => Math.round(h.x)))].sort((a, b) => a - b);
  const ys = [...new Set(part.holes.map((h) => Math.round(h.y)))].sort((a, b) => a - b);
  const fs = 10 * s;
  // maatgetallen boven: verdeel over rijen zodat ze niet overlappen
  const gap = fs * 2.4;
  const rowEnd: number[] = [];
  const xLabels = xs.map((x) => {
    let row = rowEnd.findIndex((end) => x - end >= gap);
    if (row < 0) {
      row = rowEnd.length;
      rowEnd.push(-Infinity);
    }
    rowEnd[row] = x;
    return { x, row };
  });
  const rows = Math.max(1, rowEnd.length);
  // dicht bij elkaar liggende y-maten: inspringen als de buurman niet al is ingesprongen
  const yShift = ys.reduce<number[]>((acc, y, i) => {
    const close = i > 0 && y - ys[i - 1] < fs * 1.3;
    acc.push(close && !acc[i - 1] ? fs * 2.6 : 0);
    return acc;
  }, []);
  const padTop = padT + (rows - 1) * fs * 1.25;

  return (
    <svg
      viewBox={`${-padL} ${-padTop} ${L + padL + 30 * s} ${W + padTop + padB}`}
      className="h-auto w-full"
      style={{ minWidth: L / W > 3 ? Math.min(1250, 240 * (L / W)) : undefined }}
    >
      <rect x={0} y={0} width={L} height={W} fill="#f3e9d8" stroke={INK} strokeWidth={2 * s} />
      {/* rasterlijnen door de gaten, helpen bij aftekenen */}
      <g stroke={SOFT} strokeWidth={0.8 * s} strokeDasharray={`${4 * s} ${4 * s}`}>
        {xs.map((x) => (
          <line key={`gx${x}`} x1={x} y1={-padT * 0.55} x2={x} y2={W} />
        ))}
        {ys.map((y) => (
          <line key={`gy${y}`} x1={-padL * 0.55} y1={Y(y)} x2={L} y2={Y(y)} />
        ))}
      </g>
      {/* maten vanaf 0 (ordinaat): boven langs de lengte, links langs de breedte */}
      <g fill={INK} fontSize={fs}>
        {xLabels.map(({ x, row }) => (
          <g key={`tx${x}`}>
            <line x1={x} y1={-padT * 0.45 - row * fs * 1.25} x2={x} y2={-padT * 0.3} stroke={SOFT} strokeWidth={0.8 * s} />
            <text x={x} y={-padT * 0.5 - row * fs * 1.25} textAnchor="middle">
              {x}
            </text>
          </g>
        ))}
        {ys.map((y, i) => {
          const shift = yShift[i];
          return (
            <text key={`ty${y}`} x={-padL * 0.35 - shift} y={Y(y) + fs * 0.35} textAnchor="end">
              {y}
            </text>
          );
        })}
      </g>
      {/* gaten */}
      {part.holes.map((h, i) => (
        <Mark key={i} type={h.type} cx={h.x} cy={Y(h.y)} r={h.diameter / 2} s={s} />
      ))}
      {/* referentiehoek */}
      <g>
        <path d={`M0 ${W} l${22 * s} 0 l${-22 * s} ${-22 * s} z`} fill="#a4593b" />
        <text x={4 * s} y={W + 26 * s} fontSize={fs} fill="#a4593b" fontWeight={700}>
          0,0 · voorkant
        </text>
      </g>
      <text x={L} y={W + 26 * s} fontSize={fs} fill={SOFT} textAnchor="end">
        {L} × {W} mm
      </text>
    </svg>
  );
}

export function DrillPlanView({ plan }: { plan: DrillPlan }) {
  const parts = plan.parts.filter((p) => p.holes.length > 0);
  const [open, setOpen] = useState(0);
  const [camera, setCamera] = useState<DrillPlan["parts"][number] | null>(null);
  const used = [...new Set(parts.flatMap((p) => p.holes.map((h) => h.type)))];

  if (parts.length === 0) return <p className="text-sm text-ink-2">Geen gaten nodig volgens dit plan.</p>;
  const current = parts[Math.min(open, parts.length - 1)];
  const grouped = Object.values(
    current.holes.reduce<Record<string, { type: string; diameter: number; depth: number; n: number }>>((acc, h) => {
      const k = `${h.type}|${h.diameter}|${h.depth}`;
      acc[k] = acc[k] ? { ...acc[k], n: acc[k].n + 1 } : { type: h.type, diameter: h.diameter, depth: h.depth, n: 1 };
      return acc;
    }, {}),
  );

  return (
    <div className="space-y-4">
      <p className="flex gap-2 rounded-xl bg-accent-soft px-3 py-2 text-sm">
        <Icon name="ruler" size={16} className="mt-0.5 shrink-0 text-accent" />
        {plan.reference}
      </p>

      <div className="no-scrollbar flex gap-1.5 overflow-x-auto pb-1 print:hidden">
        {parts.map((p, i) => (
          <button key={p.part + i} className="chip shrink-0 px-3 py-1.5 text-xs" data-on={i === open} onClick={() => setOpen(i)}>
            {p.part} <span className="text-ink-3">· {p.holes.length} gaten</span>
          </button>
        ))}
      </div>

      {/* scherm: één onderdeel tegelijk; afdrukken: alles onder elkaar */}
      {[current, ...parts.filter((p) => p !== current)].map((p, idx) => (
        <section key={p.part + idx} className={idx === 0 ? "" : "hidden print:block"}>
          <div className="flex flex-wrap items-baseline justify-between gap-2">
            <h4 className="font-medium">{p.part}</h4>
            <span className="flex items-center gap-2 text-xs text-ink-3">
              teken op de {p.face}
              {idx === 0 && (
                <button className="btn-primary px-3 py-1.5 text-xs print:hidden" onClick={() => setCamera(p)}>
                  <Icon name="camera" size={14} /> Met camera aftekenen
                </button>
              )}
            </span>
          </div>
          <div className="mt-2 overflow-x-auto rounded-2xl bg-white p-2 ring-1 ring-line">
            <PartDrawing part={p} />
          </div>
          {p.length / p.width > 3 && <p className="mt-1 text-xs text-ink-3 sm:hidden">Schuif de tekening opzij voor alle maten.</p>}
          <details className="mt-2 rounded-xl bg-surface-2 px-3 py-2 text-sm print:block" open={false}>
            <summary className="cursor-pointer text-ink-2">Alle gaten met maten ({p.holes.length})</summary>
            <table className="mt-2 w-full text-left tabular-nums">
              <thead className="text-xs text-ink-3">
                <tr>
                  <th className="py-1 font-medium">x (mm)</th>
                  <th className="py-1 font-medium">y (mm)</th>
                  <th className="py-1 font-medium">Soort</th>
                  <th className="py-1 font-medium">Ø × diep</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {[...p.holes]
                  .sort((a, b) => a.x - b.x || a.y - b.y)
                  .map((h, j) => (
                    <tr key={j}>
                      <td className="py-1">{Math.round(h.x)}</td>
                      <td className="py-1">{Math.round(h.y)}</td>
                      <td className="py-1">{TYPES[h.type]?.label ?? h.type}</td>
                      <td className="py-1">
                        {h.diameter} × {h.depth || "door"}
                      </td>
                    </tr>
                  ))}
              </tbody>
            </table>
          </details>
          {p.note && <p className="mt-2 text-sm text-ink-2">{p.note}</p>}
          {idx === 0 && (
            <ul className="mt-2 grid gap-1.5 text-sm sm:grid-cols-2">
              {grouped.map((g) => (
                <li key={`${g.type}${g.diameter}${g.depth}`} className="flex items-center gap-2 rounded-lg bg-surface-2 px-2.5 py-1.5">
                  <svg viewBox="-8 -8 16 16" className="h-4 w-4 shrink-0">
                    <Mark type={g.type} cx={0} cy={0} r={2.5} s={1} />
                  </svg>
                  <span>
                    {g.n}× {TYPES[g.type]?.label ?? g.type} Ø{g.diameter} mm, {g.depth ? `${g.depth} mm diep` : "door en door"}
                    <span className="block text-xs text-ink-3">{TYPES[g.type]?.hint}</span>
                  </span>
                </li>
              ))}
            </ul>
          )}
        </section>
      ))}

      <div className="flex flex-wrap gap-3 text-xs text-ink-3">
        {used.map((t) => (
          <span key={t} className="inline-flex items-center gap-1.5">
            <svg viewBox="-8 -8 16 16" className="h-3.5 w-3.5">
              <Mark type={t} cx={0} cy={0} r={2.5} s={1} />
            </svg>
            {TYPES[t]?.label ?? t}
          </span>
        ))}
      </div>

      {camera && <CameraTool mode="board" part={camera} onClose={() => setCamera(null)} />}

      {plan.tips.length > 0 && (
        <ul className="space-y-1 text-sm text-ink-2">
          {plan.tips.map((t, i) => (
            <li key={i} className="flex gap-2">
              <Icon name="info" size={15} className="mt-0.5 shrink-0 text-olive" />
              {t}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
