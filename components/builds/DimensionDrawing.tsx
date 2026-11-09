"use client";

import type { BuildGuide } from "@/lib/schemas";
import { buildFurniture } from "@/lib/floorplan";

/**
 * Maattekening: voor-, zij- en bovenaanzicht met maatlijnen, plus elk onderdeel apart.
 * Door de app getekend (niet door AI), zodat de cijfers altijd kloppen.
 */

const INK = "#2a2520";
const SOFT = "#9a8f84";
const WOOD = "#efe3cf";

function fmt(cm: number) {
  return cm.toLocaleString("nl-NL", { maximumFractionDigits: 1 });
}

/** Maatlijn met pijlpunten en tekst. Horizontaal of verticaal. */
function DimLine({ x1, y1, x2, y2, label, offset = 0, s }: { x1: number; y1: number; x2: number; y2: number; label: string; offset?: number; s: number }) {
  const horizontal = y1 === y2;
  const ox = horizontal ? 0 : offset;
  const oy = horizontal ? offset : 0;
  const a = 6 * s;
  return (
    <g stroke={SOFT} strokeWidth={s} fill={SOFT}>
      {/* hulplijnen */}
      <line x1={x1} y1={y1} x2={x1 + ox} y2={y1 + oy} strokeDasharray={`${3 * s} ${3 * s}`} />
      <line x1={x2} y1={y2} x2={x2 + ox} y2={y2 + oy} strokeDasharray={`${3 * s} ${3 * s}`} />
      <line x1={x1 + ox} y1={y1 + oy} x2={x2 + ox} y2={y2 + oy} />
      {horizontal ? (
        <>
          <path d={`M${x1 + ox} ${y1 + oy} l${a} ${-a / 2} v${a} z`} stroke="none" />
          <path d={`M${x2 + ox} ${y2 + oy} l${-a} ${-a / 2} v${a} z`} stroke="none" />
          <text x={(x1 + x2) / 2} y={y1 + oy - 5 * s} textAnchor="middle" fontSize={13 * s} stroke="none" fill={INK}>
            {label}
          </text>
        </>
      ) : (
        <>
          <path d={`M${x1 + ox} ${y1 + oy} l${-a / 2} ${a} h${a} z`} stroke="none" />
          <path d={`M${x2 + ox} ${y2 + oy} l${-a / 2} ${-a} h${a} z`} stroke="none" />
          <text
            x={x1 + ox - 6 * s}
            y={(y1 + y2) / 2}
            textAnchor="middle"
            fontSize={13 * s}
            stroke="none"
            fill={INK}
            transform={`rotate(-90 ${x1 + ox - 6 * s} ${(y1 + y2) / 2})`}
          >
            {label}
          </text>
        </>
      )}
    </g>
  );
}

function View({ title, w, h, children, s, wLabel, hLabel }: { title: string; w: number; h: number; children?: React.ReactNode; s: number; wLabel: string; hLabel: string }) {
  const pad = 46 * s;
  return (
    <figure className="min-w-0">
      <svg viewBox={`${-pad} ${-pad / 2} ${w + pad * 1.4} ${h + pad * 1.6}`} className="h-auto w-full">
        <rect x={0} y={0} width={w} height={h} fill={WOOD} stroke={INK} strokeWidth={2 * s} />
        {children}
        <DimLine x1={0} y1={h} x2={w} y2={h} offset={26 * s} label={wLabel} s={s} />
        <DimLine x1={0} y1={0} x2={0} y2={h} offset={-22 * s} label={hLabel} s={s} />
      </svg>
      <figcaption className="text-center text-xs text-ink-3">{title}</figcaption>
    </figure>
  );
}

