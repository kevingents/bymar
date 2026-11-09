"use client";

import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { BUCKET, signedUrls, supabase } from "@/lib/supabase/client";
import { RoomScene } from "@/components/visual/RoomScene";
import type { Project } from "@/lib/types";
import { euro } from "@/lib/stores";
import { Icon, type IconName } from "@/components/ui/Icon";
import { ProjectForm } from "@/components/projects/ProjectForm";
import { useUser } from "@/components/auth/AuthGate";
import { ImagesTab } from "./ImagesTab";
import { AdviceTab } from "./AdviceTab";
import { BuildsTab } from "./BuildsTab";
import { ShoppingTab } from "./ShoppingTab";
import { ShareTab } from "./ShareTab";
import { ColorTab } from "./ColorTab";
import { MoodboardTab } from "./MoodboardTab";
import { FloorplanTab } from "@/components/floorplan/FloorplanTab";

const TABS: { key: string; label: string; icon: IconName }[] = [
  { key: "beelden", label: "Beelden", icon: "sparkles" },
  { key: "advies", label: "Advies", icon: "chat" },
  { key: "maken", label: "Zelf maken", icon: "hammer" },
  { key: "plattegrond", label: "Plattegrond & 3D", icon: "plan" },
  { key: "kleur", label: "Kleur & verf", icon: "palette" },
  { key: "moodboard", label: "Moodboard", icon: "grid" },
  { key: "inkoop", label: "Inkooplijst", icon: "cart" },
  { key: "delen", label: "Delen", icon: "share" },
];

