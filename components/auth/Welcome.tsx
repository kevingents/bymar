"use client";

import dynamic from "next/dynamic";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { DEMO_PLAN } from "@/lib/demo";
import { LOOKS } from "@/lib/styles";
import { supabase } from "@/lib/supabase/client";
import { Icon, type IconName } from "@/components/ui/Icon";
import { Logo } from "@/components/ui/Logo";
import { BeforeAfter } from "@/components/ui/BeforeAfter";
import { CabinetDiagram } from "@/components/visual/CabinetDiagram";
import { isConfigured, SetupNotice } from "./AuthGate";
import { LoginCard } from "./LoginCard";

const Showroom = dynamic(() => import("@/components/floorplan/Walkthrough3D").then((m) => m.Showroom), {
  ssr: false,
  loading: () => <div className="h-full w-full animate-pulse rounded-3xl bg-surface-2" />,
});

const STEPS: { icon: IconName; title: string; text: string }[] = [
  { icon: "sparkles", title: "Droom", text: "Beschrijf je kamer of maak een foto. AI laat zien hoe het kan worden." },
  { icon: "chat", title: "Bespreek", text: "Vraag advies over kleur, indeling en budget, alsof je stylist meekijkt." },
  { icon: "plan", title: "Plan", text: "Teken je plattegrond, richt hem in en loop er in 3D doorheen." },
  { icon: "hammer", title: "Maak", text: "Bouwplan van A tot Z, met wat je waar koopt en elke stap uitgelegd." },
];

const STYLE_PHOTOS = [
  { file: "stijl-japandi", style: "Japandi" },
  { file: "stijl-scandinavisch", style: "Scandinavisch" },
  { file: "stijl-boho", style: "Boho" },
  { file: "stijl-industrieel", style: "Industrieel" },
  { file: "stijl-mid-century", style: "Mid-century" },
  { file: "stijl-mediterraan", style: "Mediterraan" },
];

const CUT_LIST = [
  ["Zijwand", "200 × 32 × 1,8", "2x"],
  ["Legplank", "86,4 × 30 × 1,8", "5x"],
  ["Achterwand", "200 × 90 × 0,4", "1x"],
];

function Eyebrow({ children }: { children: React.ReactNode }) {
  return <p className="text-xs font-medium uppercase tracking-[0.2em] text-accent">{children}</p>;
}

