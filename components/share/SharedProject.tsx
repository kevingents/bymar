"use client";

import dynamic from "next/dynamic";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import type { BuildGuide, Floorplan, ShoppingItem } from "@/lib/schemas";
import type { Comment, SavedPalette } from "@/lib/types";
import { euro, storeLink } from "@/lib/stores";
import { Icon } from "@/components/ui/Icon";
import { Logo } from "@/components/ui/Logo";
import { BeforeAfter } from "@/components/ui/BeforeAfter";
import { BuildGuideView } from "@/components/builds/BuildGuideView";
import { FloorplanEditor } from "@/components/floorplan/FloorplanEditor";
import { MoodCard, type MoodItem } from "@/components/workspace/MoodboardTab";
import { RoomScene } from "@/components/visual/RoomScene";

const Walkthrough3D = dynamic(() => import("@/components/floorplan/Walkthrough3D"), { ssr: false });

type SharedImage = { id: string; kind: string; prompt: string | null; path: string; source_path: string | null; created_at: string; votes: number };
type Shared = {
  project: {
    title: string;
    room_type: string | null;
    style: string | null;
    budget: number | null;
    description: string | null;
    cover_path: string | null;
    floorplan: Floorplan | null;
    shopping: ShoppingItem[];
    palettes?: SavedPalette[];
  };
  images: SharedImage[];
  builds: { id: string; title: string; data: BuildGuide; image_path: string | null; diagram_path?: string | null }[];
  moodboard?: MoodItem[];
  comments: Comment[];
  urls: Record<string, string>;
};

function voterId() {
  try {
    let v = localStorage.getItem("huisraad-voter");
    if (!v) {
      v = crypto.randomUUID();
      localStorage.setItem("huisraad-voter", v);
    }
    return v;
  } catch {
    return crypto.randomUUID();
  }
}

function Heading({ eyebrow, title }: { eyebrow: string; title: string }) {
  return (
    <div className="mb-4">
      <p className="text-xs font-medium uppercase tracking-[0.2em] text-accent">{eyebrow}</p>
      <h2 className="mt-1 font-display text-3xl tracking-tight">{title}</h2>
    </div>
  );
}

