"use client";

import dynamic from "next/dynamic";
import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import { checkLayout } from "@/lib/indeling";
import { LayoutChecks } from "./LayoutChecks";
import { postJson, uploadPhoto } from "@/lib/client-api";
import { signedUrls } from "@/lib/supabase/client";
import { BeforeAfter } from "@/components/ui/BeforeAfter";
import { useUser } from "@/components/auth/AuthGate";
import {
  FLOORS,
  FURNITURE,
  bboxOf,
  bounds,
  centroid,
  edgeLength,
  emptyFloorplan,
  fitOpenings,
  floorplanFromDetected,
  footprint,
  isPolygon,
  remapOpenings,
  roomArea,
  roomEdges,
  roomOf,
  roomPoints,
  shapePreset,
  uid,
  wallLength,
  withPoints,
} from "@/lib/floorplan";
import { FURNITURE_TYPES, type FloorItem, type Floorplan, type FloorplanFromImage, type FurnitureType, type LayoutSuggestion, type Room, type Wall } from "@/lib/schemas";
import type { Project } from "@/lib/types";
import { Icon } from "@/components/ui/Icon";
import { CameraTool } from "@/components/tools/CameraTool";
import { FloorplanEditor, WALLS, type Selection } from "./FloorplanEditor";

const Walkthrough3D = dynamic(() => import("./Walkthrough3D"), {
  ssr: false,
  loading: () => (
    <div className="grid h-[58dvh] min-h-[340px] place-items-center rounded-2xl bg-surface-2 text-ink-3">
      <Icon name="loader" size={28} />
    </div>
  ),
});

const ArView = dynamic(() => import("./ArView"), { ssr: false });

const WALL_COLORS = ["#F2EEE8", "#FFFFFF", "#E8DFD3", "#D9CBB8", "#C9D1C0", "#B7C4CC", "#E7C9B5", "#8C9A7E"];

const SHAPES: { key: "rect" | "l" | "corner" | "bay" | "free"; label: string; d: string }[] = [
  { key: "rect", label: "Rechthoek", d: "M4 6h16v12H4z" },
  { key: "l", label: "L-vorm", d: "M4 4h9v6h7v10H4z" },
  { key: "corner", label: "Schuine hoek", d: "M4 4h11l5 5v11H4z" },
  { key: "bay", label: "Erker", d: "M4 4h16v11h-5l-1.5 4h-5L7 15H4z" },
  { key: "free", label: "Vrij", d: "M5 5l13 2 1 11-9 2-6-6z" },
];

const RECT_EDGES = ["Boven", "Rechts", "Onder", "Links"];
const edgeName = (r: Room, i: number) => (isPolygon(r) ? `Wand ${i + 1}` : RECT_EDGES[i] ?? `Wand ${i + 1}`);

/** Meubels die je ook rond of ovaal kunt maken. */
const CAN_BE_ROUND = new Set(["eettafel", "salontafel", "nachtkastje", "bureau", "vloerkleed", "fauteuil", "overig"]);

function Num({ label, value, onChange, min = 0, step = 5 }: { label: string; value: number; onChange: (v: number) => void; min?: number; step?: number }) {
  return (
    <label className="block">
      <span className="label">{label}</span>
      <input
        type="number"
        inputMode="numeric"
        className="input py-2"
        value={Math.round(value)}
        min={min}
        step={step}
        onChange={(e) => {
          const v = Number(e.target.value);
          if (!Number.isNaN(v)) onChange(Math.max(min, v));
        }}
      />
    </label>
  );
}

