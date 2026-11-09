"use client";

import dynamic from "next/dynamic";
import { useEffect, useRef, useState } from "react";
import { postJson } from "@/lib/client-api";
import { FLOORS, FURNITURE, emptyFloorplan, footprint, roomOf, uid, wallLength } from "@/lib/floorplan";
import { FURNITURE_TYPES, type FloorItem, type Floorplan, type FurnitureType, type LayoutSuggestion, type Wall } from "@/lib/schemas";
import type { Project } from "@/lib/types";
import { Icon } from "@/components/ui/Icon";
import { FloorplanEditor, WALLS, type Selection } from "./FloorplanEditor";

const Walkthrough3D = dynamic(() => import("./Walkthrough3D"), {
  ssr: false,
  loading: () => (
    <div className="grid h-[58dvh] min-h-[340px] place-items-center rounded-2xl bg-surface-2 text-ink-3">
      <Icon name="loader" size={28} />
    </div>
  ),
});

const WALL_COLORS = ["#F2EEE8", "#FFFFFF", "#E8DFD3", "#D9CBB8", "#C9D1C0", "#B7C4CC", "#E7C9B5", "#8C9A7E"];

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
  const [sel, setSel] = useState<Selection>(null);
  const [catalog, setCatalog] = useState(false);
  const [aiBusy, setAiBusy] = useState(false);
  const [aiNote, setAiNote] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(true);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const history = useRef<Floorplan[]>([]);
  const [canUndo, setCanUndo] = useState(false);

  // Automatisch opslaan, kort na de laatste wijziging.
  function change(next: Floorplan, record = true) {
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
    const o = { id: uid(), type, roomId: targetRoom.id, wall, width, offset: Math.max(0, wallLength(targetRoom, wall) / 2 - width / 2) };
    change({ ...plan, openings: [...plan.openings, o] });
    setSel({ kind: "opening", id: o.id });
  }

  function addItem(type: FurnitureType) {
    const r = targetRoom;
    const f = FURNITURE[type];
    const it: FloorItem = {
      id: uid(),
      type,
      name: f.label,
      w: f.w,
      d: f.d,
      h: f.h,
      color: f.color,
      rotation: 0,
      x: r ? Math.round(r.x + r.w / 2 - f.w / 2) : 0,
      y: r ? Math.round(r.y + r.h / 2 - f.d / 2) : 0,
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

  const area = plan.rooms.reduce((s, r) => s + (r.w * r.h) / 10000, 0);

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
        <Walkthrough3D plan={plan} />
      ) : (
        <div className="grid gap-3 lg:grid-cols-[1fr_320px]">
          <div className="space-y-2">
            <div className="no-scrollbar flex gap-2 overflow-x-auto pb-1">
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

            <FloorplanEditor plan={plan} onChange={(p) => change(p)} selection={sel} onSelect={setSel} />
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
                    <li>Ruimtes plakken vanzelf tegen elkaar aan.</li>
                    <li>Klaar? Bekijk het in 3D en loop erdoorheen.</li>
                  </ul>
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
                <div className="grid grid-cols-2 gap-2">
                  <Num label="Breedte (cm)" value={room.w} min={100} onChange={(w) => patchRoom({ w })} />
                  <Num label="Diepte (cm)" value={room.h} min={100} onChange={(h) => patchRoom({ h })} />
                </div>
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
                <div className="flex items-end gap-2">
                  <button className="btn-outline flex-1" onClick={() => patchItem({ rotation: (item.rotation + 90) % 360 })}>
                    <Icon name="rotate" size={16} /> Draai 90°
                  </button>
                  <label className="block">
                    <span className="sr-only">Kleur</span>
                    <input type="color" value={item.color} onChange={(e) => patchItem({ color: e.target.value })} className="h-10 w-12 cursor-pointer rounded-lg border border-line bg-transparent" />
                  </label>
                </div>
                <p className="text-xs text-ink-3">
                  Neemt {footprint(item).w} × {footprint(item).h} cm in beslag.
                </p>
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
    </div>
  );
}
