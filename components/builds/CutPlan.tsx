"use client";

import { useMemo, useState } from "react";
import { makeCutPlan } from "@/lib/cutplan";
import type { BuildGuide } from "@/lib/schemas";

const SHEETS = [
  { label: "244 × 122 cm", w: 2440, h: 1220 },
  { label: "250 × 125 cm", w: 2500, h: 1250 },
  { label: "280 × 207 cm", w: 2800, h: 2070 },
  { label: "122 × 61 cm", w: 1220, h: 610 },
];
const FILLS = ["#E7D3B4", "#D9C2A0", "#CDB48F", "#E2C9A6", "#D4BB96", "#C8AE88"];

/** Tekening per plaat: hoe de onderdelen erop passen, met afvalpercentage. */
export function CutPlan({ guide }: { guide: BuildGuide }) {
  const [size, setSize] = useState(0);
  const plans = useMemo(() => makeCutPlan(guide, SHEETS[size]), [guide, size]);
  const names = [...new Set(guide.cuttingList.map((c) => c.part))];
  const color = (part: string) => FILLS[names.indexOf(part) % FILLS.length];

  if (guide.cuttingList.length === 0) return null;

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center gap-2">
        <span className="label mb-0">Plaatmaat</span>
        {SHEETS.map((s, i) => (
          <button key={s.label} className="chip px-2.5 py-1 text-xs" data-on={size === i} onClick={() => setSize(i)}>
            {s.label}
          </button>
        ))}
      </div>

      {plans.map((p) => (
        <div key={p.material + p.thickness}>
          <p className="text-sm font-medium">
            {p.material} · {p.thickness} mm —{" "}
            <span className="text-accent">
              {p.kind === "sheet"
                ? `${p.sheets.length} ${p.sheets.length === 1 ? "plaat" : "platen"}`
                : `${p.bars.length} ${p.bars.length === 1 ? "lat" : "latten"} van ${p.stock / 10} cm`}
            </span>
          </p>
          {p.tooBig.length > 0 && <p className="text-xs text-danger">Te groot voor deze maat: {[...new Set(p.tooBig)].join(", ")}</p>}

          {p.kind === "sheet" ? (
            <div className="mt-2 grid gap-3 sm:grid-cols-2">
              {p.sheets.map((s, i) => (
                <figure key={i}>
                  <svg viewBox={`-10 -10 ${s.w + 20} ${s.h + 20}`} className="w-full rounded-lg bg-surface-2">
                    <rect width={s.w} height={s.h} fill="#fff" stroke="var(--ink-3)" strokeWidth="6" strokeDasharray="30 18" />
                    {s.parts.map((pt, j) => (
                      <g key={j}>
                        <rect x={pt.x} y={pt.y} width={pt.w} height={pt.h} fill={color(pt.part)} stroke="var(--ink)" strokeWidth="5" />
                        {pt.w > 180 && pt.h > 90 && (
                          <text x={pt.x + pt.w / 2} y={pt.y + pt.h / 2} textAnchor="middle" dominantBaseline="central" fontSize={Math.min(70, pt.h / 3, pt.w / 7)} fill="#2a2520">
                            {pt.part} {Math.round(pt.w / 10)}×{Math.round(pt.h / 10)}
                          </text>
                        )}
                      </g>
                    ))}
                  </svg>
                  <figcaption className="mt-1 text-xs text-ink-3">
                    Plaat {i + 1} · {Math.round(s.used * 100)}% gebruikt
                  </figcaption>
                </figure>
              ))}
            </div>
          ) : (
            <div className="mt-2 space-y-1.5">
              {p.bars.map((b, i) => (
                <div key={i}>
                  <svg viewBox={`0 0 ${b.length} 60`} className="h-8 w-full rounded bg-surface-2" preserveAspectRatio="none">
                    {b.parts.map((pt, j) => (
                      <rect key={j} x={pt.at} y="6" width={pt.length} height="48" fill={color(pt.part)} stroke="var(--ink)" strokeWidth="4" />
                    ))}
                  </svg>
                  <p className="text-[11px] text-ink-3">
                    Lat {i + 1}: {b.parts.map((pt) => `${pt.part} ${pt.length / 10}`).join(" · ")} cm
                  </p>
                </div>
              ))}
            </div>
          )}
        </div>
      ))}
      <p className="text-xs text-ink-3">Gerekend met 4 mm zaagsnede. Laat de zaagservice de grootste delen eerst zagen.</p>
    </div>
  );
}
