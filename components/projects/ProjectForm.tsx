"use client";

import { useState } from "react";
import { ROOM_TYPES, STYLES, type Project } from "@/lib/types";
import { Icon } from "@/components/ui/Icon";

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
        <div className="flex flex-wrap gap-2">
          {STYLES.map((s) => (
            <button type="button" key={s} className="chip" data-on={style === s} onClick={() => setStyle(style === s ? "" : s)}>
              {s}
            </button>
          ))}
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
