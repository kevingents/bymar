"use client";

import { useMemo, useRef, useState } from "react";
import type { FloorItem, Floorplan, Opening, Room, Wall } from "@/lib/schemas";
import {
  FURNITURE,
  bounds,
  centroid,
  floorColor,
  footprint,
  isPolygon,
  openingGeom,
  openingWallLength,
  pointInPolygon,
  roomEdges,
  roomPoints,
  withPoints,
  type P,
} from "@/lib/floorplan";
import { Icon } from "@/components/ui/Icon";

export type Selection = { kind: "room" | "opening" | "item"; id: string } | null;

type Drag =
  | { kind: "room"; id: string; start: P; orig: Room; items: FloorItem[] }
  | { kind: "resize"; id: string; edge: "e" | "s" | "se"; start: P; orig: Room }
  | { kind: "vertex"; id: string; index: number; start: P; orig: Room }
  | { kind: "item"; id: string; start: P; orig: FloorItem }
  | { kind: "rotate"; id: string; center: P; orig: FloorItem }
  | { kind: "opening"; id: string; start: P; orig: Opening; dir: P };

const SNAP = 5;
const snap = (v: number) => Math.round(v / SNAP) * SNAP;

/** Plakt een waarde aan een nabije waarde (binnen 15 cm). */
function snapTo(v: number, targets: number[], range = 15) {
  let best = v;
  let dist = range;
  for (const t of targets) {
    const d = Math.abs(t - v);
    if (d < dist) {
      dist = d;
      best = t;
    }
  }
  return best;
}

const pathOf = (pts: P[]) => `M${pts.map((p) => `${p.x} ${p.y}`).join(" L")} Z`;

