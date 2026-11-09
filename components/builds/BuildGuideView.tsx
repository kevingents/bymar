"use client";

import type { BuildGuide } from "@/lib/schemas";
import type { BuildProgress } from "@/lib/types";
import { euro, storeLink } from "@/lib/stores";
import { Icon, type IconName } from "@/components/ui/Icon";

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
}: {
  guide: BuildGuide;
  progress: BuildProgress;
  onProgress?: (p: BuildProgress) => void;
  imageUrl?: string | null;
  imageAction?: React.ReactNode;
}) {
  const steps = progress.steps ?? {};
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

      <Section icon="check" title="Stap voor stap">
        <ol className="space-y-4">
          {guide.steps.map((s, i) => (
            <li key={i} className="flex gap-3">
              <Check on={!!steps[i]} onToggle={toggleStep ? () => toggleStep(i) : undefined} label={`Stap ${i + 1} klaar`} />
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-baseline justify-between gap-x-3">
                  <h4 className={`font-medium ${steps[i] ? "text-ink-3 line-through" : ""}`}>
                    {i + 1}. {s.title}
                  </h4>
                  <span className="text-xs text-ink-3">{s.duration}</span>
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
