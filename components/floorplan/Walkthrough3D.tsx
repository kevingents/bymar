"use client";

import { OrbitControls } from "@react-three/drei";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import * as THREE from "three";
import type { FloorItem, Floorplan } from "@/lib/schemas";
import {
  DOOR_HEIGHT,
  WALL_THICKNESS,
  WINDOW_HEIGHT,
  WINDOW_SILL,
  bounds,
  centroid,
  floorColor,
  footprint,
  edgeNormal,
  roomEdges,
  roomPoints,
  slopeRun,
  wallSegments,
  type WallSegment,
} from "@/lib/floorplan";
import { Icon, type IconName } from "@/components/ui/Icon";
import { compass, sunLabel, sunPosition } from "@/lib/zon";

export type Sun = { month: number; hour: number };

/** Plattegrond is in cm; 3D in meters. Plan-x wordt 3D-x, plan-y wordt 3D-z. */
const M = (cm: number) => cm / 100;
const EYE = 1.6;

/* ------------------------------------------------------------------ Wanden */

function WallPiece({ s, height, color }: { s: WallSegment; height: number; color: string }) {
  const dx = s.b.x - s.a.x;
  const dy = s.b.y - s.a.y;
  const len = M(Math.hypot(dx, dy));
  const t = M(WALL_THICKNESS);
  const mid: [number, number] = [M((s.a.x + s.b.x) / 2), M((s.a.y + s.b.y) / 2)];
  const angle = -Math.atan2(dy, dx); // plan-y is 3D-z
  const H = M(height);
  // dichte stukken iets langer zodat hoeken (ook schuine) dicht zijn
  const extra = s.kind === "full" ? t : 0;

  const pieces: { y: number; h: number }[] = [];
  if (s.kind === "full") pieces.push({ y: H / 2, h: H });
  if (s.kind === "door") pieces.push({ y: (M(DOOR_HEIGHT) + H) / 2, h: H - M(DOOR_HEIGHT) });
  if (s.kind === "window") {
    pieces.push({ y: M(WINDOW_SILL) / 2, h: M(WINDOW_SILL) });
    const top = M(WINDOW_SILL + WINDOW_HEIGHT);
    pieces.push({ y: (top + H) / 2, h: H - top });
  }
  const glassTop = Math.min(H, M(WINDOW_SILL + WINDOW_HEIGHT));

  return (
    <group position={[mid[0], 0, mid[1]]} rotation={[0, angle, 0]}>
      {pieces
        .filter((p) => p.h > 0.001)
        .map((p, i) => (
          <mesh key={i} position={[0, p.y, 0]} castShadow receiveShadow>
            <boxGeometry args={[len + extra, p.h, t]} />
            <meshStandardMaterial color={color} roughness={0.9} />
          </mesh>
        ))}
      {s.kind === "window" && H > M(WINDOW_SILL) && (
        <mesh position={[0, (M(WINDOW_SILL) + glassTop) / 2, 0]}>
          <boxGeometry args={[len, glassTop - M(WINDOW_SILL), 0.02]} />
          <meshPhysicalMaterial color="#cfe3ee" transparent opacity={0.25} roughness={0.05} />
        </mesh>
      )}
    </group>
  );
}

/** Vloer of plafond in de vorm van de ruimte (ook L-vorm, schuine hoek, erker). */
function RoomSurface({ points, y, color, ceiling = false }: { points: { x: number; y: number }[]; y: number; color: string; ceiling?: boolean }) {
  const geometry = useMemo(() => {
    const shape = new THREE.Shape(points.map((p) => new THREE.Vector2(M(p.x), -M(p.y))));
    return new THREE.ShapeGeometry(shape);
  }, [points]);
  return (
    <mesh geometry={geometry} rotation={[-Math.PI / 2, 0, 0]} position={[0, y, 0]} receiveShadow={!ceiling} castShadow={ceiling}>
      <meshStandardMaterial color={color} roughness={ceiling ? 1 : 0.75} side={THREE.DoubleSide} />
    </mesh>
  );
}

