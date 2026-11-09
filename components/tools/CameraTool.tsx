"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import type { DrillPlan } from "@/lib/schemas";
import { apply, dist, homography, type Pt } from "@/lib/homography";
import { Icon } from "@/components/ui/Icon";

type Part = DrillPlan["parts"][number];

const BOARD_STEPS = [
  "Tik de hoek 0,0 aan: voorkant, linker uiteinde (onderkant bij staande delen)",
  "Tik de voorkant aan het andere uiteinde aan",
  "Tik de achterkant aan dat uiteinde aan",
  "Tik de achterkant aan het begin aan",
];
const A4_STEPS = ["Tik hoek 1 van het A4'tje aan", "Tik de volgende hoek aan (met de klok mee)", "Tik de derde hoek aan", "Tik de laatste hoek aan"];

const COLORS: Record<string, string> = {
  schroef: "#ff7a45",
  voorboren: "#ffb020",
  deuvel: "#9be15d",
  scharnier: "#4fc3f7",
  plankdrager: "#ffffff",
  ophang: "#ff5c8a",
  greep: "#c084fc",
};

/**
 * Camera met overlay.
 * - "board": tik de vier hoeken van een plank aan; de gaten uit het boorplan verschijnen op het beeld.
 * - "measure": tik de hoeken van een A4'tje aan; daarna meet je afstanden op hetzelfde vlak.
 */
