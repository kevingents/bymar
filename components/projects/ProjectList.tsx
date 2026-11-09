"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { signedUrls, supabase } from "@/lib/supabase/client";
import type { Project } from "@/lib/types";
import { euro } from "@/lib/stores";
import { Icon } from "@/components/ui/Icon";
import { Logo } from "@/components/ui/Logo";
import { useUser } from "@/components/auth/AuthGate";
import { RoomScene } from "@/components/visual/RoomScene";
import Image from "next/image";

export function ProjectList() {
  const user = useUser();
  const [projects, setProjects] = useState<Project[] | null>(null);
  const [covers, setCovers] = useState<Record<string, string>>({});

  useEffect(() => {
    supabase()
      .from("projects")
      .select("*")
      .order("updated_at", { ascending: false })
      .then(async ({ data }) => {
        const list = (data ?? []) as Project[];
        setProjects(list);
        setCovers(await signedUrls(list.map((p) => p.cover_path)));
      });
  }, []);

  return (
    <main className="mx-auto max-w-6xl px-4 pb-16 pt-[max(1rem,env(safe-area-inset-top))] sm:px-6">
      <header className="flex items-center justify-between py-3">
        <Logo />
        <div className="flex items-center gap-1">
          <span className="hidden text-sm text-ink-3 sm:inline">{user.email}</span>
          <Link href="/instellingen" className="btn-ghost" aria-label="Instellingen">
            <Icon name="sliders" size={18} />
          </Link>
          <button className="btn-ghost" onClick={() => supabase().auth.signOut()} aria-label="Uitloggen">
            <Icon name="logout" size={18} />
          </button>
        </div>
      </header>

      <div className="relative mt-4 overflow-hidden rounded-3xl text-white">
        <Image src="/visuals/hero.webp" alt="" fill priority sizes="(min-width:1152px) 1152px, 100vw" className="object-cover" />
        <div className="absolute inset-0 bg-gradient-to-r from-black/65 via-black/35 to-transparent" />
        <div className="relative flex min-h-48 flex-wrap items-end justify-between gap-4 p-6 sm:min-h-56 sm:p-8">
          <div>
            <p className="text-xs font-medium uppercase tracking-[0.2em] text-white/75">Welkom terug</p>
            <h1 className="mt-2 font-display text-4xl tracking-tight sm:text-5xl">Je projecten</h1>
            <p className="mt-1 text-white/85">Elke kamer, elk meubel, elk idee: hier komt het samen.</p>
          </div>
          <Link href="/projecten/nieuw" className="btn-primary px-5 py-3">
            <Icon name="plus" size={18} /> Nieuw project
          </Link>
        </div>
      </div>

      {projects === null ? (
        <div className="mt-16 grid place-items-center text-ink-3">
          <Icon name="loader" size={28} />
        </div>
      ) : projects.length === 0 ? (
        <div className="card mt-8 grid overflow-hidden md:grid-cols-2">
          <RoomScene style="Japandi" className="aspect-[4/3] h-full w-full" />
          <div className="flex flex-col items-start justify-center p-6 sm:p-8">
          <h2 className="font-display text-3xl">Begin met je eerste project</h2>
          <p className="mt-2 max-w-sm text-ink-2">
            Bijvoorbeeld &ldquo;Slaapkamer opknappen&rdquo; of &ldquo;Eigen boekenkast bouwen&rdquo;. Je kunt daarna beelden maken,
            advies vragen en een plattegrond tekenen.
          </p>
          <Link href="/projecten/nieuw" className="btn-primary mt-6">
            <Icon name="plus" size={18} /> Nieuw project
          </Link>
          </div>
        </div>
      ) : (
        <ul className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {projects.map((p) => (
            <li key={p.id}>
              <Link href={`/projecten/${p.id}`} className="card group block overflow-hidden transition hover:shadow-lg">
                <div className="relative aspect-[4/3] bg-surface-2">
                  {p.cover_path && covers[p.cover_path] ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={covers[p.cover_path]} alt="" className="h-full w-full object-cover transition group-hover:scale-[1.02]" />
                  ) : (
                    <RoomScene style={p.style} className="h-full w-full transition duration-500 group-hover:scale-[1.03]" />
                  )}
                  {p.owner_id !== user.id && (
                    <span className="absolute left-3 top-3 inline-flex items-center gap-1 rounded-full bg-olive px-2.5 py-1 text-xs text-white">
                      <Icon name="user" size={14} /> Samen
                    </span>
                  )}
                  {p.share_enabled && (
                    <span className="absolute right-3 top-3 inline-flex items-center gap-1 rounded-full bg-surface/90 px-2.5 py-1 text-xs text-ink-2">
                      <Icon name="link" size={14} /> Gedeeld
                    </span>
                  )}
                </div>
                <div className="p-4">
                  <h2 className="font-medium">{p.title}</h2>
                  <p className="mt-1 text-sm text-ink-3">
                    {[p.room_type, p.style, p.budget != null ? euro(p.budget) : null].filter(Boolean).join(" · ") || "Nog geen details"}
                  </p>
                </div>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </main>
  );
}
