import { useMemo, useRef, useState } from 'react';
import * as THREE from 'three';
import { useFrame } from '@react-three/fiber';
import { Line } from '@react-three/drei';
import { Stage } from '@/three/Stage';
import { Plot } from '@/viz/Plot';
import { Readout, Readouts, Slider, Widget } from '@/viz/controls';
import { impulseResponse, isiLimitedRate, KOMINE_ROOM, lambertianOrder, type Vec3 } from '@/sim/lambertian';
import { dB, eng, PHYS } from '@/sim/math';

/** LOS + first-order wall reflections: impulse response, delay spread and the resulting bandwidth limit. */
const room = KOMINE_ROOM;
const T = (p: Vec3): [number, number, number] => [p[0] - room.L / 2, p[2], p[1] - room.W / 2];

interface Path {
  pts: Vec3[];
  len: number;
  w: number;
}

function Rays({ paths, tx, rx }: { paths: Path[]; tx: Vec3; rx: Vec3 }) {
  const dots = useRef<THREE.InstancedMesh>(null);
  const dummy = useMemo(() => new THREE.Object3D(), []);
  const maxLen = Math.max(...paths.map((p) => p.len), 1);
  useFrame(({ clock }) => {
    const m = dots.current;
    if (!m) return;
    const cycle = 2.6;
    const t = (clock.getElapsedTime() % cycle) / cycle; // fraction of the cycle
    paths.forEach((p, i) => {
      const s = t * maxLen * 1.25; // distance travelled by the pulse front
      if (s > p.len) {
        dummy.position.set(0, -99, 0);
        dummy.scale.setScalar(0.0001);
      } else {
        // locate along the polyline
        let rem = s;
        let pos = p.pts[0];
        for (let k = 0; k < p.pts.length - 1; k++) {
          const a = p.pts[k];
          const b = p.pts[k + 1];
          const L = Math.hypot(b[0] - a[0], b[1] - a[1], b[2] - a[2]);
          if (rem <= L) {
            const f = rem / L;
            pos = [a[0] + (b[0] - a[0]) * f, a[1] + (b[1] - a[1]) * f, a[2] + (b[2] - a[2]) * f];
            break;
          }
          rem -= L;
          pos = b;
        }
        dummy.position.set(...T(pos));
        dummy.scale.setScalar(i === 0 ? 0.09 : 0.03 + 0.05 * p.w);
      }
      dummy.updateMatrix();
      m.setMatrixAt(i, dummy.matrix);
    });
    m.instanceMatrix.needsUpdate = true;
  });
  return (
    <>
      {paths.map((p, i) => (
        <Line key={i} points={p.pts.map(T)} color={i === 0 ? '#ffcf6b' : '#6d8dff'} lineWidth={i === 0 ? 2.2 : 0.6 + 1.6 * p.w} transparent opacity={i === 0 ? 0.95 : 0.15 + 0.6 * p.w} />
      ))}
      <instancedMesh ref={dots} args={[undefined, undefined, paths.length]} frustumCulled={false}>
        <sphereGeometry args={[1, 10, 10]} />
        <meshBasicMaterial color="#fff2c8" toneMapped={false} />
      </instancedMesh>
      <mesh position={T(tx)}>
        <boxGeometry args={[0.5, 0.04, 0.5]} />
        <meshStandardMaterial color="#fff" emissive="#fff1cc" emissiveIntensity={3} toneMapped={false} />
      </mesh>
      <mesh position={T(rx)}>
        <cylinderGeometry args={[0.1, 0.1, 0.06, 24]} />
        <meshStandardMaterial color="#5ad8ff" emissive="#5ad8ff" emissiveIntensity={2} toneMapped={false} />
      </mesh>
    </>
  );
}