/** Schuin dak: van het knieschot omhoog de kamer in, tot de volle wandhoogte. */
function SlopePlane({ room, edge, knee, angle, height, faint }: { room: import("@/lib/schemas").Room; edge: number; knee: number; angle: number; height: number; faint?: boolean }) {
  const geometry = useMemo(() => {
    const e = roomEdges(room)[edge];
    if (!e) return null;
    const n = edgeNormal(room, edge);
    const run = slopeRun({ edge, knee, angle }, height);
    const k = M(Math.min(knee, height));
    const H = M(height);
    const v = [
      [e.a.x, k, e.a.y],
      [e.b.x, k, e.b.y],
      [e.b.x + n.x * run, H, e.b.y + n.y * run],
      [e.a.x + n.x * run, H, e.a.y + n.y * run],
    ].map(([x, y, z]) => [M(x), y, M(z)]);
    const g = new THREE.BufferGeometry();
    g.setAttribute("position", new THREE.Float32BufferAttribute([...v[0], ...v[1], ...v[2], ...v[0], ...v[2], ...v[3]], 3));
    g.computeVertexNormals();
    return g;
  }, [room, edge, knee, angle, height]);
  if (!geometry) return null;
  return (
    <mesh geometry={geometry} castShadow={!faint} receiveShadow>
      <meshStandardMaterial color="#f4efe7" roughness={1} side={THREE.DoubleSide} transparent={faint} opacity={faint ? 0.35 : 1} />
    </mesh>
  );
}

/* ------------------------------------------------------------------ Meubels */

function Box({ p, s, c, r = 0.85 }: { p: [number, number, number]; s: [number, number, number]; c: string; r?: number }) {
  return (
    <mesh position={p} castShadow receiveShadow>
      <boxGeometry args={s} />
      <meshStandardMaterial color={c} roughness={r} />
    </mesh>
  );
}

function shade(hex: string, f: number) {
  return "#" + new THREE.Color(hex).multiplyScalar(f).getHexString();
}

/** Eenvoudige, herkenbare vormen per meubeltype. Lokaal: breedte langs x, diepte langs z, achterkant op -z. */
function RoundShape({ it }: { it: FloorItem }) {
  const w = M(it.w);
  const d = M(it.d);
  const h = Math.max(M(it.h), 0.01);
  const c = it.color;
  const dark = shade(c, 0.7);
  // ovaal: cilinder met straal 0,5 en geschaald naar breedte en diepte
  if (it.type === "vloerkleed") {
    return (
      <mesh position={[0, 0.006, 0]} scale={[w, 1, d]} receiveShadow>
        <cylinderGeometry args={[0.5, 0.5, 0.012, 48]} />
        <meshStandardMaterial color={c} roughness={1} />
      </mesh>
    );
  }
  if (/tafel|bureau/.test(it.type)) {
    const top = 0.035;
    return (
      <group>
        <mesh position={[0, h - top / 2, 0]} scale={[w, 1, d]} castShadow receiveShadow>
          <cylinderGeometry args={[0.5, 0.5, top, 48]} />
          <meshStandardMaterial color={c} roughness={0.6} />
        </mesh>
        <mesh position={[0, (h - top) / 2, 0]} castShadow>
          <cylinderGeometry args={[0.05, 0.12, h - top, 20]} />
          <meshStandardMaterial color={dark} roughness={0.7} />
        </mesh>
      </group>
    );
  }
  return (
    <mesh position={[0, h / 2, 0]} scale={[w, 1, d]} castShadow receiveShadow>
      <cylinderGeometry args={[0.5, 0.5, h, 40]} />
      <meshStandardMaterial color={c} roughness={0.8} />
    </mesh>
  );
}

