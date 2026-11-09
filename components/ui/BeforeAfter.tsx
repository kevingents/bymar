"use client";

import { useRef, useState } from "react";
import { Icon } from "./Icon";

/** Voor/na-schuif: sleep de lijn om de oude en nieuwe kamer te vergelijken. */
export function BeforeAfter({
  before,
  after,
  fill = false,
  className = "",
  start = 50,
}: {
  before: string;
  after: string;
  /** Vult de container (bijv. op de startpagina) in plaats van de beeldmaat te volgen. */
  fill?: boolean;
  className?: string;
  start?: number;
}) {
  const [pos, setPos] = useState(start);
  const box = useRef<HTMLDivElement>(null);

  function move(clientX: number) {
    const r = box.current?.getBoundingClientRect();
    if (!r) return;
    setPos(Math.min(100, Math.max(0, ((clientX - r.left) / r.width) * 100)));
  }

  return (
    <div
      ref={box}
      className={`relative touch-none select-none overflow-hidden ${fill ? "h-full w-full cursor-ew-resize" : "max-h-full max-w-full rounded-lg"} ${className}`}
      onPointerDown={(e) => {
        (e.target as HTMLElement).setPointerCapture?.(e.pointerId);
        move(e.clientX);
      }}
      onPointerMove={(e) => e.buttons && move(e.clientX)}
    >
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={after}
        alt="Na"
        className={fill ? "absolute inset-0 h-full w-full object-cover" : "block max-h-[78dvh] w-auto max-w-full object-contain"}
        draggable={false}
      />
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={before}
        alt="Voor"
        className="absolute inset-0 h-full w-full object-cover"
        style={{ clipPath: `inset(0 ${100 - pos}% 0 0)` }}
        draggable={false}
      />
      <div className="pointer-events-none absolute inset-y-0" style={{ left: `${pos}%` }}>
        <div className="h-full w-0.5 -translate-x-1/2 bg-white shadow" />
        <div className="absolute top-1/2 grid h-9 w-9 -translate-x-1/2 -translate-y-1/2 place-items-center rounded-full bg-white text-black shadow">
          <Icon name="swap" size={18} />
        </div>
      </div>
      <span className="absolute left-3 top-3 rounded-full bg-black/60 px-2.5 py-1 text-xs text-white backdrop-blur">Voor</span>
      <span className="absolute right-3 top-3 rounded-full bg-black/60 px-2.5 py-1 text-xs text-white backdrop-blur">Na</span>
    </div>
  );
}