export function Workspace() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const user = useUser();
  const [project, setProject] = useState<Project | null | undefined>(undefined);
  // Workspace rendert alleen in de browser (achter AuthGate), dus de hash is hier beschikbaar.
  const [tab, setTab] = useState(() => {
    const fromHash = typeof window === "undefined" ? "" : window.location.hash.slice(1);
    return TABS.some((t) => t.key === fromHash) ? fromHash : "beelden";
  });
  const [editing, setEditing] = useState(false);
  const [coverUrl, setCoverUrl] = useState<string | null>(null);
  const coverPath = project?.cover_path ?? null;

  useEffect(() => {
    if (!coverPath) return;
    signedUrls([coverPath]).then((m) => setCoverUrl(m[coverPath] ?? null));
  }, [coverPath]);

  useEffect(() => {
    supabase()
      .from("projects")
      .select("*")
      .eq("id", id)
      .maybeSingle()
      .then(({ data }) => setProject((data as Project) ?? null));
  }, [id]);

  // Live: wijzigingen van wie er nog meer in dit project werkt.
  useEffect(() => {
    const sb = supabase();
    const channel = sb
      .channel(`project-${id}`)
      .on("postgres_changes", { event: "UPDATE", schema: "public", table: "projects", filter: `id=eq.${id}` }, (payload) =>
        setProject((p) => (p ? { ...p, ...(payload.new as Project) } : p)),
      )
      .subscribe();
    return () => {
      sb.removeChannel(channel);
    };
  }, [id]);

  const update = useCallback(
    async (patch: Partial<Project>) => {
      setProject((p) => (p ? { ...p, ...patch } : p));
      const { error } = await supabase().from("projects").update(patch).eq("id", id);
      if (error) console.error(error);
    },
    [id],
  );

  function choose(key: string) {
    setTab(key);
    history.replaceState(null, "", `#${key}`);
  }

  if (project === undefined)
    return (
      <div className="grid min-h-dvh place-items-center text-ink-3">
        <Icon name="loader" size={28} />
      </div>
    );
  if (project === null)
    return (
      <div className="mx-auto max-w-md p-8 text-center">
        <p className="text-ink-2">Dit project bestaat niet (meer).</p>
        <Link href="/projecten" className="btn-outline mt-4">
          Terug naar projecten
        </Link>
      </div>
    );

  return (
    <div className="min-h-dvh">
      <header className="sticky top-0 z-30 border-b border-line bg-bg/90 pt-[env(safe-area-inset-top)] backdrop-blur">
        <div className="mx-auto flex max-w-6xl items-center gap-2 px-3 py-2 sm:px-6">
          <Link href="/projecten" className="btn-ghost px-2.5" aria-label="Terug naar projecten">
            <Icon name="arrow-left" size={20} />
          </Link>
          <span className="relative h-10 w-10 shrink-0 overflow-hidden rounded-xl ring-1 ring-line">
            {coverPath && coverUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={coverUrl} alt="" className="h-full w-full object-cover" />
            ) : (
              <RoomScene style={project.style} className="h-full w-full" />
            )}
          </span>
          <div className="min-w-0 flex-1">
            <h1 className="truncate font-display text-lg font-semibold leading-tight sm:text-xl">{project.title}</h1>
            <p className="truncate text-xs text-ink-3">
              {[project.room_type, project.style, project.budget != null ? `budget ${euro(project.budget)}` : null]
                .filter(Boolean)
                .join(" · ") || "Voeg ruimte, stijl en budget toe voor beter advies"}
            </p>
          </div>
          <button className="btn-ghost px-2.5" onClick={() => setEditing(true)} aria-label="Project bewerken">
            <Icon name="edit" size={18} />
          </button>
        </div>
        <nav className="no-scrollbar mx-auto flex max-w-6xl gap-1 overflow-x-auto px-3 pb-2 sm:px-6" aria-label="Onderdelen">
          {TABS.map((t) => (
            <button
              key={t.key}
              onClick={() => choose(t.key)}
              className={`inline-flex shrink-0 items-center gap-1.5 rounded-full px-3.5 py-2 text-sm transition ${
                tab === t.key ? "bg-ink text-bg" : "text-ink-2 hover:bg-surface-2"
              }`}
              aria-current={tab === t.key ? "page" : undefined}
            >
              <Icon name={t.icon} size={16} />
              {t.label}
            </button>
          ))}
        </nav>
      </header>

      <main className="mx-auto max-w-6xl px-3 py-5 sm:px-6">
        {tab === "beelden" && <ImagesTab project={project} onCover={(cover_path) => update({ cover_path })} onShopping={(shopping) => update({ shopping })} />}
        {tab === "advies" && <AdviceTab project={project} />}
        {tab === "maken" && <BuildsTab project={project} onFloorplan={(floorplan) => update({ floorplan })} onGoTo={choose} />}
        {tab === "plattegrond" && <FloorplanTab project={project} onSave={(floorplan) => update({ floorplan })} />}
        {tab === "kleur" && (
          <ColorTab
            project={project}
            onPalettes={(palettes) => update({ palettes })}
            onWallColor={(wallColor) => project.floorplan && update({ floorplan: { ...project.floorplan, wallColor } })}
          />
        )}
        {tab === "moodboard" && <MoodboardTab project={project} />}
        {tab === "inkoop" && <ShoppingTab project={project} onChange={(shopping) => update({ shopping })} onReplace={(shopping) => setProject({ ...project, shopping })} />}
        {tab === "delen" && <ShareTab project={project} onChange={update} />}
      </main>

      {editing && (
        <div className="fixed inset-0 z-50 grid place-items-end bg-black/40 sm:place-items-center" onClick={() => setEditing(false)}>
          <div
            className="max-h-[92dvh] w-full overflow-y-auto rounded-t-3xl bg-surface p-5 pb-[max(1.25rem,env(safe-area-inset-bottom))] sm:max-w-2xl sm:rounded-3xl sm:p-6"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="mb-4 flex items-center justify-between">
              <h2 className="font-display text-2xl">Project bewerken</h2>
              <button className="btn-ghost px-2.5" onClick={() => setEditing(false)} aria-label="Sluiten">
                <Icon name="x" size={20} />
              </button>
            </div>
            <ProjectForm
              initial={project}
              submitLabel="Opslaan"
              onCancel={() => setEditing(false)}
              onSubmit={async (v) => {
                await update(v);
                setEditing(false);
              }}
            />
            {project.owner_id === user.id && (
            <div className="mt-8 border-t border-line pt-4">
              <button
                className="btn-ghost text-danger"
                onClick={async () => {
                  if (!confirm(`"${project.title}" en alles erin definitief verwijderen?`)) return;
                  const sb = supabase();
                  // Eerst de foto's in de opslag opruimen, daarna het project (rest gaat via cascade).
                  const folder = `${project.owner_id}/${project.id}`;
                  const { data: files } = await sb.storage.from(BUCKET).list(folder, { limit: 1000 });
                  if (files?.length) await sb.storage.from(BUCKET).remove(files.map((f) => `${folder}/${f.name}`));
                  await sb.from("projects").delete().eq("id", project.id);
                  router.replace("/projecten");
                }}
              >
                <Icon name="trash" size={18} /> Project verwijderen
              </button>
            </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
