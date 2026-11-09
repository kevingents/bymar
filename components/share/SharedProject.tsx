"use client";

import dynamic from "next/dynamic";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useEffect, useState } from "react";
import type { BuildGuide, Floorplan, ShoppingItem } from "@/lib/schemas";
import type { Comment } from "@/lib/types";
import { euro, storeLink } from "@/lib/stores";
import { Icon } from "@/components/ui/Icon";
import { Logo } from "@/components/ui/Logo";
import { BeforeAfter } from "@/components/ui/BeforeAfter";
import { BuildGuideView } from "@/components/builds/BuildGuideView";
import { FloorplanEditor } from "@/components/floorplan/FloorplanEditor";

const Walkthrough3D = dynamic(() => import("@/components/floorplan/Walkthrough3D"), { ssr: false });

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
  };
  images: { id: string; kind: string; prompt: string | null; path: string; source_path: string | null }[];
  builds: { id: string; title: string; data: BuildGuide; image_path: string | null }[];
  comments: Comment[];
  urls: Record<string, string>;
};

export function SharedProject() {
  const { token } = useParams<{ token: string }>();
  const [data, setData] = useState<Shared | null>(null);
  const [failed, setFailed] = useState<string | null>(null);
  const [planView, setPlanView] = useState<"2d" | "3d">("2d");
  const [openBuild, setOpenBuild] = useState<string | null>(null);
  const [openImg, setOpenImg] = useState<Shared["images"][number] | null>(null);
  const [name, setName] = useState("");
  const [body, setBody] = useState("");
  const [sending, setSending] = useState(false);

  useEffect(() => {
    fetch(`/api/share/${token}`)
      .then(async (r) => {
        const d = await r.json();
        if (!r.ok) throw new Error(d.error);
        setData(d);
        try {
          setName(localStorage.getItem("huisraad-name") ?? "");
        } catch {
          /* geen opslag beschikbaar */
        }
      })
      .catch((e) => setFailed(e.message || "Deze link werkt niet."));
  }, [token]);

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
  if (!data)
    return (
      <div className="grid min-h-dvh place-items-center text-ink-3">
        <Icon name="loader" size={28} />
      </div>
    );

  const { project, images, builds, comments, urls } = data;
  const build = builds.find((b) => b.id === openBuild);
  const plan = project.floorplan;
  const shopping = project.shopping ?? [];

  return (
    <main className="mx-auto max-w-5xl px-4 pb-16 pt-[max(1rem,env(safe-area-inset-top))] sm:px-6">
      <header className="flex items-center justify-between py-2">
        <Logo />
        <Link href="/" className="btn-ghost text-sm">
          Zelf beginnen <Icon name="arrow-right" size={16} />
        </Link>
      </header>

      <section className="mt-4">
        {project.cover_path && urls[project.cover_path] && (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={urls[project.cover_path]} alt="" className="aspect-[16/9] w-full rounded-3xl object-cover" />
        )}
        <h1 className="mt-5 font-display text-3xl tracking-tight sm:text-4xl">{project.title}</h1>
        <p className="mt-1 text-ink-3">
          {[project.room_type, project.style, project.budget != null ? `budget ${euro(project.budget)}` : null].filter(Boolean).join(" · ")}
        </p>
        {project.description && <p className="mt-3 max-w-2xl text-ink-2">{project.description}</p>}
      </section>

      {images.length > 0 && (
        <section className="mt-10">
          <h2 className="mb-3 font-display text-2xl">Beelden</h2>
          <ul className="columns-2 gap-3 sm:columns-3">
            {images.map((img) =>
              urls[img.path] ? (
                <li key={img.id} className="mb-3 break-inside-avoid">
                  <button className="block w-full overflow-hidden rounded-xl" onClick={() => setOpenImg(img)}>
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={urls[img.path]} alt={img.prompt ?? ""} className="w-full" />
                  </button>
                </li>
              ) : null,
            )}
          </ul>
        </section>
      )}

      {plan && plan.rooms.length > 0 && (
        <section className="mt-10">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="font-display text-2xl">Plattegrond</h2>
            <div className="flex gap-1 rounded-full bg-surface-2 p-1 text-sm">
              <button className={`rounded-full px-3 py-1.5 ${planView === "2d" ? "bg-surface shadow-sm" : "text-ink-2"}`} onClick={() => setPlanView("2d")}>
                2D
              </button>
              <button className={`rounded-full px-3 py-1.5 ${planView === "3d" ? "bg-surface shadow-sm" : "text-ink-2"}`} onClick={() => setPlanView("3d")}>
                3D
              </button>
            </div>
          </div>
          {planView === "2d" ? <FloorplanEditor plan={plan} selection={null} onSelect={() => {}} readOnly /> : <Walkthrough3D plan={plan} />}
        </section>
      )}

      {builds.length > 0 && (
        <section className="mt-10">
          <h2 className="mb-3 font-display text-2xl">Zelf maken</h2>
          {build ? (
            <>
              <button className="btn-ghost -ml-3 mb-3" onClick={() => setOpenBuild(null)}>
                <Icon name="arrow-left" size={18} /> Alle bouwplannen
              </button>
              <BuildGuideView guide={build.data} progress={{}} imageUrl={build.image_path ? urls[build.image_path] : null} />
            </>
          ) : (
            <ul className="grid gap-3 sm:grid-cols-2">
              {builds.map((b) => (
                <li key={b.id}>
                  <button className="card w-full p-4 text-left transition hover:shadow-lg" onClick={() => setOpenBuild(b.id)}>
                    <h3 className="font-medium">{b.title}</h3>
                    <p className="mt-1 text-sm text-ink-3">
                      {b.data.difficulty} · {b.data.totalTime} · ca. {euro(b.data.estimatedCost)}
                    </p>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </section>
      )}

      {shopping.length > 0 && (
        <section className="mt-10">
          <h2 className="mb-3 font-display text-2xl">Inkooplijst</h2>
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

      <section className="mt-10">
        <h2 className="mb-3 font-display text-2xl">Denk mee</h2>
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
    </main>
  );
}
