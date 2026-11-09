"use client";

import { useState } from "react";
import { ROOM_TYPES, STYLES, type Project } from "@/lib/types";
import { Icon } from "@/components/ui/Icon";
import { RoomScene } from "@/components/visual/RoomScene";
import { LOOKS } from "@/lib/styles";

export type ProjectFields = Pick<Project, "title" | "room_type" | "style" | "budget" | "description">;

export function ProjectForm({
  initial,
  submitLabel,
  onSubmit,
  onCancel,
}: {
  initial?: Partial<ProjectFields>;
  submitLabel: string;
  onSubmit: (v: ProjectFields) => Promise<void>;
  onCancel?: () => void;
}) {
  const [title, setTitle] = useState(initial?.title ?? "");
  const [roomType, setRoomType] = useState(initial?.room_type ?? "");
  const [style, setStyle] = useState(initial?.style ?? "");
  const [budget, setBudget] = useState(initial?.budget != null ? String(initial.budget) : "");
  const [description, setDescription] = useState(initial?.description ?? "");
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    try {
      await onSubmit({
        title: title.trim(),
        room_type: roomType || null,
        style: style || null,
        budget: budget ? Number(budget) : null,
        description: description.trim() || null,
      });
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={submit} className="space-y-6">
      <div>
        <label className="label" htmlFor="title">
          Naam van het project
        </label>
        <input
          id="title"
          required
          className="input text-lg"
          placeholder="Bijvoorbeeld: Slaapkamer rustiger maken"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
        />
      </div>

      <div>
        <span className="label">Welke ruimte</span>
        <div className="flex flex-wrap gap-2">
          {ROOM_TYPES.map((r) => (
            <button type="button" key={r} className="chip" data-on={roomType === r} onClick={() => setRoomType(roomType === r ? "" : r)}>
              {r}
            </button>
          ))}
        </div>
      </div>

      <div>
        <span className="label">Stijl</span>
        <div className="no-scrollbar -mx-1 flex snap-x gap-2.5 overflow-x-auto px-1 pb-2 sm:grid sm:grid-cols-4 sm:overflow-visible">
          {STYLES.map((s) => {
            const on = style === s;
            return (
              <button
                type="button"
                key={s}
                onClick={() => setStyle(on ? "" : s)}
                aria-pressed={on}
                className={`group w-36 shrink-0 snap-start overflow-hidden rounded-2xl border text-left transition sm:w-auto ${
                  on ? "border-accent ring-2 ring-accent/30" : "border-line hover:border-ink-3"
                }`}
              >
                <span className="relative block aspect-[4/3] overflow-hidden">
                  <RoomScene style={s} className="h-full w-full transition duration-500 group-hover:scale-105" />
                  {on && (
                    <span className="absolute right-2 top-2 grid h-6 w-6 place-items-center rounded-full bg-accent text-accent-ink">
                      <Icon name="check" size={14} strokeWidth={2.4} />
                    </span>
                  )}
                </span>
                <span className="block px-2.5 py-2">
                  <span className="block text-sm font-medium">{s}</span>
                  <span className="block truncate text-xs text-ink-3">{LOOKS[s]?.tagline}</span>
                </span>
              </button>
            );
          })}
        </div>
        <input
          className="input mt-2"
          placeholder="Of beschrijf je eigen stijl"
          value={STYLES.includes(style) ? "" : style}
          onChange={(e) => setStyle(e.target.value)}
        />
      </div>

      <div className="grid gap-4 sm:grid-cols-[180px_1fr]">
        <div>
          <label className="label" htmlFor="budget">
            Budget (euro)
          </label>
          <input
            id="budget"
            inputMode="numeric"
            className="input"
            placeholder="1500"
            value={budget}
            onChange={(e) => setBudget(e.target.value.replace(/[^\d]/g, ""))}
          />
        </div>
        <div>
          <label className="label" htmlFor="desc">
            Wat wil je bereiken?
          </label>
          <textarea
            id="desc"
            rows={3}
            className="input resize-none"
            placeholder="Bijvoorbeeld: meer opbergruimte, warme sfeer, kast voor de nis naast de schoorsteen"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
          />
        </div>
      </div>

      <div className="flex gap-2">
        <button className="btn-primary" disabled={busy || !title.trim()}>
          {busy ? <Icon name="loader" size={18} /> : <Icon name="check" size={18} />}
          {submitLabel}
        </button>
        {onCancel && (
          <button type="button" className="btn-ghost" onClick={onCancel}>
            Annuleren
          </button>
        )}
      </div>
    </form>
  );
}
