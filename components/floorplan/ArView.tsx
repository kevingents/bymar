"use client";

import { OrbitControls } from "@react-three/drei";
import { Canvas } from "@react-three/fiber";
import { useEffect, useRef, useState } from "react";
import * as THREE from "three";
import { USDZExporter } from "three/examples/jsm/exporters/USDZExporter.js";
import type { FloorItem } from "@/lib/schemas";
import { Icon } from "@/components/ui/Icon";
import { FurnitureShape } from "./Walkthrough3D";

type Support = "quicklook" | "webxr" | "none" | "checking";

/** Zoekt uit welke AR deze telefoon kan: iPhone/iPad via AR Quick Look, Android via WebXR. */
async function detect(): Promise<Support> {
  const a = document.createElement("a");
  if (a.relList?.supports?.("ar")) return "quicklook";
  try {
    if (navigator.xr && (await navigator.xr.isSessionSupported("immersive-ar"))) return "webxr";
  } catch {
    /* geen WebXR */
  }
  return "none";
}

/** Model op ware grootte, met de voorkant naar +z en de onderkant op y = 0. */
function exportable(source: THREE.Object3D) {
  const root = new THREE.Group();
  root.add(source.clone(true));
  root.updateMatrixWorld(true);
  return root;
}

async function openQuickLook(model: THREE.Object3D, name: string) {
  const data = await new USDZExporter().parseAsync(exportable(model));
  const url = URL.createObjectURL(new Blob([data as BlobPart], { type: "model/vnd.usdz+zip" }));
  const a = document.createElement("a");
  a.rel = "ar";
  a.href = url;
  a.download = `${name}.usdz`;
  // AR Quick Look wil een afbeelding in de link
  a.appendChild(document.createElement("img"));
  document.body.appendChild(a);
  a.click();
  setTimeout(() => {
    a.remove();
    URL.revokeObjectURL(url);
  }, 60_000);
}

/** WebXR (Android/Chrome): richt op de vloer, tik om te plaatsen; tik opnieuw om te verzetten. */
async function startWebXR(model: THREE.Object3D, overlay: HTMLElement, onState: (s: "searching" | "placed" | "ended") => void) {
  const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
  renderer.setPixelRatio(window.devicePixelRatio);
  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.xr.enabled = true;
  renderer.domElement.style.display = "none";
  document.body.appendChild(renderer.domElement);

  const scene = new THREE.Scene();
  scene.add(new THREE.HemisphereLight(0xffffff, 0xb9ab98, 2.2));
  const sun = new THREE.DirectionalLight(0xffffff, 1.4);
  sun.position.set(1, 3, 2);
  scene.add(sun);
  const camera = new THREE.PerspectiveCamera(70, window.innerWidth / window.innerHeight, 0.01, 30);

  const reticle = new THREE.Mesh(new THREE.RingGeometry(0.12, 0.15, 40).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({ color: 0xffffff }));
  reticle.matrixAutoUpdate = false;
  reticle.visible = false;
  scene.add(reticle);

  const placed = exportable(model);
  placed.visible = false;
  scene.add(placed);

  const session = await navigator.xr!.requestSession("immersive-ar", {
    requiredFeatures: ["hit-test"],
    optionalFeatures: ["dom-overlay"],
    domOverlay: { root: overlay },
  });
  renderer.xr.setReferenceSpaceType("local");
  await renderer.xr.setSession(session);
  const viewer = await session.requestReferenceSpace("viewer");
  const hitSource = await session.requestHitTestSource!({ space: viewer });
  onState("searching");

  session.addEventListener("select", () => {
    if (!reticle.visible) return;
    placed.position.setFromMatrixPosition(reticle.matrix);
    const cam = renderer.xr.getCamera();
    const camPos = new THREE.Vector3().setFromMatrixPosition(cam.matrixWorld);
    // voorkant naar je toe
    placed.rotation.set(0, Math.atan2(camPos.x - placed.position.x, camPos.z - placed.position.z), 0);
    placed.visible = true;
    onState("placed");
  });

  renderer.setAnimationLoop((_t, frame) => {
    if (frame && hitSource) {
      const ref = renderer.xr.getReferenceSpace();
      const hits = frame.getHitTestResults(hitSource);
      const pose = hits[0] && ref ? hits[0].getPose(ref) : undefined;
      reticle.visible = !!pose;
      if (pose) reticle.matrix.fromArray(pose.transform.matrix);
    }
    renderer.render(scene, camera);
  });

  session.addEventListener("end", () => {
    renderer.setAnimationLoop(null);
    hitSource?.cancel();
    renderer.dispose();
    renderer.domElement.remove();
    onState("ended");
  });
  return session;
}