export function FurnitureShape({ it }: { it: FloorItem }) {
  if (it.shape === "round") return <RoundShape it={it} />;
  const w = M(it.w);
  const d = M(it.d);
  const h = Math.max(M(it.h), 0.01);
  const c = it.color;
  const dark = shade(c, 0.7);
  const leg = 0.04;

  switch (it.type) {
    case "bank": {
      const seat = Math.min(0.45, h * 0.55);
      const arm = Math.min(0.18, w * 0.1);
      return (
        <group>
          <Box p={[0, seat / 2, 0.05]} s={[w, seat, d - 0.1]} c={c} />
          <Box p={[0, h / 2, -d / 2 + 0.1]} s={[w, h, 0.2]} c={c} />
          <Box p={[-w / 2 + arm / 2, seat + 0.08, 0.05]} s={[arm, 0.18, d - 0.1]} c={dark} />
          <Box p={[w / 2 - arm / 2, seat + 0.08, 0.05]} s={[arm, 0.18, d - 0.1]} c={dark} />
        </group>
      );
    }
    case "fauteuil":
      return (
        <group>
          <Box p={[0, 0.22, 0.04]} s={[w, 0.44, d - 0.08]} c={c} />
          <Box p={[0, h / 2, -d / 2 + 0.08]} s={[w, h, 0.16]} c={c} />
        </group>
      );
    case "bed":
      return (
        <group>
          <Box p={[0, 0.15, 0]} s={[w, 0.3, d]} c={dark} />
          <Box p={[0, 0.38, 0.05]} s={[w - 0.06, 0.18, d - 0.12]} c="#f4f1ec" r={1} />
          <Box p={[0, 0.5, -d / 2 + 0.25]} s={[w - 0.2, 0.12, 0.35]} c="#ffffff" r={1} />
          <Box p={[0, 0.48, d * 0.18]} s={[w - 0.04, 0.06, d * 0.55]} c={c} r={1} />
          <Box p={[0, 0.55, -d / 2 + 0.03]} s={[w, 1.1, 0.06]} c={dark} />
        </group>
      );
    case "eettafel":
    case "salontafel":
    case "bureau": {
      const top = 0.035;
      return (
        <group>
          <Box p={[0, h - top / 2, 0]} s={[w, top, d]} c={c} r={0.6} />
          {[-1, 1].flatMap((sx) =>
            [-1, 1].map((sz) => <Box key={`${sx}${sz}`} p={[sx * (w / 2 - 0.06), (h - top) / 2, sz * (d / 2 - 0.06)]} s={[leg, h - top, leg]} c={dark} />),
          )}
        </group>
      );
    }
    case "stoel":
      return (
        <group>
          <Box p={[0, 0.45, 0]} s={[w, 0.04, d]} c={c} />
          <Box p={[0, (h + 0.45) / 2, -d / 2 + 0.02]} s={[w, h - 0.45, 0.03]} c={c} />
          {[-1, 1].flatMap((sx) =>
            [-1, 1].map((sz) => <Box key={`${sx}${sz}`} p={[sx * (w / 2 - 0.03), 0.225, sz * (d / 2 - 0.03)]} s={[0.03, 0.45, 0.03]} c={dark} />),
          )}
        </group>
      );
    case "plant": {
      const pot = Math.min(w, d) * 0.4;
      return (
        <group>
          <mesh position={[0, 0.18, 0]} castShadow>
            <cylinderGeometry args={[pot, pot * 0.8, 0.36, 20]} />
            <meshStandardMaterial color="#d9cfc2" roughness={0.9} />
          </mesh>
          <mesh position={[0, 0.36 + (h - 0.36) / 2, 0]} castShadow>
            <sphereGeometry args={[Math.min(w, d) / 2, 16, 12]} />
            <meshStandardMaterial color={c} roughness={1} />
          </mesh>
        </group>
      );
    }
    case "lamp":
      return (
        <group>
          <mesh position={[0, 0.015, 0]}>
            <cylinderGeometry args={[0.14, 0.14, 0.03, 20]} />
            <meshStandardMaterial color="#3a3530" />
          </mesh>
          <mesh position={[0, h / 2, 0]}>
            <cylinderGeometry args={[0.012, 0.012, h, 8]} />
            <meshStandardMaterial color="#3a3530" />
          </mesh>
          <mesh position={[0, h - 0.12, 0]}>
            <cylinderGeometry args={[0.12, Math.min(w, d) / 2, 0.26, 24, 1, true]} />
            <meshStandardMaterial color={c} emissive={c} emissiveIntensity={0.5} side={THREE.DoubleSide} />
          </mesh>
          <pointLight position={[0, h - 0.2, 0]} intensity={1.2} distance={4} color="#ffd9a8" />
        </group>
      );
    case "vloerkleed":
      return <Box p={[0, 0.006, 0]} s={[w, 0.012, d]} c={c} r={1} />;
    case "kast":
    case "dressoir":
    case "tv-meubel":
    case "nachtkastje":
    case "keukenblok": {
      const plinth = 0.06;
      const doors = Math.max(1, Math.round(w / 0.5));
      return (
        <group>
          <Box p={[0, plinth / 2, 0]} s={[w - 0.04, plinth, d - 0.04]} c={dark} />
          <Box p={[0, plinth + (h - plinth) / 2, 0]} s={[w, h - plinth, d]} c={c} r={0.7} />
          {Array.from({ length: doors - 1 }, (_, i) => (
            <Box key={i} p={[-w / 2 + ((i + 1) * w) / doors, plinth + (h - plinth) / 2, d / 2 + 0.002]} s={[0.006, h - plinth - 0.04, 0.004]} c={dark} />
          ))}
          {it.type === "keukenblok" && <Box p={[0, h + 0.02, 0]} s={[w + 0.02, 0.04, d + 0.02]} c="#e9e6e1" r={0.4} />}
        </group>
      );
    }
    default:
      return <Box p={[0, h / 2, 0]} s={[w, h, d]} c={c} />;
  }
}

