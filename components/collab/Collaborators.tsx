"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase/client";
import type { Project } from "@/lib/types";
import { Icon } from "@/components/ui/Icon";
import { useUser } from "@/components/auth/AuthGate";

type Member = { user_id: string; email: string | null; created_at: string };

function newToken() {
  const bytes = crypto.getRandomValues(new Uint8Array(24));
  return Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");
}

/** Samenwerken: uitnodigingslink + wie er meedoet. Leden kunnen alles bewerken, niet verwijderen. */
export function Collaborators({ project, onChange }: { project: Project; onChange: (p: Partial<Project>) => Promise<void> }) {
  const user = useUser();
  const router = useRouter();
  const isOwner = project.owner_id === user.id;
  const [members, setMembers] = useState<Member[]>([]);
  const [copied, setCopied] = useState(false);
  const url = project.invite_token && typeof window !== "undefined" ? `${window.location.origin}/uitnodiging/${project.invite_token}` : "";

  useEffect(() => {
    supabase()
      .from("project_members")
      .select("user_id, email, created_at")
      .eq("project_id", project.id)
      .order("created_at")
      .then(({ data }) => setMembers((data ?? []) as Member[]));
  }, [project.id]);

  async function invite() {
    const token = project.invite_token ?? newToken();
    if (!project.invite_token) await onChange({ invite_token: token });
    const link = `${window.location.origin}/uitnodiging/${token}`;
    if (navigator.share) {
      try {
        await navigator.share({ title: project.title, text: `Werk je mee aan "${project.title}" in Huisraad?`, url: link });
        return;
      } catch {
        /* geannuleerd, val terug op kopiëren */
      }
    }
    await navigator.clipboard.writeText(link);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  async function remove(m: Member) {
    const self = m.user_id === user.id;
    if (!confirm(self ? "Wil je dit project verlaten?" : `${m.email ?? "Dit lid"} uit het project halen?`)) return;
    await supabase().from("project_members").delete().eq("project_id", project.id).eq("user_id", m.user_id);
    if (self) router.replace("/projecten");
    else setMembers((l) => l.filter((x) => x.user_id !== m.user_id));
  }

  return (
    <section className="card p-5">
      <h2 className="flex items-center gap-2 font-display text-xl">
        <Icon name="user" size={20} className="text-accent" /> Samen werken
      </h2>
      <p className="mt-1 text-sm text-ink-2">
        Nodig iemand uit om mee te bouwen: beelden maken, plattegrond tekenen, inkooplijst afvinken. Wijzigingen zie je live.
      </p>

      <ul className="mt-4 space-y-2">
        <li className="flex items-center gap-3 rounded-xl bg-surface-2 px-3 py-2">
          <span className="grid h-8 w-8 place-items-center rounded-full bg-accent text-accent-ink">
            <Icon name="home" size={16} />
          </span>
          <span className="flex-1 text-sm">{isOwner ? "Jij (eigenaar)" : "Eigenaar van het project"}</span>
        </li>
        {members.map((m) => (
          <li key={m.user_id} className="flex items-center gap-3 rounded-xl bg-surface-2 px-3 py-2">
            <span className="grid h-8 w-8 place-items-center rounded-full bg-olive text-sm font-semibold text-white">
              {(m.email ?? "?").slice(0, 1).toUpperCase()}
            </span>
            <span className="flex-1 truncate text-sm">
              {m.user_id === user.id ? "Jij" : (m.email ?? "Lid")}
              <span className="ml-2 text-xs text-ink-3">
                sinds {new Date(m.created_at).toLocaleDateString("nl-NL", { day: "numeric", month: "short" })}
              </span>
            </span>
            {(isOwner || m.user_id === user.id) && (
              <button
                className="text-ink-3 hover:text-danger"
                onClick={() => remove(m)}
                aria-label={m.user_id === user.id ? "Project verlaten" : "Lid verwijderen"}
              >
                <Icon name={m.user_id === user.id ? "logout" : "trash"} size={16} />
              </button>
            )}
          </li>
        ))}
      </ul>

      <div className="mt-4 flex flex-wrap gap-2">
        <button className="btn-primary" onClick={invite}>
          <Icon name={copied ? "check" : "plus"} size={18} /> {copied ? "Link gekopieerd" : "Iemand uitnodigen"}
        </button>
        {isOwner && project.invite_token && (
          <button
            className="btn-ghost"
            onClick={async () => {
              if (confirm("Uitnodigingslink intrekken? Wie al meedoet, blijft lid.")) await onChange({ invite_token: null });
            }}
          >
            <Icon name="x" size={16} /> Link intrekken
          </button>
        )}
      </div>
      {url && <p className="mt-2 truncate text-xs text-ink-3">{url}</p>}
    </section>
  );
}