/** Meubel in 3D bekijken en op ware grootte in je eigen kamer zetten (AR). */
export default function ArView({ item, onClose }: { item: FloorItem; onClose: () => void }) {
  const model = useRef<THREE.Group>(null);
  const overlay = useRef<HTMLDivElement>(null);
  const session = useRef<XRSession | null>(null);
  const [support, setSupport] = useState<Support>("checking");
  const [busy, setBusy] = useState(false);
  const [xr, setXr] = useState<"off" | "searching" | "placed">("off");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    detect().then(setSupport);
  }, []);

  useEffect(() => () => void session.current?.end().catch(() => {}), []);

  const shown: FloorItem = { ...item, rotation: 0, x: 0, y: 0 };
  const size = Math.max(item.w, item.d, item.h) / 100;

  async function start() {
    if (!model.current) return;
    setBusy(true);
    setError(null);
    try {
      if (support === "quicklook") await openQuickLook(model.current, item.name);
      else if (support === "webxr" && overlay.current) {
        session.current = await startWebXR(model.current, overlay.current, (s) => {
          if (s === "ended") {
            session.current = null;
            setXr("off");
          } else setXr(s);
        });
      }
    } catch (e) {
      setError(e instanceof Error ? `AR starten lukte niet: ${e.message}` : "AR starten lukte niet.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="fixed inset-0 z-[70] grid place-items-end bg-black/40 sm:place-items-center" onClick={onClose}>
      <div
        className="w-full rounded-t-3xl bg-surface p-5 pb-[max(1.25rem,env(safe-area-inset-bottom))] sm:max-w-lg sm:rounded-3xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-3">
          <div>
            <h2 className="font-display text-2xl">In je kamer bekijken</h2>
            <p className="text-sm text-ink-2">
              {item.name} · {item.w} × {item.d} × {item.h} cm
            </p>
          </div>
          <button className="btn-ghost px-2.5" onClick={onClose} aria-label="Sluiten">
            <Icon name="x" size={20} />
          </button>
        </div>

        <div className="mt-3 h-64 overflow-hidden rounded-2xl bg-surface-2">
          <Canvas camera={{ position: [size * 1.4, size * 1.1, size * 1.8], fov: 40 }} dpr={[1, 2]}>
            <hemisphereLight args={["#fff8ee", "#b9ab98", 1.2]} />
            <directionalLight position={[2, 4, 3]} intensity={1.6} />
            <group ref={model}>
              <FurnitureShape it={shown} />
            </group>
            <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.001, 0]}>
              <circleGeometry args={[size * 1.2, 48]} />
              <meshStandardMaterial color="#e2dbd0" />
            </mesh>
            <OrbitControls target={[0, item.h / 200, 0]} enablePan={false} />
          </Canvas>
        </div>

        {support === "checking" ? (
          <p className="mt-3 flex items-center gap-2 text-sm text-ink-3">
            <Icon name="loader" size={14} /> Kijken wat je telefoon kan…
          </p>
        ) : support === "none" ? (
          <p className="mt-3 rounded-xl bg-surface-2 p-3 text-sm text-ink-2">
            AR werkt op een iPhone of iPad (Safari) en op de meeste Android-telefoons (Chrome). Open dit project daar en tik dan op &ldquo;Zet in je kamer&rdquo;.
          </p>
        ) : (
          <>
            <button className="btn-primary mt-3 w-full" onClick={start} disabled={busy}>
              <Icon name={busy ? "loader" : "camera"} size={18} /> {busy ? "Klaarzetten…" : "Zet in je kamer"}
            </button>
            <p className="mt-2 text-xs text-ink-3">
              {support === "quicklook"
                ? "Richt de camera op de vloer en beweeg de telefoon even rond. Het meubel staat er op ware grootte; met twee vingers draai je het."
                : "Richt de camera op de vloer en beweeg rustig rond tot er een rondje verschijnt. Tik om het meubel neer te zetten, tik opnieuw om het te verzetten."}
            </p>
          </>
        )}
        {error && <p className="mt-2 text-sm text-danger">{error}</p>}
      </div>

      {/* DOM-laag over het camerabeeld tijdens WebXR */}
      <div ref={overlay} className={xr === "off" ? "hidden" : "fixed inset-0 z-[80]"} onClick={(e) => e.stopPropagation()}>
        <div className="flex items-start gap-2 p-3 pt-[max(0.75rem,env(safe-area-inset-top))]">
          <p className="flex-1 rounded-full bg-black/55 px-4 py-2 text-sm text-white">
            {xr === "searching" ? "Richt op de vloer en tik als het rondje verschijnt" : `${item.name} staat er. Tik ergens anders om te verzetten.`}
          </p>
          <button className="grid h-10 w-10 place-items-center rounded-full bg-black/55 text-white" onClick={() => session.current?.end()} aria-label="AR stoppen">
            <Icon name="x" size={20} />
          </button>
        </div>
      </div>
    </div>
  );
}