function Furniture({ it }: { it: FloorItem }) {
  const f = footprint(it);
  const cx = M(it.x + f.w / 2);
  const cz = M(it.y + f.h / 2);
  // rotatie 0 = rug naar boven (plan-y klein) → in 3D naar -z
  return (
    <group position={[cx, 0, cz]} rotation={[0, (-it.rotation * Math.PI) / 180, 0]}>
      <FurnitureShape it={it} />
    </group>
  );
}

/* ---------------------------------------------------------- Rondlopen (FPS) */

type Keys = { f: boolean; b: boolean; l: boolean; r: boolean };

function blocked(x: number, z: number, walls: WallSegment[]) {
  const R = 0.22 + M(WALL_THICKNESS) / 2;
  for (const s of walls) {
    if (s.kind === "door") continue;
    const ax = M(s.a.x);
    const az = M(s.a.y);
    const vx = M(s.b.x) - ax;
    const vz = M(s.b.y) - az;
    const L2 = vx * vx + vz * vz || 1;
    const t = Math.max(0, Math.min(1, ((x - ax) * vx + (z - az) * vz) / L2));
    if (Math.hypot(x - (ax + vx * t), z - (az + vz * t)) < R) return true;
  }
  return false;
}

function WalkControls({ start, walls, keys }: { start: [number, number]; walls: WallSegment[]; keys: React.RefObject<Keys> }) {
  const { camera, gl } = useThree();
  const yaw = useRef(0);
  const pitch = useRef(0);

  useEffect(() => {
    camera.position.set(start[0], EYE, start[1]);
    yaw.current = 0;
    pitch.current = 0;
  }, [camera, start]);

  useEffect(() => {
    const el = gl.domElement;
    let last: { x: number; y: number } | null = null;
    const down = (e: PointerEvent) => {
      last = { x: e.clientX, y: e.clientY };
      el.setPointerCapture(e.pointerId);
    };
    const move = (e: PointerEvent) => {
      if (!last) return;
      yaw.current -= (e.clientX - last.x) * 0.005;
      pitch.current = Math.max(-1.2, Math.min(1.2, pitch.current - (e.clientY - last.y) * 0.004));
      last = { x: e.clientX, y: e.clientY };
    };
    const up = () => (last = null);
    el.addEventListener("pointerdown", down);
    el.addEventListener("pointermove", move);
    el.addEventListener("pointerup", up);
    el.addEventListener("pointercancel", up);
    return () => {
      el.removeEventListener("pointerdown", down);
      el.removeEventListener("pointermove", move);
      el.removeEventListener("pointerup", up);
      el.removeEventListener("pointercancel", up);
    };
  }, [gl]);

  useFrame((state, dt) => {
    const cam = state.camera;
    cam.rotation.set(pitch.current, yaw.current, 0, "YXZ");
    const k = keys.current;
    const speed = 1.6 * Math.min(dt, 0.05);
    const fwd = (k.f ? 1 : 0) - (k.b ? 1 : 0);
    const side = (k.r ? 1 : 0) - (k.l ? 1 : 0);
    if (!fwd && !side) return;
    const sin = Math.sin(yaw.current);
    const cos = Math.cos(yaw.current);
    const dx = (-sin * fwd + cos * side) * speed;
    const dz = (-cos * fwd - sin * side) * speed;
    const { x, z } = cam.position;
    if (!blocked(x + dx, z, walls)) cam.position.x += dx;
    if (!blocked(cam.position.x, z + dz, walls)) cam.position.z += dz;
  });
  return null;
}