export function SharedProject() {
  const { token } = useParams<{ token: string }>();
  const [data, setData] = useState<Shared | null>(null);
  const [failed, setFailed] = useState<string | null>(null);
  const [planView, setPlanView] = useState<"2d" | "3d">("3d");
  const [openBuild, setOpenBuild] = useState<string | null>(null);
  const [openImg, setOpenImg] = useState<SharedImage | null>(null);
  const [name, setName] = useState("");
  const [body, setBody] = useState("");
  const [sending, setSending] = useState(false);
  const [myVotes, setMyVotes] = useState<Record<string, boolean>>({});

  useEffect(() => {
    fetch(`/api/share/${token}`)
      .then(async (r) => {
        const d = await r.json();
        if (!r.ok) throw new Error(d.error);
        setData(d);
        try {
          setName(localStorage.getItem("huisraad-name") ?? "");
          setMyVotes(JSON.parse(localStorage.getItem(`huisraad-votes-${token}`) ?? "{}"));
        } catch {
          /* geen opslag beschikbaar */
        }
      })
      .catch((e) => setFailed(e.message || "Deze link werkt niet."));
  }, [token]);

  const story = useMemo(() => {
    if (!data) return null;
    const featured = data.images.find((i) => i.source_path && data.urls[i.source_path] && (i.kind === "restyle" || i.kind === "render"));
    const progress = data.images.filter((i) => i.kind === "progress").sort((a, b) => a.created_at.localeCompare(b.created_at));
    return { featured, progress };
  }, [data]);

  async function vote(img: SharedImage) {
    const on = !myVotes[img.id];
    const next = { ...myVotes, [img.id]: on };
    setMyVotes(next);
    try {
      localStorage.setItem(`huisraad-votes-${token}`, JSON.stringify(next));
    } catch {
      /* negeren */
    }
    const r = await fetch(`/api/share/${token}/vote`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ imageId: img.id, voter: voterId(), on }),
    });
    const d = await r.json().catch(() => ({}));
    if (r.ok) setData((x) => (x ? { ...x, images: x.images.map((i) => (i.id === img.id ? { ...i, votes: d.votes } : i)) } : x));
  }

  async function comment(e: React.FormEvent) {
    e.preventDefault();
    setSending(true);
    try {
      const r = await fetch(`/api/share/${token}/comments`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, body }),
      });
      const d = await r.json();
      if (!r.ok) throw new Error(d.error);
      setData((x) => (x ? { ...x, comments: [...x.comments, d.comment] } : x));
      setBody("");
      try {
        localStorage.setItem("huisraad-name", name);
      } catch {
        /* negeren */
      }
    } catch (err) {
      alert(err instanceof Error ? err.message : "Plaatsen lukte niet.");
    } finally {
      setSending(false);
    }
  }

  if (failed)
    return (
      <div className="mx-auto max-w-md p-8 text-center">
        <Logo />
        <p className="mt-6 text-ink-2">{failed}</p>
      </div>
    );
  if (!data || !story)
    return (
      <div className="grid min-h-dvh place-items-center text-ink-3">
        <Icon name="loader" size={28} />
      </div>
    );

  const { project, images, builds, comments, urls } = data;
  const build = builds.find((b) => b.id === openBuild);
  const plan = project.floorplan;
  const shopping = project.shopping ?? [];
  const moodboard = data.moodboard ?? [];
  const palettes = project.palettes ?? [];
  const cover = project.cover_path ? urls[project.cover_path] : null;

  return (
    <div className="overflow-x-clip pb-16">
      {/* Kop */}
      <section className="relative isolate text-white">
        {cover ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={cover} alt="" className="absolute inset-0 -z-10 h-full w-full object-cover" />
        ) : (
          <RoomScene style={project.style} className="absolute inset-0 -z-10 h-full w-full" />
        )}
        <div className="absolute inset-0 -z-10 bg-gradient-to-t from-black/75 via-black/30 to-black/20" />
        <div className="mx-auto flex min-h-[62dvh] max-w-5xl flex-col px-4 pt-[max(1rem,env(safe-area-inset-top))] sm:px-6">
          <header className="flex items-center justify-between">
            <span className="[&_span]:!text-white">
              <Logo />
            </span>
            <Link href="/" className="btn rounded-full bg-white/15 px-4 py-2 text-sm text-white backdrop-blur hover:bg-white/25">
              Zelf beginnen <Icon name="arrow-right" size={16} />
            </Link>
          </header>
          <div className="mt-auto pb-10">
            <p className="text-xs font-medium uppercase tracking-[0.2em] text-white/80">
              {[project.room_type, project.style].filter(Boolean).join(" · ") || "Interieurproject"}
            </p>
            <h1 className="mt-2 font-display text-4xl tracking-tight sm:text-6xl">{project.title}</h1>
            {project.description && <p className="mt-3 max-w-2xl text-white/85">{project.description}</p>}
          </div>
        </div>
      </section>

      <main className="mx-auto max-w-5xl space-y-16 px-4 pt-12 sm:px-6">
        {/* Verhaal: voor en na */}
        {(story.featured || story.progress.length > 0) && (
          <section>
            <Heading eyebrow="Het verhaal" title="Van toen naar nu" />
            {story.featured && (
              <div className="relative aspect-[4/3] overflow-hidden rounded-3xl shadow-xl">
                <BeforeAfter before={urls[story.featured.source_path!]} after={urls[story.featured.path]} fill />
              </div>
            )}
            {story.progress.length > 0 && (
              <ol className="no-scrollbar mt-6 flex snap-x gap-3 overflow-x-auto pb-2">
                {story.progress.map((p, i) =>
                  urls[p.path] ? (
                    <li key={p.id} className="w-56 shrink-0 snap-start">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={urls[p.path]} alt="" className="aspect-[4/5] w-full rounded-2xl object-cover" />
                      <p className="mt-1.5 text-xs text-ink-3">
                        {i + 1}. {new Date(p.created_at).toLocaleDateString("nl-NL", { day: "numeric", month: "long" })}
                      </p>
                    </li>
                  ) : null,
                )}
              </ol>
            )}
          </section>
        )}

        {/* Beelden met stemmen */}
        {images.length > 0 && (
          <section>
            <Heading eyebrow="Beelden" title="Welke vind jij het mooist?" />
            <p className="-mt-2 mb-4 text-sm text-ink-2">Tik op het hartje bij je favorieten; dat helpt bij het kiezen.</p>
            <ul className="columns-2 gap-3 sm:columns-3">
              {images.map((img) =>
                urls[img.path] ? (
                  <li key={img.id} className="relative mb-3 break-inside-avoid">
                    <button className="block w-full overflow-hidden rounded-xl" onClick={() => setOpenImg(img)}>
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={urls[img.path]} alt={img.prompt ?? ""} className="w-full" />
                    </button>
                    <button
                      onClick={() => vote(img)}
                      aria-pressed={!!myVotes[img.id]}
                      aria-label="Stem op dit beeld"
                      className={`absolute bottom-2 right-2 inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs shadow transition ${
                        myVotes[img.id] ? "bg-accent text-accent-ink" : "bg-surface/90 text-ink"
                      }`}
                    >
                      <Icon name="heart" size={14} /> {img.votes || ""}
                    </button>
                  </li>
                ) : null,
              )}
            </ul>
          </section>
        )}

        {/* Moodboard */}
        {moodboard.length > 0 && (
          <section>
            <Heading eyebrow="Moodboard" title="Waar het van droomt" />
            <ul className="grid auto-rows-[9rem] grid-cols-2 gap-3 sm:auto-rows-[11rem] sm:grid-cols-4">
              {moodboard.map((it, i) => (
                <li key={it.id} className={`overflow-hidden rounded-2xl ${(it.kind === "image" || it.image_url) && i % 3 === 1 ? "row-span-2" : ""}`}>
                  <MoodCard it={it} url={it.image_path ? urls[it.image_path] : null} />
                </li>
              ))}
            </ul>
          </section>
        )}

        {/* Kleuren */}
        {palettes.length > 0 && (
          <section>
            <Heading eyebrow="Kleuren" title="Het kleurenpalet" />
            <div className="space-y-4">
              {palettes.map((p) => (
                <div key={p.id} className="card overflow-hidden">
                  <div className="flex h-28">
                    {p.colors.map((c) => (
                      <div key={c.hex + c.name} className="flex-1" style={{ background: c.hex }} title={`${c.name} · ${c.paint}`} />
                    ))}
                  </div>
                  <div className="p-4">
                    <p className="font-display text-lg">{p.name}</p>
                    <p className="text-sm text-ink-2">{p.colors.map((c) => c.name).join(" · ")}</p>
                  </div>
                </div>
              ))}
            </div>
          </section>
        )}

        {/* Plattegrond */}
        {plan && plan.rooms.length > 0 && (
          <section>
            <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
              <Heading eyebrow="Plattegrond" title="Loop even mee" />
              <div className="flex gap-1 rounded-full bg-surface-2 p-1 text-sm">
                <button className={`rounded-full px-3 py-1.5 ${planView === "3d" ? "bg-surface shadow-sm" : "text-ink-2"}`} onClick={() => setPlanView("3d")}>
                  3D
                </button>
                <button className={`rounded-full px-3 py-1.5 ${planView === "2d" ? "bg-surface shadow-sm" : "text-ink-2"}`} onClick={() => setPlanView("2d")}>
                  2D
                </button>
              </div>
            </div>
            {planView === "2d" ? <FloorplanEditor plan={plan} selection={null} onSelect={() => {}} readOnly /> : <Walkthrough3D plan={plan} />}
          </section>
        )}

        {/* Zelf maken */}
        {builds.length > 0 && (
          <section>
            <Heading eyebrow="Zelf maken" title="Wat er gebouwd wordt" />
            {build ? (
              <>
                <button className="btn-ghost -ml-3 mb-3" onClick={() => setOpenBuild(null)}>
                  <Icon name="arrow-left" size={18} /> Alle bouwplannen
                </button>
                <BuildGuideView
                  guide={build.data}
                  progress={{}}
                  imageUrl={build.image_path ? urls[build.image_path] : null}
                  diagramUrl={build.diagram_path ? urls[build.diagram_path] : null}
                />
              </>
            ) : (
              <ul className="grid gap-3 sm:grid-cols-2">
                {builds.map((b) => (
                  <li key={b.id}>
                    <button className="card w-full overflow-hidden text-left transition hover:shadow-lg" onClick={() => setOpenBuild(b.id)}>
                      {b.image_path && urls[b.image_path] && (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={urls[b.image_path]} alt="" className="aspect-[16/9] w-full object-cover" />
                      )}
                      <div className="p-4">
                        <h3 className="font-medium">{b.title}</h3>
                        <p className="mt-1 text-sm text-ink-3">
                          {b.data.difficulty} · {b.data.totalTime} · ca. {euro(b.data.estimatedCost)}
                        </p>
                      </div>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </section>
        )}

        {/* Inkoop */}
        {shopping.length > 0 && (
          <section>
            <Heading eyebrow="Inkooplijst" title="Waar het vandaan komt" />
            <ul className="card divide-y divide-line p-2">
              {shopping.map((i) => {
                const link = storeLink(i.store, i.searchQuery);
                return (
                  <li key={i.id} className="flex items-center justify-between gap-3 px-2 py-3">
                    <div className="min-w-0">
                      <p className="font-medium">{i.name}</p>
                      <a href={link.href} target="_blank" rel="noreferrer" className="text-sm text-accent hover:underline">
                        {link.label}
                      </a>
                    </div>
                    <span className="text-sm tabular-nums">{euro(i.estPrice * i.quantity)}</span>
                  </li>
                );
              })}
            </ul>
          </section>
        )}

        {/* Reacties */}
        <section>
          <Heading eyebrow="Reacties" title="Denk mee" />
          <ul className="space-y-3">
            {comments.map((c) => (
              <li key={c.id} className="card p-4">
                <p className="text-sm font-medium">{c.author_name}</p>
                <p className="mt-1 whitespace-pre-wrap text-ink-2">{c.body}</p>
              </li>
            ))}
          </ul>
          <form onSubmit={comment} className="card mt-3 space-y-3 p-4">
            <input className="input" placeholder="Je naam" value={name} onChange={(e) => setName(e.target.value)} maxLength={60} required />
            <textarea className="input resize-none" rows={3} placeholder="Wat vind je ervan? Een tip?" value={body} onChange={(e) => setBody(e.target.value)} maxLength={2000} required />
            <button className="btn-primary" disabled={sending || !name.trim() || !body.trim()}>
              <Icon name={sending ? "loader" : "send"} size={18} /> Plaats reactie
            </button>
          </form>
        </section>
      </main>

      {openImg && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/90 p-3" onClick={() => setOpenImg(null)}>
          <button className="btn absolute right-2 top-[max(0.5rem,env(safe-area-inset-top))] text-white/80" aria-label="Sluiten">
            <Icon name="x" size={22} />
          </button>
          <div onClick={(e) => e.stopPropagation()}>
            {openImg.source_path && urls[openImg.source_path] ? (
              <BeforeAfter before={urls[openImg.source_path]} after={urls[openImg.path]} />
            ) : (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={urls[openImg.path]} alt={openImg.prompt ?? ""} className="max-h-[85dvh] max-w-full rounded-lg object-contain" />
            )}
          </div>
        </div>
      )}
    </div>
  );
}
