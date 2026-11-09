"use client";

import { useMemo, useRef, useState } from "react";
import type { FloorItem, Floorplan, Opening, Room, Wall } from "@/lib/schemas";
import { FURNITURE, bounds, floorColor, footprint, wallLength, wallLine } from "@/lib/floorplan";
import { Icon } from "@/components/ui/Icon";

export type Selection = { kind: "room" | "opening" | "item"; id: string } | null;

type Drag =
  | { kind: "room"; id: string; start: { x: number; y: number }; orig: Room; items: FloorItem[] }
  | { kind: "resize"; id: string; edge: "e" | "s" | "se"; start: { x: number; y: number }; orig: Room }
  | { kind: "item"; id: string; start: { x: number; y: number }; orig: FloorItem }
  | { kind: "opening"; id: string; start: { x: number; y: number }; orig: Opening };

const SNAP = 5;
const snap = (v: number) => Math.round(v / SNAP) * SNAP;

/** Plakt een waarde aan een nabije rand van een andere ruimte (binnen 15 cm). */
function snapToEdges(v: number, edges: number[]) {
  let best = v;
  let dist = 15;
  for (const e of edges) {
    const d = Math.abs(e - v);
    if (d < dist) {
      dist = d;
      best = e;
    }
  }
  return best;
}