/* ------------------------------------------------------------------- Scène */

/** Licht: zonder zon een vaste, zachte belichting; met zon de echte stand voor die maand en dat uur. */
function Lights({ plan, mode, sun, center, span }: { plan: Floorplan; mode: string; sun?: Sun | null; center: [number, number, number]; span: number }) {
  const light = useRef<THREE.DirectionalLight>(null);
  const target = useRef<THREE.Object3D>(null);
  useEffect(() => {
    if (light.current && target.current) light.current.target = target.current;
  }, []);
  let pos: [number, number, number] = [center[0] + span, span * 1.5, center[2] + span * 0.6];
  let intensity = 1.6;
  let color = "#ffffff";
  let sky = 0.9;
  if (sun) {
    const p = sunPosition(sun.month, sun.hour);
    const theta = ((plan.north ?? 0) + p.azimuth) * (Math.PI / 180);
    const alt = p.altitude * (Math.PI / 180);
    const R = span * 2.5;
    pos = [center[0] + Math.sin(theta) * Math.cos(alt) * R, Math.max(0.2, Math.sin(alt) * R), center[2] - Math.cos(theta) * Math.cos(alt) * R];
    const up = Math.max(0, Math.sin(alt));
    intensity = p.altitude > 0 ? 0.5 + 2.6 * Math.min(1, up * 1.4) : 0;
    color = new THREE.Color("#ff9f5a").lerp(new THREE.Color("#fff6e8"), Math.min(1, up * 2.2)).getStyle();
    sky = 0.15 + 0.75 * Math.min(1, Math.max(0, up * 2.5));
  }
  return (
    <>
      <hemisphereLight args={["#fff8ee", "#b9ab98", sky]} />
      <ambientLight intensity={sun ? 0.08 + sky * 0.2 : 0.25} />
      <object3D ref={target} position={center} />
      <directionalLight
        ref={light}
        position={pos}
        intensity={intensity}
        color={color}
        castShadow
        shadow-bias={-0.0004}
        shadow-mapSize={[2048, 2048]}
        shadow-camera-left={-span * 1.2}
        shadow-camera-right={span * 1.2}
        shadow-camera-top={span * 1.2}
        shadow-camera-bottom={-span * 1.2}
        shadow-camera-far={span * 8}
      />
      {mode === "walk" && sun && <color attach="background" args={[new THREE.Color("#1f2430").lerp(new THREE.Color("#cfe0ee"), sky).getStyle()]} />}
    </>
  );
}