export function Welcome() {
  const router = useRouter();

  useEffect(() => {
    if (!isConfigured()) return;
    supabase()
      .auth.getUser()
      .then(({ data }) => {
        if (data.user) router.replace("/projecten");
      });
  }, [router]);

  if (!isConfigured()) return <SetupNotice />;

  return (
    <div className="overflow-x-clip">
      {/* ------------------------------------------------------------- Hero */}
      <section className="relative isolate min-h-[92dvh] text-white">
        <Image src="/visuals/hero.webp" alt="Lichte japandi-woonkamer met linnen bank en papieren lamp" fill priority sizes="100vw" className="-z-10 object-cover" />
        <div className="absolute inset-0 -z-10 bg-gradient-to-r from-black/65 via-black/35 to-black/5" />
        <div className="absolute inset-x-0 bottom-0 -z-10 h-40 bg-gradient-to-t from-black/40 to-transparent" />

        <header className="mx-auto flex max-w-6xl items-center justify-between px-4 pt-[max(1rem,env(safe-area-inset-top))] sm:px-6">
          <span className="[&_span]:!text-white">
            <Logo />
          </span>
          <a href="#inloggen" className="btn rounded-full bg-white/15 px-4 py-2 text-white backdrop-blur hover:bg-white/25">
            Inloggen
          </a>
        </header>

        <div className="mx-auto grid max-w-6xl items-end gap-10 px-4 pb-14 pt-20 sm:px-6 md:grid-cols-[1.25fr_1fr] md:pt-32">
          <div>
            <p className="text-xs font-medium uppercase tracking-[0.25em] text-white/80">Jouw interieur, van idee tot klaar</p>
            <h1 className="mt-4 font-display text-5xl leading-[1.02] tracking-tight sm:text-6xl lg:text-7xl">
              Bedenk het,
              <br />
              zie het, <em className="text-[#F3C9A8]">maak het</em>.
            </h1>
            <p className="mt-5 max-w-lg text-lg text-white/85">
              Huisraad is je stylist, ontwerper en klusmaatje in één: AI-beelden van je eigen kamer, advies op maat, een
              plattegrond in 3D en bouwplannen tot de laatste schroef.
            </p>
            <div className="mt-7 flex flex-wrap gap-3">
              <a href="#inloggen" className="btn-primary px-6 py-3 text-base">
                Begin je eerste project <Icon name="arrow-right" size={18} />
              </a>
              <a href="#voor-na" className="btn rounded-full border border-white/40 px-6 py-3 text-base text-white hover:bg-white/10">
                Bekijk wat het doet
              </a>
            </div>
          </div>
          <div id="inloggen" className="scroll-mt-6 text-ink">
            <LoginCard />
          </div>
        </div>
      </section>

      {/* ----------------------------------------------------- Vier stappen */}
      <section className="mx-auto max-w-6xl px-4 py-20 sm:px-6">
        <Eyebrow>Zo werkt het</Eyebrow>
        <h2 className="mt-3 max-w-xl font-display text-4xl tracking-tight">Van vaag idee tot een kamer waar je blij van wordt.</h2>
        <ol className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {STEPS.map((s, i) => (
            <li key={s.title} className="card relative overflow-hidden p-5">
              <span className="absolute -right-2 -top-6 font-display text-8xl text-surface-2">{i + 1}</span>
              <span className="relative grid h-11 w-11 place-items-center rounded-2xl bg-accent text-accent-ink">
                <Icon name={s.icon} size={22} />
              </span>
              <h3 className="relative mt-4 font-display text-xl">{s.title}</h3>
              <p className="relative mt-1 text-sm text-ink-2">{s.text}</p>
            </li>
          ))}
        </ol>
      </section>

      {/* ---------------------------------------------------------- Voor/na */}
      <section id="voor-na" className="scroll-mt-6 bg-ink py-20 text-bg">
        <div className="mx-auto grid max-w-6xl items-center gap-10 px-4 sm:px-6 md:grid-cols-[1fr_1.4fr]">
          <div>
            <p className="text-xs font-medium uppercase tracking-[0.2em] text-[#E7A989]">Restyle je eigen kamer</p>
            <h2 className="mt-3 font-display text-4xl tracking-tight">Eén foto. Een hele nieuwe sfeer.</h2>
            <p className="mt-4 text-bg/75">
              Maak een foto van je woonkamer en vertel wat je zoekt. Huisraad houdt je ramen, muren en perspectief precies
              gelijk en verandert alleen de inrichting. Sleep de lijn en zie het verschil.
            </p>
            <ul className="mt-6 space-y-2 text-sm text-bg/80">
              {["Zelfde kamer, zelfde hoek", "Elk beeld kun je verder bijschaven", "Deel het met wie mag meekijken"].map((t) => (
                <li key={t} className="flex items-center gap-2">
                  <Icon name="check" size={16} className="text-[#A7B48F]" /> {t}
                </li>
              ))}
            </ul>
          </div>
          <div className="relative aspect-[4/3] overflow-hidden rounded-3xl shadow-2xl ring-1 ring-white/10">
            <BeforeAfter before="/visuals/voor.webp" after="/visuals/na.webp" fill start={46} />
          </div>
        </div>
      </section>

      {/* ---------------------------------------------------------- Stijlen */}
      <section className="mx-auto max-w-6xl px-4 py-20 sm:px-6">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <Eyebrow>Vind je stijl</Eyebrow>
            <h2 className="mt-3 max-w-xl font-display text-4xl tracking-tight">Japandi of juist boho? Huisraad kent ze allemaal.</h2>
          </div>
          <p className="max-w-sm text-ink-2">Kies een stijl en je beelden, advies, kleuren en inkooplijst passen zich erop aan.</p>
        </div>
        <ul className="mt-10 grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-3">
          {STYLE_PHOTOS.map(({ file, style }) => {
            const look = LOOKS[style];
            const swatches = [look.colors.wall, look.colors.sofa, look.colors.accent, look.colors.wood, look.colors.plant];
            return (
              <li key={file} className="group relative overflow-hidden rounded-3xl">
                <div className="relative aspect-[4/5]">
                  <Image src={`/visuals/${file}.webp`} alt={`Interieur in ${style}-stijl`} fill sizes="(min-width:1024px) 33vw, 50vw" className="object-cover transition duration-700 group-hover:scale-[1.04]" />
                  <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/10 to-transparent" />
                  <div className="absolute inset-x-0 bottom-0 p-4 text-white sm:p-5">
                    <div className="flex gap-1">
                      {swatches.map((c) => (
                        <span key={c} className="h-3.5 w-3.5 rounded-full ring-2 ring-white/70" style={{ background: c }} />
                      ))}
                    </div>
                    <h3 className="mt-2 font-display text-xl sm:text-2xl">{style}</h3>
                    <p className="text-xs text-white/80 sm:text-sm">{look.tagline}</p>
                  </div>
                </div>
              </li>
            );
          })}
        </ul>
      </section>

      {/* ------------------------------------------------------ Zelf maken */}
      <section className="bg-surface-2/60 py-20">
        <div className="mx-auto grid max-w-6xl items-center gap-10 px-4 sm:px-6 md:grid-cols-2">
          <div className="relative">
            <div className="relative aspect-[4/3] overflow-hidden rounded-3xl shadow-xl">
              <Image src="/visuals/zelf-maken.webp" alt="Zelfgemaakte boekenkast van multiplex in een nis" fill sizes="(min-width:768px) 50vw, 100vw" className="object-cover" />
            </div>
            <div className="card absolute -bottom-10 -right-2 w-[min(78%,300px)] p-4 shadow-xl sm:-right-8">
              <p className="flex items-center gap-2 text-xs font-medium uppercase tracking-wider text-ink-3">
                <Icon name="saw" size={16} className="text-accent" /> Zaaglijst · cm
              </p>
              <table className="mt-2 w-full text-sm">
                <tbody className="divide-y divide-line">
                  {CUT_LIST.map(([part, size, n]) => (
                    <tr key={part}>
                      <td className="py-1.5 font-medium">{part}</td>
                      <td className="py-1.5 text-ink-2 tabular-nums">{size}</td>
                      <td className="py-1.5 text-right text-ink-3">{n}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
          <div className="pt-8 md:pt-0">
            <Eyebrow>Zelf maken, van A tot Z</Eyebrow>
            <h2 className="mt-3 font-display text-4xl tracking-tight">Die kast die nergens te koop is? Die bouw je zelf.</h2>
            <p className="mt-4 text-ink-2">
              Vertel wat je wilt maken en hoe groot. Je krijgt een compleet bouwplan, ook als je nog nooit een zaag hebt
              vastgehouden.
            </p>
            <div className="mt-6 grid grid-cols-[1fr_auto] items-center gap-4">
              <ul className="space-y-2.5 text-sm">
                {[
                  ["cart", "Materialen met prijs en winkel"],
                  ["saw", "Zaaglijst voor de zaagservice"],
                  ["hammer", "Gereedschap, of wat je kunt huren"],
                  ["check", "Montagestappen om af te vinken"],
                ].map(([icon, text]) => (
                  <li key={text} className="flex items-center gap-2.5">
                    <span className="grid h-8 w-8 place-items-center rounded-xl bg-surface text-accent ring-1 ring-line">
                      <Icon name={icon as IconName} size={16} />
                    </span>
                    {text}
                  </li>
                ))}
              </ul>
              <CabinetDiagram className="hidden h-44 w-auto sm:block" />
            </div>
          </div>
        </div>
      </section>

      {/* -------------------------------------------------------------- 3D */}
      <section className="mx-auto max-w-6xl px-4 py-20 sm:px-6">
        <div className="grid items-center gap-8 md:grid-cols-[1fr_1.5fr]">
          <div>
            <Eyebrow>Plattegrond en 3D</Eyebrow>
            <h2 className="mt-3 font-display text-4xl tracking-tight">Teken je huis. Loop erdoorheen.</h2>
            <p className="mt-4 text-ink-2">
              Zet je kamers neer, sleep meubels op hun plek of laat AI de kamer inrichten. Daarna zie je alles in 3D, en
              loop je rond alsof je er al woont.
            </p>
            <p className="mt-4 inline-flex items-center gap-2 rounded-full bg-surface-2 px-3 py-1.5 text-sm text-ink-2">
              <Icon name="rotate" size={16} /> Sleep om zelf te draaien
            </p>
          </div>
          <div className="relative h-[46dvh] min-h-[320px] rounded-3xl bg-gradient-to-b from-surface-2/70 to-transparent">
            <Showroom plan={DEMO_PLAN} className="h-full w-full cursor-grab active:cursor-grabbing" />
          </div>
        </div>
      </section>

      {/* ------------------------------------------------------------- Slot */}
      <section className="relative isolate overflow-hidden">
        <Image src="/visuals/na.webp" alt="" fill sizes="100vw" className="-z-10 object-cover" />
        <div className="absolute inset-0 -z-10 bg-black/55" />
        <div className="mx-auto grid max-w-6xl items-center gap-8 px-4 py-20 text-white sm:px-6 md:grid-cols-2">
          <div>
            <h2 className="font-display text-4xl tracking-tight sm:text-5xl">Welke kamer pak jij als eerste aan?</h2>
            <p className="mt-3 text-white/80">Maak een account met alleen je e-mailadres en begin meteen.</p>
          </div>
          <div className="text-ink">
            <LoginCard id="inloggen-onder" title="Begin gratis" />
          </div>
        </div>
      </section>

      <footer className="mx-auto flex max-w-6xl items-center justify-between px-4 py-8 text-sm text-ink-3 sm:px-6">
        <Logo size={22} />
        <span>Met liefde gemaakt voor mooie huizen</span>
      </footer>
    </div>
  );
}
