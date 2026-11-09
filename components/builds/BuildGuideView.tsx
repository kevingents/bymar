"use client";

import type { BuildGuide } from "@/lib/schemas";
import type { BuildProgress } from "@/lib/types";
import { euro, storeLink } from "@/lib/stores";
import { Icon, type IconName } from "@/components/ui/Icon";
import { CutPlan } from "./CutPlan";
import { DimensionDrawing } from "./DimensionDrawing";
import { DrillPlanView } from "./DrillPlanView";
import { buildIcs, downloadIcs } from "@/lib/ics";

const DIFF_COLOR: Record<BuildGuide["difficulty"], string> = {
  makkelijk: "bg-olive-soft text-olive",
  gemiddeld: "bg-accent-soft text-accent",
  lastig: "bg-danger/10 text-danger",
};

function Section({ icon, title, children, aside }: { icon: IconName; title: string; children: React.ReactNode; aside?: React.ReactNode }) {
  return (
    <section className="card break-inside-avoid p-4 sm:p-5 print:border-0 print:p-0">
      <div className="mb-3 flex items-center justify-between gap-2">
        <h3 className="flex items-center gap-2 font-display text-lg">
          <Icon name={icon} size={20} className="text-accent" /> {title}
        </h3>
        {aside}
      </div>
      {children}
    </section>
  );
}

function Check({ on, onToggle, label }: { on: boolean; onToggle?: () => void; label: string }) {
  return (
    <button
      type="button"
      onClick={onToggle}
      disabled={!onToggle}
      aria-pressed={on}
      aria-label={label}
      className={`mt-0.5 grid h-6 w-6 shrink-0 place-items-center rounded-md border transition ${
        on ? "border-olive bg-olive text-white" : "border-line bg-surface text-transparent"
      } ${onToggle ? "cursor-pointer" : "cursor-default"}`}
    >
      <Icon name="check" size={16} strokeWidth={2.2} />
    </button>
  );
}

const cm = (mm: number) => (mm / 10).toLocaleString("nl-NL", { maximumFractionDigits: 1 });

