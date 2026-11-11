"use client";

import { useEffect, useState } from "react";
import { postJson } from "@/lib/client-api";
import type { ShopLook, ShoppingItem } from "@/lib/schemas";
import { euro, storeLink } from "@/lib/stores";
import { Icon } from "@/components/ui/Icon";
import { guessFurniture } from "@/lib/indeling";

type Item = ShopLook["items"][number];

/** Beeld met aanklikbare puntjes + lijst met vergelijkbare producten per winkel. */
export function ShopTheLook({
  projectId,
  imageId,
  url,
  cached,
  onAdd,
  onCached,
  onFit,
}: {
  onFit?: (p: { name: string; category: string; size: Item["size"] }) => void;
  projectId: string;
  imageId: string;
  url: string;
  cached?: ShopLook | null;
  onAdd: (item: ShoppingItem) => void;
  onCached: (shop: ShopLook) => void;
}) {
  const [shop, setShop] = useState<ShopLook | null>(cached ?? null);
  const [busy, setBusy] = useState(!cached);
  const [error, setError] = useState<string | null>(null);
  const [active, setActive] = useState<number | null>(null);
  const [added, setAdded] = useState<Record<number, boolean>>({});

  useEffect(() => {
    if (cached) return;
    let alive = true;
    postJson<{ shop: ShopLook }>(`/api/projects/${projectId}/shop`, { imageId })
      .then(({ shop }) => {
        if (!alive) return;
        setShop(shop);
        onCached(shop);
      })
      .catch((e) => alive && setError(e instanceof Error ? e.message : "Er ging iets mis."))
      .finally(() => alive && setBusy(false));
    return () => {
      alive = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [imageId]);

  function add(i: number, it: Item) {
    onAdd({
      id: crypto.randomUUID(),
      name: it.name,
      category: it.category,
      quantity: 1,
      estPrice: it.estPrice,
      store: it.store,
      searchQuery: it.searchQuery,
      note: it.description,
      size: it.size ?? null,
      bought: false,
    });
    setAdded((a) => ({ ...a, [i]: true }));
  }

  return (
    <div className="flex h-full min-h-0 w-full flex-col gap-3 lg:flex-row">
      <div className="flex min-h-0 flex-1 items-center justify-center">
        <div className="relative inline-block max-h-full">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={url} alt="" className="block max-h-[52dvh] max-w-full rounded-lg object-contain lg:max-h-[78dvh]" />
          {shop?.items.map((it, i) => (
            <button
              key={i}
              onClick={() => setActive(i)}
              className="group absolute -translate-x-1/2 -translate-y-1/2"
              style={{ left: `${it.x}%`, top: `${it.y}%` }}
              aria-label={it.name}
            >
              <span className={`absolute inset-0 animate-ping rounded-full bg-white/60 ${active === i ? "" : "hidden"}`} />
              <span
                className={`relative grid h-7 w-7 place-items-center rounded-full border-2 border-white text-xs font-bold shadow-lg transition ${
                  active === i ? "scale-110 bg-accent text-white" : "bg-white/90 text-ink"
                }`}
              >
                {i + 1}
              </span>
            </button>
          ))}
          {busy && (
            <div className="absolute inset-0 grid place-items-center rounded-lg bg-black/35 text-white">
              <span className="flex items-center gap-2 rounded-full bg-black/50 px-4 py-2 text-sm">
                <Icon name="loader" size={16} /> Producten zoeken…
              </span>
            </div>
          )}
        </div>
      </div>

      <aside className="max-h-[36dvh] w-full overflow-y-auto rounded-2xl bg-surface p-3 text-ink lg:max-h-[78dvh] lg:w-80">
        <h3 className="flex items-center gap-2 px-1 font-display text-lg">
          <Icon name="cart" size={18} className="text-accent" /> Shop the look
        </h3>
        {error && <p className="mt-2 px-1 text-sm text-danger">{error}</p>}
        {!busy && shop && shop.items.length === 0 && <p className="mt-2 px-1 text-sm text-ink-3">Geen producten herkend.</p>}
        <ul className="mt-2 space-y-1.5">
          {shop?.items.map((it, i) => {
            const link = storeLink(it.store, it.searchQuery);
            return (
              <li
                key={i}
                onMouseEnter={() => setActive(i)}
                className={`rounded-xl p-2.5 transition ${active === i ? "bg-accent-soft" : "hover:bg-surface-2"}`}
              >
                <div className="flex items-start gap-2.5">
                  <span className="mt-0.5 grid h-6 w-6 shrink-0 place-items-center rounded-full bg-ink text-xs font-bold text-bg">{i + 1}</span>
                  <div className="min-w-0 flex-1">
                    <p className="font-medium leading-tight">{it.name}</p>
                    <p className="mt-0.5 text-xs text-ink-3">{it.description}</p>
                    <div className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm">
                      <span className="tabular-nums">ca. {euro(it.estPrice)}</span>
                      <a href={link.href} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-accent hover:underline">
                        {link.label} <Icon name="external" size={12} />
                      </a>
                    </div>
                  </div>
                  <button
                    onClick={() => add(i, it)}
                    disabled={added[i]}
                    className="btn-outline shrink-0 px-2.5 py-1.5 text-xs"
                    aria-label={`${it.name} op de inkooplijst`}
                  >
                    <Icon name={added[i] ? "check" : "plus"} size={14} /> {added[i] ? "Op lijst" : "Lijst"}
                  </button>
                </div>
                {onFit && (it.size || guessFurniture(it.name, it.category)) && (
                  <button className="ml-8 mt-1 inline-flex items-center gap-1 text-xs text-ink-2 hover:text-ink hover:underline" onClick={() => onFit({ name: it.name, category: it.category, size: it.size })}>
                    <Icon name="ruler" size={12} /> Past het in mijn kamer?
                  </button>
                )}
              </li>
            );
          })}
        </ul>
      </aside>
    </div>
  );
}
