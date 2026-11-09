"use client";

import { useEffect, useRef, useState } from "react";
import { Icon } from "@/components/ui/Icon";

type Orientation = { beta: number; gamma: number };
type PermissionApi = { requestPermission?: () => Promise<"granted" | "denied"> };

const LEVEL = 0.5; // graden waarbinnen het "waterpas" is

function readOffset(): Orientation {
  try {
    return JSON.parse(localStorage.getItem("huisraad-waterpas") ?? "") as Orientation;
  } catch {
    return { beta: 0, gamma: 0 };
  }
}

/** Waterpas met de bewegingssensor van de telefoon: plat (bel) of op de lange kant (lat). */
export function SpiritLevel() {
  const [state, setState] = useState<"idle" | "on" | "denied" | "unsupported">("idle");
  const [o, setO] = useState<Orientation>({ beta: 0, gamma: 0 });
  const [offset, setOffset] = useState<Orientation>({ beta: 0, gamma: 0 });
  const wasLevel = useRef(false);

  useEffect(() => {
    if (state !== "on") return;
    const onMove = (e: DeviceOrientationEvent) => setO({ beta: e.beta ?? 0, gamma: e.gamma ?? 0 });
    window.addEventListener("deviceorientation", onMove);
    return () => window.removeEventListener("deviceorientation", onMove);
  }, [state]);

  async function start() {
    if (typeof window === "undefined" || !("DeviceOrientationEvent" in window)) {
      setState("unsupported");
      return;
    }
    const api = DeviceOrientationEvent as unknown as PermissionApi;
    if (typeof api.requestPermission === "function") {
      try {
        if ((await api.requestPermission()) !== "granted") {
          setState("denied");
          return;
        }
      } catch {
        setState("denied");
        return;
      }
    }
    setOffset(readOffset());
    setState("on");
  }

  // plat: beta en gamma rond 0; op de kant: beta rond ±90, dan meet gamma de helling langs de lat
  const beta = o.beta - offset.beta;
  const gamma = o.gamma - offset.gamma;
  const onEdge = Math.abs(o.beta) > 55;
  const angle = onEdge ? gamma : Math.hypot(beta, gamma);
  const level = Math.abs(angle) < LEVEL;

  useEffect(() => {
    if (state !== "on") return;
    if (level && !wasLevel.current) navigator.vibrate?.(40);
    wasLevel.current = level;
  }, [level, state]);

  function calibrate() {
    const next = { beta: onEdge ? 0 : o.beta, gamma: o.gamma };
    setOffset(next);
    try {
      localStorage.setItem("huisraad-waterpas", JSON.stringify(next));
    } catch {
      /* geen opslag */
    }
  }

  if (state !== "on")
    return (
      <div className="card p-6 text-center">
        <span className="mx-auto grid h-14 w-14 place-items-center rounded-2xl bg-accent-soft text-accent">
          <Icon name="ruler" size={28} />
        </span>
        <h2 className="mt-3 font-display text-2xl">Waterpas</h2>
        <p className="mx-auto mt-1 max-w-sm text-sm text-ink-2">
          Leg je telefoon plat op een plank, of zet hem op de lange kant tegen een lat of de muur.
        </p>
        {state === "denied" && <p className="mt-3 text-sm text-danger">Geen toegang tot de bewegingssensor. Sta het toe in je browser en probeer opnieuw.</p>}
        {state === "unsupported" && <p className="mt-3 text-sm text-danger">Dit apparaat heeft geen bewegingssensor; gebruik je telefoon.</p>}
        <button className="btn-primary mt-4" onClick={start}>
          <Icon name="arrow-right" size={18} /> Start waterpas
        </button>
      </div>
    );

  const clamp = (v: number) => Math.max(-1, Math.min(1, v / 10));
  return (
    <div className={`card overflow-hidden p-5 text-center transition-colors ${level ? "bg-olive-soft" : ""}`}>
      <p className={`font-display text-6xl tabular-nums ${level ? "text-olive" : "text-ink"}`}>
        {Math.abs(angle).toFixed(1)}°
      </p>
      <p className="mt-1 text-sm text-ink-2">{level ? "Waterpas" : onEdge ? (gamma > 0 ? "Rechts te hoog" : "Links te hoog") : "Kantel tot de bel in het midden staat"}</p>

      {onEdge ? (
        <div className="relative mx-auto mt-6 h-14 w-full max-w-sm rounded-full bg-surface-2 ring-1 ring-line">
          <div className="absolute inset-y-2 left-1/2 w-16 -translate-x-1/2 rounded-full border-2 border-ink-3/50" />
          <div
            className={`absolute top-1/2 h-10 w-10 -translate-x-1/2 -translate-y-1/2 rounded-full shadow transition-[left] duration-75 ${level ? "bg-olive" : "bg-accent"}`}
            style={{ left: `${50 - clamp(gamma) * 45}%` }}
          />
        </div>
      ) : (
        <div className="relative mx-auto mt-6 aspect-square w-60 rounded-full bg-surface-2 ring-1 ring-line">
          <div className="absolute left-1/2 top-1/2 h-16 w-16 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-ink-3/50" />
          <div className="absolute left-1/2 top-0 h-full w-px bg-line" />
          <div className="absolute left-0 top-1/2 h-px w-full bg-line" />
          <div
            className={`absolute h-12 w-12 -translate-x-1/2 -translate-y-1/2 rounded-full shadow transition-all duration-75 ${level ? "bg-olive" : "bg-accent"}`}
            style={{ left: `${50 - clamp(gamma) * 42}%`, top: `${50 - clamp(beta) * 42}%` }}
          />
        </div>
      )}

      <div className="mt-5 flex justify-center gap-2">
        <button className="btn-outline" onClick={calibrate}>
          <Icon name="rotate" size={16} /> Kalibreren
        </button>
      </div>
      <p className="mt-2 text-xs text-ink-3">Kalibreren: leg de telefoon op iets wat zeker waterpas is en tik op de knop.</p>
    </div>
  );
}