export function FloorplanEditor({
  plan,
  onChange,
  selection,
  onSelect,
  readOnly = false,
}: {
  plan: Floorplan;
  onChange?: (p: Floorplan) => void;
  selection: Selection;
  onSelect: (s: Selection) => void;
  readOnly?: boolean;
}) {
  const svgRef = useRef<SVGSVGElement>(null);
  const [drag, setDrag] = useState<Drag | null>(null);
  const [zoom, setZoom] = useState(1);

  // Het zichtvenster volgt de plattegrond, maar staat stil tijdens het slepen.
  const [dragView, setDragView] = useState<{ x: number; y: number; w: number; h: number } | null>(null);
  const fitted = useMemo(() => {
    const b = bounds(plan);
    const pad = 120;
    return { x: b.minX - pad, y: b.minY - pad, w: b.maxX - b.minX + pad * 2, h: b.maxY - b.minY + pad * 2 };
  }, [plan]);
  const frozen = dragView ?? fitted;
  const vb = {
    x: frozen.x + (frozen.w - frozen.w / zoom) / 2,
    y: frozen.y + (frozen.h - frozen.h / zoom) / 2,
    w: frozen.w / zoom,
    h: frozen.h / zoom,
  };
  const unit = vb.w / 600; // ongeveer 1 schermpixel bij 600px breed, voor lijndiktes en tekst

  function toPlan(e: { clientX: number; clientY: number }) {
    const svg = svgRef.current!;
    const pt = svg.createSVGPoint();
    pt.x = e.clientX;
    pt.y = e.clientY;
    const p = pt.matrixTransform(svg.getScreenCTM()!.inverse());
    return { x: p.x, y: p.y };
  }

  function begin(e: React.PointerEvent, d: Drag) {
    if (readOnly) return;
    e.stopPropagation();
    (e.currentTarget as Element).setPointerCapture?.(e.pointerId);
    setDragView(frozen);
    setDrag(d);
  }

  function end() {
    setDrag(null);
    setDragView(null);
  }

  function move(e: React.PointerEvent) {
    if (!drag || !onChange) return;
    const p = toPlan(e);
    const dx = p.x - drag.start.x;
    const dy = p.y - drag.start.y;
    const others = plan.rooms.filter((r) => r.id !== drag.id);
    const xEdges = others.flatMap((r) => [r.x, r.x + r.w]);
    const yEdges = others.flatMap((r) => [r.y, r.y + r.h]);

    if (drag.kind === "room") {
      let nx = snap(drag.orig.x + dx);
      let ny = snap(drag.orig.y + dy);
      const sx = snapToEdges(nx, xEdges);
      const sxr = snapToEdges(nx + drag.orig.w, xEdges) - drag.orig.w;
      nx = Math.abs(sx - nx) <= Math.abs(sxr - nx) ? sx : sxr;
      const sy = snapToEdges(ny, yEdges);
      const syb = snapToEdges(ny + drag.orig.h, yEdges) - drag.orig.h;
      ny = Math.abs(sy - ny) <= Math.abs(syb - ny) ? sy : syb;
      const mx = nx - drag.orig.x;
      const my = ny - drag.orig.y;
      onChange({
        ...plan,
        rooms: plan.rooms.map((r) => (r.id === drag.id ? { ...r, x: nx, y: ny } : r)),
        items: plan.items.map((it) => {
          const o = drag.items.find((x) => x.id === it.id);
          return o ? { ...it, x: o.x + mx, y: o.y + my } : it;
        }),
      });
    } else if (drag.kind === "resize") {
      const r = drag.orig;
      let w = r.w;
      let h = r.h;
      if (drag.edge !== "s") w = Math.max(100, snapToEdges(snap(r.x + r.w + dx), xEdges) - r.x);
      if (drag.edge !== "e") h = Math.max(100, snapToEdges(snap(r.y + r.h + dy), yEdges) - r.y);
      onChange({ ...plan, rooms: plan.rooms.map((x) => (x.id === drag.id ? { ...x, w, h } : x)) });
    } else if (drag.kind === "item") {
      onChange({
        ...plan,
        items: plan.items.map((x) => (x.id === drag.id ? { ...x, x: snap(drag.orig.x + dx), y: snap(drag.orig.y + dy) } : x)),
      });
    } else if (drag.kind === "opening") {
      const o = drag.orig;
      const room = plan.rooms.find((r) => r.id === o.roomId);
      if (!room) return;
      const along = o.wall === "n" || o.wall === "s" ? dx : dy;
      const max = wallLength(room, o.wall) - o.width;
      onChange({
        ...plan,
        openings: plan.openings.map((x) => (x.id === drag.id ? { ...x, offset: Math.max(0, Math.min(max, snap(o.offset + along))) } : x)),
      });
    }
  }

  const selectedRoom = selection?.kind === "room" ? plan.rooms.find((r) => r.id === selection.id) : undefined;
  const startResize = (e: React.PointerEvent, r: Room, edge: "e" | "s" | "se") =>
    begin(e, { kind: "resize", id: r.id, edge, start: toPlan(e), orig: r });

  const sorted = [...plan.items].sort((a, b) => (a.type === "vloerkleed" ? -1 : 0) - (b.type === "vloerkleed" ? -1 : 0));

  return (
    <div className="relative">
      <svg
        ref={svgRef}
        viewBox={`${vb.x} ${vb.y} ${vb.w} ${vb.h}`}
        className="block h-[58dvh] min-h-[340px] w-full touch-none select-none rounded-2xl bg-surface"
        onPointerMove={move}
        onPointerUp={end}
        onPointerCancel={end}
        onPointerDown={() => onSelect(null)}
        role="img"
        aria-label="Plattegrond"
      >
        <defs>
          <pattern id="grid" width="50" height="50" patternUnits="userSpaceOnUse">
            <path d="M50 0H0V50" fill="none" stroke="var(--line)" strokeWidth={unit * 0.8} />
          </pattern>
        </defs>
        <rect x={vb.x - vb.w} y={vb.y - vb.h} width={vb.w * 3} height={vb.h * 3} fill="url(#grid)" />

        {/* Vloeren */}
        {plan.rooms.map((r) => (
          <rect
            key={`f-${r.id}`}
            x={r.x}
            y={r.y}
            width={r.w}
            height={r.h}
            fill={floorColor(r.floor)}
            fillOpacity={0.45}
            onPointerDown={(e) => {
              onSelect({ kind: "room", id: r.id });
              const inside = plan.items.filter((it) => {
                const f = footprint(it);
                const cx = it.x + f.w / 2;
                const cy = it.y + f.h / 2;
                return cx >= r.x && cx <= r.x + r.w && cy >= r.y && cy <= r.y + r.h;
              });
              begin(e, { kind: "room", id: r.id, start: toPlan(e), orig: r, items: inside });
            }}
            style={{ cursor: readOnly ? "default" : "move" }}
          />
        ))}

        {/* Meubels */}
        {sorted.map((it) => {
          const f = footprint(it);
          const sel = selection?.kind === "item" && selection.id === it.id;
          const turned = Math.round(it.rotation / 90) % 2 !== 0;
          return (
            <g
              key={it.id}
              onPointerDown={(e) => {
                onSelect({ kind: "item", id: it.id });
                begin(e, { kind: "item", id: it.id, start: toPlan(e), orig: it });
              }}
              style={{ cursor: readOnly ? "default" : "move" }}
            >
              <rect
                x={it.x}
                y={it.y}
                width={f.w}
                height={f.h}
                rx={it.type === "plant" || it.type === "lamp" ? Math.min(f.w, f.h) / 2 : 4}
                fill={it.color}
                fillOpacity={it.type === "vloerkleed" ? 0.5 : 0.9}
                stroke={sel ? "var(--accent)" : "var(--ink)"}
                strokeWidth={unit * (sel ? 2.5 : 1)}
                strokeOpacity={sel ? 1 : 0.35}
              />
              {/* lijn aan de achterkant, zodat je ziet hoe het meubel staat */}
              {it.type !== "vloerkleed" && it.type !== "plant" && it.type !== "lamp" && (
                <line
                  {...(() => {
                    const r = ((it.rotation % 360) + 360) % 360;
                    const inset = Math.min(f.w, f.h) * 0.12;
                    if (r === 0) return { x1: it.x + 4, y1: it.y + inset, x2: it.x + f.w - 4, y2: it.y + inset };
                    if (r === 180) return { x1: it.x + 4, y1: it.y + f.h - inset, x2: it.x + f.w - 4, y2: it.y + f.h - inset };
                    if (r === 90) return { x1: it.x + f.w - inset, y1: it.y + 4, x2: it.x + f.w - inset, y2: it.y + f.h - 4 };
                    return { x1: it.x + inset, y1: it.y + 4, x2: it.x + inset, y2: it.y + f.h - 4 };
                  })()}
                  stroke="var(--ink)"
                  strokeOpacity={0.35}
                  strokeWidth={unit}
                />
              )}
              <text
                x={it.x + f.w / 2}
                y={it.y + f.h / 2}
                textAnchor="middle"
                dominantBaseline="central"
                fontSize={Math.min(unit * 11, (turned ? f.h : f.w) / Math.max(4, it.name.length * 0.62))}
                fill="var(--ink)"
                transform={turned ? `rotate(-90 ${it.x + f.w / 2} ${it.y + f.h / 2})` : undefined}
                pointerEvents="none"
              >
                {it.name}
              </text>
            </g>
          );
        })}

        {/* Wanden */}
        {plan.rooms.map((r) => {
          const sel = selection?.kind === "room" && selection.id === r.id;
          return (
            <g key={`w-${r.id}`} pointerEvents="none">
              <rect x={r.x} y={r.y} width={r.w} height={r.h} fill="none" stroke={sel ? "var(--accent)" : "var(--ink)"} strokeWidth={10} strokeLinejoin="miter" />
              {/* naam en maten linksonder in de ruimte, met een lichte rand zodat het boven meubels leesbaar blijft */}
              <text
                x={r.x + 14}
                y={r.y + r.h - 14}
                fontSize={unit * 13}
                fontWeight={600}
                fill="var(--ink)"
                stroke="var(--surface)"
                strokeWidth={unit * 3}
                strokeLinejoin="round"
                paintOrder="stroke"
              >
                {r.name}
                <tspan fontWeight={400} fill="var(--ink-2)" fontSize={unit * 11}>
                  {"  "}
                  {(r.w / 100).toLocaleString("nl-NL")} × {(r.h / 100).toLocaleString("nl-NL")} m
                </tspan>
              </text>
            </g>
          );
        })}

        {/* Deuren en ramen */}
        {plan.openings.map((o) => {
          const r = plan.rooms.find((x) => x.id === o.roomId);
          if (!r) return null;
          const l = wallLine(r, o.wall);
          const horizontal = l.y1 === l.y2;
          const a = horizontal ? { x: l.x1 + o.offset, y: l.y1 } : { x: l.x1, y: l.y1 + o.offset };
          const b = horizontal ? { x: a.x + o.width, y: a.y } : { x: a.x, y: a.y + o.width };
          const sel = selection?.kind === "opening" && selection.id === o.id;
          const inward = o.wall === "n" ? 1 : o.wall === "s" ? -1 : o.wall === "w" ? 1 : -1;
          const color = sel ? "var(--accent)" : "var(--ink)";
          return (
            <g
              key={o.id}
              onPointerDown={(e) => {
                onSelect({ kind: "opening", id: o.id });
                begin(e, { kind: "opening", id: o.id, start: toPlan(e), orig: o });
              }}
              style={{ cursor: readOnly ? "default" : horizontal ? "ew-resize" : "ns-resize" }}
            >
              {/* gat in de muur */}
              <line x1={a.x} y1={a.y} x2={b.x} y2={b.y} stroke="var(--surface)" strokeWidth={12} />
              <line x1={a.x} y1={a.y} x2={b.x} y2={b.y} stroke="transparent" strokeWidth={30} />
              {o.type === "window" ? (
                <>
                  <line x1={a.x} y1={a.y} x2={b.x} y2={b.y} stroke={color} strokeWidth={unit * 1.5} transform={horizontal ? "translate(0,-3)" : "translate(-3,0)"} />
                  <line x1={a.x} y1={a.y} x2={b.x} y2={b.y} stroke={color} strokeWidth={unit * 1.5} transform={horizontal ? "translate(0,3)" : "translate(3,0)"} />
                </>
              ) : horizontal ? (
                <path
                  d={`M${a.x} ${a.y} L${a.x} ${a.y + inward * o.width} A${o.width} ${o.width} 0 0 ${inward > 0 ? 0 : 1} ${b.x} ${b.y}`}
                  fill="none"
                  stroke={color}
                  strokeWidth={unit * 1.3}
                />
              ) : (
                <path
                  d={`M${a.x} ${a.y} L${a.x + inward * o.width} ${a.y} A${o.width} ${o.width} 0 0 ${inward > 0 ? 1 : 0} ${b.x} ${b.y}`}
                  fill="none"
                  stroke={color}
                  strokeWidth={unit * 1.3}
                />
              )}
            </g>
          );
        })}

        {/* Grepen om een geselecteerde ruimte te vergroten */}
        {!readOnly && selectedRoom && <ResizeHandles r={selectedRoom} unit={unit} onStart={startResize} />}
      </svg>

      <div className="absolute bottom-3 right-3 flex flex-col overflow-hidden rounded-xl border border-line bg-surface shadow-sm">
        <button className="p-2.5 text-ink-2 hover:bg-surface-2" onClick={() => setZoom((z) => Math.min(4, z * 1.25))} aria-label="Inzoomen">
          <Icon name="plus" size={18} />
        </button>
        <button className="border-t border-line p-2.5 text-ink-2 hover:bg-surface-2" onClick={() => setZoom((z) => Math.max(0.5, z / 1.25))} aria-label="Uitzoomen">
          <Icon name="minus" size={18} />
        </button>
      </div>
    </div>
  );
}