function Scene({ plan, mode, keys, sun }: { plan: Floorplan; mode: "orbit" | "walk" | "showcase"; keys: React.RefObject<Keys>; sun?: Sun | null }) {
  const lampsOn = !sun || sunPosition(sun.month, sun.hour).altitude < 8;
  const walls = useMemo(() => wallSegments(plan), [plan]);
  const b = bounds(plan);
  const center: [number, number, number] = [M((b.minX + b.maxX) / 2), 0, M((b.minY + b.maxY) / 2)];
  const span = Math.max(M(b.maxX - b.minX), M(b.maxY - b.minY), 3);
  const firstRoom = plan.rooms[0];
  const start = useMemo<[number, number]>(() => {
    if (!firstRoom) return [0, 0];
    const c = centroid(roomPoints(firstRoom));
    return [M(c.x), M(c.y)];
  }, [firstRoom]);

  return (
    <>
      {mode !== "showcase" && !(mode === "walk" && sun) && <color attach="background" args={[mode === "walk" ? "#e9e4dc" : "#efeae2"]} />}
      <Lights plan={plan} mode={mode} sun={sun} center={center} span={span} />

      {/* buitenvloer (niet in de showroom: daar zweeft het huis op de pagina) */}
      {mode !== "showcase" && (
        <mesh rotation={[-Math.PI / 2, 0, 0]} position={[center[0], -0.01, center[2]]} receiveShadow>
          <planeGeometry args={[span * 4, span * 4]} />
          <meshStandardMaterial color="#e2dbd0" roughness={1} />
        </mesh>
      )}

      {plan.rooms.map((r) => {
        const pts = roomPoints(r);
        const c = centroid(pts);
        return (
          <group key={r.id}>
            <RoomSurface points={pts} y={0} color={floorColor(r.floor)} />
            {mode === "walk" && <RoomSurface points={pts} y={M(plan.wallHeight)} color="#fbfaf7" ceiling />}
            {mode !== "showcase" &&
              (r.slopes ?? []).map((sl) => (
                <SlopePlane key={sl.edge} room={r} edge={sl.edge} knee={sl.knee} angle={sl.angle} height={plan.wallHeight} faint={mode === "orbit"} />
              ))}
            {mode === "walk" && <pointLight position={[M(c.x), M(plan.wallHeight) - 0.3, M(c.y)]} intensity={lampsOn ? 2.5 : 0.35} distance={8} color="#fff1dc" />}
          </group>
        );
      })}

      {walls.map((s, i) => (
        // In de showroom zijn de muren laag (poppenhuis), zodat je de inrichting goed ziet.
        <WallPiece key={i} s={s} height={mode === "showcase" ? Math.min(s.height, 125) : s.height} color={plan.wallColor} />
      ))}
      {plan.items.map((it) => (
        <Furniture key={it.id} it={it} />
      ))}

      {mode === "showcase" ? (
        <OrbitControls target={center} autoRotate autoRotateSpeed={0.8} enableZoom={false} enablePan={false} minPolarAngle={0.5} maxPolarAngle={1.05} enableDamping />
      ) : mode === "orbit" ? (
        <OrbitControls target={center} maxPolarAngle={Math.PI / 2.1} minDistance={1.5} maxDistance={span * 4} enableDamping />
      ) : (
        <WalkControls start={start} walls={walls} keys={keys} />
      )}
    </>
  );
}

/* --------------------------------------------------------------- Component */