export function BuildGuideView({
  guide,
  progress,
  onProgress,
  imageUrl,
  imageAction,
  diagramUrl,
  diagramAction,
  drillAction,
}: {
  guide: BuildGuide;
  progress: BuildProgress;
  onProgress?: (p: BuildProgress) => void;
  imageUrl?: string | null;
  imageAction?: React.ReactNode;
  diagramUrl?: string | null;
  diagramAction?: React.ReactNode;
  drillAction?: React.ReactNode;
}) {
  const steps = progress.steps ?? {};
  const dates = progress.dates ?? {};
  const planned = guide.steps
    .map((s, i) => ({ s, i, date: dates[i] }))
    .filter((x) => x.date)
    .sort((a, b) => a.date!.localeCompare(b.date!));
  const setDate = onProgress && ((i: number, date: string) => onProgress({ ...progress, dates: { ...dates, [i]: date } }));
  function toAgenda() {
    const ics = buildIcs(
      guide.title,
      planned.map(({ s, i, date }) => ({
        date: date!,
        summary: `${guide.title}: stap ${i + 1}, ${s.title}`,
        description: `${s.description}

Duur: ${s.duration}${s.warning ? `
Let op: ${s.warning}` : ""}`,
      })),
    );
    downloadIcs(`${guide.title.replace(/[^a-z0-9]+/gi, "-").toLowerCase()}.ics`, ics);
  }
  const bought = progress.materials ?? {};
  const doneCount = guide.steps.filter((_, i) => steps[i]).length;
  const pct = guide.steps.length ? Math.round((doneCount / guide.steps.length) * 100) : 0;
  const materialTotal = guide.materials.reduce((s, m) => s + (m.estPrice || 0), 0);
  const stillToBuy = guide.materials.reduce((s, m, i) => s + (bought[i] ? 0 : m.estPrice || 0), 0);

  const toggleStep = onProgress && ((i: number) => onProgress({ ...progress, steps: { ...steps, [i]: !steps[i] } }));
  const toggleBought =
    onProgress && ((i: number) => onProgress({ ...progress, materials: { ...bought, [i]: !bought[i] } }));

  return (
    <div className="space-y-4">
      <header className="card overflow-hidden print:border-0">
        <div className="grid gap-0 sm:grid-cols-[1fr_280px]">
          <div className="p-5">
            <h2 className="font-display text-2xl tracking-tight sm:text-3xl">{guide.title}</h2>
            <p className="mt-2 text-ink-2">{guide.summary}</p>
            <div className="mt-4 flex flex-wrap gap-2 text-sm">
              <span className={`rounded-full px-3 py-1 ${DIFF_COLOR[guide.difficulty]}`}>Niveau: {guide.difficulty}</span>
              <span className="inline-flex items-center gap-1.5 rounded-full bg-surface-2 px-3 py-1 text-ink-2">
                <Icon name="clock" size={15} /> {guide.totalTime}
              </span>
              <span className="inline-flex items-center gap-1.5 rounded-full bg-surface-2 px-3 py-1 text-ink-2">
                <Icon name="euro" size={15} /> ca. {euro(guide.estimatedCost)}
              </span>
              <span className="inline-flex items-center gap-1.5 rounded-full bg-surface-2 px-3 py-1 text-ink-2">
                <Icon name="ruler" size={15} /> {guide.dimensions}
              </span>
            </div>
            {onProgress && (
              <div className="mt-5">
                <div className="flex justify-between text-xs text-ink-3">
                  <span>Voortgang</span>
                  <span>
                    {doneCount} van {guide.steps.length} stappen
                  </span>
                </div>
                <div className="mt-1 h-2 overflow-hidden rounded-full bg-surface-2">
                  <div className="h-full rounded-full bg-olive transition-all" style={{ width: `${pct}%` }} />
                </div>
              </div>
            )}
          </div>
          <div className="relative min-h-48 bg-surface-2 print:hidden">
            {imageUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={imageUrl} alt={guide.title} className="absolute inset-0 h-full w-full object-cover" />
            ) : (
              <div className="absolute inset-0 grid place-items-center p-4 text-center">{imageAction}</div>
            )}
          </div>
        </div>
      </header>

      <Section icon="layers" title="Ontwerp">
        <p className="text-[15px] leading-relaxed text-ink-2">{guide.design.description}</p>
        {guide.design.options.length > 0 && (
          <ul className="mt-3 space-y-1.5 text-sm">
            {guide.design.options.map((o, i) => (
              <li key={i} className="flex gap-2">
                <Icon name="chevron-right" size={16} className="mt-0.5 shrink-0 text-accent" />
                {o}
              </li>
            ))}
          </ul>
        )}
      </Section>

      {guide.materialChoice?.length ? (
        <Section icon="layers" title="Welk materiaal en waarom">
          <div className="grid gap-3 sm:grid-cols-2">
            {[...guide.materialChoice]
              .sort((a, b) => Number(b.recommended) - Number(a.recommended))
              .map((m, i) => (
                <article
                  key={i}
                  className={`rounded-2xl border p-4 ${m.recommended ? "border-accent bg-accent-soft/60 sm:col-span-2" : "border-line"}`}
                >
                  <div className="flex flex-wrap items-center gap-2">
                    <h4 className="font-medium">{m.option}</h4>
                    <span className="rounded-full bg-surface-2 px-2 py-0.5 text-xs text-ink-2">{m.priceLevel}</span>
                    {m.recommended && (
                      <span className="inline-flex items-center gap-1 rounded-full bg-accent px-2 py-0.5 text-xs text-accent-ink">
                        <Icon name="check" size={12} strokeWidth={2.4} /> Beste keuze
                      </span>
                    )}
                  </div>
                  <p className="mt-1.5 text-sm text-ink-2">{m.why}</p>
                  <div className="mt-2 grid gap-2 text-sm sm:grid-cols-2">
                    <ul className="space-y-1">
                      {m.pros.map((p, j) => (
                        <li key={j} className="flex gap-1.5">
                          <Icon name="plus" size={14} className="mt-0.5 shrink-0 text-olive" />
                          {p}
                        </li>
                      ))}
                    </ul>
                    <ul className="space-y-1">
                      {m.cons.map((p, j) => (
                        <li key={j} className="flex gap-1.5 text-ink-2">
                          <Icon name="minus" size={14} className="mt-0.5 shrink-0 text-danger" />
                          {p}
                        </li>
                      ))}
                    </ul>
                  </div>
                </article>
              ))}
          </div>
        </Section>
      ) : null}

      <Section
        icon="cart"
        title="Materialen"
        aside={
          <span className="text-sm text-ink-3">
            {onProgress && stillToBuy !== materialTotal ? `nog ${euro(stillToBuy)} van ` : ""}
            {euro(materialTotal)}
          </span>
        }
      >
        <ul className="divide-y divide-line">
          {guide.materials.map((m, i) => {
            const link = storeLink(m.store, m.searchQuery);
            return (
              <li key={i} className="flex gap-3 py-3">
                <Check on={!!bought[i]} onToggle={toggleBought ? () => toggleBought(i) : undefined} label={`${m.name} gekocht`} />
                <div className="min-w-0 flex-1">
                  <p className={`font-medium ${bought[i] ? "text-ink-3 line-through" : ""}`}>
                    {m.quantity} {m.unit} {m.name}
                  </p>
                  <p className="text-sm text-ink-3">{m.spec}</p>
                </div>
                <div className="shrink-0 text-right">
                  <p className="text-sm">{euro(m.estPrice)}</p>
                  <a href={link.href} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-xs text-accent hover:underline print:hidden">
                    {link.label} <Icon name="external" size={12} />
                  </a>
                </div>
              </li>
            );
          })}
        </ul>
      </Section>

      <Section icon="ruler" title="Maattekening">
        <DimensionDrawing guide={guide} />
      </Section>

      {guide.cuttingList.length > 0 && (
        <Section icon="saw" title="Zaaglijst" aside={<span className="text-xs text-ink-3">maten in cm</span>}>
          <p className="mb-3 text-sm text-ink-2">
            Tip: neem deze lijst mee naar de bouwmarkt; de meeste zaagservices zagen plaatmateriaal op maat.
          </p>
          <div className="-mx-1 overflow-x-auto">
            <table className="w-full min-w-[480px] text-sm">
              <thead>
                <tr className="text-left text-xs uppercase tracking-wider text-ink-3">
                  <th className="px-1 py-2 font-medium">Onderdeel</th>
                  <th className="px-1 py-2 font-medium">Materiaal</th>
                  <th className="px-1 py-2 text-right font-medium">L</th>
                  <th className="px-1 py-2 text-right font-medium">B</th>
                  <th className="px-1 py-2 text-right font-medium">D</th>
                  <th className="px-1 py-2 text-right font-medium">Aantal</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {guide.cuttingList.map((c, i) => (
                  <tr key={i}>
                    <td className="px-1 py-2 font-medium">{c.part}</td>
                    <td className="px-1 py-2 text-ink-2">{c.material}</td>
                    <td className="px-1 py-2 text-right tabular-nums">{cm(c.length)}</td>
                    <td className="px-1 py-2 text-right tabular-nums">{cm(c.width)}</td>
                    <td className="px-1 py-2 text-right tabular-nums">{cm(c.thickness)}</td>
                    <td className="px-1 py-2 text-right tabular-nums">{c.quantity}x</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Section>
      )}

      {guide.cuttingList.length > 0 && (
        <Section icon="grid" title="Zaagplan">
          <CutPlan guide={guide} />
        </Section>
      )}

      {guide.construction ? (
        <Section icon="cube" title="Zo bouw je het frame">
          <div className={diagramUrl || diagramAction ? "grid gap-4 md:grid-cols-[1fr_300px]" : ""}>
            <p className="whitespace-pre-line text-[15px] leading-relaxed text-ink-2">{guide.construction.frame}</p>
            {(diagramUrl || diagramAction) && (
              <div className="overflow-hidden rounded-2xl bg-white ring-1 ring-line print:break-inside-avoid">
                {diagramUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={diagramUrl} alt={`Bouwtekening van ${guide.title}`} className="w-full" />
                ) : (
                  <div className="grid aspect-square place-items-center p-4 text-center print:hidden">{diagramAction}</div>
                )}
              </div>
            )}
          </div>
          {guide.construction.joints.length > 0 && (
            <>
              <h4 className="mt-5 text-xs font-medium uppercase tracking-wider text-ink-3">Verbindingen</h4>
              <ul className="mt-2 grid gap-3 sm:grid-cols-2">
                {guide.construction.joints.map((j, i) => (
                  <li key={i} className="rounded-2xl bg-surface-2 p-4">
                    <p className="font-medium">{j.name}</p>
                    <p className="text-xs text-ink-3">{j.where}</p>
                    <p className="mt-2 text-sm leading-relaxed">{j.how}</p>
                    <p className="mt-2 flex gap-1.5 text-sm text-ink-2">
                      <Icon name="info" size={15} className="mt-0.5 shrink-0 text-olive" />
                      {j.why}
                    </p>
                  </li>
                ))}
              </ul>
            </>
          )}
        </Section>
      ) : null}

      {guide.drillPlan ? (
        <Section icon="ruler" title="Waar komen de gaten?">
          <DrillPlanView plan={guide.drillPlan} />
        </Section>
      ) : drillAction ? (
        <Section icon="ruler" title="Waar komen de gaten?">
          <div className="flex flex-wrap items-center gap-3 print:hidden">
            <p className="min-w-0 flex-1 text-sm text-ink-2">
              Per onderdeel een tekening met elk schroef-, deuvel- en scharniergat, en de afstand tot de randen in millimeters.
            </p>
            {drillAction}
          </div>
        </Section>
      ) : null}

      {guide.fasteners?.length ? (
        <Section icon="hammer" title="Schroeven, lijm en beslag">
          <ul className="divide-y divide-line">
            {guide.fasteners.map((f, i) => (
              <li key={i} className="grid gap-1 py-3 sm:grid-cols-[1fr_auto]">
                <div>
                  <p className="font-medium">
                    {f.quantity > 0 && <span className="tabular-nums text-accent">{f.quantity}× </span>}
                    {f.name}
                  </p>
                  <p className="text-sm text-ink-2">
                    <span className="text-ink-3">Waar: </span>
                    {f.where}
                  </p>
                  <p className="text-sm text-ink-2">
                    <span className="text-ink-3">Waarom: </span>
                    {f.why}
                  </p>
                  {f.alternative && (
                    <p className="text-sm text-ink-3">
                      <span>Alternatief: </span>
                      {f.alternative}
                    </p>
                  )}
                </div>
              </li>
            ))}
          </ul>
          <p className="mt-2 rounded-xl bg-surface-2 px-3 py-2 text-xs text-ink-2">
            Vuistregel: een schroef is ongeveer 2,5× zo lang als de plaat die je vastzet, en komt er nooit aan de andere kant uit.
            Boor in hardhout en dicht bij de rand altijd eerst voor.
          </p>
        </Section>
      ) : null}

      <Section icon="hammer" title="Gereedschap">
        <ul className="grid gap-2 sm:grid-cols-2">
          {guide.tools.map((t, i) => (
            <li key={i} className="rounded-xl bg-surface-2 px-3 py-2 text-sm">
              <span className="font-medium">{t.name}</span>
              {!t.required && <span className="ml-2 text-xs text-ink-3">handig, niet nodig</span>}
              {t.alternative && <p className="mt-0.5 text-xs text-ink-3">{t.alternative}</p>}
            </li>
          ))}
        </ul>
      </Section>

      <Section
        icon="check"
        title="Stap voor stap"
        aside={
          onProgress && planned.length > 0 ? (
            <button className="btn-outline px-3 py-1.5 text-xs print:hidden" onClick={toAgenda}>
              <Icon name="clock" size={14} /> {planned.length} in agenda zetten
            </button>
          ) : undefined
        }
      >
        {onProgress && planned.length === 0 && (
          <p className="mb-3 rounded-xl bg-surface-2 px-3 py-2 text-xs text-ink-2 print:hidden">
            Tip: kies per stap een dag, dan zet je de hele klus met één tik in je agenda, met een herinnering de avond ervoor.
          </p>
        )}
        <ol className="space-y-4">
          {guide.steps.map((s, i) => (
            <li key={i} className="flex gap-3">
              <Check on={!!steps[i]} onToggle={toggleStep ? () => toggleStep(i) : undefined} label={`Stap ${i + 1} klaar`} />
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-baseline justify-between gap-x-3">
                  <h4 className={`font-medium ${steps[i] ? "text-ink-3 line-through" : ""}`}>
                    {i + 1}. {s.title}
                  </h4>
                  <span className="flex items-center gap-2 text-xs text-ink-3">
                    {s.duration}
                    {setDate ? (
                      <input
                        type="date"
                        aria-label={`Datum voor stap ${i + 1}`}
                        value={dates[i] ?? ""}
                        onChange={(e) => setDate(i, e.target.value)}
                        className="rounded-lg border border-line bg-surface px-1.5 py-0.5 text-xs text-ink print:hidden"
                      />
                    ) : null}
                  </span>
                </div>
                <p className="mt-1 whitespace-pre-line text-[15px] leading-relaxed text-ink-2">{s.description}</p>
                {s.tips.length > 0 && (
                  <ul className="mt-2 space-y-1 text-sm text-ink-2">
                    {s.tips.map((t, j) => (
                      <li key={j} className="flex gap-2">
                        <Icon name="info" size={16} className="mt-0.5 shrink-0 text-olive" />
                        {t}
                      </li>
                    ))}
                  </ul>
                )}
                {s.warning && (
                  <p className="mt-2 flex gap-2 rounded-lg bg-accent-soft px-3 py-2 text-sm text-ink">
                    <Icon name="warning" size={16} className="mt-0.5 shrink-0 text-accent" />
                    {s.warning}
                  </p>
                )}
              </div>
            </li>
          ))}
        </ol>
      </Section>

      <div className="grid gap-4 sm:grid-cols-2">
        <Section icon="wand" title="Afwerking">
          <ul className="space-y-1.5 text-sm text-ink-2">
            {guide.finishing.map((f, i) => (
              <li key={i} className="flex gap-2">
                <Icon name="chevron-right" size={16} className="mt-0.5 shrink-0 text-accent" />
                {f}
              </li>
            ))}
          </ul>
        </Section>
        <Section icon="shield" title="Veiligheid">
          <ul className="space-y-1.5 text-sm text-ink-2">
            {guide.safety.map((f, i) => (
              <li key={i} className="flex gap-2">
                <Icon name="chevron-right" size={16} className="mt-0.5 shrink-0 text-accent" />
                {f}
              </li>
            ))}
          </ul>
        </Section>
      </div>
    </div>
  );
}