export function DimensionDrawing({ guide }: { guide: BuildGuide }) {
  const { w, d, h } = buildFurniture(guide);
  const parts = guide.cuttingList;
  const thicknesses = parts.map((p) => p.thickness).filter(Boolean);
  const t = thicknesses.length ? thicknesses.sort((a, b) => thicknesses.filter((x) => x === b).length - thicknesses.filter((x) => x === a).length)[0] / 10 : 1.8;

  const isHorizontal = (name: string) => /plank|bodem|bovenblad|onderblad|\btop\b|blad|tussenvloer/i.test(name) && !/achter|zij|deur|plint|front/i.test(name);
  const horizontalCount = parts.filter((p) => isHorizontal(p.part)).reduce((n, p) => n + Math.max(1, p.quantity), 0);
  const doorParts = parts.filter((p) => /deur|front/i.test(p.part));
  const doors = doorParts.reduce((n, p) => n + Math.max(1, p.quantity), 0);
  const plinth = parts.find((p) => /plint/i.test(p.part));
  const plinthH = plinth ? Math.min(plinth.width, plinth.length) / 10 : 0;

  // schaal: lijndiktes en tekst in "cm"-eenheden van de tekening
  const s = Math.max(w, h) / 260;
  const levels = Math.max(2, horizontalCount); // bodem + top minimaal
  const usableBottom = h - plinthH - t;
  const step = (usableBottom) / (levels - 1);

  const uniqueParts = Object.values(
    parts.reduce<Record<string, (typeof parts)[number] & { n: number }>>((acc, p) => {
      const k = `${p.part}|${p.length}|${p.width}|${p.thickness}`;
      acc[k] = acc[k] ? { ...acc[k], n: acc[k].n + p.quantity } : { ...p, n: p.quantity };
      return acc;
    }, {}),
  );

  return (
    <div className="space-y-6">
      <div className="grid items-end gap-4 sm:grid-cols-[1.3fr_0.7fr_1fr]">
        <View title="Vooraanzicht" w={w} h={h} s={s} wLabel={`${fmt(w)} cm`} hLabel={`${fmt(h)} cm`}>
          {/* zijwanden */}
          <rect x={0} y={0} width={t} height={h} fill="#e3d2b6" stroke={INK} strokeWidth={s} />
          <rect x={w - t} y={0} width={t} height={h} fill="#e3d2b6" stroke={INK} strokeWidth={s} />
          {/* liggende delen */}
          {Array.from({ length: levels }, (_, i) => {
            const y = t + i * step - t;
            return <rect key={i} x={t} y={Math.max(0, y)} width={w - 2 * t} height={t} fill="#e3d2b6" stroke={INK} strokeWidth={s * 0.8} />;
          })}
          {/* plint */}
          {plinthH > 0 && <rect x={t} y={h - plinthH} width={w - 2 * t} height={plinthH} fill="#d8c4a3" stroke={INK} strokeWidth={s * 0.8} />}
          {/* deuren als stippellijn */}
          {doors > 0 &&
            Array.from({ length: doors }, (_, i) => {
              const dw = w / doors;
              return (
                <rect
                  key={`d${i}`}
                  x={i * dw + s}
                  y={s}
                  width={dw - 2 * s}
                  height={h - plinthH - 2 * s}
                  fill="none"
                  stroke="#a4593b"
                  strokeWidth={1.4 * s}
                  strokeDasharray={`${8 * s} ${5 * s}`}
                />
              );
            })}
          {levels > 2 && (
            <DimLine x1={w} y1={t} x2={w} y2={t + step} offset={22 * s} label={`${fmt(step - t)} cm`} s={s} />
          )}
        </View>
        <View title="Zijaanzicht" w={d} h={h} s={s} wLabel={`${fmt(d)} cm`} hLabel={`${fmt(h)} cm`}>
          <rect x={d - 0.6} y={0} width={0.6} height={h} fill={INK} />
        </View>
        <View title="Bovenaanzicht" w={w} h={d} s={s} wLabel={`${fmt(w)} cm`} hLabel={`${fmt(d)} cm`}>
          <rect x={0} y={0} width={t} height={d} fill="#e3d2b6" stroke={INK} strokeWidth={s} />
          <rect x={w - t} y={0} width={t} height={d} fill="#e3d2b6" stroke={INK} strokeWidth={s} />
        </View>
      </div>
      <p className="text-xs text-ink-3">
        Plaatdikte {fmt(t * 10)} mm. {doors > 0 && "Oranje stippellijn: deuren. "}Planken staan gelijk verdeeld; houd je eigen indeling aan als je die anders wilt.
      </p>

      {uniqueParts.length > 0 && (
        <div>
          <h4 className="text-xs font-medium uppercase tracking-wider text-ink-3">Onderdelen</h4>
          <ul className="mt-2 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
            {uniqueParts.map((p, i) => {
              const L = p.length / 10;
              const B = p.width / 10;
              const ps = Math.max(L, B) / 160;
              return (
                <li key={i} className="rounded-xl bg-surface-2 p-2">
                  <svg viewBox={`${-34 * ps} ${-8 * ps} ${L + 44 * ps} ${B + 40 * ps}`} className="h-24 w-full">
                    <rect x={0} y={0} width={L} height={B} fill={WOOD} stroke={INK} strokeWidth={1.5 * ps} />
                    <DimLine x1={0} y1={B} x2={L} y2={B} offset={20 * ps} label={fmt(L)} s={ps} />
                    <DimLine x1={0} y1={0} x2={0} y2={B} offset={-14 * ps} label={fmt(B)} s={ps} />
                  </svg>
                  <p className="mt-1 text-sm font-medium leading-tight">
                    {p.n}× {p.part}
                  </p>
                  <p className="text-xs text-ink-3">
                    {fmt(L)} × {fmt(B)} cm · {p.thickness} mm {p.material.toLowerCase()}
                  </p>
                </li>
              );
            })}
          </ul>
        </div>
      )}
    </div>
  );
}
