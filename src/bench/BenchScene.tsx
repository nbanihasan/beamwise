import { useEffect, useMemo, useRef, useState } from 'react';
import { Canvas, useThree, type ThreeEvent } from '@react-three/fiber';
import { Html, Line, OrbitControls } from '@react-three/drei';
import { EffectComposer, Bloom } from '@react-three/postprocessing';
import * as THREE from 'three';
import type { BenchObject, BenchState, Vec3 } from './types';
import type { Scenario } from './scenarios';
import type { TraceResult } from './tracer';
import type { BenchAnalysis } from './link';
import { LIMIT_TEXT } from './link';
import type { Action } from './store';
import { catalog } from './catalog';
import { BenchObjectModel } from './BenchModels';
import { MATERIALS, nmColor } from './optics';
import { fmtRate } from './advisor';
import { Particles, Starfield, StudioLights } from '@/three/kit/env';
import { Building, Road } from '@/three/kit/models';
import { inferno } from '@/three/colormap';

export type ViewMode = 'persp' | 'top' | 'front' | 'side';

export interface SceneApi {
  /** world point under a screen position on the horizontal plane y */
  screenToWorld: (clientX: number, clientY: number, y: number) => Vec3 | null;
  /** a sensible spawn point: where the camera looks, at height y */
  spawn: (y: number) => Vec3;
  view: (v: ViewMode) => void;
}

export interface Layers {
  rays: boolean;
  los: boolean;
  coverage: boolean;
  labels: boolean;
}

interface Props {
  state: BenchState;
  sc: Scenario;
  dispatch: (a: Action) => void;
  tr: TraceResult | null;
  an: BenchAnalysis | null;
  cov: { grid: Float32Array; n: number; min: Vec3; max: Vec3; peak: number } | null;
  layers: Layers;
  onApi: (api: SceneApi) => void;
}

export function displayScale(sc: Scenario) {
  if (sc.kind === 'lab') return 0.45;
  if (sc.kind === 'indoor') return 1;
  return sc.visualScale * 1.6;
}

function clamp(v: number, a: number, b: number) {
  return Math.min(b, Math.max(a, v));
}

function Environment({ sc, state }: { sc: Scenario; state: BenchState }) {
  const env = state.env;
  if (sc.kind === 'indoor' || sc.kind === 'lab') {
    const { L, W, H } = sc.room!;
    const wall = MATERIALS[env.wallMaterial] ?? MATERIALS.plaster;
    const floor = MATERIALS[env.floorMaterial] ?? MATERIALS.carpet;
    return (
      <>
        <mesh position={[0, H / 2, 0]} raycast={() => null}>
          <boxGeometry args={[L, H, W]} />
          <meshStandardMaterial color={new THREE.Color(wall.color).multiplyScalar(0.3)} side={THREE.BackSide} roughness={0.95} />
        </mesh>
        <mesh rotation-x={-Math.PI / 2} position={[0, 0.002, 0]} raycast={() => null}>
          <planeGeometry args={[L, W]} />
          <meshStandardMaterial color={new THREE.Color(floor.color).multiplyScalar(0.45)} roughness={0.95} />
        </mesh>
        <gridHelper args={[Math.max(L, W), Math.round(Math.max(L, W) / (sc.kind === 'lab' ? 0.25 : 0.5)), '#3a3f52', '#23262f']} position={[0, 0.006, 0]} raycast={() => null} />
        <lineSegments position={[0, H / 2, 0]} raycast={() => null}>
          <edgesGeometry args={[new THREE.BoxGeometry(L, H, W)]} />
          <lineBasicMaterial color="#4a5068" />
        </lineSegments>
      </>
    );
  }
  if (sc.kind === 'underwater') {
    return (
      <>
        <color attach="background" args={['#02141c']} />
        <fog attach="fog" args={['#03222e', 10, 70]} />
        <mesh rotation-x={-Math.PI / 2} raycast={() => null}>
          <planeGeometry args={[120, 60]} />
          <meshStandardMaterial color="#4a4632" roughness={1} />
        </mesh>
        <mesh position={[0, 15, 0]} rotation-x={Math.PI / 2} raycast={() => null}>
          <planeGeometry args={[120, 60]} />
          <meshStandardMaterial color="#3fa9ff" transparent opacity={0.25} side={THREE.DoubleSide} />
        </mesh>
        <Particles count={1200} box={[44, 15, 18]} center={[0, 7.5, 0]} color="#9fe8ff" size={0.06} drift={0.1} opacity={0.4} />
        <gridHelper args={[40, 40, '#2a5a5a', '#1a3a3a']} position={[0, 0.01, 0]} raycast={() => null} />
      </>
    );
  }
  if (sc.kind === 'space') {
    return (
      <>
        <color attach="background" args={['#010103']} />
        <Starfield count={2500} radius={4e6} />
        <directionalLight position={[1, 0.4, 0.3]} intensity={2} />
      </>
    );
  }
  // outdoor
  return (
    <>
      <color attach="background" args={[env.ambient === 'daylight' ? '#0e1420' : '#05060a']} />
      <fog attach="fog" args={[env.ambient === 'daylight' ? '#0e1420' : '#05060a', 40 * Math.max(1, sc.visualScale), Math.max(80, env.visibilityKm * 1000) * Math.max(1, sc.visualScale * 0.4)]} />
      <mesh rotation-x={-Math.PI / 2} raycast={() => null}>
        <planeGeometry args={[(sc.bounds.max[0] - sc.bounds.min[0]) * 3, (sc.bounds.max[2] - sc.bounds.min[2]) * 3]} />
        <meshStandardMaterial color="#14161b" roughness={0.95} />
      </mesh>
      {sc.id === 'street' && <Road length={70} width={8} position={[1, 0, 0]} />}
      {sc.id === 'fso' && (
        <>
          <Building position={[-205, 0, 0]} w={20} h={29.5} d={20} seed={3} />
          <Building position={[205, 0, 0]} w={20} h={29.5} d={20} seed={8} />
          {[-120, -40, 60, 140].map((x, i) => (
            <Building key={x} position={[x, 0, -45 + (i % 2) * 90]} w={18} h={18 + i * 6} d={18} seed={i + 11} />
          ))}
        </>
      )}
      <gridHelper args={[(sc.bounds.max[0] - sc.bounds.min[0]) * 1.2, 30, '#2a2d3a', '#1a1c24']} position={[0, 0.02, 0]} raycast={() => null} />
    </>
  );
}

