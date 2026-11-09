"use client";

import Link from "next/link";
import { useState } from "react";
import { Icon } from "@/components/ui/Icon";
import { SpiritLevel } from "./SpiritLevel";
import { CameraTool } from "./CameraTool";

/** Klusgereedschap in je telefoon: waterpas en meten met een A4'tje. */
export function ToolsPage() {
  const [tab, setTab] = useState<"waterpas" | "meten">("waterpas");
  const [measuring, setMeasuring] = useState(false);
  const [results, setResults] = useState<number[]>([]);

  return (
    <main className="mx-auto max-w-lg px-4 pb-16 pt-[max(1rem,env(safe-area-inset-top))]">
      <Link href="/projecten" className="btn-ghost -ml-3 mt-2">
        <Icon name="arrow-left" size={18} /> Projecten
      </Link>
      <h1 className="mt-3 font-display text-3xl tracking-tight">Gereedschap</h1>
      <p className="mt-1 text-sm text-ink-2">Handig bij het klussen, gewoon in je telefoon.</p>

      <div className="mt-5 grid grid-cols-2 gap-1 rounded-full bg-surface-2 p-1 text-sm">
        {(["waterpas", "meten"] as const).map((t) => (
          <button key={t} onClick={() => setTab(t)} className={`rounded-full px-3 py-2 ${tab === t ? "bg-surface shadow-sm" : "text-ink-2"}`}>
            {t === "waterpas" ? "Waterpas" : "Meten met A4"}
          </button>
        ))}
      </div>

      <div className="mt-4">
        {tab === "waterpas" ? (
          <SpiritLevel />
        ) : (
          <div className="card p-5">
            <h2 className="font-display text-2xl">Meten met een A4&apos;tje</h2>
            <ol className="mt-3 space-y-2 text-sm text-ink-2">
              <li>1. Plak of leg een A4&apos;tje plat tegen de muur, de vloer of de plank die je wilt meten.</li>
              <li>2. Maak de foto recht ervoor; bevries het beeld als je wilt.</li>
              <li>3. Tik de vier hoeken van het A4&apos;tje aan, met de klok mee.</li>
              <li>4. Tik twee punten aan: je ziet de afstand in centimeters.</li>
            </ol>
            <p className="mt-3 text-xs text-ink-3">Werkt nauwkeurig op hetzelfde vlak als het papier. Hoe groter het papier in beeld, hoe preciezer.</p>
            <button className="btn-primary mt-4" onClick={() => setMeasuring(true)}>
              <Icon name="camera" size={18} /> Start meten
            </button>
            {results.length > 0 && (
              <ul className="mt-4 space-y-1 text-sm">
                {results.map((r, i) => (
                  <li key={i} className="flex justify-between rounded-lg bg-surface-2 px-3 py-1.5">
                    <span>Meting {results.length - i}</span>
                    <span className="font-medium tabular-nums">{r.toLocaleString("nl-NL")} cm</span>
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}
      </div>

      {measuring && (
        <CameraTool
          mode="measure"
          onClose={() => setMeasuring(false)}
          onMeasured={(cm) => {
            setResults((r) => [cm, ...r]);
            setMeasuring(false);
          }}
        />
      )}
    </main>
  );
}
