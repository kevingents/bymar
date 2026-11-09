"use client";

import { useEffect, useRef, useState } from "react";
import { postJson } from "@/lib/client-api";
import { signedUrls, supabase } from "@/lib/supabase/client";
import type { Build, BuildProgress, Project, ProjectImage } from "@/lib/types";
import { euro } from "@/lib/stores";
import { Icon } from "@/components/ui/Icon";
import { BuildGuideView } from "@/components/builds/BuildGuideView";
import { CabinetDiagram } from "@/components/visual/CabinetDiagram";

const EXAMPLES = [
  "Wandkast met deuren, 200 hoog, 100 breed, 40 diep",
  "Boekenkast in de nis naast de schoorsteen",
  "Zwevend tv-meubel van eikenhout",
  "Bed met opberglades, 160 x 200",
  "Bankje met schoenenrek voor in de hal",
  "Wandplanken met verborgen ophanging",
];

const LEVELS = ["Beginner", "Een beetje ervaring", "Ervaren klusser"];

export function BuildsTab({ project }: { project: Project }) {
  const [builds, setBuilds] = useState<Build[] | null>(null);
  const [urls, setUrls] = useState<Record<string, string>>({});
  const [active, setActive] = useState<string | null>(null);
  const [wish, setWish] = useState("");
  const [size, setSize] = useState("");
  const [level, setLevel] = useState(LEVELS[0]);
  const [material, setMaterial] = useState("");
  const [busy, setBusy] = useState(false);
  const [imgBusy, setImgBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    supabase()
      .from("builds")
      .select("*")
      .eq("project_id", project.id)
      .order("created_at", { ascending: false })
      .then(async ({ data }) => {
        const list = (data ?? []) as Build[];
        setBuilds(list);
        setUrls(await signedUrls(list.map((b) => b.image_path)));
      });
  }, [project.id]);

  async function create() {
    if (!wish.trim()) return;
    setBusy(true);
    setError(null);
    const request = [
      wish.trim(),
      size.trim() && `Maten: ${size.trim()}`,
      `Ervaring: ${level}`,
      material.trim() && `Materiaal/kleur: ${material.trim()}`,
    ]
      .filter(Boolean)
      .join("\n");
    try {
      const { build } = await postJson<{ build: Build }>(`/api/projects/${project.id}/builds`, { request });
      setBuilds((l) => [build, ...(l ?? [])]);
      setActive(build.id);
      setWish("");
      setSize("");
      setMaterial("");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Er ging iets mis.");
    } finally {
      setBusy(false);
    }
  }

  function saveProgress(b: Build, progress: BuildProgress) {
    setBuilds((l) => l?.map((x) => (x.id === b.id ? { ...x, progress } : x)) ?? null);
    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(() => {
      supabase().from("builds").update({ progress }).eq("id", b.id).then();
    }, 400);
  }

  async function makeImage(b: Build) {
    setImgBusy(true);
    setError(null);
    try {
      const { image } = await postJson<{ image: ProjectImage }>(`/api/projects/${project.id}/images`, {
        prompt: `Het zelfgemaakte object "${b.data.title}": ${b.data.summary} Afmetingen ${b.data.dimensions}. Toon het in een passend interieur.`,
        kind: "build",
        buildId: b.id,
      });
      const u = await signedUrls([image.path]);
      setUrls((m) => ({ ...m, ...u }));
      setBuilds((l) => l?.map((x) => (x.id === b.id ? { ...x, image_path: image.path } : x)) ?? null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Beeld maken lukte niet.");
    } finally {
      setImgBusy(false);
    }
  }

  async function remove(b: Build) {
    if (!confirm(`Bouwplan "${b.title}" verwijderen?`)) return;
    await supabase().from("builds").delete().eq("id", b.id);
    setBuilds((l) => l?.filter((x) => x.id !== b.id) ?? null);
    setActive(null);
  }

  const current = builds?.find((b) => b.id === active);

  if (current) {
    return (
      <div className="mx-auto max-w-4xl">
        <div className="mb-4 flex items-center justify-between print:hidden">
          <button className="btn-ghost -ml-3" onClick={() => setActive(null)}>
            <Icon name="arrow-left" size={18} /> Alle bouwplannen
          </button>
          <div className="flex gap-1">
            <button className="btn-ghost" onClick={() => window.print()}>
              <Icon name="download" size={18} /> Afdrukken
            </button>
            <button className="btn-ghost text-danger" onClick={() => remove(current)} aria-label="Bouwplan verwijderen">
              <Icon name="trash" size={18} />
            </button>
          </div>
        </div>
        {error && <p className="mb-3 text-sm text-danger">{error}</p>}
        <BuildGuideView
          guide={current.data}
          progress={current.progress ?? {}}
          onProgress={(p) => saveProgress(current, p)}
          imageUrl={current.image_path ? urls[current.image_path] : null}
          imageAction={
            <button className="btn-outline" onClick={() => makeImage(current)} disabled={imgBusy}>
              <Icon name={imgBusy ? "loader" : "sparkles"} size={18} />
              {imgBusy ? "Bezig…" : "Laat zien hoe het wordt"}
            </button>
          }
        />
      </div>
    );
  }

  return (
    <div className="grid gap-6 lg:grid-cols-[400px_1fr]">
      <section className="card h-fit p-4 sm:p-5">
        <h2 className="font-display text-xl">Wat wil je zelf maken?</h2>
        <p className="mt-1 text-sm text-ink-2">
          Je krijgt een compleet plan: ontwerp, materialen met prijzen en winkels, zaaglijst, gereedschap en elke montagestap.
        </p>
        <textarea
          rows={3}
          className="input mt-4 resize-none"
          placeholder="Bijvoorbeeld: een open boekenkast van multiplex voor de nis naast het raam"
          value={wish}
          onChange={(e) => setWish(e.target.value)}
        />
        <div className="no-scrollbar mt-2 flex gap-2 overflow-x-auto pb-1">
          {EXAMPLES.map((ex) => (
            <button key={ex} className="chip shrink-0 text-xs" onClick={() => setWish(ex)}>
              {ex.split(",")[0]}
            </button>
          ))}
        </div>
        <div className="mt-4 grid grid-cols-2 gap-3">
          <div className="col-span-2 sm:col-span-1">
            <label className="label" htmlFor="size">
              Maten (optioneel)
            </label>
            <input id="size" className="input" placeholder="h 200 x b 100 x d 40 cm" value={size} onChange={(e) => setSize(e.target.value)} />
          </div>
          <div className="col-span-2 sm:col-span-1">
            <label className="label" htmlFor="mat">
              Materiaal / kleur
            </label>
            <input id="mat" className="input" placeholder="eiken, wit gelakt…" value={material} onChange={(e) => setMaterial(e.target.value)} />
          </div>
        </div>
        <div className="mt-4">
          <span className="label">Ervaring</span>
          <div className="flex flex-wrap gap-2">
            {LEVELS.map((l) => (
              <button key={l} className="chip" data-on={level === l} onClick={() => setLevel(l)}>
                {l}
              </button>
            ))}
          </div>
        </div>
        <button className="btn-primary mt-5 w-full" onClick={create} disabled={busy || !wish.trim()}>
          <Icon name={busy ? "loader" : "hammer"} size={18} />
          {busy ? "Bouwplan wordt uitgewerkt…" : "Maak bouwplan"}
        </button>
        {busy && (
          <p className="mt-2 text-center text-xs text-ink-3">
            Even geduld: materialen, zaaglijst en stappen worden doorgerekend. Dit duurt 1 tot 3 minuten; laat dit scherm open.
          </p>
        )}
        {error && <p className="mt-3 text-sm text-danger">{error}</p>}
      </section>

      <section>
        {builds === null ? (
          <div className="grid place-items-center py-16 text-ink-3">
            <Icon name="loader" size={28} />
          </div>
        ) : builds.length === 0 ? (
          <div className="card flex flex-col items-center px-6 py-10 text-center text-ink-2">
            <CabinetDiagram className="h-56 w-auto" />
            <p className="mt-2 font-display text-2xl text-ink">Wat ga jij bouwen?</p>
            <p className="mt-1 max-w-sm">Beschrijf iets wat je wilt maken, van wandplank tot complete kast. Je krijgt elke plank en elke schroef uitgelegd.</p>
          </div>
        ) : (
          <ul className="grid gap-3 sm:grid-cols-2">
            {builds.map((b) => {
              const done = Object.values(b.progress?.steps ?? {}).filter(Boolean).length;
              return (
                <li key={b.id}>
                  <button className="card group w-full overflow-hidden text-left transition hover:shadow-lg" onClick={() => setActive(b.id)}>
                    <div className="aspect-[16/9] bg-surface-2">
                      {b.image_path && urls[b.image_path] ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={urls[b.image_path]} alt="" className="h-full w-full object-cover" />
                      ) : (
                        <div className="grid h-full place-items-center bg-surface-2">
                          <CabinetDiagram className="h-full w-auto py-2" />
                        </div>
                      )}
                    </div>
                    <div className="p-4">
                      <h3 className="font-medium">{b.title}</h3>
                      <p className="mt-1 text-sm text-ink-3">
                        {b.data.difficulty} · {b.data.totalTime} · ca. {euro(b.data.estimatedCost)}
                      </p>
                      <p className="mt-2 text-xs text-ink-3">
                        {done} van {b.data.steps.length} stappen klaar
                      </p>
                    </div>
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </section>
    </div>
  );
}