export function CameraTool({ mode, part, onClose, onMeasured }: { mode: "board" | "measure"; part?: Part; onClose: () => void; onMeasured?: (cm: number) => void }) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const boxRef = useRef<HTMLDivElement>(null);
  const [error, setError] = useState<string | null>(null);
  const [corners, setCorners] = useState<Pt[]>([]);
  const [points, setPoints] = useState<Pt[]>([]);
  const [frozen, setFrozen] = useState(false);
  const [drag, setDrag] = useState<number | null>(null);
  const [picked, setPicked] = useState<number | null>(null);

  // pagina eronder niet laten meescrollen
  useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, []);

  useEffect(() => {
    let stream: MediaStream | null = null;
    navigator.mediaDevices
      ?.getUserMedia({ video: { facingMode: { ideal: "environment" }, width: { ideal: 1920 } }, audio: false })
      .then((s) => {
        stream = s;
        if (videoRef.current) {
          videoRef.current.srcObject = s;
          videoRef.current.play().catch(() => {});
        }
      })
      .catch(() => setError("Geen toegang tot de camera. Sta de camera toe in je browser."));
    if (!navigator.mediaDevices) setError("Deze browser kan de camera niet gebruiken.");
    return () => stream?.getTracks().forEach((t) => t.stop());
  }, []);

  function toggleFreeze() {
    const v = videoRef.current;
    if (!v) return;
    if (frozen) v.play().catch(() => {});
    else v.pause();
    setFrozen(!frozen);
  }

  // board: plank-mm → scherm; measure: scherm → A4-mm
  const H = useMemo(() => {
    if (corners.length < 4) return null;
    try {
      if (mode === "board" && part) {
        const src = [
          { x: 0, y: 0 },
          { x: part.length, y: 0 },
          { x: part.length, y: part.width },
          { x: 0, y: part.width },
        ];
        return homography(src, corners);
      }
      const longFirst = dist(corners[0], corners[1]) >= dist(corners[1], corners[2]);
      const [a, b] = longFirst ? [297, 210] : [210, 297];
      return homography(corners, [
        { x: 0, y: 0 },
        { x: a, y: 0 },
        { x: a, y: b },
        { x: 0, y: b },
      ]);
    } catch {
      return null;
    }
  }, [corners, mode, part]);

  function local(e: React.PointerEvent) {
    const r = boxRef.current!.getBoundingClientRect();
    return { x: e.clientX - r.left, y: e.clientY - r.top };
  }

  function tap(e: React.PointerEvent) {
    const p = local(e);
    // hoek verslepen als je dichtbij een bestaande hoek tikt
    const near = corners.findIndex((c) => dist(c, p) < 28);
    if (near >= 0) {
      setDrag(near);
      (e.currentTarget as Element).setPointerCapture?.(e.pointerId);
      return;
    }
    if (corners.length < 4) setCorners((c) => [...c, p]);
    else if (mode === "measure") setPoints((l) => (l.length >= 2 ? [p] : [...l, p]));
    else if (mode === "board" && H && part) {
      // dichtstbijzijnde gat aanwijzen
      let best = -1;
      let bestD = 30;
      part.holes.forEach((h, i) => {
        const q = apply(H, { x: h.x, y: h.y });
        const dd = dist(q, p);
        if (dd < bestD) {
          bestD = dd;
          best = i;
        }
      });
      setPicked(best >= 0 ? best : null);
    }
  }



  const measuredCm =
    mode === "measure" && H && points.length === 2 ? dist(apply(H, points[0]), apply(H, points[1])) / 10 : null;

  const steps = mode === "board" ? BOARD_STEPS : A4_STEPS;
  const instruction =
    corners.length < 4
      ? steps[corners.length]
      : mode === "board"
        ? "Klaar. Houd de telefoon stil en zet bij elk puntje een kruisje. Hoeken bijstellen? Sleep ze."
        : points.length < 2
          ? "Tik nu twee punten aan die je wilt meten (op hetzelfde vlak als het A4'tje)."
          : "Tik opnieuw om een nieuwe meting te starten.";

  return (
    <div className="fixed inset-0 z-[60] flex flex-col bg-black text-white">
      <div className="flex items-center gap-2 p-2 pt-[max(0.5rem,env(safe-area-inset-top))]">
        <button className="btn px-2.5 text-white/90 hover:bg-white/10" onClick={onClose} aria-label="Sluiten">
          <Icon name="x" size={22} />
        </button>
        <p className="min-w-0 flex-1 text-sm leading-snug">{instruction}</p>
      </div>

      <div
        ref={boxRef}
        className="relative min-h-0 flex-1 touch-none select-none overflow-hidden"
        onPointerDown={tap}
        onPointerMove={(e) => {
          if (drag === null) return;
          const p = local(e);
          setCorners((c) => c.map((q, i) => (i === drag ? p : q)));
        }}
        onPointerUp={() => setDrag(null)}
      >
        <video ref={videoRef} playsInline muted className="absolute inset-0 h-full w-full object-cover" />
        <svg className="absolute inset-0 h-full w-full">
          {/* contour */}
          {corners.length > 1 && (
            <polygon points={corners.map((c) => `${c.x},${c.y}`).join(" ")} fill={H ? "rgba(255,255,255,0.08)" : "none"} stroke="#fff" strokeWidth={2} />
          )}
          {/* hulplijnen en gaten op de plank */}
          {mode === "board" &&
            H &&
            part &&
            (() => {
              const xs = [...new Set(part.holes.map((h) => Math.round(h.x)))];
              const ys = [...new Set(part.holes.map((h) => Math.round(h.y)))];
              const line = (a: Pt, b: Pt, k: string) => {
                const p = apply(H, a);
                const q = apply(H, b);
                return <line key={k} x1={p.x} y1={p.y} x2={q.x} y2={q.y} stroke="rgba(255,255,255,0.45)" strokeDasharray="5 5" />;
              };
              return (
                <g>
                  {xs.map((x) => line({ x, y: 0 }, { x, y: part.width }, `x${x}`))}
                  {ys.map((y) => line({ x: 0, y }, { x: part.length, y }, `y${y}`))}
                  {part.holes.map((h, i) => {
                    const p = apply(H, { x: h.x, y: h.y });
                    const q = apply(H, { x: h.x + h.diameter / 2, y: h.y });
                    const r = Math.max(3, Math.min(14, dist(p, q)));
                    const c = COLORS[h.type] ?? "#fff";
                    const on = picked === i;
                    return (
                      <g key={i}>
                        <circle cx={p.x} cy={p.y} r={r + 1.5} fill="none" stroke="#000" strokeWidth={3} opacity={0.55} />
                        <circle cx={p.x} cy={p.y} r={r} fill={on ? c : "none"} fillOpacity={0.35} stroke={c} strokeWidth={on ? 3 : 2} />
                        <path
                          d={`M${p.x - r - 5} ${p.y}H${p.x + r + 5}M${p.x} ${p.y - r - 5}V${p.y + r + 5}`}
                          stroke={c}
                          strokeWidth={on ? 2 : 1.2}
                        />
                        {on && (
                          <text x={p.x + r + 8} y={p.y - r - 6} fontSize={15} fontWeight={700} fill="#fff" stroke="#000" strokeWidth={4} paintOrder="stroke">
                            {Math.round(h.x)} / {Math.round(h.y)}
                          </text>
                        )}
                      </g>
                    );
                  })}
                </g>
              );
            })()}
          {/* meetlijn */}
          {mode === "measure" && points.length > 0 && (
            <g>
              {points.length === 2 && <line x1={points[0].x} y1={points[0].y} x2={points[1].x} y2={points[1].y} stroke="#ffb020" strokeWidth={3} />}
              {points.map((p, i) => (
                <circle key={i} cx={p.x} cy={p.y} r={7} fill="#ffb020" stroke="#000" strokeWidth={2} />
              ))}
              {measuredCm !== null && (
                <text
                  x={(points[0].x + points[1].x) / 2}
                  y={(points[0].y + points[1].y) / 2 - 14}
                  textAnchor="middle"
                  fontSize={22}
                  fontWeight={700}
                  fill="#fff"
                  stroke="#000"
                  strokeWidth={4}
                  paintOrder="stroke"
                >
                  {measuredCm.toLocaleString("nl-NL", { maximumFractionDigits: 1 })} cm
                </text>
              )}
            </g>
          )}
          {/* hoeken */}
          {corners.map((c, i) => (
            <g key={i}>
              <circle cx={c.x} cy={c.y} r={14} fill="rgba(164,89,59,0.85)" stroke="#fff" strokeWidth={2} />
              <text x={c.x} y={c.y + 4} textAnchor="middle" fontSize={12} fontWeight={700} fill="#fff">
                {mode === "board" && i === 0 ? "0" : i + 1}
              </text>
            </g>
          ))}
        </svg>
        {error && <p className="absolute inset-x-4 top-4 rounded-xl bg-black/70 p-3 text-sm">{error}</p>}
      </div>

      <div className="flex flex-wrap items-center justify-center gap-2 p-3 pb-[max(0.75rem,env(safe-area-inset-bottom))]">
        <button className="btn rounded-full bg-white/15 px-4 text-white" onClick={toggleFreeze}>
          <Icon name={frozen ? "camera" : "eye"} size={16} /> {frozen ? "Live" : "Bevries beeld"}
        </button>
        <button
          className="btn rounded-full bg-white/15 px-4 text-white"
          onClick={() => {
            setCorners([]);
            setPoints([]);
          }}
        >
          <Icon name="rotate" size={16} /> Opnieuw
        </button>
        {measuredCm !== null && onMeasured && (
          <button className="btn-primary" onClick={() => onMeasured(Math.round(measuredCm * 10) / 10)}>
            <Icon name="check" size={16} /> Gebruik {measuredCm.toLocaleString("nl-NL", { maximumFractionDigits: 1 })} cm
          </button>
        )}
        {mode === "board" && part && picked !== null && part.holes[picked] && (
          <p className="w-full rounded-xl bg-white/10 px-3 py-2 text-center text-sm">
            <strong>x {Math.round(part.holes[picked].x)} mm</strong> vanaf hoek 0 ·{" "}
            <strong>y {Math.round(part.holes[picked].y)} mm</strong> vanaf de voorkant · {part.holes[picked].type} Ø{part.holes[picked].diameter} mm,{" "}
            {part.holes[picked].depth ? `${part.holes[picked].depth} mm diep` : "door en door"}
          </p>
        )}
        {mode === "board" && part && (
          <p className="w-full text-center text-xs text-white/70">
            {part.part}: {part.length} × {part.width} mm · tik een gaatje aan voor de maten
          </p>
        )}
      </div>
    </div>
  );
}