function Rays({ tr, k }: { tr: TraceResult; k: number }) {
  const geo = useMemo(() => {
    const pos: number[] = [];
    const col: number[] = [];
    const c = new THREE.Color();
    for (const r of tr.rays) {
      c.set(nmColor(r.nm));
      // bright first leg, fading with every bounce; rays that reach a receiver stay bright
      let a = r.hit ? 1 : 0.45;
      for (let i = 0; i < r.pts.length - 1; i++) {
        pos.push(...r.pts[i], ...r.pts[i + 1]);
        col.push(c.r * a, c.g * a, c.b * a, c.r * a, c.g * a, c.b * a);
        a *= r.hit ? 0.9 : 0.35;
      }
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    g.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
    return g;
  }, [tr]);
  useEffect(() => () => geo.dispose(), [geo]);
  void k;
  return (
    <lineSegments geometry={geo} raycast={() => null} renderOrder={4}>
      <lineBasicMaterial vertexColors transparent opacity={0.85} blending={THREE.AdditiveBlending} depthWrite={false} toneMapped={false} />
    </lineSegments>
  );
}

function Coverage({ cov, y }: { cov: NonNullable<Props['cov']>; y: number }) {
  const tex = useMemo(() => {
    const data = new Uint8Array(cov.n * cov.n * 4);
    const lo = cov.peak * 1e-3;
    for (let i = 0; i < cov.n * cov.n; i++) {
      const v = cov.grid[i];
      const t = v > lo ? Math.log10(v / lo) / 3 : 0;
      const [r, g, b] = inferno(0.05 + 0.95 * t);
      data.set([r, g, b, v > lo ? 210 : 40], i * 4);
    }
    const t = new THREE.DataTexture(data, cov.n, cov.n, THREE.RGBAFormat);
    t.magFilter = THREE.LinearFilter;
    t.minFilter = THREE.LinearFilter;
    t.colorSpace = THREE.SRGBColorSpace;
    t.needsUpdate = true;
    return t;
  }, [cov]);
  useEffect(() => () => tex.dispose(), [tex]);
  const w = cov.max[0] - cov.min[0];
  const d = cov.max[2] - cov.min[2];
  return (
    <mesh position={[(cov.max[0] + cov.min[0]) / 2, y, (cov.max[2] + cov.min[2]) / 2]} rotation-x={Math.PI / 2} raycast={() => null} renderOrder={2}>
      <planeGeometry args={[w, d]} />
      <meshBasicMaterial map={tex} transparent depthWrite={false} side={THREE.DoubleSide} toneMapped={false} />
    </mesh>
  );
}

function Interaction({ state, sc, dispatch, onApi }: Pick<Props, 'state' | 'sc' | 'dispatch' | 'onApi'>) {
  const { camera, gl, controls } = useThree() as unknown as { camera: THREE.PerspectiveCamera; gl: THREE.WebGLRenderer; controls: (THREE.EventDispatcher & { target: THREE.Vector3; enabled: boolean; update: () => void }) | null };
  const ray = useMemo(() => new THREE.Raycaster(), []);
  const anim = useRef<{ pos: THREE.Vector3; tgt: THREE.Vector3; t: number } | null>(null);

  useEffect(() => {
    const toNdc = (x: number, y: number) => {
      const r = gl.domElement.getBoundingClientRect();
      return new THREE.Vector2(((x - r.left) / r.width) * 2 - 1, -((y - r.top) / r.height) * 2 + 1);
    };
    const center = new THREE.Vector3(...sc.camera.target);
    const size = new THREE.Vector3(sc.bounds.max[0] - sc.bounds.min[0], sc.bounds.max[1] - sc.bounds.min[1], sc.bounds.max[2] - sc.bounds.min[2]);
    const span = Math.max(size.x, size.z);
    onApi({
      screenToWorld: (x, y, h) => {
        ray.setFromCamera(toNdc(x, y), camera);
        const p = new THREE.Vector3();
        return ray.ray.intersectPlane(new THREE.Plane(new THREE.Vector3(0, 1, 0), -h), p) ? [p.x, p.y, p.z] : null;
      },
      spawn: (h) => {
        const t = controls?.target ?? center;
        ray.set(camera.position, t.clone().sub(camera.position).normalize());
        const p = new THREE.Vector3();
        const hit = ray.ray.intersectPlane(new THREE.Plane(new THREE.Vector3(0, 1, 0), -h), p);
        return hit ? [clamp(p.x, sc.bounds.min[0], sc.bounds.max[0]), h, clamp(p.z, sc.bounds.min[2], sc.bounds.max[2])] : [t.x, h, t.z];
      },
      view: (v) => {
        const tgt = center.clone();
        const d = span * 1.15 + 1;
        const pos =
          v === 'top'
            ? tgt.clone().add(new THREE.Vector3(0.0001, d * 1.05, 0))
            : v === 'front'
              ? tgt.clone().add(new THREE.Vector3(0, size.y * 0.4, d))
              : v === 'side'
                ? tgt.clone().add(new THREE.Vector3(d, size.y * 0.4, 0))
                : new THREE.Vector3(...sc.camera.pos);
        anim.current = { pos, tgt, t: 0 };
        const step = () => {
          const a = anim.current;
          if (!a || !controls) return;
          a.t += 1 / 40;
          camera.position.lerp(a.pos, 0.18);
          controls.target.lerp(a.tgt, 0.18);
          controls.update();
          if (a.t < 1) requestAnimationFrame(step);
          else anim.current = null;
        };
        requestAnimationFrame(step);
      },
    });
  }, [camera, gl, controls, sc, ray, onApi]);
  void state;
  void dispatch;
  return null;
}

function ObjectNode({ o, selected, k, sc, dispatch, report }: { o: BenchObject; selected: boolean; k: number; sc: Scenario; dispatch: (a: Action) => void; report?: BenchAnalysis['reports'][number] }) {
  const [hover, setHover] = useState(false);
  const { camera, gl, controls } = useThree() as unknown as { camera: THREE.PerspectiveCamera; gl: THREE.WebGLRenderer; controls: { enabled: boolean } | null };
  const cat = catalog(o.kind);
  const env = cat.category === 'environment';

  const onDown = (e: ThreeEvent<PointerEvent>) => {
    if (e.button !== 0) return;
    e.stopPropagation();
    dispatch({ t: 'select', id: o.id });
    const vertical = e.shiftKey || e.altKey;
    const p0 = new THREE.Vector3(...o.pos);
    const camDir = new THREE.Vector3();
    camera.getWorldDirection(camDir);
    const plane = vertical ? new THREE.Plane().setFromNormalAndCoplanarPoint(new THREE.Vector3(camDir.x, 0, camDir.z).normalize(), p0) : new THREE.Plane(new THREE.Vector3(0, 1, 0), -p0.y);
    const hit = new THREE.Vector3();
    if (!e.ray.intersectPlane(plane, hit)) return;
    const offset = p0.clone().sub(hit);
    const ray = new THREE.Raycaster();
    if (controls) controls.enabled = false;
    let moved = false;
    const move = (ev: PointerEvent) => {
      const r = gl.domElement.getBoundingClientRect();
      ray.setFromCamera(new THREE.Vector2(((ev.clientX - r.left) / r.width) * 2 - 1, -((ev.clientY - r.top) / r.height) * 2 + 1), camera);
      const h = new THREE.Vector3();
      if (!ray.ray.intersectPlane(plane, h)) return;
      const np = h.add(offset);
      const sn = ev.ctrlKey || ev.metaKey ? sc.snap / 4 : sc.snap;
      const snap = (v: number) => Math.round(v / sn) * sn;
      const b = sc.bounds;
      let pos: Vec3;
      if (vertical) pos = [o.pos[0], clamp(snap(np.y), env ? 0 : b.min[1], b.max[1]), o.pos[2]];
      else pos = [clamp(snap(np.x), b.min[0], b.max[0]), o.pos[1], clamp(snap(np.z), b.min[2], b.max[2])];
      moved = true;
      dispatch({ t: 'update', id: o.id, patch: { pos }, commit: false });
    };
    const up = () => {
      window.removeEventListener('pointermove', move);
      window.removeEventListener('pointerup', up);
      if (controls) controls.enabled = true;
      if (moved) dispatch({ t: 'endGesture' });
      document.body.style.cursor = '';
    };
    window.addEventListener('pointermove', move);
    window.addEventListener('pointerup', up);
    document.body.style.cursor = vertical ? 'ns-resize' : 'grabbing';
  };

  const hitR = env ? 0 : Math.max(0.12, 0.22 * k);
  const tone = report ? (report.limit === 'ok' ? 'good' : report.throughput > 0 ? 'warn' : 'bad') : '';
  return (
    <group
      position={o.pos}
      onPointerDown={onDown}
      onPointerOver={(e) => {
        e.stopPropagation();
        setHover(true);
        document.body.style.cursor = 'grab';
      }}
      onPointerOut={() => {
        setHover(false);
        document.body.style.cursor = '';
      }}
    >
      <BenchObjectModel o={o} selected={selected} hovered={hover} k={k} />
      {!env && (
        <mesh visible={false}>
          <sphereGeometry args={[hitR, 10, 8]} />
          <meshBasicMaterial />
        </mesh>
      )}
      {report && (
        <Html position={[0, 0.32 * k + (sc.kind === 'lab' ? 0.05 : 0.15), 0]} center zIndexRange={[15, 0]} style={{ pointerEvents: 'none' }}>
          <div className={`bench-tag ${tone}`}>
            <b>{report.name}</b>
            <span>{report.throughput > 0 ? fmtRate(report.throughput) : LIMIT_TEXT[report.limit]}</span>
            {isFinite(report.snrDb) && <span className="mono">{report.snrDb.toFixed(0)} dB</span>}
          </div>
        </Html>
      )}
      {!report && (selected || hover) && (
        <Html position={[0, 0.3 * k + 0.12, 0]} center zIndexRange={[15, 0]} style={{ pointerEvents: 'none' }}>
          <div className="bench-tag">
            <b>{o.name}</b>
          </div>
        </Html>
      )}
    </group>
  );
}

export function BenchCanvas({ state, sc, dispatch, tr, an, cov, layers, onApi }: Props) {
  const k = displayScale(sc);
  const reportFor = (id: string) => an?.reports.find((r) => r.rxId === id);
  return (
    <Canvas
      key={sc.id}
      dpr={[1, 2]}
      camera={{ position: sc.camera.pos, fov: 42, near: sc.camera.near, far: sc.camera.far }}
      gl={{ antialias: true, alpha: false, powerPreference: 'high-performance', logarithmicDepthBuffer: sc.kind === 'space' }}
      onPointerMissed={(e) => e.button === 0 && dispatch({ t: 'select', id: null })}
    >
      <color attach="background" args={['#06070b']} />
      <StudioLights intensity={sc.kind === 'lab' ? 0.55 : 0.7} env={sc.kind !== 'space'} />
      <Environment sc={sc} state={state} />
      {state.objects.map((o) => (
        <ObjectNode key={o.id} o={o} selected={state.selected === o.id} k={k} sc={sc} dispatch={dispatch} report={layers.labels ? reportFor(o.id) : undefined} />
      ))}
      {layers.rays && tr && <Rays tr={tr} k={k} />}
      {layers.los &&
        tr?.losLinks.map((l, i) => (
          <Line key={i} points={[l.from, l.to]} color={l.blocked ? '#ff6f86' : '#5ee0a8'} lineWidth={l.blocked ? 1.5 : 1.2} dashed={l.blocked} dashSize={0.15 * k} gapSize={0.1 * k} transparent opacity={l.blocked ? 0.9 : 0.55} raycast={() => null} />
        ))}
      {layers.coverage && cov && <Coverage cov={cov} y={cov.min[1] + 0.003} />}
      <OrbitControls makeDefault target={sc.camera.target} enableDamping dampingFactor={0.1} maxDistance={sc.camera.far * 0.3} minDistance={sc.camera.near * 10} screenSpacePanning />
      <Interaction state={state} sc={sc} dispatch={dispatch} onApi={onApi} />
      <EffectComposer multisampling={0}>
        <Bloom intensity={0.75} luminanceThreshold={0.6} luminanceSmoothing={0.2} mipmapBlur radius={0.6} />
      </EffectComposer>
    </Canvas>
  );
}