function HoldButton({ icon, label, onHold }: { icon: IconName; label: string; onHold: (on: boolean) => void }) {
  return (
    <button
      aria-label={label}
      className="grid h-12 w-12 touch-none place-items-center rounded-full bg-black/45 text-white backdrop-blur active:bg-black/65"
      onPointerDown={(e) => {
        e.preventDefault();
        onHold(true);
      }}
      onPointerUp={() => onHold(false)}
      onPointerLeave={() => onHold(false)}
      onPointerCancel={() => onHold(false)}
      onContextMenu={(e) => e.preventDefault()}
    >
      <Icon name={icon} size={22} />
    </button>
  );
}

export default function Walkthrough3D({
  plan,
  onCapture,
  capturing = false,
}: {
  plan: Floorplan;
  /** Krijgt een PNG van het huidige standpunt (voor "maak er een foto van"). */
  onCapture?: (png: Blob) => void;
  capturing?: boolean;
}) {
  const wrap = useRef<HTMLDivElement>(null);
  function capture() {
    const canvas = wrap.current?.querySelector("canvas");
    canvas?.toBlob((b) => b && onCapture?.(b), "image/png");
  }
  const [mode, setMode] = useState<"orbit" | "walk">("orbit");
  const [sunOn, setSunOn] = useState(false);
  const [sun, setSun] = useState<Sun>(() => ({ month: new Date().getMonth() + 1, hour: 14 }));
  const sunInfo = sunPosition(sun.month, sun.hour);
  const keys = useRef<Keys>({ f: false, b: false, l: false, r: false });
  // Overzicht: hoog en schuin van voren, zodat je over de voormuren heen het huis in kijkt.
  const orbitStart = useMemo<[number, number, number]>(() => {
    const b = bounds(plan);
    const span = Math.max(M(b.maxX - b.minX), M(b.maxY - b.minY), 3);
    return [M((b.minX + b.maxX) / 2) + span * 0.1, span * 1.0, M((b.minY + b.maxY) / 2) + span * 0.65];
    // alleen bij het openen bepalen, niet bij elke wijziging
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  const press = useCallback((k: keyof Keys, on: boolean) => {
    keys.current[k] = on;
  }, []);

  useEffect(() => {
    const map: Record<string, keyof Keys> = {
      ArrowUp: "f",
      KeyW: "f",
      ArrowDown: "b",
      KeyS: "b",
      ArrowLeft: "l",
      KeyA: "l",
      ArrowRight: "r",
      KeyD: "r",
    };
    const set = (on: boolean) => (e: KeyboardEvent) => {
      const k = map[e.code];
      if (k && mode === "walk") {
        e.preventDefault();
        keys.current[k] = on;
      }
    };
    const down = set(true);
    const up = set(false);
    window.addEventListener("keydown", down);
    window.addEventListener("keyup", up);
    return () => {
      window.removeEventListener("keydown", down);
      window.removeEventListener("keyup", up);
    };
  }, [mode]);

  return (
    <div ref={wrap} className="relative h-[58dvh] min-h-[340px] w-full overflow-hidden rounded-2xl bg-surface-2">
      <Canvas
        shadows
        dpr={[1, 2]}
        gl={{ preserveDrawingBuffer: !!onCapture }}
        camera={{ fov: mode === "walk" ? 70 : 45, near: 0.05, far: 200, position: orbitStart }}
        key={mode}
      >
        <Scene plan={plan} mode={mode} keys={keys} sun={sunOn ? sun : null} />
      </Canvas>

      <div className="absolute left-3 top-3 flex gap-1 rounded-full bg-surface/90 p-1 text-sm shadow-sm backdrop-blur">
        <button className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 ${mode === "orbit" ? "bg-ink text-bg" : "text-ink-2"}`} onClick={() => setMode("orbit")}>
          <Icon name="cube" size={16} /> Overzicht
        </button>
        <button className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 ${mode === "walk" ? "bg-ink text-bg" : "text-ink-2"}`} onClick={() => setMode("walk")}>
          <Icon name="walk" size={16} /> Rondlopen
        </button>
        <button
          className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 ${sunOn ? "bg-accent text-accent-ink" : "text-ink-2"}`}
          onClick={() => setSunOn((s) => !s)}
          aria-pressed={sunOn}
        >
          <Icon name="sun" size={16} /> Zon
        </button>
      </div>

      {sunOn && (
        <div className="absolute left-3 top-14 w-56 rounded-2xl bg-surface/95 p-2.5 text-xs shadow-sm backdrop-blur sm:w-64 sm:p-3 sm:text-sm">
          <p className="font-medium">{sunLabel(sun.month, sun.hour)}</p>
          <p className="text-xs text-ink-3">
            {sunInfo.altitude > 0
              ? `Zon uit het ${compass(sunInfo.azimuth)}, ${Math.round(sunInfo.altitude)}° hoog`
              : "De zon is onder; de lampen zijn aan"}
          </p>
          <label className="mt-2 block text-xs text-ink-2">
            Maand
            <input type="range" min={1} max={12} step={1} value={sun.month} onChange={(e) => setSun({ ...sun, month: Number(e.target.value) })} className="w-full accent-[var(--accent)]" />
          </label>
          <label className="block text-xs text-ink-2">
            Tijd
            <input type="range" min={5} max={22} step={0.25} value={sun.hour} onChange={(e) => setSun({ ...sun, hour: Number(e.target.value) })} className="w-full accent-[var(--accent)]" />
          </label>
          {plan.north === undefined && <p className="mt-1 text-xs text-ink-3">Tip: zet bij de plattegrond waar het noorden is.</p>}
        </div>
      )}

      {onCapture && (
        <button
          onClick={capture}
          disabled={capturing}
          className="btn-primary absolute bottom-4 right-3 px-3.5 py-2 shadow-lg sm:bottom-auto sm:top-3"
          style={mode === "walk" ? { top: "auto", bottom: "1rem" } : undefined}
        >
          <Icon name={capturing ? "loader" : "camera"} size={16} /> {capturing ? "Foto maken…" : "Maak er een foto van"}
        </button>
      )}

      {mode === "walk" && (
        <>
          <p className="pointer-events-none absolute right-3 top-3 hidden rounded-full bg-black/45 px-3 py-1.5 text-xs text-white sm:block">
            Sleep om rond te kijken · pijltjes of WASD om te lopen
          </p>
          <div className="absolute bottom-4 left-1/2 grid -translate-x-1/2 grid-cols-3 gap-1.5">
            <span />
            <HoldButton icon="arrow-up" label="Vooruit" onHold={(on) => press("f", on)} />
            <span />
            <HoldButton icon="arrow-left" label="Links" onHold={(on) => press("l", on)} />
            <HoldButton icon="arrow-down" label="Achteruit" onHold={(on) => press("b", on)} />
            <HoldButton icon="arrow-right" label="Rechts" onHold={(on) => press("r", on)} />
          </div>
        </>
      )}
    </div>
  );
}

/** Vanzelf ronddraaiend 3D-huis voor de startpagina; slepen om zelf te draaien. */
export function Showroom({ plan, className }: { plan: Floorplan; className?: string }) {
  const keys = useRef<Keys>({ f: false, b: false, l: false, r: false });
  const start = useMemo<[number, number, number]>(() => {
    const b = bounds(plan);
    const span = Math.max(M(b.maxX - b.minX), M(b.maxY - b.minY), 3);
    return [M((b.minX + b.maxX) / 2) + span * 0.5, span * 1.3, M((b.minY + b.maxY) / 2) + span * 0.85];
  }, [plan]);
  return (
    <div className={className}>
      <Canvas shadows dpr={[1, 2]} gl={{ alpha: true }} camera={{ fov: 38, near: 0.05, far: 200, position: start }}>
        <Scene plan={plan} mode="showcase" keys={keys} />
      </Canvas>
    </div>
  );
}
