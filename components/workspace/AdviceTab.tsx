"use client";

import { useEffect, useRef, useState } from "react";
import { uploadPhoto } from "@/lib/client-api";
import { signedUrls, supabase } from "@/lib/supabase/client";
import type { ChatMessage, Project } from "@/lib/types";
import { Icon } from "@/components/ui/Icon";
import { Markdown } from "@/components/ui/Markdown";
import { useUser } from "@/components/auth/AuthGate";

const STARTERS = [
  "Welke kleuren passen bij deze stijl, en welke verf kan ik kopen?",
  "Hoe richt ik deze ruimte in zodat hij groter lijkt?",
  "Wat kan ik binnen mijn budget het beste eerst aanpakken?",
  "Welke verlichting heb ik nodig voor een warme sfeer?",
];

type Local = Pick<ChatMessage, "id" | "role" | "content" | "image_path">;

export function AdviceTab({ project }: { project: Project }) {
  const user = useUser();
  const [messages, setMessages] = useState<Local[]>([]);
  const [urls, setUrls] = useState<Record<string, string>>({});
  const [input, setInput] = useState("");
  const [imagePath, setImagePath] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const endRef = useRef<HTMLDivElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    supabase()
      .from("messages")
      .select("*")
      .eq("project_id", project.id)
      .order("created_at")
      .then(async ({ data }) => {
        const list = (data ?? []) as ChatMessage[];
        setMessages(list);
        setUrls(await signedUrls(list.map((m) => m.image_path)));
      });
  }, [project.id]);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [messages]);

  async function send(text: string) {
    const content = text.trim();
    if (!content || busy) return;
    setBusy(true);
    setError(null);
    setInput("");
    const attached = imagePath;
    setImagePath(null);
    const answerId = crypto.randomUUID();
    setMessages((m) => [
      ...m,
      { id: crypto.randomUUID(), role: "user", content, image_path: attached },
      { id: answerId, role: "assistant", content: "", image_path: null },
    ]);

    try {
      const res = await fetch(`/api/projects/${project.id}/chat`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: content, imagePath: attached }),
      });
      if (!res.ok || !res.body) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error ?? "Het advies kon niet worden opgehaald.");
      }
      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let acc = "";
      for (;;) {
        const { done, value } = await reader.read();
        if (done) break;
        acc += decoder.decode(value, { stream: true });
        setMessages((m) => m.map((x) => (x.id === answerId ? { ...x, content: acc } : x)));
      }
      if (!acc.trim()) throw new Error("Geen antwoord ontvangen. Probeer het nog eens.");
    } catch (e) {
      setMessages((m) => m.filter((x) => x.id !== answerId));
      setError(e instanceof Error ? e.message : "Er ging iets mis.");
    } finally {
      setBusy(false);
    }
  }

  async function attach(file: File) {
    setUploading(true);
    try {
      const path = await uploadPhoto(user.id, project.id, file);
      const u = await signedUrls([path]);
      setUrls((m) => ({ ...m, ...u }));
      setImagePath(path);
    } catch {
      setError("Foto uploaden lukte niet.");
    } finally {
      setUploading(false);
    }
  }

  return (
    <div className="mx-auto flex max-w-3xl flex-col">
      {messages.length === 0 && (
        <div className="card p-5">
          <h2 className="font-display text-xl">Vraag het maar</h2>
          <p className="mt-1 text-sm text-ink-2">
            Je adviseur kent je project, stijl, budget en plattegrond. Voeg een foto toe en vraag wat er beter kan.
          </p>
          <div className="mt-4 grid gap-2 sm:grid-cols-2">
            {STARTERS.map((s) => (
              <button key={s} className="rounded-xl border border-line p-3 text-left text-sm text-ink-2 transition hover:border-accent hover:text-ink" onClick={() => send(s)}>
                {s}
              </button>
            ))}
          </div>
        </div>
      )}

      <ul className="space-y-4 pb-36">
        {messages.map((m) => (
          <li key={m.id} className={m.role === "user" ? "flex justify-end" : ""}>
            {m.role === "user" ? (
              <div className="max-w-[85%] rounded-2xl rounded-br-md bg-ink px-4 py-2.5 text-[15px] text-bg">
                {m.image_path && urls[m.image_path] && (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={urls[m.image_path]} alt="" className="mb-2 max-h-56 rounded-lg" />
                )}
                <p className="whitespace-pre-wrap">{m.content}</p>
              </div>
            ) : (
              <div className="flex gap-3">
                <span className="mt-1 grid h-8 w-8 shrink-0 place-items-center rounded-full bg-accent-soft text-accent">
                  <Icon name="sparkles" size={16} />
                </span>
                <div className="min-w-0 flex-1 text-ink">
                  {m.content ? <Markdown text={m.content} /> : <Icon name="loader" size={18} className="mt-2 text-ink-3" />}
                </div>
              </div>
            )}
          </li>
        ))}
        <div ref={endRef} />
      </ul>

      <form
        onSubmit={(e) => {
          e.preventDefault();
          send(input);
        }}
        className="fixed inset-x-0 bottom-0 z-20 border-t border-line bg-bg/95 px-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] pt-3 backdrop-blur"
      >
        <div className="mx-auto max-w-3xl">
          {error && <p className="mb-2 text-sm text-danger">{error}</p>}
          {imagePath && urls[imagePath] && (
            <div className="relative mb-2 inline-block">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={urls[imagePath]} alt="Bijlage" className="h-16 rounded-lg" />
              <button type="button" className="absolute -right-2 -top-2 grid h-6 w-6 place-items-center rounded-full bg-ink text-bg" onClick={() => setImagePath(null)} aria-label="Foto weghalen">
                <Icon name="x" size={14} />
              </button>
            </div>
          )}
          <div className="flex items-end gap-2">
            <button type="button" className="btn-outline h-11 w-11 shrink-0 p-0" onClick={() => fileRef.current?.click()} disabled={uploading} aria-label="Foto toevoegen">
              <Icon name={uploading ? "loader" : "camera"} size={20} />
            </button>
            <textarea
              rows={1}
              className="input max-h-40 min-h-11 flex-1 resize-none"
              placeholder="Stel een vraag over je interieur…"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  send(input);
                }
              }}
            />
            <button className="btn-primary h-11 w-11 shrink-0 p-0" disabled={busy || !input.trim()} aria-label="Versturen">
              <Icon name={busy ? "loader" : "send"} size={20} />
            </button>
          </div>
          <input
            ref={fileRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) attach(f);
              e.target.value = "";
            }}
          />
        </div>
      </form>
    </div>
  );
}
