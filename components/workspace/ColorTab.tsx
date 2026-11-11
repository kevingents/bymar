"use client";

import { useMemo, useRef, useState } from "react";
import { postJson, uploadPhoto } from "@/lib/client-api";
import { isPolygon, roomArea, roomSurfaces } from "@/lib/floorplan";
import type { Floorplan } from "@/lib/schemas";
import { euro, storeLink } from "@/lib/stores";
import type { Project, SavedPalette } from "@/lib/types";
import { Icon } from "@/components/ui/Icon";
import { useUser } from "@/components/auth/AuthGate";

/** Leesbare tekstkleur op een vlak. */
function inkOn(hex: string) {
  const h = hex.replace("#", "");
  const [r, g, b] = [0, 2, 4].map((i) => parseInt(h.slice(i, i + 2), 16) || 0);
  return 0.299 * r + 0.587 * g + 0.114 * b > 150 ? "#2a2520" : "#ffffff";
}

function wallArea(plan: Floorplan, roomId: string, height: number) {
  const r = plan.rooms.find((x) => x.id === roomId);
  if (!r) return 0;
  return roomSurfaces(r, height, plan.openings).walls;
}

export function ColorTab({
  project,
  onPalettes,
  onWallColor,
}: {
  project: Project;
  onPalettes: (p: SavedPalette[]) => void;
  onWallColor: (hex: string) => void;
}) {
  const user = useUser();
  const palettes = project.palettes ?? [];
  const plan = project.floorplan;
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [applied, setApplied] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  // verfcalculator
  const [roomId, setRoomId] = useState(plan?.rooms[0]?.id ?? "");
  const [height, setHeight] = useState(plan?.wallHeight ?? 260);
  const [layers, setLayers] = useState(2);
  const [coverage, setCoverage] = useState(10);
  const [ceiling, setCeiling] = useState(false);
  const [pricePerL, setPricePerL] = useState(14);

  const calc = useMemo(() => {
    if (!plan) return null;
    const room = plan.rooms.find((r) => r.id === roomId);
    if (!room) return null;
    const walls = wallArea(plan, roomId, height);
    const top = ceiling ? roomSurfaces(room, height).ceiling : 0;
    const area = walls + top;
    const liters = (area * layers) / Math.max(1, coverage);
    const cans25 = Math.ceil(liters / 2.5);
    return { walls, top, area, liters, cans25, cost: liters * pricePerL };
  }, [plan, roomId, height, layers, coverage, ceiling, pricePerL]);

  async function make(imagePath: string | null) {
    setBusy(true);
    setError(null);
    try {
      const { palettes: next } = await postJson<{ palettes: SavedPalette[] }>(`/api/projects/${project.id}/palette`, { imagePath });
      onPalettes(next);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Er ging iets mis.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="grid gap-6 lg:grid-cols-[1fr_360px]">
      <section className="space-y-4">
        <div className="card flex flex-wrap items-center justify-between gap-3 p-4 sm:p-5">
          <div>
            <h2 className="font-display text-xl">Kleurpaletten</h2>
            <p className="text-sm text-ink-2">Uit een foto die je mooi vindt, of passend bij je stijl.</p>
          </div>
          <div className="flex flex-wrap gap-2">
            <button className="btn-primary" onClick={() => fileRef.current?.click()} disabled={busy}>
              <Icon name={busy ? "loader" : "camera"} size={18} /> Uit een foto
            </button>
            <button className="btn-outline" onClick={() => make(null)} disabled={busy}>
              <Icon name="sparkles" size={18} /> Bij mijn stijl
            </button>
            <input
              ref={fileRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={async (e) => {
                const f = e.target.files?.[0];
                e.target.value = "";
                if (!f) return;
                setBusy(true);
                try {
                  await make(await uploadPhoto(user.id, project.id, f));
                } catch {
                  setBusy(false);
                  setError("Uploaden lukte niet.");
                }
              }}
            />
          </div>
          {error && <p className="w-full text-sm text-danger">{error}</p>}
        </div>

        {palettes.length === 0 && !busy && (
          <div className="card overflow-hidden">
            <div className="flex h-28">
              {["#EDE6DB", "#C9A57E", "#8E9A7B", "#3B3631", "#D8CDBB", "#A4593B"].map((c) => (
                <div key={c} className="flex-1" style={{ background: c }} />
              ))}
            </div>
            <p className="p-4 text-sm text-ink-2">
              Maak een foto van een kussen, een tegel of een interieur dat je mooi vindt. Huisraad haalt er de kleuren uit en
              zoekt verf die erbij past.
            </p>
          </div>
        )}
        {busy && <div className="h-40 animate-pulse rounded-2xl bg-surface-2" />}

        {palettes.map((p) => (
          <article key={p.id} className="card overflow-hidden">
            <div className="flex h-32 sm:h-40">
              {p.colors.map((c) => (
                <div key={c.hex + c.name} className="flex flex-1 flex-col justify-end p-2 text-[11px] sm:text-xs" style={{ background: c.hex, color: inkOn(c.hex) }}>
                  <span className="font-medium">{c.name}</span>
                  <span className="opacity-80">{c.hex.toUpperCase()}</span>
                </div>
              ))}
            </div>
            <div className="p-4 sm:p-5">
              <div className="flex flex-wrap items-start justify-between gap-2">
                <h3 className="font-display text-lg">{p.name}</h3>
                <button
                  className="text-ink-3 hover:text-danger"
                  aria-label="Palet verwijderen"
                  onClick={() => onPalettes(palettes.filter((x) => x.id !== p.id))}
                >
                  <Icon name="trash" size={16} />
                </button>
              </div>
              <p className="mt-1 text-sm text-ink-2">{p.advice}</p>
              <ul className="mt-3 divide-y divide-line">
                {p.colors.map((c) => {
                  const link = storeLink("gamma", c.paint);
                  return (
                    <li key={c.hex + c.role} className="flex items-center gap-3 py-2.5">
                      <span className="h-9 w-9 shrink-0 rounded-lg ring-1 ring-line" style={{ background: c.hex }} />
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-medium">
                          {c.name} <span className="font-normal text-ink-3">· {c.role}</span>
                        </p>
                        <p className="truncate text-xs text-ink-3">{c.paint}</p>
                      </div>
                      <div className="flex shrink-0 items-center gap-1">
                        <a href={link.href} target="_blank" rel="noreferrer" className="btn-ghost px-2 py-1.5 text-xs" aria-label={`Zoek ${c.paint}`}>
                          <Icon name="external" size={14} />
                        </a>
                        {plan && (
                          <button
                            className="btn-outline px-2.5 py-1.5 text-xs"
                            onClick={() => {
                              onWallColor(c.hex);
                              setApplied(c.hex);
                            }}
                          >
                            <Icon name={applied === c.hex ? "check" : "cube"} size={14} /> {applied === c.hex ? "In 3D" : "Muur in 3D"}
                          </button>
                        )}
                      </div>
                    </li>
                  );
                })}
              </ul>
              <p className="mt-2 text-xs text-ink-3">Verfkleuren zijn suggesties. Vraag in de winkel om een proefpotje.</p>
            </div>
          </article>
        ))}
      </section>

      <aside className="card h-fit space-y-4 p-4 sm:p-5 lg:sticky lg:top-32">
        <h2 className="flex items-center gap-2 font-display text-xl">
          <Icon name="ruler" size={20} className="text-accent" /> Hoeveel verf?
        </h2>
        {!plan || plan.rooms.length === 0 ? (
          <p className="text-sm text-ink-2">Teken eerst je ruimte bij Plattegrond, dan reken ik het uit.</p>
        ) : (
          <>
            <label className="block">
              <span className="label">Ruimte</span>
              <select className="input" value={roomId} onChange={(e) => setRoomId(e.target.value)}>
                {plan.rooms.map((r) => (
                  <option key={r.id} value={r.id}>
                    {r.name} ({isPolygon(r) ? `${(roomArea(r) / 10000).toLocaleString("nl-NL", { maximumFractionDigits: 1 })} m²` : `${r.w / 100} × ${r.h / 100} m`})
                  </option>
                ))}
              </select>
            </label>
            <div className="grid grid-cols-2 gap-2">
              <label className="block">
                <span className="label">Wandhoogte cm</span>
                <input type="number" className="input py-2" value={height} onChange={(e) => setHeight(Number(e.target.value) || 0)} />
              </label>
              <label className="block">
                <span className="label">Lagen</span>
                <input type="number" min={1} max={4} className="input py-2" value={layers} onChange={(e) => setLayers(Number(e.target.value) || 1)} />
              </label>
              <label className="block">
                <span className="label">m² per liter</span>
                <input type="number" className="input py-2" value={coverage} onChange={(e) => setCoverage(Number(e.target.value) || 1)} />
              </label>
              <label className="block">
                <span className="label">€ per liter</span>
                <input type="number" className="input py-2" value={pricePerL} onChange={(e) => setPricePerL(Number(e.target.value) || 0)} />
              </label>
            </div>
            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" checked={ceiling} onChange={(e) => setCeiling(e.target.checked)} className="h-4 w-4 accent-[var(--accent)]" />
              Plafond ook verven
            </label>
            {calc && (
              <div className="rounded-2xl bg-accent-soft p-4">
                <p className="text-sm text-ink-2">
                  {calc.walls.toFixed(1)} m² muur{ceiling ? ` + ${calc.top.toFixed(1)} m² plafond` : ""}, ramen en deuren eraf
                </p>
                <p className="mt-1 font-display text-3xl">{calc.liters.toFixed(1)} liter</p>
                <p className="text-sm text-ink-2">
                  Dat is {calc.cans25} {calc.cans25 === 1 ? "blik" : "blikken"} van 2,5 l · ca. {euro(calc.cost)}
                </p>
              </div>
            )}
            <p className="text-xs text-ink-3">Reken op 10 m² per liter voor muurverf; donkere kleuren of een nieuwe muur vragen soms een extra laag.</p>
          </>
        )}
      </aside>
    </div>
  );
}