export function FloorplanEditor({
  plan,
  onChange,
  selection,
  onSelect,
  vertex = null,
  onVertex,
  readOnly = false,
  flags,
  highlight,
}: {
  /** Meubels met een melding uit de indelingscontrole. */
  flags?: Map<string, "warn" | "tip">;
  /** Meubel dat extra in beeld moet (bijv. bij "Past het?"). */
  highlight?: string;
  plan: Floorplan;
  onChange?: (p: Floorplan) => void;
  selection: Selection;
  onSelect: (s: Selection) => void;
  /** Gekozen hoekpunt van de geselecteerde ruimte (alleen bij vrije vorm). */
  vertex?: number | null;
  onVertex?: (i: number | null) => void;
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

  function toPlan(e: { clientX: number; clientY: number }): P {
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

  function setRoom(id: string, next: Room) {
    onChange?.({ ...plan, rooms: plan.rooms.map((r) => (r.id === id ? next : r)) });
  }

  function move(e: React.PointerEvent) {
    if (!drag || !onChange) return;
    const p = toPlan(e);
    const others = plan.rooms.filter((r) => r.id !== drag.id);
    const otherPts = others.flatMap((r) => roomPoints(r));
    const xEdges = otherPts.map((q) => q.x);
    const yEdges = otherPts.map((q) => q.y);

    if (drag.kind === "room") {
      const dx = p.x - drag.start.x;
      const dy = p.y - drag.start.y;
      let nx = snap(drag.orig.x + dx);
      let ny = snap(drag.orig.y + dy);
      const sx = snapTo(nx, xEdges);
      const sxr = snapTo(nx + drag.orig.w, xEdges) - drag.orig.w;
      nx = Math.abs(sx - nx) <= Math.abs(sxr - nx) ? sx : sxr;
      const sy = snapTo(ny, yEdges);
      const syb = snapTo(ny + drag.orig.h, yEdges) - drag.orig.h;
      ny = Math.abs(sy - ny) <= Math.abs(syb - ny) ? sy : syb;
      const mx = nx - drag.orig.x;
      const my = ny - drag.orig.y;
      const moved: Room = drag.orig.points
        ? withPoints(drag.orig, drag.orig.points.map((q) => ({ x: q.x + mx, y: q.y + my })))
        : { ...drag.orig, x: nx, y: ny };
      onChange({
        ...plan,
        rooms: plan.rooms.map((r) => (r.id === drag.id ? moved : r)),
        items: plan.items.map((it) => {
          const o = drag.items.find((x) => x.id === it.id);
          return o ? { ...it, x: o.x + mx, y: o.y + my } : it;
        }),
      });
    } else if (drag.kind === "resize") {
      const r = drag.orig;
      let w = r.w;
      let h = r.h;
      if (drag.edge !== "s") w = Math.max(100, snapTo(snap(p.x), xEdges) - r.x);
      if (drag.edge !== "e") h = Math.max(100, snapTo(snap(p.y), yEdges) - r.y);
      setRoom(drag.id, { ...r, w, h });
    } else if (drag.kind === "vertex") {
      const pts = roomPoints(drag.orig).map((q) => ({ ...q }));
      const prev = pts[(drag.index - 1 + pts.length) % pts.length];
      const next = pts[(drag.index + 1) % pts.length];
      // recht houden: plakken aan de x/y van de buren en aan hoeken van andere ruimtes
      const x = snapTo(snap(p.x), [prev.x, next.x, ...xEdges], 12);
      const y = snapTo(snap(p.y), [prev.y, next.y, ...yEdges], 12);
      pts[drag.index] = { x, y };
      setRoom(drag.id, withPoints(drag.orig, pts));
    } else if (drag.kind === "item") {
      const dx = p.x - drag.start.x;
      const dy = p.y - drag.start.y;
      onChange({
        ...plan,
        items: plan.items.map((x) => (x.id === drag.id ? { ...x, x: snap(drag.orig.x + dx), y: snap(drag.orig.y + dy) } : x)),
      });
    } else if (drag.kind === "rotate") {
      // hoek vanaf het midden; 0° = greep recht boven het meubel; stappen van 15°
      const raw = (Math.atan2(p.x - drag.center.x, -(p.y - drag.center.y)) * 180) / Math.PI;
      const rot = ((Math.round(raw / 15) * 15) % 360 + 360) % 360;
      const it = drag.orig;
      const f = footprint({ ...it, rotation: rot });
      onChange({
        ...plan,
        items: plan.items.map((x) =>
          x.id === drag.id ? { ...x, rotation: rot, x: Math.round(drag.center.x - f.w / 2), y: Math.round(drag.center.y - f.h / 2) } : x,
        ),
      });
    } else if (drag.kind === "opening") {
      const o = drag.orig;
      const room = plan.rooms.find((r) => r.id === o.roomId);
      if (!room) return;
      const along = (p.x - drag.start.x) * drag.dir.x + (p.y - drag.start.y) * drag.dir.y;
      const max = openingWallLength(o, room) - o.width;
      onChange({
        ...plan,
        openings: plan.openings.map((x) => (x.id === drag.id ? { ...x, offset: Math.max(0, Math.min(max, snap(o.offset + along))) } : x)),
      });
    }
  }

  const selectedRoom = selection?.kind === "room" ? plan.rooms.find((r) => r.id === selection.id) : undefined;
  const selectedItem = selection?.kind === "item" ? plan.items.find((i) => i.id === selection.id) : undefined;
  const startResize = (e: React.PointerEvent, r: Room, edge: "e" | "s" | "se") => begin(e, { kind: "resize", id: r.id, edge, start: toPlan(e), orig: r });

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
        onPointerDown={() => {
          onSelect(null);
          onVertex?.(null);
        }}
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
        {plan.rooms.map((r) => {
          const pts = roomPoints(r);
          return (
            <path
              key={`f-${r.id}`}
              d={pathOf(pts)}
              fill={floorColor(r.floor)}
              fillOpacity={0.45}
              onPointerDown={(e) => {
                onSelect({ kind: "room", id: r.id });
                onVertex?.(null);
                const inside = plan.items.filter((it) => {
                  const f = footprint(it);
                  return pointInPolygon({ x: it.x + f.w / 2, y: it.y + f.h / 2 }, pts);
                });
                begin(e, { kind: "room", id: r.id, start: toPlan(e), orig: r, items: inside });
              }}
              style={{ cursor: readOnly ? "default" : "move" }}
            />
          );
        })}

        {/* Meubels */}
        {sorted.map((it) => {
          const f = footprint(it);
          const sel = selection?.kind === "item" && selection.id === it.id;
          const cx = it.x + f.w / 2;
          const cy = it.y + f.h / 2;
          const round = it.shape === "round" || it.type === "plant" || it.type === "lamp";
          const stroke = { stroke: sel ? "var(--accent)" : "var(--ink)", strokeWidth: unit * (sel ? 2.5 : 1), strokeOpacity: sel ? 1 : 0.35 };
          const rot = ((it.rotation % 360) + 360) % 360;
          // tekst leesbaar houden: nooit op z'n kop
          const textRot = rot > 90 && rot <= 270 ? rot - 180 : rot;
          return (
            <g
              key={it.id}
              onPointerDown={(e) => {
                onSelect({ kind: "item", id: it.id });
                begin(e, { kind: "item", id: it.id, start: toPlan(e), orig: it });
              }}
              style={{ cursor: readOnly ? "default" : "move" }}
            >
              <g transform={`rotate(${rot} ${cx} ${cy})`}>
                {round ? (
                  <ellipse cx={cx} cy={cy} rx={it.w / 2} ry={it.d / 2} fill={it.color} fillOpacity={it.type === "vloerkleed" ? 0.5 : 0.9} {...stroke} />
                ) : (
                  <rect
                    x={cx - it.w / 2}
                    y={cy - it.d / 2}
                    width={it.w}
                    height={it.d}
                    rx={4}
                    fill={it.color}
                    fillOpacity={it.type === "vloerkleed" ? 0.5 : 0.9}
                    {...stroke}
                  />
                )}
                {(flags?.get(it.id) || highlight === it.id) &&
                  (() => {
                    const color = highlight === it.id ? "var(--olive)" : flags?.get(it.id) === "warn" ? "var(--danger)" : "#C08A2E";
                    const pad = unit * 4;
                    const common = {
                      fill: "none",
                      stroke: color,
                      strokeWidth: unit * 2,
                      strokeDasharray: `${unit * 5} ${unit * 3}`,
                      pointerEvents: "none" as const,
                    };
                    return round ? (
                      <ellipse cx={cx} cy={cy} rx={it.w / 2 + pad} ry={it.d / 2 + pad} {...common} />
                    ) : (
                      <rect x={cx - it.w / 2 - pad} y={cy - it.d / 2 - pad} width={it.w + pad * 2} height={it.d + pad * 2} rx={6} {...common} />
                    );
                  })()}
                {/* lijn aan de achterkant, zodat je ziet hoe het meubel staat */}
                {!round && it.type !== "vloerkleed" && (
                  <line
                    x1={cx - it.w / 2 + 4}
                    y1={cy - it.d / 2 + Math.min(it.w, it.d) * 0.12}
                    x2={cx + it.w / 2 - 4}
                    y2={cy - it.d / 2 + Math.min(it.w, it.d) * 0.12}
                    stroke="var(--ink)"
                    strokeOpacity={0.35}
                    strokeWidth={unit}
                  />
                )}
              </g>
              <text
                x={cx}
                y={cy}
                textAnchor="middle"
                dominantBaseline="central"
                fontSize={Math.min(unit * 11, it.w / Math.max(4, it.name.length * 0.62))}
                fill="var(--ink)"
                transform={`rotate(${textRot} ${cx} ${cy})`}
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
          const pts = roomPoints(r);
          const label = isPolygon(r) ? centroid(pts) : { x: r.x + 14, y: r.y + r.h - 14 };
          return (
            <g key={`w-${r.id}`} pointerEvents="none">
              <path d={pathOf(pts)} fill="none" stroke={sel ? "var(--accent)" : "var(--ink)"} strokeWidth={10} strokeLinejoin="miter" />
              {/* naam en maten, met een lichte rand zodat het boven meubels leesbaar blijft */}
              <text
                x={label.x}
                y={label.y}
                textAnchor={isPolygon(r) ? "middle" : "start"}
                fontSize={unit * 13}
                fontWeight={600}
                fill="var(--ink)"
                stroke="var(--surface)"
                strokeWidth={unit * 3}
                strokeLinejoin="round"
                paintOrder="stroke"
              >
                {r.name}
                {!isPolygon(r) && (
                  <tspan fontWeight={400} fill="var(--ink-2)" fontSize={unit * 11}>
                    {"  "}
                    {(r.w / 100).toLocaleString("nl-NL")} × {(r.h / 100).toLocaleString("nl-NL")} m
                  </tspan>
                )}
              </text>
            </g>
          );
        })}

        {/* Wandlengtes van de gekozen ruimte */}
        {selectedRoom &&
          roomEdges(selectedRoom).map((e) => {
            const L = Math.hypot(e.b.x - e.a.x, e.b.y - e.a.y);
            if (L < 30) return null;
            const mid = { x: (e.a.x + e.b.x) / 2, y: (e.a.y + e.b.y) / 2 };
            const n = { x: -(e.b.y - e.a.y) / L, y: (e.b.x - e.a.x) / L };
            const inside = pointInPolygon({ x: mid.x + n.x * 5, y: mid.y + n.y * 5 }, roomPoints(selectedRoom));
            const k = (inside ? -1 : 1) * unit * 16;
            let ang = (Math.atan2(e.b.y - e.a.y, e.b.x - e.a.x) * 180) / Math.PI;
            if (ang > 90) ang -= 180;
            if (ang < -90) ang += 180;
            const tx = mid.x + n.x * k;
            const ty = mid.y + n.y * k;
            return (
              <text
                key={`len-${e.i}`}
                x={tx}
                y={ty}
                textAnchor="middle"
                dominantBaseline="central"
                fontSize={unit * 11}
                fill="var(--accent)"
                stroke="var(--surface)"
                strokeWidth={unit * 3}
                paintOrder="stroke"
                transform={`rotate(${ang} ${tx} ${ty})`}
                pointerEvents="none"
              >
                {isPolygon(selectedRoom) ? `${e.i + 1}: ` : ""}
                {(L / 100).toLocaleString("nl-NL", { maximumFractionDigits: 2 })} m
              </text>
            );
          })}

        {/* Deuren en ramen (ook in schuine wanden) */}
        {plan.openings.map((o) => {
          const g = openingGeom(o, plan.rooms);
          if (!g) return null;
          const { a, b, n, dir } = g;
          const sel = selection?.kind === "opening" && selection.id === o.id;
          const color = sel ? "var(--accent)" : "var(--ink)";
          const leaf = { x: a.x + n.x * o.width, y: a.y + n.y * o.width };
          // draairichting van de boog: van het deurblad terug naar de wand
          const cross = (leaf.x - a.x) * (b.y - a.y) - (leaf.y - a.y) * (b.x - a.x);
          const sweep = cross > 0 ? 1 : 0;
          return (
            <g
              key={o.id}
              onPointerDown={(e) => {
                onSelect({ kind: "opening", id: o.id });
                begin(e, { kind: "opening", id: o.id, start: toPlan(e), orig: o, dir });
              }}
              style={{ cursor: readOnly ? "default" : "grab" }}
            >
              {/* gat in de muur */}
              <line x1={a.x} y1={a.y} x2={b.x} y2={b.y} stroke="var(--surface)" strokeWidth={12} />
              <line x1={a.x} y1={a.y} x2={b.x} y2={b.y} stroke="transparent" strokeWidth={30} />
              {o.type === "window" ? (
                <>
                  <line x1={a.x - n.x * 3} y1={a.y - n.y * 3} x2={b.x - n.x * 3} y2={b.y - n.y * 3} stroke={color} strokeWidth={unit * 1.5} />
                  <line x1={a.x + n.x * 3} y1={a.y + n.y * 3} x2={b.x + n.x * 3} y2={b.y + n.y * 3} stroke={color} strokeWidth={unit * 1.5} />
                </>
              ) : (
                <path d={`M${a.x} ${a.y} L${leaf.x} ${leaf.y} A${o.width} ${o.width} 0 0 ${sweep} ${b.x} ${b.y}`} fill="none" stroke={color} strokeWidth={unit * 1.3} />
              )}
            </g>
          );
        })}

        {/* Grepen voor de gekozen ruimte */}
        {!readOnly && selectedRoom && !isPolygon(selectedRoom) && <ResizeHandles r={selectedRoom} unit={unit} onStart={startResize} />}
        {!readOnly && selectedRoom && isPolygon(selectedRoom) && (
          <g>
            {/* plusjes halverwege elke wand: hoekpunt toevoegen */}
            {roomEdges(selectedRoom).map((e) => {
              const mid = { x: (e.a.x + e.b.x) / 2, y: (e.a.y + e.b.y) / 2 };
              return (
                <g
                  key={`add-${e.i}`}
                  style={{ cursor: "copy" }}
                  onPointerDown={(ev) => {
                    ev.stopPropagation();
                    const pts = roomPoints(selectedRoom).map((q) => ({ ...q }));
                    pts.splice(e.i + 1, 0, { x: snap(mid.x), y: snap(mid.y) });
                    const next = withPoints(selectedRoom, pts);
                    // openingen op latere wanden schuiven één index op
                    onChange?.({
                      ...plan,
                      rooms: plan.rooms.map((r) => (r.id === selectedRoom.id ? next : r)),
                      openings: plan.openings.map((o) =>
                        o.roomId === selectedRoom.id && o.edge !== undefined && o.edge > e.i ? { ...o, edge: o.edge + 1 } : o,
                      ),
                    });
                    onVertex?.(e.i + 1);
                    begin(ev, { kind: "vertex", id: selectedRoom.id, index: e.i + 1, start: toPlan(ev), orig: next });
                  }}
                >
                  <circle cx={mid.x} cy={mid.y} r={unit * 8} fill="var(--surface)" stroke="var(--accent)" strokeWidth={unit * 1.5} />
                  <path
                    d={`M${mid.x - unit * 4} ${mid.y}H${mid.x + unit * 4}M${mid.x} ${mid.y - unit * 4}V${mid.y + unit * 4}`}
                    stroke="var(--accent)"
                    strokeWidth={unit * 1.5}
                  />
                </g>
              );
            })}
            {/* hoekpunten slepen */}
            {roomPoints(selectedRoom).map((q, i) => (
              <circle
                key={`v-${i}`}
                cx={q.x}
                cy={q.y}
                r={unit * (vertex === i ? 11 : 9)}
                fill={vertex === i ? "var(--ink)" : "var(--accent)"}
                stroke="var(--surface)"
                strokeWidth={unit * 2}
                style={{ cursor: "move" }}
                onPointerDown={(ev) => {
                  onVertex?.(i);
                  begin(ev, { kind: "vertex", id: selectedRoom.id, index: i, start: toPlan(ev), orig: selectedRoom });
                }}
              />
            ))}
          </g>
        )}

        {/* Draaigreep voor het gekozen meubel */}
        {!readOnly &&
          selectedItem &&
          (() => {
            const f = footprint(selectedItem);
            const c = { x: selectedItem.x + f.w / 2, y: selectedItem.y + f.h / 2 };
            const t = (selectedItem.rotation * Math.PI) / 180;
            const reach = selectedItem.d / 2 + unit * 22;
            const hx = c.x + Math.sin(t) * reach;
            const hy = c.y - Math.cos(t) * reach;
            return (
              <g>
                <line x1={c.x} y1={c.y} x2={hx} y2={hy} stroke="var(--accent)" strokeWidth={unit * 1.2} strokeDasharray={`${unit * 3} ${unit * 3}`} />
                <circle
                  cx={hx}
                  cy={hy}
                  r={unit * 9}
                  fill="var(--accent)"
                  stroke="var(--surface)"
                  strokeWidth={unit * 2}
                  style={{ cursor: "grab" }}
                  onPointerDown={(ev) => begin(ev, { kind: "rotate", id: selectedItem.id, center: c, orig: selectedItem })}
                />
                <path
                  d={`M${hx - unit * 4} ${hy + unit * 1}a${unit * 4} ${unit * 4} 0 1 1 ${unit * 2} ${unit * 3}`}
                  fill="none"
                  stroke="var(--surface)"
                  strokeWidth={unit * 1.4}
                  pointerEvents="none"
                />
              </g>
            );
          })()}
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

function ResizeHandles({ r, unit, onStart }: { r: Room; unit: number; onStart: (e: React.PointerEvent, r: Room, edge: "e" | "s" | "se") => void }) {
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
