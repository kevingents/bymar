"use client";

import { useMemo, useState } from "react";
import { FURNITURE, roomOf } from "@/lib/floorplan";
import { findSpot, guessFurniture } from "@/lib/indeling";
import { FURNITURE_TYPES, type Floorplan, type FurnitureType } from "@/lib/schemas";
import { Icon } from "@/components/ui/Icon";
import { FloorplanEditor } from "./FloorplanEditor";

export type FitProduct = { name: string; category?: string; size?: { w: number; d: number; h: number } | null };

const ROUNDABLE = new Set<FurnitureType>(["eettafel", "salontafel", "vloerkleed", "nachtkastje", "fauteuil", "overig"]);

/**
 * "Past het?": zoekt een plek voor een product in een ruimte van de plattegrond,
 * laat zien waar het komt en zet het er met één tik in.
 */
export function FitDialog({
  product,
  plan,
  onPlace,
  onOpenPlan,
  onClose,
}: {
  product: FitProduct;
  plan: Floorplan | null;
  onPlace: (next: Floorplan) => void;
  onOpenPlan: () => void;
  onClose: () => void;
}) {
  const initialType = guessFurniture(product.name, product.category) ?? "overig";
  const def = FURNITURE[initialType];
  const [type, setType] = useState<FurnitureType>(initialType);
  const [w, setW] = useState(Math.round(product.size?.w ?? def.w));
  const [d, setD] = useState(Math.round(product.size?.d ?? def.d));
  const [h, setH] = useState(Math.round(product.size?.h ?? def.h));
  const [round, setRound] = useState(/rond|ovaal/i.test(product.name));
  const rooms = plan?.rooms ?? [];
  // standaard de ruimte met de meeste meubels, anders de eerste
  const [roomId, setRoomId] = useState(() => {
    if (!plan || plan.rooms.length === 0) return "";
    const count = new Map<string, number>();
    for (const it of plan.items) {
      const r = roomOf(plan, it);
      if (r) count.set(r.id, (count.get(r.id) ?? 0) + 1);
    }
    return [...plan.rooms].sort((a, b) => (count.get(b.id) ?? 0) - (count.get(a.id) ?? 0))[0].id;
  });

  const result = useMemo(() => {
    if (!plan || !roomId || w < 5 || d < 5) return null;
    return findSpot(plan, roomId, { type, name: product.name, w, d, h, shape: round && ROUNDABLE.has(type) ? "round" : undefined });
  }, [plan, roomId, type, w, d, h, round, product.name]);

  const preview = useMemo(() => (plan && result?.ok ? { ...plan, items: [...plan.items, result.item] } : plan), [plan, result]);

  function pickType(t: FurnitureType) {
    setType(t);
    if (!product.size) {
      setW(FURNITURE[t].w);
      setD(FURNITURE[t].d);
      setH(FURNITURE[t].h);
    }
  }

  const num = (label: string, v: number, set: (n: number) => void) => (
    <label className="block">
      <span className="label">{label}</span>
      <input type="number" inputMode="numeric" className="input py-2" value={v} min={5} onChange={(e) => set(Math.max(0, Number(e.target.value) || 0))} />
    </label>
  );

  return (
    <div className="fixed inset-0 z-[70] grid place-items-end bg-black/40 sm:place-items-center" onClick={onClose}>
      <div
        className="max-h-[94dvh] w-full overflow-y-auto rounded-t-3xl bg-surface p-5 pb-[max(1.25rem,env(safe-area-inset-bottom))] text-ink sm:max-w-3xl sm:rounded-3xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-3">
          <div>
            <h2 className="font-display text-2xl">Past het?</h2>
            <p className="text-sm text-ink-2">{product.name}</p>
          </div>
          <button className="btn-ghost px-2.5" onClick={onClose} aria-label="Sluiten">
            <Icon name="x" size={20} />
          </button>
        </div>

        {rooms.length === 0 ? (
          <div className="mt-4 rounded-2xl bg-surface-2 p-4">
            <p className="text-sm">Er is nog geen plattegrond. Teken je kamer (of lees hem in uit een foto), dan rekent Huisraad uit of het past.</p>
            <button className="btn-primary mt-3" onClick={onOpenPlan}>
              <Icon name="plan" size={18} /> Naar de plattegrond
            </button>
          </div>
        ) : (
          <>
            <div className="mt-4 grid gap-3 sm:grid-cols-[1fr_1fr]">
              <label className="block">
                <span className="label">Ruimte</span>
                <select className="input py-2" value={roomId} onChange={(e) => setRoomId(e.target.value)}>
                  {rooms.map((r) => (
                    <option key={r.id} value={r.id}>
                      {r.name}
                    </option>
                  ))}
                </select>
              </label>
              <label className="block">
                <span className="label">Soort</span>
                <select className="input py-2" value={type} onChange={(e) => pickType(e.target.value as FurnitureType)}>
                  {FURNITURE_TYPES.map((t) => (
                    <option key={t} value={t}>
                      {FURNITURE[t].label}
                    </option>
                  ))}
                </select>
              </label>
            </div>
            <div className="mt-3 grid grid-cols-3 gap-2">
              {num("Breed (cm)", w, setW)}
              {num("Diep (cm)", d, setD)}
              {num("Hoog (cm)", h, setH)}
            </div>
            <p className="mt-1 text-xs text-ink-3">
              {product.size ? "Maten van een vergelijkbaar product; check de echte maten op de productpagina." : "Standaardmaten; vul de maten van de productpagina in."}
            </p>
            {ROUNDABLE.has(type) && (
              <button className="chip mt-2 px-3 py-1.5 text-sm" data-on={round} onClick={() => setRound((r) => !r)}>
                Rond of ovaal
              </button>
            )}

            {result && (
              <p className={`mt-4 flex gap-2 rounded-xl p-3 text-sm ${result.ok ? (result.roomy ? "bg-olive-soft" : "bg-accent-soft") : "bg-accent-soft"}`}>
                <Icon
                  name={result.ok ? (result.roomy ? "check" : "info") : "warning"}
                  size={16}
                  className={`mt-0.5 shrink-0 ${result.ok && result.roomy ? "text-olive" : "text-danger"}`}
                />
                {result.note}
              </p>
            )}
            {preview && (
              <div className="mt-3">
                <FloorplanEditor plan={preview} selection={null} onSelect={() => {}} readOnly highlight={result?.ok ? result.item.id : undefined} />
              </div>
            )}

            <div className="mt-4 flex flex-wrap gap-2">
              <button className="btn-primary" disabled={!result?.ok} onClick={() => result?.ok && plan && onPlace({ ...plan, items: [...plan.items, result.item] })}>
                <Icon name="plan" size={18} /> Zet in de plattegrond
              </button>
              <button className="btn-ghost" onClick={onClose}>
                Annuleren
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
