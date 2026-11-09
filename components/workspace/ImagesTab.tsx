"use client";

import { useEffect, useRef, useState } from "react";
import { postJson, uploadPhoto } from "@/lib/client-api";
import { BUCKET, signedUrls, supabase } from "@/lib/supabase/client";
import type { Project, ProjectImage } from "@/lib/types";
import { Icon } from "@/components/ui/Icon";
import { useUser } from "@/components/auth/AuthGate";
import { BeforeAfter } from "@/components/ui/BeforeAfter";

const IDEAS = [
  "Lichte woonkamer met linnen bank, eiken vloer en veel planten",
  "Slaapkamer in zachte aardetinten met een bed van gestoomd beuken",
  "Werkhoek in een nis met zwevend bureau en open planken",
  "Eethoek met ronde tafel, papieren hanglamp en kalkverf op de muur",
  "Kinderkamer met speelse hoogslaper en opbergbakken",
];

const KIND_LABEL: Record<ProjectImage["kind"], string> = {
  generated: "AI-ontwerp",
  restyle: "Restyle",
  upload: "Eigen foto",
  progress: "Voortgang",
  build: "Bouwresultaat",
};

export function ImagesTab({ project, onCover }: { project: Project; onCover: (path: string) => void }) {
  const user = useUser();
  const [images, setImages] = useState<ProjectImage[]>([]);
  const [urls, setUrls] = useState<Record<string, string>>({});
  const [mode, setMode] = useState<"new" | "restyle">("new");
  const [prompt, setPrompt] = useState("");
  const [sourcePath, setSourcePath] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [open, setOpen] = useState<ProjectImage | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const progressRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    supabase()
      .from("project_images")
      .select("*")
      .eq("project_id", project.id)
      .order("created_at", { ascending: false })
      .then(async ({ data }) => {
        const list = (data ?? []) as ProjectImage[];
        setImages(list);
        setUrls(await signedUrls(list.flatMap((i) => [i.path, i.source_path])));
      });
  }, [project.id]);

  async function addUpload(file: File, kind: "upload" | "progress") {
    setUploading(true);
    setError(null);
    try {
      const path = await uploadPhoto(user.id, project.id, file);
      const { data } = await supabase()
        .from("project_images")
        .insert({ project_id: project.id, kind, path })
        .select("*")
        .single();
      if (kind === "upload") {
        setSourcePath(path);
        setMode("restyle");
      }
      if (data) {
        const u = await signedUrls([path]);
        setUrls((m) => ({ ...m, ...u }));
        setImages((l) => [data as ProjectImage, ...l]);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Uploaden lukte niet.");
    } finally {
      setUploading(false);
    }
  }

  async function generate() {
    if (!prompt.trim()) return;
    if (mode === "restyle" && !sourcePath) {
      setError("Kies of upload eerst een foto van je kamer.");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const { image } = await postJson<{ image: ProjectImage }>(`/api/projects/${project.id}/images`, {
        prompt,
        sourcePath: mode === "restyle" ? sourcePath : null,
      });
      const u = await signedUrls([image.path, image.source_path]);
      setUrls((m) => ({ ...m, ...u }));
      setImages((l) => [image, ...l]);
      if (!project.cover_path) onCover(image.path);
      setOpen(image);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Er ging iets mis.");
    } finally {
      setBusy(false);
    }
  }

  async function remove(img: ProjectImage) {
    if (!confirm("Dit beeld verwijderen?")) return;
    await supabase().from("project_images").delete().eq("id", img.id);
    await supabase().storage.from(BUCKET).remove([img.path]);
    setImages((l) => l.filter((i) => i.id !== img.id));
    if (sourcePath === img.path) setSourcePath(null);
    setOpen(null);
  }

  const ownPhotos = images.filter((i) => i.kind === "upload" || i.kind === "progress" || i.kind === "restyle" || i.kind === "generated");

  return (
    <div className="grid gap-6 lg:grid-cols-[380px_1fr]">
      <section className="card h-fit p-4 sm:p-5 lg:sticky lg:top-32">
        <div className="grid grid-cols-2 gap-1 rounded-full bg-surface-2 p-1">
          {(["new", "restyle"] as const).map((m) => (
            <button
              key={m}
              onClick={() => setMode(m)}
              className={`rounded-full px-3 py-2 text-sm transition ${mode === m ? "bg-surface text-ink shadow-sm" : "text-ink-2"}`}
            >
              {m === "new" ? "Nieuw ontwerp" : "Mijn kamer restylen"}
            </button>
          ))}
        </div>

        {mode === "restyle" && (
          <div className="mt-4">
            <span className="label">Foto van je kamer</span>
            {sourcePath && urls[sourcePath] ? (
              <div className="relative overflow-hidden rounded-xl">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={urls[sourcePath]} alt="Gekozen foto" className="aspect-[4/3] w-full object-cover" />
                <button className="btn-outline absolute bottom-2 right-2 px-3 py-1.5 text-xs" onClick={() => setSourcePath(null)}>
                  Andere foto
                </button>
              </div>
            ) : (
              <>
                <button
                  className="flex aspect-[4/3] w-full flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed border-line text-ink-2 transition hover:border-accent hover:text-accent"
                  onClick={() => fileRef.current?.click()}
                  disabled={uploading}
                >
                  <Icon name={uploading ? "loader" : "camera"} size={28} />
                  <span className="text-sm">Maak of kies een foto</span>
                </button>
                {ownPhotos.length > 0 && (
                  <div className="no-scrollbar mt-2 flex gap-2 overflow-x-auto">
                    {ownPhotos.slice(0, 12).map((i) =>
                      urls[i.path] ? (
                        <button key={i.id} onClick={() => setSourcePath(i.path)} className="shrink-0 overflow-hidden rounded-lg" title="Gebruik deze foto">
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img src={urls[i.path]} alt="" className="h-14 w-14 object-cover" />
                        </button>
                      ) : null,
                    )}
                  </div>
                )}
              </>
            )}
            <input
              ref={fileRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) addUpload(f, "upload");
                e.target.value = "";
              }}
            />
          </div>
        )}

        <div className="mt-4">
          <label className="label" htmlFor="prompt">
            {mode === "new" ? "Beschrijf je droomkamer" : "Wat moet er veranderen?"}
          </label>
          <textarea
            id="prompt"
            rows={4}
            className="input resize-none"
            placeholder={
              mode === "new"
                ? "Bijvoorbeeld: rustige slaapkamer met linnen beddengoed, eiken nachtkastjes en een groene accentmuur"
                : "Bijvoorbeeld: maak er een japandi-woonkamer van met lichte houttinten, een lage bank en een rijstpapieren lamp"
            }
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
          />
          {mode === "new" && (
            <div className="no-scrollbar mt-2 flex gap-2 overflow-x-auto pb-1">
              {IDEAS.map((idea) => (
                <button key={idea} className="chip shrink-0 text-xs" onClick={() => setPrompt(idea)}>
                  {idea.split(" met ")[0]}
                </button>
              ))}
            </div>
          )}
        </div>

        <button className="btn-primary mt-4 w-full" onClick={generate} disabled={busy || !prompt.trim()}>
          {busy ? <Icon name="loader" size={18} /> : <Icon name="sparkles" size={18} />}
          {busy ? "Bezig met tekenen…" : mode === "new" ? "Maak beeld" : "Restyle mijn kamer"}
        </button>
        {busy && <p className="mt-2 text-center text-xs text-ink-3">Dit duurt meestal 10 tot 30 seconden.</p>}
        {error && <p className="mt-3 text-sm text-danger">{error}</p>}

        <div className="mt-5 border-t border-line pt-4">
          <button className="btn-outline w-full" onClick={() => progressRef.current?.click()} disabled={uploading}>
            <Icon name={uploading ? "loader" : "upload"} size={18} /> Voortgangsfoto toevoegen
          </button>
          <input
            ref={progressRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) addUpload(f, "progress");
              e.target.value = "";
            }}
          />
        </div>
      </section>

      <section>
        {busy && (
          <div className="mb-4 aspect-[4/3] w-full animate-pulse rounded-2xl bg-surface-2 sm:max-w-md" aria-label="Beeld wordt gemaakt" />
        )}
        {images.length === 0 && !busy ? (
          <div className="card flex flex-col items-center px-6 py-16 text-center text-ink-2">
            <Icon name="image" size={40} strokeWidth={1.2} className="text-ink-3" />
            <p className="mt-3 max-w-sm">Nog geen beelden. Beschrijf je droomkamer of upload een foto van je ruimte om te beginnen.</p>
          </div>
        ) : (
          <ul className="columns-2 gap-3 sm:columns-3">
            {images.map((img) =>
              urls[img.path] ? (
                <li key={img.id} className="mb-3 break-inside-avoid">
                  <button className="group relative block w-full overflow-hidden rounded-xl" onClick={() => setOpen(img)}>
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={urls[img.path]} alt={img.prompt ?? ""} className="w-full transition group-hover:scale-[1.02]" />
                    <span className="absolute left-2 top-2 rounded-full bg-surface/90 px-2 py-0.5 text-[11px] text-ink-2">
                      {KIND_LABEL[img.kind]}
                    </span>
                    {project.cover_path === img.path && (
                      <span className="absolute right-2 top-2 rounded-full bg-accent px-2 py-0.5 text-[11px] text-accent-ink">Omslag</span>
                    )}
                  </button>
                </li>
              ) : null,
            )}
          </ul>
        )}
      </section>

      {open && (
        <div className="fixed inset-0 z-50 flex flex-col bg-black/90 pt-[env(safe-area-inset-top)]" onClick={() => setOpen(null)}>
          <div className="flex items-center justify-end gap-1 p-2" onClick={(e) => e.stopPropagation()}>
            <button
              className="btn text-white/80 hover:bg-white/10"
              onClick={() => {
                setSourcePath(open.path);
                setMode("restyle");
                setPrompt("");
                setOpen(null);
              }}
            >
              <Icon name="wand" size={18} /> Verder bewerken
            </button>
            <button className="btn text-white/80 hover:bg-white/10" onClick={() => onCover(open.path)}>
              <Icon name="home" size={18} /> Als omslag
            </button>
            <a className="btn text-white/80 hover:bg-white/10" href={urls[open.path]} download target="_blank" rel="noreferrer" aria-label="Downloaden">
              <Icon name="download" size={18} />
            </a>
            <button className="btn text-white/80 hover:bg-white/10" onClick={() => remove(open)} aria-label="Verwijderen">
              <Icon name="trash" size={18} />
            </button>
            <button className="btn text-white/80 hover:bg-white/10" onClick={() => setOpen(null)} aria-label="Sluiten">
              <Icon name="x" size={20} />
            </button>
          </div>
          <div className="flex min-h-0 flex-1 items-center justify-center p-3" onClick={(e) => e.stopPropagation()}>
            {open.source_path && urls[open.source_path] ? (
              <BeforeAfter before={urls[open.source_path]} after={urls[open.path]} />
            ) : (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={urls[open.path]} alt={open.prompt ?? ""} className="max-h-full max-w-full rounded-lg object-contain" />
            )}
          </div>
          {open.prompt && (
            <p className="mx-auto max-w-2xl px-4 pb-[max(1rem,env(safe-area-inset-bottom))] text-center text-sm text-white/70" onClick={(e) => e.stopPropagation()}>
              {open.prompt}
            </p>
          )}
        </div>
      )}
    </div>
  );
}
