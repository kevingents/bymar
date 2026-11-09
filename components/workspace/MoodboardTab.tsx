"use client";

import { useEffect, useRef, useState } from "react";
import { uploadPhoto } from "@/lib/client-api";
import { signedUrls, supabase } from "@/lib/supabase/client";
import type { Project, ProjectImage } from "@/lib/types";
import { Icon } from "@/components/ui/Icon";
import { useUser } from "@/components/auth/AuthGate";

export type MoodItem = {
  id: string;
  kind: "image" | "link" | "color" | "note";
  title: string | null;
  url: string | null;
  image_path: string | null;
  image_url: string | null;
  color: string | null;
  note: string | null;
};

const SIZES = ["", "row-span-2", "", "", "row-span-2", ""];
const EMPTY = ["#EDE6DB", "#C9A57E", "#8E9A7B", "#3B3631", "#D8CDBB", "#A4593B"];

export function MoodboardTab({ project }: { project: Project }) {
  const user = useUser();
  const [items, setItems] = useState<MoodItem[] | null>(null);
  const [urls, setUrls] = useState<Record<string, string>>({});
  const [adding, setAdding] = useState<null | "link" | "color" | "note" | "beelden">(null);
  const [text, setText] = useState("");
  const [color, setColor] = useState("#C9A57E");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [gallery, setGallery] = useState<ProjectImage[]>([]);
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    supabase()
      .from("moodboard_items")
      .select("*")
      .eq("project_id", project.id)
      .order("created_at", { ascending: false })
      .then(async ({ data }) => {
        const list = (data ?? []) as MoodItem[];
        setItems(list);
        setUrls(await signedUrls(list.map((i) => i.image_path)));
      });
  }, [project.id]);

  async function insert(row: Partial<MoodItem>) {
    const { data, error } = await supabase()
      .from("moodboard_items")
      .insert({ project_id: project.id, ...row })
      .select("*")
      .single();
    if (error || !data) throw new Error("Opslaan lukte niet.");
    const item = data as MoodItem;
    if (item.image_path) {
      const u = await signedUrls([item.image_path]);
      setUrls((m) => ({ ...m, ...u }));
    }
    setItems((l) => [item, ...(l ?? [])]);
  }

  async function run(fn: () => Promise<void>) {
    setBusy(true);
    setError(null);
    try {
      await fn();
      setAdding(null);
      setText("");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Er ging iets mis.");
    } finally {
      setBusy(false);
    }
  }

  async function addLink() {
    const url = text.trim();
    if (!/^https?:\/\//.test(url)) throw new Error("Plak een volledige link, beginnend met https://");
    const res = await fetch(`/api/og?url=${encodeURIComponent(url)}`);
    const meta = (await res.json().catch(() => ({}))) as { title?: string; image?: string | null };
    await insert({ kind: "link", url, title: meta.title ?? url, image_url: meta.image ?? null });
  }

  async function openGallery() {
    setAdding("beelden");
    const { data } = await supabase()
      .from("project_images")
      .select("*")
      .eq("project_id", project.id)
      .order("created_at", { ascending: false })
      .limit(40);
    const list = (data ?? []) as ProjectImage[];
    setGallery(list);
    const u = await signedUrls(list.map((i) => i.path));
    setUrls((m) => ({ ...m, ...u }));
  }

  async function remove(it: MoodItem) {
    await supabase().from("moodboard_items").delete().eq("id", it.id);
    setItems((l) => l?.filter((x) => x.id !== it.id) ?? null);
  }

  return (
    <div className="space-y-4">
      <div className="card flex flex-wrap items-center gap-2 p-3 sm:p-4">
        <h2 className="mr-auto font-display text-xl">Moodboard</h2>
        <button className="btn-outline px-3 py-2" onClick={() => fileRef.current?.click()} disabled={busy}>
          <Icon name={busy ? "loader" : "camera"} size={16} /> Foto
        </button>
        <button className="btn-outline px-3 py-2" onClick={openGallery}>
          <Icon name="image" size={16} /> Uit je beelden
        </button>
        <button className="btn-outline px-3 py-2" onClick={() => setAdding("link")}>
          <Icon name="link" size={16} /> Link
        </button>
        <button className="btn-outline px-3 py-2" onClick={() => setAdding("color")}>
          <Icon name="palette" size={16} /> Kleur
        </button>
        <button className="btn-outline px-3 py-2" onClick={() => setAdding("note")}>
          <Icon name="edit" size={16} /> Notitie
        </button>
        <input
          ref={fileRef}
          type="file"
          accept="image/*"
          multiple
          className="hidden"
          onChange={(e) => {
            const files = [...(e.target.files ?? [])];
            e.target.value = "";
            run(async () => {
              for (const f of files) {
                const path = await uploadPhoto(user.id, project.id, f);
                await insert({ kind: "image", image_path: path, title: f.name.replace(/\.[^.]+$/, "") });
              }
            });
          }}
        />
      </div>

      {adding && adding !== "beelden" && (
        <form
          className="card flex flex-col gap-2 p-3 sm:flex-row sm:items-center"
          onSubmit={(e) => {
            e.preventDefault();
            run(async () => {
              if (adding === "link") await addLink();
              if (adding === "color") await insert({ kind: "color", color, title: text.trim() || color.toUpperCase() });
              if (adding === "note") {
                if (!text.trim()) throw new Error("Schrijf eerst iets.");
                await insert({ kind: "note", note: text.trim() });
              }
            });
          }}
        >
          {adding === "color" && (
            <input type="color" value={color} onChange={(e) => setColor(e.target.value)} className="h-11 w-14 cursor-pointer rounded-xl border border-line bg-transparent" />
          )}
          {adding === "note" ? (
            <textarea
              autoFocus
              rows={2}
              className="input flex-1 resize-none"
              placeholder="Bijvoorbeeld: warme verlichting, niets wits, veel textuur"
              value={text}
              onChange={(e) => setText(e.target.value)}
            />
          ) : (
            <input
              autoFocus
              className="input flex-1"
              placeholder={adding === "link" ? "Plak een link van Pinterest, Instagram of een webwinkel" : "Naam van de kleur (optioneel)"}
              value={text}
              onChange={(e) => setText(e.target.value)}
            />
          )}
          <div className="flex gap-2">
            <button className="btn-primary" disabled={busy}>
              <Icon name={busy ? "loader" : "plus"} size={16} /> Toevoegen
            </button>
            <button type="button" className="btn-ghost" onClick={() => setAdding(null)}>
              Annuleren
            </button>
          </div>
        </form>
      )}

      {adding === "beelden" && (
        <div className="card p-3">
          <div className="mb-2 flex items-center justify-between">
            <p className="text-sm text-ink-2">Tik een beeld aan om het op je moodboard te zetten.</p>
            <button className="btn-ghost px-2" onClick={() => setAdding(null)} aria-label="Sluiten">
              <Icon name="x" size={18} />
            </button>
          </div>
          {gallery.length === 0 ? (
            <p className="py-6 text-center text-sm text-ink-3">Nog geen beelden in dit project.</p>
          ) : (
            <div className="no-scrollbar flex gap-2 overflow-x-auto">
              {gallery.map((g) =>
                urls[g.path] ? (
                  <button
                    key={g.id}
                    onClick={() => run(() => insert({ kind: "image", image_path: g.path, title: g.prompt?.slice(0, 80) ?? null }))}
                    className="shrink-0 overflow-hidden rounded-xl"
                  >
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={urls[g.path]} alt="" className="h-28 w-28 object-cover" />
                  </button>
                ) : null,
              )}
            </div>
          )}
        </div>
      )}
      {error && <p className="text-sm text-danger">{error}</p>}

      {items === null ? (
        <div className="grid place-items-center py-16 text-ink-3">
          <Icon name="loader" size={28} />
        </div>
      ) : items.length === 0 ? (
        <div className="card grid grid-cols-3 gap-2 p-3 sm:grid-cols-6">
          {EMPTY.map((c, i) => (
            <div key={c} className={`rounded-xl ${i % 2 ? "h-32" : "h-20"}`} style={{ background: c }} />
          ))}
          <p className="col-span-full pt-2 text-sm text-ink-2">
            Verzamel hier alles wat je inspireert: foto&apos;s, links naar producten, kleuren en notities. Wie je project deelt, ziet je
            moodboard ook.
          </p>
        </div>
      ) : (
        <ul className="grid auto-rows-[9rem] grid-cols-2 gap-3 sm:auto-rows-[11rem] sm:grid-cols-3 lg:grid-cols-4">
          {items.map((it, i) => (
            <li key={it.id} className={`group relative overflow-hidden rounded-2xl ${it.kind === "image" || it.image_url ? SIZES[i % SIZES.length] : ""}`}>
              <MoodCard it={it} url={it.image_path ? urls[it.image_path] : null} />
              <button
                onClick={() => remove(it)}
                className="absolute right-2 top-2 grid h-8 w-8 place-items-center rounded-full bg-black/45 text-white opacity-100 transition sm:opacity-0 sm:group-hover:opacity-100 sm:focus:opacity-100"
                aria-label="Verwijderen"
              >
                <Icon name="trash" size={14} />
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

export function MoodCard({ it, url }: { it: MoodItem; url?: string | null }) {
  if (it.kind === "color")
    return (
      <div className="flex h-full flex-col justify-end p-3" style={{ background: it.color ?? "#ccc" }}>
        <span className="w-fit rounded-full bg-white/85 px-2 py-0.5 text-xs text-ink">{it.title}</span>
      </div>
    );
  if (it.kind === "note")
    return (
      <div className="flex h-full items-center bg-accent-soft p-4">
        <p className="font-display text-lg leading-snug text-ink">&ldquo;{it.note}&rdquo;</p>
      </div>
    );
  if (it.kind === "link")
    return (
      <a href={it.url ?? "#"} target="_blank" rel="noreferrer" className="flex h-full flex-col bg-surface ring-1 ring-line">
        {it.image_url ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={it.image_url} alt="" className="min-h-0 flex-1 object-cover" referrerPolicy="no-referrer" />
        ) : (
          <div className="grid flex-1 place-items-center text-ink-3">
            <Icon name="link" size={28} />
          </div>
        )}
        <span className="flex items-center gap-1.5 p-2 text-xs text-ink-2">
          <Icon name="external" size={12} className="shrink-0" />
          <span className="truncate">{it.title ?? it.url}</span>
        </span>
      </a>
    );
  return url ? (
    // eslint-disable-next-line @next/next/no-img-element
    <img src={url} alt={it.title ?? ""} className="h-full w-full object-cover" />
  ) : (
    <div className="h-full animate-pulse bg-surface-2" />
  );
}