function ResizeHandles({
  r,
  unit,
  onStart,
}: {
  r: Room;
  unit: number;
  onStart: (e: React.PointerEvent, r: Room, edge: "e" | "s" | "se") => void;
}) {
  const handles = [
    { edge: "e", cx: r.x + r.w, cy: r.y + r.h / 2, cursor: "ew-resize" },
    { edge: "s", cx: r.x + r.w / 2, cy: r.y + r.h, cursor: "ns-resize" },
    { edge: "se", cx: r.x + r.w, cy: r.y + r.h, cursor: "nwse-resize" },
  ] as const;
  return (
    <g>
      {handles.map((h) => (
        <rect
          key={h.edge}
          x={h.cx - unit * 9}
          y={h.cy - unit * 9}
          width={unit * 18}
          height={unit * 18}
          rx={unit * 3.6}
          fill="var(--accent)"
          stroke="var(--surface)"
          strokeWidth={unit * 2}
          style={{ cursor: h.cursor }}
          onPointerDown={(e) => onStart(e, r, h.edge)}
        />
      ))}
    </g>
  );
}

export const WALLS: { key: Wall; label: string }[] = [
  { key: "n", label: "Boven" },
  { key: "e", label: "Rechts" },
  { key: "s", label: "Onder" },
  { key: "w", label: "Links" },
];

export { FURNITURE };
