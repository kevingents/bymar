"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase/client";
import type { ShoppingItem } from "@/lib/schemas";
import type { Build, BudgetItem, Project } from "@/lib/types";
import { euro } from "@/lib/stores";
import { Icon } from "@/components/ui/Icon";

const PRESETS = ["Verf", "Schilder of klusser", "Bezorging", "Montage", "Gereedschap", "Verlichting aanleggen"];

function Check({ on, onClick, label }: { on: boolean; onClick: () => void; label: string }) {
  return (
    <button
      onClick={onClick}
      aria-pressed={on}
      aria-label={label}
      className={`grid h-6 w-6 shrink-0 place-items-center rounded-md border transition ${on ? "border-olive bg-olive text-white" : "border-line text-transparent"}`}
    >
      <Icon name="check" size={16} strokeWidth={2.2} />
    </button>
  );
}

/** Alles wat het project kost op één plek: inkooplijst, zelf maken en eigen posten. */
export function BudgetTab({
  project,
  onShopping,
  onItems,
  onBudget,
  onGoTo,
}: {
  project: Project;
  onShopping: (items: ShoppingItem[]) => void;
  onItems: (items: BudgetItem[]) => void;
  onBudget: (budget: number | null) => void;
  onGoTo: (tab: string) => void;
}) {
  const shopping = project.shopping ?? [];
  const extras = project.budget_items ?? [];
  const [builds, setBuilds] = useState<Build[] | null>(null);
  const [draft, setDraft] = useState({ name: "", amount: "" });
  const [budgetText, setBudgetText] = useState(project.budget != null ? String(project.budget) : "");

  useEffect(() => {
    supabase()
      .from("builds")
      .select("*")
      .eq("project_id", project.id)
      .order("created_at", { ascending: false })
      .then(({ data }) => setBuilds((data ?? []) as Build[]));
  }, [project.id]);

  const buildCost = (b: Build) => {
    const mats = b.data.materials ?? [];
    const sum = mats.reduce((s, m) => s + (m.estPrice || 0), 0);
    return sum > 0 ? sum : b.data.estimatedCost || 0;
  };
  const buildPaid = (b: Build) => {
    const got = b.progress?.materials ?? {};
    return (b.data.materials ?? []).reduce((s, m, i) => s + (got[i] ? m.estPrice || 0 : 0), 0);
  };
  const buildDone = (b: Build) => (b.data.materials ?? []).length > 0 && (b.data.materials ?? []).every((_, i) => b.progress?.materials?.[i]);

  function toggleBuild(b: Build) {
    const all = !buildDone(b);
    const materials = Object.fromEntries((b.data.materials ?? []).map((_, i) => [i, all]));
    const progress = { ...(b.progress ?? {}), materials };
    setBuilds((l) => l?.map((x) => (x.id === b.id ? { ...x, progress } : x)) ?? null);
    supabase().from("builds").update({ progress }).eq("id", b.id).then();
  }

  const groups = [
    {
      key: "inkoop",
      label: "Inkooplijst",
      color: "var(--accent)",
      planned: shopping.reduce((s, i) => s + i.estPrice * i.quantity, 0),
      paid: shopping.filter((i) => i.bought).reduce((s, i) => s + i.estPrice * i.quantity, 0),
    },
    {
      key: "maken",
      label: "Zelf maken",
      color: "var(--olive)",
      planned: (builds ?? []).reduce((s, b) => s + buildCost(b), 0),
      paid: (builds ?? []).reduce((s, b) => s + buildPaid(b), 0),
    },
    {
      key: "eigen",
      label: "Eigen posten",
      color: "var(--ink-3)",
      planned: extras.reduce((s, i) => s + i.amount, 0),
      paid: extras.filter((i) => i.paid).reduce((s, i) => s + i.amount, 0),
    },
  ];
  const planned = groups.reduce((s, g) => s + g.planned, 0);
  const paid = groups.reduce((s, g) => s + g.paid, 0);
  const budget = project.budget;
  const scale = Math.max(planned, budget ?? 0, 1);

  const byCategory = new Map<string, number>();
  for (const i of shopping) byCategory.set(i.category, (byCategory.get(i.category) ?? 0) + i.estPrice * i.quantity);

  function addExtra(name: string, amount: number) {
    if (!name.trim()) return;
    onItems([...extras, { id: crypto.randomUUID(), name: name.trim(), amount: Math.max(0, amount), paid: false }]);
    setDraft({ name: "", amount: "" });
  }

  return (
    <div className="mx-auto max-w-3xl space-y-4">
      <section className="card p-4 sm:p-5">
        <div className="grid gap-4 sm:grid-cols-[1fr_auto]">
          <div className="grid grid-cols-3 gap-3">
            <div>
              <p className="label">Gepland</p>
              <p className="font-display text-2xl sm:text-3xl">{euro(planned)}</p>
            </div>
            <div>
              <p className="label">Al betaald</p>
              <p className="font-display text-2xl text-olive sm:text-3xl">{euro(paid)}</p>
            </div>
            <div>
              <p className="label">Nog te gaan</p>
              <p className="font-display text-2xl sm:text-3xl">{euro(planned - paid)}</p>
            </div>
          </div>
          <label className="block sm:w-40">
            <span className="label">Budget</span>
            <input
              className="input py-2"
              inputMode="decimal"
              placeholder="bv. 2500"
              value={budgetText}
              onChange={(e) => setBudgetText(e.target.value.replace(/[^\d]/g, ""))}
              onBlur={() => onBudget(budgetText ? Number(budgetText) : null)}
            />
          </label>
        </div>

        {/* balk: betaald (vol), gepland (licht), streep = budget */}
        <div className="relative mt-5 h-4 overflow-hidden rounded-full bg-surface-2">
          <div className="absolute inset-y-0 left-0 rounded-full bg-accent-soft" style={{ width: `${(planned / scale) * 100}%` }} />
          <div className="absolute inset-y-0 left-0 rounded-full bg-olive" style={{ width: `${(paid / scale) * 100}%` }} />
          {budget != null && <div className="absolute inset-y-0 w-0.5 bg-ink" style={{ left: `calc(${(budget / scale) * 100}% - 1px)` }} />}
        </div>
        <p className="mt-2 text-sm text-ink-2">
          {budget == null
            ? "Vul een budget in om te zien hoeveel ruimte je nog hebt."
            : planned > budget
              ? `Je zit ${euro(planned - budget)} boven je budget van ${euro(budget)}.`
              : `Nog ${euro(budget - planned)} over binnen je budget van ${euro(budget)}.`}
        </p>

        <ul className="mt-4 space-y-2.5">
          {groups.map((g) => (
            <li key={g.key}>
              <div className="flex items-baseline justify-between text-sm">
                <span className="flex items-center gap-2">
                  <span className="h-2.5 w-2.5 rounded-full" style={{ background: g.color }} />
                  {g.label}
                </span>
                <span className="tabular-nums text-ink-2">
                  {euro(g.paid)} van {euro(g.planned)}
                </span>
              </div>
              <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-surface-2">
                <div className="h-full rounded-full" style={{ width: `${(g.planned / scale) * 100}%`, background: g.color, opacity: 0.35 }}>
                  <div className="h-full rounded-full" style={{ width: `${g.planned ? (g.paid / g.planned) * 100 : 0}%`, background: g.color }} />
                </div>
              </div>
            </li>
          ))}
        </ul>
      </section>

      <section className="card p-4">
        <div className="flex items-center justify-between">
          <h3 className="font-medium">Inkooplijst</h3>
          <button className="btn-ghost px-2.5 py-1.5 text-sm" onClick={() => onGoTo("inkoop")}>
            Naar de lijst <Icon name="arrow-right" size={14} />
          </button>
        </div>
        {shopping.length === 0 ? (
          <p className="mt-1 text-sm text-ink-3">Nog leeg. Laat een lijst voorstellen of voeg producten toe vanuit Shop the look.</p>
        ) : (
          <>
            <div className="mt-2 flex flex-wrap gap-1.5">
              {[...byCategory.entries()]
                .sort((a, b) => b[1] - a[1])
                .map(([c, v]) => (
                  <span key={c} className="rounded-full bg-surface-2 px-2.5 py-1 text-xs text-ink-2">
                    {c} · {euro(v)}
                  </span>
                ))}
            </div>
            <ul className="mt-2 divide-y divide-line">
              {shopping.map((i) => (
                <li key={i.id} className="flex items-center gap-3 py-2">
                  <Check on={i.bought} label={`${i.name} gekocht`} onClick={() => onShopping(shopping.map((x) => (x.id === i.id ? { ...x, bought: !x.bought } : x)))} />
                  <span className={`min-w-0 flex-1 truncate text-sm ${i.bought ? "text-ink-3 line-through" : ""}`}>
                    {i.quantity > 1 && `${i.quantity}x `}
                    {i.name}
                  </span>
                  <span className="text-sm tabular-nums">{euro(i.estPrice * i.quantity)}</span>
                </li>
              ))}
            </ul>
          </>
        )}
      </section>

      <section className="card p-4">
        <div className="flex items-center justify-between">
          <h3 className="font-medium">Zelf maken</h3>
          <button className="btn-ghost px-2.5 py-1.5 text-sm" onClick={() => onGoTo("maken")}>
            Naar bouwplannen <Icon name="arrow-right" size={14} />
          </button>
        </div>
        {builds === null ? (
          <p className="mt-2 flex items-center gap-2 text-sm text-ink-3">
            <Icon name="loader" size={14} /> Laden…
          </p>
        ) : builds.length === 0 ? (
          <p className="mt-1 text-sm text-ink-3">Nog geen bouwplannen.</p>
        ) : (
          <ul className="mt-2 divide-y divide-line">
            {builds.map((b) => (
              <li key={b.id} className="flex items-center gap-3 py-2">
                <Check on={buildDone(b)} label={`Materiaal voor ${b.title} gekocht`} onClick={() => toggleBuild(b)} />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm">{b.title}</p>
                  <p className="text-xs text-ink-3">
                    materiaal {euro(buildPaid(b))} van {euro(buildCost(b))} gekocht
                  </p>
                </div>
                <span className="text-sm tabular-nums">{euro(buildCost(b))}</span>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="card p-4">
        <h3 className="font-medium">Eigen posten</h3>
        <p className="text-sm text-ink-3">Alles wat niet op de inkooplijst staat: een schilder, bezorgkosten, gereedschap.</p>
        {extras.length > 0 && (
          <ul className="mt-2 divide-y divide-line">
            {extras.map((x) => (
              <li key={x.id} className="flex items-center gap-3 py-2">
                <Check on={x.paid} label={`${x.name} betaald`} onClick={() => onItems(extras.map((y) => (y.id === x.id ? { ...y, paid: !y.paid } : y)))} />
                <span className={`min-w-0 flex-1 truncate text-sm ${x.paid ? "text-ink-3 line-through" : ""}`}>{x.name}</span>
                <input
                  className="input w-24 py-1 text-right text-sm tabular-nums"
                  inputMode="decimal"
                  aria-label={`Bedrag ${x.name}`}
                  value={x.amount}
                  onChange={(e) => onItems(extras.map((y) => (y.id === x.id ? { ...y, amount: Number(e.target.value.replace(/[^\d.]/g, "")) || 0 } : y)))}
                />
                <button className="text-ink-3 hover:text-danger" onClick={() => onItems(extras.filter((y) => y.id !== x.id))} aria-label={`${x.name} verwijderen`}>
                  <Icon name="trash" size={16} />
                </button>
              </li>
            ))}
          </ul>
        )}
        <form
          className="mt-3 grid gap-2 sm:grid-cols-[1fr_120px_auto]"
          onSubmit={(e) => {
            e.preventDefault();
            addExtra(draft.name, Number(draft.amount) || 0);
          }}
        >
          <input className="input" placeholder="Post, bv. schilder" value={draft.name} onChange={(e) => setDraft({ ...draft, name: e.target.value })} />
          <input
            className="input"
            inputMode="decimal"
            placeholder="Bedrag"
            value={draft.amount}
            onChange={(e) => setDraft({ ...draft, amount: e.target.value.replace(/[^\d.]/g, "") })}
          />
          <button className="btn-outline" disabled={!draft.name.trim()}>
            <Icon name="plus" size={18} /> Toevoegen
          </button>
        </form>
        <div className="mt-2 flex flex-wrap gap-1.5">
          {PRESETS.filter((p) => !extras.some((x) => x.name === p)).map((p) => (
            <button key={p} className="chip px-2.5 py-1 text-xs" onClick={() => setDraft({ ...draft, name: p })}>
              {p}
            </button>
          ))}
        </div>
      </section>
      <p className="px-1 text-xs text-ink-3">Bedragen zijn schattingen. Vink af wat je gekocht of betaald hebt; je partner ziet het meteen mee.</p>
    </div>
  );
}
