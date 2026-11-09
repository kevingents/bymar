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
  floorColor,
  footprint,
  wallSegments,
  type WallSegment,
} from "@/lib/floorplan";
import { Icon, type IconName } from "@/components/ui/Icon";

/** Plattegrond is in cm; 3D in meters. Plan-x wordt 3D-x, plan-y wordt 3D-z. */
const M = (cm: number) => cm / 100;
const EYE = 1.6;

/* ------------------------------------------------------------------ Wanden */

function WallPiece({ s, height, color }: { s: WallSegment; height: number; color: string }) {
  const len = M(s.b - s.a);
  const t = M(WALL_THICKNESS);
  const mid = M((s.a + s.b) / 2);
  const pos = (y: number): [number, number, number] => (s.horizontal ? [mid, y, M(s.fixed)] : [M(s.fixed), y, mid]);
  const size = (h: number): [number, number, number] => (s.horizontal ? [len + (s.kind === "full" ? t : 0), h, t] : [t, h, len + (s.kind === "full" ? t : 0)]);
  const H = M(height);

  const pieces: { y: number; h: number }[] = [];
  if (s.kind === "full") pieces.push({ y: H / 2, h: H });
  if (s.kind === "door") pieces.push({ y: (M(DOOR_HEIGHT) + H) / 2, h: H - M(DOOR_HEIGHT) });
  if (s.kind === "window") {
    pieces.push({ y: M(WINDOW_SILL) / 2, h: M(WINDOW_SILL) });
    const top = M(WINDOW_SILL + WINDOW_HEIGHT);
    pieces.push({ y: (top + H) / 2, h: H - top });
  }

  return (
    <group>
      {pieces
        .filter((p) => p.h > 0.001)
        .map((p, i) => (
          <mesh key={i} position={pos(p.y)} castShadow receiveShadow>
            <boxGeometry args={size(p.h)} />
            <meshStandardMaterial color={color} roughness={0.9} />
          </mesh>
        ))}
      {s.kind === "window" && (
        <mesh position={pos(M(WINDOW_SILL + WINDOW_HEIGHT / 2))}>
          <boxGeometry args={s.horizontal ? [len, M(WINDOW_HEIGHT), 0.02] : [0.02, M(WINDOW_HEIGHT), len]} />
          <meshPhysicalMaterial color="#cfe3ee" transparent opacity={0.25} roughness={0.05} />
        </mesh>
      )}
    </group>
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
function FurnitureShape({ it }: { it: FloorItem }) {
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
  const R = 0.22;
  for (const s of walls) {
    if (s.kind === "door") continue;
    const a = M(s.a) - R;
    const b = M(s.b) + R;
    const f = M(s.fixed);
    if (s.horizontal) {
      if (x > a && x < b && Math.abs(z - f) < R + M(WALL_THICKNESS) / 2) return true;
    } else if (z > a && z < b && Math.abs(x - f) < R + M(WALL_THICKNESS) / 2) return true;
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

function Scene({ plan, mode, keys }: { plan: Floorplan; mode: "orbit" | "walk"; keys: React.RefObject<Keys> }) {
  const walls = useMemo(() => wallSegments(plan), [plan]);
  const b = bounds(plan);
  const center: [number, number, number] = [M((b.minX + b.maxX) / 2), 0, M((b.minY + b.maxY) / 2)];
  const span = Math.max(M(b.maxX - b.minX), M(b.maxY - b.minY), 3);
  const firstRoom = plan.rooms[0];
  const start = useMemo<[number, number]>(
    () => (firstRoom ? [M(firstRoom.x + firstRoom.w / 2), M(firstRoom.y + firstRoom.h * 0.8)] : [0, 0]),
    [firstRoom],
  );

  return (
    <>
      <color attach="background" args={[mode === "walk" ? "#e9e4dc" : "#efeae2"]} />
      <hemisphereLight args={["#fff8ee", "#b9ab98", 0.9]} />
      <ambientLight intensity={0.25} />
      <directionalLight
        position={[center[0] + span, span * 1.5, center[2] + span * 0.6]}
        intensity={1.6}
        castShadow
        shadow-mapSize={[2048, 2048]}
        shadow-camera-left={-span}
        shadow-camera-right={span}
        shadow-camera-top={span}
        shadow-camera-bottom={-span}
      />

      {/* buitenvloer */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[center[0], -0.01, center[2]]} receiveShadow>
        <planeGeometry args={[span * 4, span * 4]} />
        <meshStandardMaterial color="#e2dbd0" roughness={1} />
      </mesh>

      {plan.rooms.map((r) => (
        <group key={r.id}>
          <mesh rotation={[-Math.PI / 2, 0, 0]} position={[M(r.x + r.w / 2), 0, M(r.y + r.h / 2)]} receiveShadow>
            <planeGeometry args={[M(r.w), M(r.h)]} />
            <meshStandardMaterial color={floorColor(r.floor)} roughness={0.75} />
          </mesh>
          {mode === "walk" && (
            <mesh rotation={[Math.PI / 2, 0, 0]} position={[M(r.x + r.w / 2), M(plan.wallHeight), M(r.y + r.h / 2)]}>
              <planeGeometry args={[M(r.w), M(r.h)]} />
              <meshStandardMaterial color="#fbfaf7" roughness={1} />
            </mesh>
          )}
          {mode === "walk" && <pointLight position={[M(r.x + r.w / 2), M(plan.wallHeight) - 0.3, M(r.y + r.h / 2)]} intensity={2.5} distance={8} color="#fff1dc" />}
        </group>
      ))}

      {walls.map((s, i) => (
        <WallPiece key={i} s={s} height={plan.wallHeight} color={plan.wallColor} />
      ))}
      {plan.items.map((it) => (
        <Furniture key={it.id} it={it} />
      ))}

      {mode === "orbit" ? (
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

export default function Walkthrough3D({ plan }: { plan: Floorplan }) {
  const [mode, setMode] = useState<"orbit" | "walk">("orbit");
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
    <div className="relative h-[58dvh] min-h-[340px] w-full overflow-hidden rounded-2xl bg-surface-2">
      <Canvas shadows dpr={[1, 2]} camera={{ fov: mode === "walk" ? 70 : 45, near: 0.05, far: 200, position: orbitStart }} key={mode}>
        <Scene plan={plan} mode={mode} keys={keys} />
      </Canvas>

      <div className="absolute left-3 top-3 flex gap-1 rounded-full bg-surface/90 p-1 text-sm shadow-sm backdrop-blur">
        <button className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 ${mode === "orbit" ? "bg-ink text-bg" : "text-ink-2"}`} onClick={() => setMode("orbit")}>
          <Icon name="cube" size={16} /> Overzicht
        </button>
        <button className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 ${mode === "walk" ? "bg-ink text-bg" : "text-ink-2"}`} onClick={() => setMode("walk")}>
          <Icon name="walk" size={16} /> Rondlopen
        </button>
      </div>

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
