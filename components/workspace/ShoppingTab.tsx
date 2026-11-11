"use client";

import { useState } from "react";
import { postJson } from "@/lib/client-api";
import { STORE_KEYS, type ShoppingItem, type StoreKey } from "@/lib/schemas";
import type { Project } from "@/lib/types";
import { STORES, euro, storeLink } from "@/lib/stores";
import { Icon } from "@/components/ui/Icon";
import { FitDialog } from "@/components/floorplan/FitDialog";
import { guessFurniture } from "@/lib/indeling";
import type { Floorplan } from "@/lib/schemas";

export function ShoppingTab({
  project,
  onChange,
  onReplace,
  onFloorplan,
  onGoTo,
}: {
  project: Project;
  onChange: (items: ShoppingItem[]) => void;
  onReplace: (items: ShoppingItem[]) => void;
  onFloorplan: (p: Floorplan) => void;
  onGoTo: (tab: string) => void;
}) {
  const [fit, setFit] = useState<ShoppingItem | null>(null);
  const items = project.shopping ?? [];
  const [wish, setWish] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [adding, setAdding] = useState(false);
  const [draft, setDraft] = useState({ name: "", estPrice: "", store: "ikea" as StoreKey });
  const [groupBy, setGroupBy] = useState<"category" | "store">("category");

  async function suggest() {
    setBusy(true);
    setError(null);
    try {
      const { shopping } = await postJson<{ shopping: ShoppingItem[] }>(`/api/projects/${project.id}/shopping`, { wish });
      onReplace(shopping);
      setWish("");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Er ging iets mis.");
    } finally {
      setBusy(false);
    }
  }

  function addManual(e: React.FormEvent) {
    e.preventDefault();
    if (!draft.name.trim()) return;
    onChange([
      ...items,
      {
        id: crypto.randomUUID(),
        name: draft.name.trim(),
        category: "Eigen toevoeging",
        quantity: 1,
        estPrice: Number(draft.estPrice) || 0,
        store: draft.store,
        searchQuery: draft.name.trim(),
        note: "",
        size: null,
        bought: false,
      },
    ]);
    setDraft({ name: "", estPrice: "", store: draft.store });
    setAdding(false);
  }

  const total = items.reduce((s, i) => s + i.estPrice * i.quantity, 0);
  const open = items.filter((i) => !i.bought).reduce((s, i) => s + i.estPrice * i.quantity, 0);
  const budget = project.budget;

  const groups = new Map<string, ShoppingItem[]>();
  for (const i of items) {
    const key = groupBy === "category" ? i.category : STORES[i.store]?.label ?? "Overig";
    groups.set(key, [...(groups.get(key) ?? []), i]);
  }

  return (
    <div className="mx-auto max-w-3xl space-y-4">
      <section className="card p-4 sm:p-5">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <p className="label">Totaal</p>
            <p className="font-display text-3xl">{euro(total)}</p>
            <p className="text-sm text-ink-3">nog te kopen: {euro(open)}</p>
          </div>
          {budget != null && (
            <div className="min-w-48 flex-1 sm:max-w-xs">
              <div className="flex justify-between text-xs text-ink-3">
                <span>Budget {euro(budget)}</span>
                <span className={total > budget ? "text-danger" : ""}>
                  {total > budget ? `${euro(total - budget)} erover` : `${euro(budget - total)} over`}
                </span>
              </div>
              <div className="mt-1 h-2 overflow-hidden rounded-full bg-surface-2">
                <div
                  className={`h-full rounded-full ${total > budget ? "bg-danger" : "bg-olive"}`}
                  style={{ width: `${Math.min(100, (total / Math.max(budget, 1)) * 100)}%` }}
                />
              </div>
            </div>
          )}
        </div>

        <div className="mt-5 flex flex-col gap-2 sm:flex-row">
          <input
            className="input flex-1"
            placeholder="Waar moet het op letten? Bijvoorbeeld: kindvriendelijk, veel opbergruimte"
            value={wish}
            onChange={(e) => setWish(e.target.value)}
          />
          <button className="btn-primary shrink-0" onClick={suggest} disabled={busy}>
            <Icon name={busy ? "loader" : "sparkles"} size={18} />
            {busy ? "Zoeken…" : items.length ? "Meer voorstellen" : "Stel een lijst voor"}
          </button>
        </div>
        {error && <p className="mt-2 text-sm text-danger">{error}</p>}
      </section>

      {items.length > 0 && (
        <div className="flex items-center justify-between">
          <div className="flex gap-1 rounded-full bg-surface-2 p-1 text-sm">
            {(["category", "store"] as const).map((g) => (
              <button
                key={g}
                onClick={() => setGroupBy(g)}
                className={`rounded-full px-3 py-1.5 ${groupBy === g ? "bg-surface shadow-sm" : "text-ink-2"}`}
              >
                {g === "category" ? "Per soort" : "Per winkel"}
              </button>
            ))}
          </div>
          <button className="btn-ghost" onClick={() => setAdding((a) => !a)}>
            <Icon name="plus" size={18} /> Zelf toevoegen
          </button>
        </div>
      )}

      {(adding || items.length === 0) && (
        <form onSubmit={addManual} className="card grid gap-2 p-4 sm:grid-cols-[1fr_110px_150px_auto]">
          <input className="input" placeholder="Product" value={draft.name} onChange={(e) => setDraft({ ...draft, name: e.target.value })} />
          <input
            className="input"
            inputMode="decimal"
            placeholder="Prijs"
            value={draft.estPrice}
            onChange={(e) => setDraft({ ...draft, estPrice: e.target.value.replace(/[^\d.]/g, "") })}
          />
          <select className="input" value={draft.store} onChange={(e) => setDraft({ ...draft, store: e.target.value as StoreKey })}>
            {STORE_KEYS.map((k) => (
              <option key={k} value={k}>
                {STORES[k].label}
              </option>
            ))}
          </select>
          <button className="btn-outline" disabled={!draft.name.trim()}>
            <Icon name="plus" size={18} /> Toevoegen
          </button>
        </form>
      )}

      {[...groups.entries()].map(([group, list]) => (
        <section key={group} className="card p-2 sm:p-3">
          <h3 className="px-2 pb-1 pt-2 text-xs font-medium uppercase tracking-wider text-ink-3">{group}</h3>
          <ul className="divide-y divide-line">
            {list.map((i) => {
              const link = storeLink(i.store, i.searchQuery);
              return (
                <li key={i.id} className="flex items-start gap-3 px-2 py-3">
                  <button
                    onClick={() => onChange(items.map((x) => (x.id === i.id ? { ...x, bought: !x.bought } : x)))}
                    aria-pressed={i.bought}
                    aria-label={`${i.name} gekocht`}
                    className={`mt-0.5 grid h-6 w-6 shrink-0 place-items-center rounded-md border transition ${
                      i.bought ? "border-olive bg-olive text-white" : "border-line text-transparent"
                    }`}
                  >
                    <Icon name="check" size={16} strokeWidth={2.2} />
                  </button>
                  <div className="min-w-0 flex-1">
                    <p className={`font-medium ${i.bought ? "text-ink-3 line-through" : ""}`}>
                      {i.quantity > 1 && `${i.quantity}x `}
                      {i.name}
                    </p>
                    {i.note && <p className="mt-0.5 text-sm text-ink-3">{i.note}</p>}
                    <a href={link.href} target="_blank" rel="noreferrer" className="mt-1 inline-flex items-center gap-1 text-sm text-accent hover:underline">
                      Zoek bij {link.label} <Icon name="external" size={13} />
                    </a>
                    {(i.size || guessFurniture(i.name, i.category)) && (
                      <button className="ml-3 mt-1 inline-flex items-center gap-1 text-sm text-ink-2 hover:text-ink hover:underline" onClick={() => setFit(i)}>
                        <Icon name="ruler" size={13} /> Past het?
                      </button>
                    )}
                  </div>
                  <div className="flex shrink-0 flex-col items-end gap-1">
                    <span className="text-sm tabular-nums">{euro(i.estPrice * i.quantity)}</span>
                    <button
                      className="text-ink-3 hover:text-danger"
                      onClick={() => onChange(items.filter((x) => x.id !== i.id))}
                      aria-label={`${i.name} verwijderen`}
                    >
                      <Icon name="trash" size={16} />
                    </button>
                  </div>
                </li>
              );
            })}
          </ul>
        </section>
      ))}
      <p className="px-1 text-xs text-ink-3">Prijzen zijn schattingen; controleer de actuele prijs in de winkel.</p>
      {fit && (
        <FitDialog
          product={fit}
          plan={project.floorplan}
          onClose={() => setFit(null)}
          onOpenPlan={() => {
            setFit(null);
            onGoTo("plattegrond");
          }}
          onPlace={(p) => {
            onFloorplan(p);
            setFit(null);
            onGoTo("plattegrond");
          }}
        />
      )}
    </div>
  );
}