export default function MultipathLab() {
  const [rho, setRho] = useState(0.8);
  const [x, setX] = useState(0.6);
  const [y, setY] = useState(0.8);
  const [fov, setFov] = useState(85);
  const [semi, setSemi] = useState(60);
  const tx: Vec3 = [2.5, 2.5, 3];
  const rxPos: Vec3 = [x, y, 0.85];

  const ir = useMemo(
    () => impulseResponse(room, { pos: tx, normal: [0, 0, -1], m: lambertianOrder(semi) }, { pos: rxPos, normal: [0, 0, 1], area: 1e-4, fovDeg: fov }, rho, 0.1, 0.25e-9),
    [rho, x, y, fov, semi], // eslint-disable-line react-hooks/exhaustive-deps
  );

  // a sample of wall reflection paths for the 3D view (strongest patches)
  const paths = useMemo<Path[]>(() => {
    const out: Path[] = [{ pts: [tx, rxPos], len: Math.hypot(tx[0] - x, tx[1] - y, 3 - 0.85), w: 1 }];
    const cand: { p: Vec3; g: number }[] = [];
    const walls: [Vec3, Vec3, Vec3, number, number][] = [
      [[0, 0, 0], [0, 1, 0], [1, 0, 0], room.W, room.H],
      [[room.L, 0, 0], [0, 1, 0], [-1, 0, 0], room.W, room.H],
      [[0, 0, 0], [1, 0, 0], [0, 1, 0], room.L, room.H],
      [[0, room.W, 0], [1, 0, 0], [0, -1, 0], room.L, room.H],
    ];
    for (const [o, u, n, lu, lv] of walls) {
      for (let a = 0.25; a < lu; a += 0.5) {
        for (let b = 0.25; b < lv; b += 0.5) {
          const p: Vec3 = [o[0] + u[0] * a, o[1] + u[1] * a, b];
          const v1 = [p[0] - tx[0], p[1] - tx[1], p[2] - tx[2]];
          const d1 = Math.hypot(...v1);
          const v2 = [rxPos[0] - p[0], rxPos[1] - p[1], rxPos[2] - p[2]];
          const d2 = Math.hypot(...v2);
          const cphi = -v1[2] / d1;
          const ca = -(v1[0] * n[0] + v1[1] * n[1]) / d1;
          const cb = (v2[0] * n[0] + v2[1] * n[1]) / d2;
          const cpsi = -v2[2] / d2; // receiver faces up: cos ψ = −v2·ẑ / |v2|
          const psiOk = Math.acos(Math.min(1, Math.max(-1, cpsi))) <= (fov * Math.PI) / 180;
          if (cphi <= 0 || ca <= 0 || cb <= 0 || !psiOk || cpsi <= 0) continue;
          cand.push({ p, g: (Math.pow(cphi, lambertianOrder(semi)) * ca * cb * cpsi) / (d1 * d1 * d2 * d2) });
        }
      }
    }
    cand.sort((a, b) => b.g - a.g);
    const top = cand.slice(0, 26);
    const gmax = top[0]?.g ?? 1;
    for (const c of top) {
      out.push({
        pts: [tx, c.p, rxPos],
        len: Math.hypot(c.p[0] - tx[0], c.p[1] - tx[1], c.p[2] - tx[2]) + Math.hypot(rxPos[0] - c.p[0], rxPos[1] - c.p[1], rxPos[2] - c.p[2]),
        w: c.g / gmax,
      });
    }
    return out;
  }, [x, y, fov, semi]); // eslint-disable-line react-hooks/exhaustive-deps

  const tNs = Array.from(ir.h, (_, i) => (ir.t0 + i * ir.dt) * 1e9);
  const total = ir.losGain + ir.diffuseGain;
  const hNorm = Array.from(ir.h, (v) => v / (ir.dt * 1e9) / Math.max(total, 1e-30));
  // frequency response from the impulse response
  const freq = useMemo(() => {
    const f: number[] = [];
    const H: number[] = [];
    let f3 = NaN;
    for (let k = 0; k <= 160; k++) {
      const fr = Math.pow(10, 6 + (k / 160) * 3.3); // 1 MHz .. 2 GHz
      let re = 0;
      let im = 0;
      ir.h.forEach((g, i) => {
        const t = i * ir.dt;
        re += g * Math.cos(2 * Math.PI * fr * t);
        im -= g * Math.sin(2 * Math.PI * fr * t);
      });
      const mag = dB((re * re + im * im) / Math.max(total * total, 1e-60));
      f.push(fr / 1e6);
      H.push(mag);
      if (isNaN(f3) && mag < -3) f3 = fr;
    }
    return { f, H, f3 };
  }, [ir, total]);

  const kFactor = ir.diffuseGain > 0 ? dB(ir.losGain / ir.diffuseGain) : Infinity;
  return (
    <Widget
      title="Multipath: light that takes the long way round"
      eyebrow="3D · impulse response"
      controls={
        <>
          <Slider label="Wall reflectivity ρ" value={rho} min={0} max={0.95} step={0.01} onChange={setRho} format={(v) => v.toFixed(2)} />
          <Slider label="Receiver x" value={x} min={0.1} max={4.9} step={0.05} onChange={setX} format={(v) => `${v.toFixed(2)} m`} />
          <Slider label="Receiver y" value={y} min={0.1} max={4.9} step={0.05} onChange={setY} format={(v) => `${v.toFixed(2)} m`} />
          <Slider label="Receiver FOV" value={fov} min={20} max={90} step={1} onChange={setFov} format={(v) => `${v.toFixed(0)}°`} />
          <Slider label="LED semi-angle" value={semi} min={15} max={80} step={1} onChange={setSemi} format={(v) => `${v.toFixed(0)}°`} />
          <Readouts>
            <Readout k="RMS delay spread" v={`${(ir.rmsDelay * 1e9).toFixed(2)} ns`} />
            <Readout k="LOS / diffuse" v={isFinite(kFactor) ? `${kFactor.toFixed(1)} dB` : 'LOS only'} />
            <Readout k="−3 dB bandwidth" v={isNaN(freq.f3) ? '> 2 GHz' : eng(freq.f3, 'Hz')} />
            <Readout k="ISI-free rate ≈" v={eng(isiLimitedRate(ir.rmsDelay), 'Bd')} />
          </Readouts>
        </>
      }
      caption={
        <p>
          The yellow ray is line of sight; blue rays bounce once off a wall and arrive later because they travel further (1 m ≈ {(1e9 / PHYS.c).toFixed(2)} ns). The
          receiver sees the sum: a sharp LOS spike followed by a diffuse tail. Its spread in time, τ<sub>rms</sub>, limits the symbol rate before inter-symbol
          interference sets in. Move the receiver into a corner, or narrow its FOV so the LED drops out of view, and watch the tail take over.
        </p>
      }
    >
      <Stage height={330} camera={[5, 4.8, 6]} target={[0, 1, 0]} bloom={0.9}>
        <lineSegments position={[0, room.H / 2, 0]}>
          <edgesGeometry args={[new THREE.BoxGeometry(room.L, room.H, room.W)]} />
          <lineBasicMaterial color="#3a4462" />
        </lineSegments>
        <mesh rotation={[-Math.PI / 2, 0, 0]}>
          <planeGeometry args={[room.L, room.W]} />
          <meshStandardMaterial color="#10131c" />
        </mesh>
        <ambientLight intensity={0.5} />
        <Rays paths={paths} tx={tx} rx={rxPos} />
      </Stage>
      <div className="grid-2">
        <Plot
          title="Impulse response h(t) · LOS spike runs off the top"
          height={190}
          xLabel="arrival time (ns)"
          series={[{ x: tNs, y: hNorm, color: 'var(--c1)', kind: 'area', width: 1.2 }]}
          y={[0, Math.max(...hNorm.slice(1), 0.05) * 1.3]}
          vlines={[{ x: (ir.meanDelay) * 1e9, label: 'mean delay', color: 'var(--phosphor)' }]}
        />
        <Plot
          title="Channel frequency response |H(f)|"
          height={190}
          logX
          xLabel="frequency (MHz)"
          yLabel="dB"
          y={[-25, 2]}
          series={[{ x: freq.f, y: freq.H, color: 'var(--phosphor)', width: 2 }]}
          hlines={[{ y: -3, label: '−3 dB' }]}
        />
      </div>
    </Widget>
  );
}
