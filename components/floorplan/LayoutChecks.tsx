"use client";

import type { Check } from "@/lib/indeling";
import { Icon } from "@/components/ui/Icon";

/** Meldingen over de indeling: rood = echt een probleem, olijf = tip. */
export function LayoutChecks({ checks, onPick, empty = true }: { checks: Check[]; onPick?: (id: string) => void; empty?: boolean }) {
  if (checks.length === 0) {
    if (!empty) return null;
    return (
      <p className="flex gap-2 rounded-xl bg-olive-soft p-3 text-sm">
        <Icon name="check" size={16} className="mt-0.5 shrink-0 text-olive" /> Alles heeft genoeg ruimte: geen botsingen, deuren gaan vrij open.
      </p>
    );
  }
  return (
    <ul className="space-y-1.5">
      {checks.map((c) => (
        <li key={c.text}>
          <button
            className={`flex w-full gap-2 rounded-xl p-2.5 text-left text-sm ${c.level === "warn" ? "bg-accent-soft" : "bg-olive-soft"}`}
            onClick={() => c.ids[0] && onPick?.(c.ids[0])}
          >
            <Icon name={c.level === "warn" ? "warning" : "info"} size={16} className={`mt-0.5 shrink-0 ${c.level === "warn" ? "text-danger" : "text-olive"}`} />
            <span>{c.text}</span>
          </button>
        </li>
      ))}
    </ul>
  );
}
