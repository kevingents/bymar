"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase/client";
import type { Comment, Project } from "@/lib/types";
import { Icon } from "@/components/ui/Icon";
import { Collaborators } from "@/components/collab/Collaborators";

function newToken() {
  const bytes = crypto.getRandomValues(new Uint8Array(24));
  return Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");
}

export function ShareTab({ project, onChange }: { project: Project; onChange: (p: Partial<Project>) => Promise<void> }) {
  const [comments, setComments] = useState<Comment[]>([]);
  const [copied, setCopied] = useState(false);
  const url =
    project.share_token && typeof window !== "undefined" ? `${window.location.origin}/delen/${project.share_token}` : "";

  useEffect(() => {
    supabase()
      .from("comments")
      .select("*")
      .eq("project_id", project.id)
      .order("created_at", { ascending: false })
      .then(({ data }) => setComments((data ?? []) as Comment[]));
  }, [project.id]);

  async function toggle() {
    if (project.share_enabled) await onChange({ share_enabled: false });
    else await onChange({ share_enabled: true, share_token: project.share_token ?? newToken() });
  }

  async function share() {
    if (navigator.share) {
      try {
        await navigator.share({ title: project.title, text: `Kijk je mee naar mijn project "${project.title}"?`, url });
        return;
      } catch {
        /* geannuleerd, val terug op kopiëren */
      }
    }
    await navigator.clipboard.writeText(url);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  return (
    <div className="mx-auto max-w-2xl space-y-4">
      <Collaborators project={project} onChange={onChange} />
      <section className="card p-5">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h2 className="font-display text-xl">Laten meekijken</h2>
            <p className="mt-1 text-sm text-ink-2">
              Iedereen met de link ziet je beelden, bouwplannen, plattegrond (ook in 3D) en inkooplijst, en kan een reactie
              achterlaten. Bewerken kan alleen jij.
            </p>
          </div>
          <button
            role="switch"
            aria-checked={project.share_enabled}
            aria-label="Delen aan of uit"
            onClick={toggle}
            className={`relative h-7 w-12 shrink-0 rounded-full transition ${project.share_enabled ? "bg-olive" : "bg-surface-2 ring-1 ring-line"}`}
          >
            <span className={`absolute top-1 h-5 w-5 rounded-full bg-white shadow transition ${project.share_enabled ? "left-6" : "left-1"}`} />
          </button>
        </div>

        {project.share_enabled && url && (
          <div className="mt-4 space-y-3">
            <div className="flex items-center gap-2 rounded-xl bg-surface-2 p-2 pl-3">
              <Icon name="link" size={18} className="shrink-0 text-ink-3" />
              <span className="min-w-0 flex-1 truncate text-sm">{url}</span>
              <button className="btn-primary px-3 py-2" onClick={share}>
                <Icon name={copied ? "check" : "share"} size={16} /> {copied ? "Gekopieerd" : "Delen"}
              </button>
            </div>
            <div className="flex flex-wrap gap-2">
              <a href={url} target="_blank" rel="noreferrer" className="btn-outline">
                <Icon name="eye" size={16} /> Bekijk als gast
              </a>
              <button
                className="btn-ghost"
                onClick={async () => {
                  if (confirm("Nieuwe link maken? De oude link werkt dan niet meer.")) await onChange({ share_token: newToken() });
                }}
              >
                <Icon name="rotate" size={16} /> Nieuwe link
              </button>
            </div>
          </div>
        )}
      </section>

      <section className="card p-5">
        <h3 className="font-display text-lg">Reacties</h3>
        {comments.length === 0 ? (
          <p className="mt-2 text-sm text-ink-3">Nog geen reacties. Deel je link om mensen te laten meedenken.</p>
        ) : (
          <ul className="mt-3 space-y-3">
            {comments.map((c) => (
              <li key={c.id} className="rounded-xl bg-surface-2 p-3">
                <div className="flex items-center justify-between gap-2">
                  <p className="text-sm font-medium">{c.author_name}</p>
                  <div className="flex items-center gap-2">
                    <time className="text-xs text-ink-3">{new Date(c.created_at).toLocaleDateString("nl-NL", { day: "numeric", month: "short" })}</time>
                    <button
                      className="text-ink-3 hover:text-danger"
                      aria-label="Reactie verwijderen"
                      onClick={async () => {
                        await supabase().from("comments").delete().eq("id", c.id);
                        setComments((l) => l.filter((x) => x.id !== c.id));
                      }}
                    >
                      <Icon name="trash" size={15} />
                    </button>
                  </div>
                </div>
                <p className="mt-1 whitespace-pre-wrap text-sm text-ink-2">{c.body}</p>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