export function FloorplanTab({ project, onSave }: { project: Project; onSave: (p: Floorplan) => void }) {
  const [plan, setPlan] = useState<Floorplan>(() => project.floorplan ?? emptyFloorplan());
  const [view, setView] = useState<"2d" | "3d">("2d");
  const [sel, setSelState] = useState<Selection>(null);
  const [vertex, setVertex] = useState<number | null>(null);
  const setSel = (s: Selection) => {
    setSelState(s);
    if (s?.kind !== "room" || s.id !== sel?.id) setVertex(null);
  };
  const [catalog, setCatalog] = useState(false);
  const [aiBusy, setAiBusy] = useState(false);
  const [aiNote, setAiNote] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(true);
  // Live: neem een plattegrond over die iemand anders heeft opgeslagen (niet tijdens eigen bewerkingen).
  const [remote, setRemote] = useState(project.floorplan);
  if (project.floorplan !== remote) {
    setRemote(project.floorplan);
    if (saved && project.floorplan && JSON.stringify(project.floorplan) !== JSON.stringify(plan)) setPlan(project.floorplan);
  }
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const history = useRef<Floorplan[]>([]);
  const user = useUser();
  const photoRef = useRef<HTMLInputElement>(null);
  const [scan, setScan] = useState<{ busy: boolean; plan?: Floorplan; note?: string } | null>(null);
  const [scanSel, setScanSel] = useState<Selection>(null);
  const [render, setRender] = useState<{ busy: boolean; before?: string; after?: string } | null>(null);

  async function renderPhoto(png: Blob) {
    const before = URL.createObjectURL(png);
    setRender({ busy: true, before });
    setError(null);
    try {
      const sourcePath = await uploadPhoto(user.id, project.id, new File([png], "3d.png", { type: "image/png" }));
      const { image } = await postJson<{ image: { path: string } }>(`/api/projects/${project.id}/images`, {
        kind: "render",
        sourcePath,
        prompt: project.style ? `interieur in ${project.style}-stijl` : "warm en licht interieur",
      });
      const urls = await signedUrls([image.path]);
      setRender({ busy: false, before, after: urls[image.path] });
    } catch (e) {
      setRender(null);
      setError(e instanceof Error ? e.message : "De foto kon niet worden gemaakt.");
    }
  }

  async function fromPhoto(file: File) {
    setScan({ busy: true });
    setError(null);
    try {
      const imagePath = await uploadPhoto(user.id, project.id, file);
      const { detected } = await postJson<{ detected: FloorplanFromImage }>(`/api/projects/${project.id}/floorplan-from-image`, { imagePath });
      const next = floorplanFromDetected(detected, plan);
      if (next.rooms.length === 0) throw new Error("Er zijn geen ruimtes herkend. Probeer een scherpere foto, recht van boven.");
      setScan({ busy: false, plan: next, note: detected.note });
    } catch (e) {
      setScan(null);
      setError(e instanceof Error ? e.message : "Inlezen lukte niet.");
    }
  }

  function acceptScan(mode: "replace" | "append") {
    if (!scan?.plan) return;
    if (mode === "replace") change({ ...scan.plan, items: [] });
    else {
      const b = bounds(plan);
      const dx = plan.rooms.length ? b.maxX + 100 : 0;
      const ids = new Map(scan.plan.rooms.map((r) => [r.id, uid()]));
      change({
        ...plan,
        rooms: [...plan.rooms, ...scan.plan.rooms.map((r) => ({ ...r, id: ids.get(r.id)!, x: r.x + dx }))],
        openings: [...plan.openings, ...scan.plan.openings.map((o) => ({ ...o, id: uid(), roomId: ids.get(o.roomId)! }))],
      });
    }
    setScan(null);
  }
  const [canUndo, setCanUndo] = useState(false);
  const [measureFor, setMeasureFor] = useState<null | "w" | "h">(null);
  const [arItem, setArItem] = useState<FloorItem | null>(null);

  // Automatisch opslaan, kort na de laatste wijziging.
  function change(raw: Floorplan, record = true) {
    const next = fitOpenings(raw);
    if (record) history.current = [...history.current.slice(-40), plan];
    setCanUndo(history.current.length > 0);
    setPlan(next);
    setSaved(false);
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => {
      onSave(next);
      setSaved(true);
    }, 700);
  }
  useEffect(() => () => void (timer.current && clearTimeout(timer.current)), []);

  function undo() {
    const prev = history.current.pop();
    if (prev) change(prev, false);
  }

  const room = sel?.kind === "room" ? plan.rooms.find((r) => r.id === sel.id) : undefined;
  const item = sel?.kind === "item" ? plan.items.find((i) => i.id === sel.id) : undefined;
  const opening = sel?.kind === "opening" ? plan.openings.find((o) => o.id === sel.id) : undefined;
  const targetRoom = room ?? (item ? roomOf(plan, item) : null) ?? plan.rooms[0];

  function addRoom() {
    const last = plan.rooms[plan.rooms.length - 1];
    const r = { id: uid(), name: `Ruimte ${plan.rooms.length + 1}`, x: last ? last.x + last.w : 0, y: last ? last.y : 0, w: 400, h: 350, floor: "eiken" };
    change({ ...plan, rooms: [...plan.rooms, r] });
    setSel({ kind: "room", id: r.id });
  }

  function addOpening(type: "door" | "window") {
    if (!targetRoom) return;
    const wall: Wall = type === "door" ? "s" : "n";
    const width = type === "door" ? 85 : 120;
    // vrije vorm: deur op de onderste wand, raam op de bovenste (op basis van het midden van elke wand)
    const edges = roomEdges(targetRoom);
    const pick = isPolygon(targetRoom)
      ? edges.reduce((best, e) => {
          const my = (e.a.y + e.b.y) / 2;
          const bm = (best.a.y + best.b.y) / 2;
          return (type === "door" ? my > bm : my < bm) && edgeLength(targetRoom, e.i) >= width + 10 ? e : best;
        }, edges[0])
      : null;
    const L = pick ? edgeLength(targetRoom, pick.i) : wallLength(targetRoom, wall);
    const o = {
      id: uid(),
      type,
      roomId: targetRoom.id,
      wall,
      ...(pick ? { edge: pick.i } : {}),
      width: Math.min(width, Math.max(40, L - 10)),
      offset: Math.max(0, Math.round(L / 2 - width / 2)),
    };
    change({ ...plan, openings: [...plan.openings, o] });
    setSel({ kind: "opening", id: o.id });
  }

  function addItem(type: FurnitureType) {
    const r = targetRoom;
    const f = FURNITURE[type];
    const c = r ? centroid(roomPoints(r)) : { x: 0, y: 0 };
    const it: FloorItem = {
      id: uid(),
      type,
      name: f.label,
      w: f.w,
      d: f.d,
      h: f.h,
      color: f.color,
      rotation: 0,
      x: Math.round(c.x - f.w / 2),
      y: Math.round(c.y - f.d / 2),
    };
    change({ ...plan, items: [...plan.items, it] });
    setSel({ kind: "item", id: it.id });
    setCatalog(false);
  }

  function remove() {
    if (!sel) return;
    if (sel.kind === "room") {
      const r = plan.rooms.find((x) => x.id === sel.id);
      change({
        ...plan,
        rooms: plan.rooms.filter((x) => x.id !== sel.id),
        openings: plan.openings.filter((o) => o.roomId !== sel.id),
        items: r ? plan.items.filter((i) => roomOf(plan, i)?.id !== r.id) : plan.items,
      });
    } else if (sel.kind === "item") change({ ...plan, items: plan.items.filter((x) => x.id !== sel.id) });
    else change({ ...plan, openings: plan.openings.filter((x) => x.id !== sel.id) });
    setSel(null);
  }

  function patchRoom(p: Partial<(typeof plan.rooms)[number]>) {
    if (!room) return;
    change({ ...plan, rooms: plan.rooms.map((r) => (r.id === room.id ? { ...r, ...p } : r)) });
  }
  /** Andere vorm voor de gekozen ruimte; deuren en ramen gaan mee naar de dichtstbijzijnde wand. */
  function setShape(kind: (typeof SHAPES)[number]["key"]) {
    if (!room) return;
    let next: Room;
    if (kind === "rect") {
      const { points: _drop, ...rest } = room;
      void _drop;
      next = { ...rest, ...bboxOf(roomPoints(room)) };
    } else {
      const base: Room = { ...room, points: undefined };
      next = withPoints(room, shapePreset(base, kind) ?? roomPoints(room));
    }
    change({ ...plan, rooms: plan.rooms.map((r) => (r.id === room.id ? next : r)), openings: remapOpenings(plan, room.id, next) });
    setVertex(null);
  }

  /** Breedte/diepte aanpassen; bij een vrije vorm schaalt de hele vorm mee. */
  function resizeRoom(w: number, h: number) {
    if (!room) return;
    if (!isPolygon(room)) return patchRoom({ w, h });
    const sx = room.w ? w / room.w : 1;
    const sy = room.h ? h / room.h : 1;
    const pts = roomPoints(room).map((p) => ({ x: Math.round(room.x + (p.x - room.x) * sx), y: Math.round(room.y + (p.y - room.y) * sy) }));
    const next = withPoints(room, pts);
    change({ ...plan, rooms: plan.rooms.map((r) => (r.id === room.id ? next : r)), openings: remapOpenings(plan, room.id, next) });
  }

  function patchVertex(i: number, p: { x?: number; y?: number }) {
    if (!room) return;
    const pts = roomPoints(room).map((q, j) => (j === i ? { ...q, ...p } : q));
    patchRoom(withPoints(room, pts));
  }

  function removeVertex(i: number) {
    if (!room || roomPoints(room).length <= 3) return;
    const pts = roomPoints(room).filter((_, j) => j !== i);
    const next = withPoints(room, pts);
    change({ ...plan, rooms: plan.rooms.map((r) => (r.id === room.id ? next : r)), openings: remapOpenings(plan, room.id, next) });
    setVertex(null);
  }

  function patchItem(p: Partial<FloorItem>) {
    if (!item) return;
    change({ ...plan, items: plan.items.map((i) => (i.id === item.id ? { ...i, ...p } : i)) });
  }
  function patchOpening(p: Partial<(typeof plan.openings)[number]>) {
    if (!opening) return;
    change({ ...plan, openings: plan.openings.map((o) => (o.id === opening.id ? { ...o, ...p } : o)) });
  }

  async function aiFurnish() {
    if (!targetRoom) return;
    setAiBusy(true);
    setError(null);
    setAiNote(null);
    try {
      const { suggestion } = await postJson<{ suggestion: LayoutSuggestion }>(`/api/projects/${project.id}/layout`, {
        floorplan: plan,
        roomId: targetRoom.id,
      });
      const keep = plan.items.filter((i) => roomOf(plan, i)?.id !== targetRoom.id);
      const added: FloorItem[] = suggestion.items.map((i) => ({ ...i, id: uid(), rotation: ((Math.round(i.rotation / 90) * 90) % 360 + 360) % 360 }));
      change({ ...plan, items: [...keep, ...added] });
      setAiNote(suggestion.explanation);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Inrichten lukte niet.");
    } finally {
      setAiBusy(false);
    }
  }

  const area = plan.rooms.reduce((s, r) => s + roomArea(r) / 10000, 0);
  const checks = useMemo(() => checkLayout(plan), [plan]);
  const flags = useMemo(() => {
    const m = new Map<string, "warn" | "tip">();
    for (const c of checks) for (const id of c.ids) if (m.get(id) !== "warn") m.set(id, c.level);
    return m;
  }, [checks]);
  const vpts = room ? roomPoints(room) : [];

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex gap-1 rounded-full bg-surface-2 p-1 text-sm">
          <button className={`inline-flex items-center gap-1.5 rounded-full px-3.5 py-1.5 ${view === "2d" ? "bg-surface shadow-sm" : "text-ink-2"}`} onClick={() => setView("2d")}>
            <Icon name="plan" size={16} /> Tekenen
          </button>
          <button className={`inline-flex items-center gap-1.5 rounded-full px-3.5 py-1.5 ${view === "3d" ? "bg-surface shadow-sm" : "text-ink-2"}`} onClick={() => setView("3d")}>
            <Icon name="cube" size={16} /> 3D bekijken
          </button>
        </div>
        <p className="text-xs text-ink-3">
          {area.toLocaleString("nl-NL", { maximumFractionDigits: 1 })} m² · {saved ? "opgeslagen" : "opslaan…"}
        </p>
      </div>

      {view === "3d" ? (
        <>
          <Walkthrough3D plan={plan} onCapture={renderPhoto} capturing={render?.busy} />
          {error && <p className="text-sm text-danger">{error}</p>}
          <p className="text-xs text-ink-3">
            Kies een mooi standpunt (ook tijdens het rondlopen) en tik op &ldquo;Maak er een foto van&rdquo;: AI maakt er een echte interieurfoto van,
            in je stijl. Die komt ook bij je beelden.
          </p>
        </>
      ) : (
        <div className="grid gap-3 lg:grid-cols-[minmax(0,1fr)_320px]">
          <div className="min-w-0 space-y-2">
            <div className="no-scrollbar flex gap-2 overflow-x-auto pb-1">
              <button className="btn-outline shrink-0 px-3 py-2" onClick={() => photoRef.current?.click()} disabled={scan?.busy}>
                <Icon name={scan?.busy ? "loader" : "camera"} size={16} /> {scan?.busy ? "Inlezen…" : "Uit foto"}
              </button>
              <input
                ref={photoRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (f) fromPhoto(f);
                  e.target.value = "";
                }}
              />
              <button className="btn-outline shrink-0 px-3 py-2" onClick={addRoom}>
                <Icon name="plus" size={16} /> Ruimte
              </button>
              <button className="btn-outline shrink-0 px-3 py-2" onClick={() => addOpening("door")} disabled={!targetRoom}>
                <Icon name="door" size={16} /> Deur
              </button>
              <button className="btn-outline shrink-0 px-3 py-2" onClick={() => addOpening("window")} disabled={!targetRoom}>
                <Icon name="window" size={16} /> Raam
              </button>
              <button className="btn-outline shrink-0 px-3 py-2" onClick={() => setCatalog((c) => !c)} disabled={!targetRoom}>
                <Icon name="sofa" size={16} /> Meubel
              </button>
              <button className="btn-primary shrink-0 px-3 py-2" onClick={aiFurnish} disabled={aiBusy || !targetRoom}>
                <Icon name={aiBusy ? "loader" : "sparkles"} size={16} /> {aiBusy ? "Inrichten…" : `Richt ${targetRoom?.name ?? "ruimte"} in`}
              </button>
              <button className="btn-ghost shrink-0 px-3 py-2" onClick={undo} disabled={!canUndo} aria-label="Ongedaan maken">
                <Icon name="rotate" size={16} className="-scale-x-100" /> Terug
              </button>
              {plan.rooms.length > 0 && (
                <Link href={`/projecten/${project.id}/afdrukken`} className="btn-ghost shrink-0 px-3 py-2">
                  <Icon name="download" size={16} /> Pdf op schaal
                </Link>
              )}
            </div>

            {catalog && (
              <div className="card grid grid-cols-3 gap-1 p-2 sm:grid-cols-4">
                {FURNITURE_TYPES.map((t) => (
                  <button key={t} className="rounded-xl px-2 py-2.5 text-sm text-ink-2 hover:bg-surface-2 hover:text-ink" onClick={() => addItem(t)}>
                    {FURNITURE[t].label}
                  </button>
                ))}
              </div>
            )}

            {scan?.busy && (
              <p className="flex items-center gap-2 rounded-xl bg-accent-soft p-3 text-sm">
                <Icon name="loader" size={16} /> De plattegrond wordt gelezen: ruimtes, maten, deuren en ramen. Dit duurt ongeveer een minuut.
              </p>
            )}
            <FloorplanEditor plan={plan} onChange={(p) => change(p)} selection={sel} onSelect={setSel} vertex={vertex} onVertex={setVertex} flags={flags} />
            {error && <p className="text-sm text-danger">{error}</p>}
            {aiNote && (
              <p className="flex gap-2 rounded-xl bg-olive-soft p-3 text-sm text-ink">
                <Icon name="sparkles" size={16} className="mt-0.5 shrink-0 text-olive" /> {aiNote}
              </p>
            )}
          </div>

          <aside className="card h-fit space-y-4 p-4">
            {!sel && (
              <>
                <div>
                  <h3 className="font-medium">Zo werkt het</h3>
                  <ul className="mt-2 space-y-1.5 text-sm text-ink-2">
                    <li>Tik een ruimte, deur of meubel aan om het te kiezen; sleep om te verplaatsen.</li>
                    <li>Gebruik de oranje grepen om een ruimte groter of kleiner te maken.</li>
                    <li>L-vorm, schuine muur of erker? Kies een ruimte en dan een vorm; sleep de hoekpunten of tik een plusje aan voor een extra hoek.</li>
                    <li>Meubels draai je met het bolletje erboven, in stappen van 15°.</li>
                    <li>Ruimtes plakken vanzelf tegen elkaar aan.</li>
                    <li>Klaar? Bekijk het in 3D en loop erdoorheen.</li>
                  </ul>
                </div>
                {plan.items.length > 0 && (
                  <div>
                    <h3 className="mb-2 font-medium">Indeling</h3>
                    <LayoutChecks checks={checks} onPick={(id) => setSel({ kind: "item", id })} />
                  </div>
                )}
                <div>
                  <span className="label">Noorden · {Math.round(plan.north ?? 0)}°</span>
                  <div className="flex items-center gap-3">
                    <svg viewBox="0 0 40 40" width={40} height={40} className="shrink-0 text-ink-2" aria-hidden>
                      <circle cx="20" cy="20" r="18" fill="none" stroke="currentColor" strokeWidth="1.4" />
                      <g transform={`rotate(${plan.north ?? 0} 20 20)`}>
                        <path d="M20 6l4 14h-8z" fill="var(--accent)" />
                        <path d="M20 34l4-14h-8z" fill="none" stroke="currentColor" strokeWidth="1.2" />
                      </g>
                    </svg>
                    <input
                      type="range"
                      min={0}
                      max={345}
                      step={15}
                      value={plan.north ?? 0}
                      onChange={(e) => change({ ...plan, north: Number(e.target.value) })}
                      className="w-full accent-[var(--accent)]"
                      aria-label="Richting van het noorden"
                    />
                  </div>
                  <p className="mt-1 text-xs text-ink-3">Waar is het noorden op je tekening? Dan klopt het zonlicht in 3D.</p>
                </div>
                <Num label="Wandhoogte (cm)" value={plan.wallHeight} min={200} onChange={(v) => change({ ...plan, wallHeight: v })} />
                <div>
                  <span className="label">Wandkleur</span>
                  <div className="flex flex-wrap gap-2">
                    {WALL_COLORS.map((c) => (
                      <button
                        key={c}
                        aria-label={`Wandkleur ${c}`}
                        onClick={() => change({ ...plan, wallColor: c })}
                        className={`h-8 w-8 rounded-full border ${plan.wallColor === c ? "ring-2 ring-accent ring-offset-2 ring-offset-surface" : "border-line"}`}
                        style={{ background: c }}
                      />
                    ))}
                    <input type="color" aria-label="Eigen wandkleur" value={plan.wallColor} onChange={(e) => change({ ...plan, wallColor: e.target.value })} className="h-8 w-8 cursor-pointer rounded-full border border-line bg-transparent" />
                  </div>
                </div>
              </>
            )}

            {room && (
              <>
                <h3 className="font-medium">Ruimte</h3>
                <label className="block">
                  <span className="label">Naam</span>
                  <input className="input py-2" value={room.name} onChange={(e) => patchRoom({ name: e.target.value })} />
                </label>
                <div>
                  <span className="label">Vorm</span>
                  <div className="grid grid-cols-5 gap-1">
                    {SHAPES.map((s) => {
                      const on = s.key === "rect" ? !isPolygon(room) : false;
                      return (
                        <button
                          key={s.key}
                          className="flex flex-col items-center gap-1 rounded-xl border px-1 py-2 text-[11px] leading-tight text-ink-2 hover:bg-surface-2 data-[on=true]:border-accent data-[on=true]:bg-accent-soft data-[on=true]:text-ink"
                          style={{ borderColor: on ? undefined : "var(--line)" }}
                          data-on={on}
                          onClick={() => setShape(s.key)}
                          title={s.label}
                        >
                          <svg viewBox="0 0 24 24" width={22} height={22} fill="none" stroke="currentColor" strokeWidth={1.6} strokeLinejoin="round">
                            <path d={s.d} />
                          </svg>
                          {s.label}
                        </button>
                      );
                    })}
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <Num label={isPolygon(room) ? "Totale breedte" : "Breedte (cm)"} value={room.w} min={100} onChange={(w) => resizeRoom(w, room.h)} />
                  <Num label={isPolygon(room) ? "Totale diepte" : "Diepte (cm)"} value={room.h} min={100} onChange={(h) => resizeRoom(room.w, h)} />
                  <button className="btn-ghost px-2 py-1.5 text-xs" onClick={() => setMeasureFor("w")}>
                    <Icon name="camera" size={14} /> Meet breedte
                  </button>
                  <button className="btn-ghost px-2 py-1.5 text-xs" onClick={() => setMeasureFor("h")}>
                    <Icon name="camera" size={14} /> Meet diepte
                  </button>
                </div>
                <div>
                  <span className="label">Schuin dak</span>
                  <div className="flex flex-wrap gap-1">
                    {roomEdges(room).map((e) => {
                      const on = !!room.slopes?.some((s) => s.edge === e.i);
                      return (
                        <button
                          key={e.i}
                          className="chip px-2.5 py-1 text-xs"
                          data-on={on}
                          onClick={() =>
                            patchRoom({
                              slopes: on ? room.slopes!.filter((s) => s.edge !== e.i) : [...(room.slopes ?? []), { edge: e.i, knee: 60, angle: 45 }],
                            })
                          }
                        >
                          {edgeName(room, e.i)}
                        </button>
                      );
                    })}
                  </div>
                  {(room.slopes ?? []).map((sl) => (
                    <div key={sl.edge} className="mt-2 grid grid-cols-2 gap-2">
                      <Num
                        label={`Knieschot ${edgeName(room, sl.edge).toLowerCase()} (cm)`}
                        value={sl.knee}
                        min={0}
                        onChange={(knee) => patchRoom({ slopes: room.slopes!.map((s) => (s.edge === sl.edge ? { ...s, knee: Math.min(knee, plan.wallHeight) } : s)) })}
                      />
                      <Num
                        label="Helling (graden)"
                        value={sl.angle}
                        min={15}
                        step={1}
                        onChange={(angle) => patchRoom({ slopes: room.slopes!.map((s) => (s.edge === sl.edge ? { ...s, angle: Math.min(75, angle) } : s)) })}
                      />
                    </div>
                  ))}
                  <p className="mt-1 text-xs text-ink-3">Zolder of dakkamer? Kies de wand onder het schuine dak. Het knieschot is de lage wand; de meeste daken hellen 40 tot 50 graden.</p>
                </div>
                {isPolygon(room) && (
                  <div className="space-y-2 rounded-xl bg-surface-2 p-3">
                    <p className="text-sm">
                      {(roomArea(room) / 10000).toLocaleString("nl-NL", { maximumFractionDigits: 1 })} m² · {vpts.length} hoeken
                    </p>
                    {vertex !== null && vpts[vertex] ? (
                      <>
                        <p className="text-xs text-ink-2">Hoekpunt {vertex + 1} (in cm)</p>
                        <div className="grid grid-cols-2 gap-2">
                          <Num label="x" value={vpts[vertex].x} min={-100000} onChange={(x) => patchVertex(vertex, { x })} />
                          <Num label="y" value={vpts[vertex].y} min={-100000} onChange={(y) => patchVertex(vertex, { y })} />
                        </div>
                        <button className="btn-ghost w-full px-2 py-1.5 text-xs text-danger" onClick={() => removeVertex(vertex)} disabled={vpts.length <= 3}>
                          <Icon name="minus" size={14} /> Hoekpunt weghalen
                        </button>
                      </>
                    ) : (
                      <p className="text-xs text-ink-3">Sleep een hoekpunt, of tik een plusje halverwege een wand aan voor een extra hoek. Tik een hoekpunt aan om het exact in te stellen of weg te halen.</p>
                    )}
                  </div>
                )}
                <div>
                  <span className="label">Vloer</span>
                  <div className="flex flex-wrap gap-1.5">
                    {FLOORS.map((f) => (
                      <button key={f.key} className="chip px-2.5 py-1 text-xs" data-on={room.floor === f.key} onClick={() => patchRoom({ floor: f.key })}>
                        <span className="h-3 w-3 rounded-full" style={{ background: f.color }} /> {f.label}
                      </button>
                    ))}
                  </div>
                </div>
              </>
            )}

            {opening && (
              <>
                <h3 className="font-medium">{opening.type === "door" ? "Deur" : "Raam"}</h3>
                {(() => {
                  const r = plan.rooms.find((x) => x.id === opening.roomId);
                  if (r && isPolygon(r)) {
                    return (
                      <div>
                        <span className="label">Welke wand</span>
                        <div className="flex flex-wrap gap-1">
                          {roomEdges(r).map((e) => {
                            const L = edgeLength(r, e.i);
                            return (
                              <button
                                key={e.i}
                                className="chip px-2.5 py-1.5 text-xs"
                                data-on={opening.edge === e.i}
                                disabled={L < 50}
                                onClick={() => patchOpening({ edge: e.i, offset: Math.max(0, Math.round(L / 2 - Math.min(opening.width, L - 10) / 2)), width: Math.min(opening.width, Math.max(40, L - 10)) })}
                              >
                                {e.i + 1} · {(L / 100).toLocaleString("nl-NL", { maximumFractionDigits: 2 })} m
                              </button>
                            );
                          })}
                        </div>
                        <p className="mt-1 text-xs text-ink-3">De nummers staan bij de wanden als je de ruimte aantikt.</p>
                      </div>
                    );
                  }
                  return (
                    <div>
                      <span className="label">Welke wand</span>
                      <div className="grid grid-cols-4 gap-1">
                        {WALLS.map((w) => (
                          <button key={w.key} className="chip justify-center px-2 py-1.5 text-xs" data-on={opening.wall === w.key} onClick={() => patchOpening({ wall: w.key, offset: 20 })}>
                            {w.label}
                          </button>
                        ))}
                      </div>
                    </div>
                  );
                })()}
                <div className="grid grid-cols-2 gap-2">
                  <Num label="Breedte (cm)" value={opening.width} min={40} onChange={(width) => patchOpening({ width })} />
                  <Num label="Vanaf hoek (cm)" value={opening.offset} onChange={(offset) => patchOpening({ offset })} />
                </div>
              </>
            )}

            {item && (
              <>
                <h3 className="font-medium">Meubel</h3>
                <label className="block">
                  <span className="label">Naam</span>
                  <input className="input py-2" value={item.name} onChange={(e) => patchItem({ name: e.target.value })} />
                </label>
                <div className="grid grid-cols-3 gap-2">
                  <Num label="Breed" value={item.w} min={5} onChange={(w) => patchItem({ w })} />
                  <Num label="Diep" value={item.d} min={5} onChange={(d) => patchItem({ d })} />
                  <Num label="Hoog" value={item.h} min={1} onChange={(h) => patchItem({ h })} />
                </div>
                <label className="block">
                  <span className="label">Draaien · {Math.round(item.rotation)}°</span>
                  <input
                    type="range"
                    min={0}
                    max={345}
                    step={15}
                    value={Math.round(item.rotation / 15) * 15 === 360 ? 0 : Math.round(item.rotation / 15) * 15}
                    onChange={(e) => {
                      // om het midden draaien, zodat het meubel niet verspringt
                      const rot = Number(e.target.value);
                      const f0 = footprint(item);
                      const f1 = footprint({ ...item, rotation: rot });
                      patchItem({ rotation: rot, x: Math.round(item.x + f0.w / 2 - f1.w / 2), y: Math.round(item.y + f0.h / 2 - f1.h / 2) });
                    }}
                    className="w-full accent-[var(--accent)]"
                  />
                </label>
                <div className="flex items-end gap-2">
                  <button
                    className="btn-outline flex-1"
                    onClick={() => {
                      const rot = (Math.round(item.rotation) + 90) % 360;
                      const f0 = footprint(item);
                      const f1 = footprint({ ...item, rotation: rot });
                      patchItem({ rotation: rot, x: Math.round(item.x + f0.w / 2 - f1.w / 2), y: Math.round(item.y + f0.h / 2 - f1.h / 2) });
                    }}
                  >
                    <Icon name="rotate" size={16} /> Draai 90°
                  </button>
                  {CAN_BE_ROUND.has(item.type) && (
                    <button className="chip px-3 py-2 text-sm" data-on={item.shape === "round"} onClick={() => patchItem({ shape: item.shape === "round" ? "rect" : "round" })}>
                      <svg viewBox="0 0 24 24" width={16} height={16} fill="none" stroke="currentColor" strokeWidth={1.6}>
                        <ellipse cx="12" cy="12" rx="8" ry="6" />
                      </svg>
                      Rond
                    </button>
                  )}
                  <label className="block">
                    <span className="sr-only">Kleur</span>
                    <input type="color" value={item.color} onChange={(e) => patchItem({ color: e.target.value })} className="h-10 w-12 cursor-pointer rounded-lg border border-line bg-transparent" />
                  </label>
                </div>
                <p className="text-xs text-ink-3">
                  Neemt {Math.round(footprint(item).w)} × {Math.round(footprint(item).h)} cm in beslag.
                </p>
                <LayoutChecks checks={checks.filter((c) => c.ids.includes(item.id))} empty={false} />
                {item.type !== "vloerkleed" && (
                  <button className="btn-outline w-full" onClick={() => setArItem(item)}>
                    <Icon name="camera" size={16} /> Bekijk in je kamer (AR)
                  </button>
                )}
              </>
            )}

            {sel && (
              <button className="btn-ghost w-full text-danger" onClick={remove}>
                <Icon name="trash" size={16} /> Verwijderen
              </button>
            )}
          </aside>
        </div>
      )}

      {render?.after && render.before && (
        <div className="fixed inset-0 z-50 flex flex-col bg-black/90 p-3 pt-[max(0.75rem,env(safe-area-inset-top))]" onClick={() => setRender(null)}>
          <div className="flex items-center justify-between pb-2 text-white">
            <p className="font-display text-xl">Van 3D naar foto</p>
            <button className="btn text-white/80 hover:bg-white/10" onClick={() => setRender(null)} aria-label="Sluiten">
              <Icon name="x" size={20} />
            </button>
          </div>
          <div className="flex min-h-0 flex-1 items-center justify-center" onClick={(e) => e.stopPropagation()}>
            <BeforeAfter before={render.before} after={render.after} />
          </div>
          <p className="pt-2 text-center text-sm text-white/70">Sleep de lijn. De foto staat ook bij Beelden.</p>
        </div>
      )}

      {arItem && <ArView item={arItem} onClose={() => setArItem(null)} />}

      {measureFor && (
        <CameraTool
          mode="measure"
          onClose={() => setMeasureFor(null)}
          onMeasured={(cm) => {
            if (room && measureFor === "w") resizeRoom(Math.round(cm), room.h);
            else if (room) resizeRoom(room.w, Math.round(cm));
            setMeasureFor(null);
          }}
        />
      )}

      {scan?.plan && (
        <div className="fixed inset-0 z-50 grid place-items-end bg-black/40 sm:place-items-center" onClick={() => setScan(null)}>
          <div
            className="max-h-[92dvh] w-full overflow-y-auto rounded-t-3xl bg-surface p-5 pb-[max(1.25rem,env(safe-area-inset-bottom))] sm:max-w-3xl sm:rounded-3xl"
            onClick={(e) => e.stopPropagation()}
          >
            <h2 className="font-display text-2xl">Zo heb ik je plattegrond gelezen</h2>
            {scan.note && <p className="mt-1 text-sm text-ink-2">{scan.note}</p>}
            <div className="mt-4">
              <FloorplanEditor plan={scan.plan} selection={scanSel} onSelect={setScanSel} readOnly />
            </div>
            <p className="mt-2 text-xs text-ink-3">Controleer de maten even; je kunt alles daarna nog aanpassen.</p>
            <div className="mt-4 flex flex-wrap gap-2">
              <button className="btn-primary" onClick={() => acceptScan("replace")}>
                <Icon name="check" size={18} /> Gebruik deze plattegrond
              </button>
              {plan.rooms.length > 0 && (
                <button className="btn-outline" onClick={() => acceptScan("append")}>
                  <Icon name="plus" size={18} /> Naast de huidige zetten
                </button>
              )}
              <button className="btn-ghost" onClick={() => setScan(null)}>
                Annuleren
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
