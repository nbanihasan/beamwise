import { useEffect, useMemo, useRef, useState, type MutableRefObject } from 'react';
import * as THREE from 'three';
import { useFrame } from '@react-three/fiber';
import { Html } from '@react-three/drei';
import { Stage } from '@/three/Stage';
import { Plot } from '@/viz/Plot';
import { Segmented, Slider, Widget } from '@/viz/controls';

/**
 * Four ways to turn photons into current. PIN: one photon → one electron-hole pair.
 * APD: impact ionisation multiplies carriers (random gain → excess noise).
 * SPAD: biased above breakdown, one photon → full avalanche, then dead time.
 * PMT: photocathode + dynode chain, ~4–5× per stage, ~10⁶ overall.
 */
type Kind = 'pin' | 'apd' | 'spad' | 'pmt';

const SPECS: Record<Kind, { name: string; gain: string; bw: string; sens: string; notes: string }> = {
  pin: { name: 'PIN photodiode', gain: '1', bw: 'up to tens of GHz (small area)', sens: 'thermal-noise limited', notes: 'Cheap, linear, robust. The default VLC/LiFi receiver.' },
  apd: { name: 'Avalanche photodiode', gain: '10–200', bw: 'up to ~10 GHz', sens: '5–15 dB better than PIN', notes: 'Internal gain beats amplifier noise; random gain adds excess noise F(M); needs ~100 V bias.' },
  spad: { name: 'Single-photon avalanche diode', gain: '~10⁶ (digital pulse)', bw: 'limited by dead time (~ns–µs)', sens: 'single-photon level', notes: 'Counts photons. Saturates when photons arrive faster than the dead time; arrays restore dynamic range.' },
  pmt: { name: 'Photomultiplier tube', gain: '10⁵–10⁷', bw: '~100s of MHz', sens: 'single-photon level', notes: 'Vacuum tube with photocathode and dynodes. Superb sensitivity, large area, but bulky, fragile and needs ~1 kV.' },
};

interface P {
  x: number;
  y: number;
  z: number;
  vx: number;
  vy: number;
  life: number;
  kind: 0 | 1 | 2; // photon, electron, hole
  gen: number;
  stage: number;
  lost: boolean;
}

const MAXP = 900;
const DYN = [
  [-0.55, 0.25],
  [0.55, -0.15],
  [-0.55, -0.55],
  [0.55, -0.95],
  [-0.55, -1.35],
];

function Device({ kind, rate, pulses }: { kind: Kind; rate: number; pulses: MutableRefObject<number[]> }) {
  const mesh = useRef<THREE.InstancedMesh>(null);
  const body = useRef<THREE.MeshStandardMaterial>(null);
  const dummy = useMemo(() => new THREE.Object3D(), []);
  const col = useMemo(() => ({ ph: new THREE.Color('#ffd25a').multiplyScalar(2.2), lost: new THREE.Color('#555a66'), e: new THREE.Color('#6fa8ff').multiplyScalar(2), h: new THREE.Color('#ff7aa8').multiplyScalar(1.6) }), []);
  const S = useRef({ ps: [] as P[], acc: 0, dead: 0, t: 0 });
  useEffect(() => {
    S.current.ps = [];
    S.current.dead = 0;
  }, [kind]);

  useFrame((_, dtRaw) => {
    const dt = Math.min(dtRaw, 0.05);
    const st = S.current;
    st.t += dt;
    st.dead = Math.max(0, st.dead - dt);
    st.acc += dt * rate;
    while (st.acc > 1 && st.ps.length < MAXP) {
      st.acc -= 1;
      st.ps.push({ x: (Math.random() - 0.5) * 1.6, y: 2.4, z: (Math.random() - 0.5) * 0.8, vx: 0, vy: -3, life: 3, kind: 0, gen: 0, stage: 0, lost: false });
    }
    let out = 0;
    const add: P[] = [];
    for (const p of st.ps) {
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.life -= dt;
      if (p.kind === 0 && !p.lost && p.y <= 0.55) {
        // photon absorbed
        if (kind === 'spad' && st.dead > 0) {
          p.lost = true; // arrives during dead time: not counted
          continue;
        }
        p.life = 0;
        if (kind === 'pin') {
          add.push({ ...p, kind: 1, vy: -1.6, vx: 0, life: 0.7, gen: 0, stage: 0, lost: false });
          add.push({ ...p, kind: 2, vy: 1.4, vx: 0, life: 0.25, gen: 0, stage: 0, lost: false });
          out += 1;
        } else if (kind === 'apd' || kind === 'spad') {
          add.push({ ...p, kind: 1, vy: -1.8, vx: 0, life: 1.2, gen: 0, stage: 0, lost: false });
          if (kind === 'spad') {
            st.dead = 0.45;
            out += 60;
          } else {
            // random gain: geometric-ish distribution around ~20
            let g = 1;
            for (let k = 0; k < 6; k++) if (Math.random() < 0.72) g *= 2;
            out += g * 0.9;
          }
        } else {
          add.push({ ...p, kind: 1, x: p.x * 0.3, vy: 0, vx: 0, life: 4, gen: 0, stage: 0, lost: false });
          let g = 1;
          for (let k = 0; k < 5; k++) g *= 3 + Math.random() * 2;
          out += g / 12;
        }
      }
      // carrier multiplication
      if (p.kind === 1 && (kind === 'apd' || kind === 'spad')) {
        const thr = -0.05 - 0.13 * p.gen;
        const maxGen = kind === 'spad' ? 6 : 5;
        if (p.y < thr && p.gen < maxGen) {
          p.gen++;
          if (kind === 'spad' || Math.random() < 0.72) add.push({ ...p, x: p.x + (Math.random() - 0.5) * 0.18, z: p.z + (Math.random() - 0.5) * 0.18, gen: p.gen });
        }
        if (p.y < -1.0) p.life = 0;
      }
      if (p.kind === 1 && kind === 'pmt') {
        // hop dynode to dynode
        const target = p.stage < DYN.length ? DYN[p.stage] : [0, -1.75];
        const dx = target[0] - p.x;
        const dy = target[1] - p.y;
        const d = Math.hypot(dx, dy);
        p.vx = (dx / (d || 1)) * 2.4;
        p.vy = (dy / (d || 1)) * 2.4;
        if (d < 0.06) {
          p.stage++;
          if (p.stage <= DYN.length) {
            const n = p.stage < 3 ? 2 : 1;
            for (let k = 0; k < n; k++) add.push({ ...p, x: p.x + (Math.random() - 0.5) * 0.15, z: p.z + (Math.random() - 0.5) * 0.3 });
          } else p.life = 0;
        }
      }
    }
    st.ps = st.ps.filter((p) => p.life > 0 && p.y > -2.2).concat(add).slice(0, MAXP);
    pulses.current.push(out);
    if (pulses.current.length > 240) pulses.current.shift();

    if (body.current) {
      const target = kind === 'spad' && st.dead > 0 ? 0.9 : 0.05;
      body.current.emissiveIntensity = THREE.MathUtils.lerp(body.current.emissiveIntensity, target, 0.3);
    }
    const m = mesh.current;
    if (!m) return;
    for (let i = 0; i < MAXP; i++) {
      const p = st.ps[i];
      if (!p) {
        dummy.position.set(0, -99, 0);
        dummy.scale.setScalar(0.0001);
      } else {
        dummy.position.set(p.x, p.y, p.z);
        dummy.scale.setScalar(p.kind === 0 ? 0.045 : 0.035);
        m.setColorAt(i, p.kind === 0 ? (p.lost ? col.lost : col.ph) : p.kind === 1 ? col.e : col.h);
      }
      dummy.updateMatrix();
      m.setMatrixAt(i, dummy.matrix);
    }
    m.instanceMatrix.needsUpdate = true;
    if (m.instanceColor) m.instanceColor.needsUpdate = true;
  });

  return (
    <>
      <ambientLight intensity={0.45} />
      <directionalLight position={[3, 5, 4]} intensity={1} />
      {kind !== 'pmt' ? (
        <>
          <mesh position={[0, 0.62, 0]}>
            <boxGeometry args={[2, 0.1, 1.1]} />
            <meshStandardMaterial color="#2a3550" transparent opacity={0.55} />
          </mesh>
          <mesh position={[0, -0.3, 0]}>
            <boxGeometry args={[2, 1.7, 1.05]} />
            <meshStandardMaterial ref={body} color="#1b2233" emissive="#ff3b5c" emissiveIntensity={0.05} transparent opacity={0.35} depthWrite={false} />
          </mesh>
          {(kind === 'apd' || kind === 'spad') && (
            <mesh position={[0, -0.45, 0]}>
              <boxGeometry args={[2.02, 0.75, 1.07]} />
              <meshStandardMaterial color="#5a2a6a" transparent opacity={0.25} depthWrite={false} />
            </mesh>
          )}
          <mesh position={[0, -1.2, 0]}>
            <boxGeometry args={[2.1, 0.08, 1.15]} />
            <meshStandardMaterial color="#c9ccd4" metalness={0.9} roughness={0.3} />
          </mesh>
          <Html position={[1.55, 0.62, 0]} center>
            <div className="scene-label">absorption</div>
          </Html>
          {(kind === 'apd' || kind === 'spad') && (
            <Html position={[1.75, -0.45, 0]} center>
              <div className="scene-label">{kind === 'spad' ? 'avalanche (Geiger mode)' : 'multiplication region'}</div>
            </Html>
          )}
        </>
      ) : (
        <>
          <mesh position={[0, -0.6, 0]}>
            <cylinderGeometry args={[1.25, 1.25, 2.9, 48, 1, true]} />
            <meshPhysicalMaterial color="#8fb3ff" transparent opacity={0.12} roughness={0.05} side={THREE.DoubleSide} depthWrite={false} />
          </mesh>
          <mesh position={[0, 0.6, 0]}>
            <boxGeometry args={[1.8, 0.05, 0.9]} />
            <meshStandardMaterial color="#c58a3a" metalness={0.6} roughness={0.4} />
          </mesh>
          {DYN.map(([x, y], i) => (
            <mesh key={i} position={[x, y, 0]} rotation={[0, 0, x < 0 ? -0.5 : 0.5]}>
              <boxGeometry args={[0.6, 0.05, 0.6]} />
              <meshStandardMaterial color="#9aa3b5" metalness={0.8} roughness={0.3} />
            </mesh>
          ))}
          <mesh position={[0, -1.8, 0]}>
            <boxGeometry args={[0.8, 0.06, 0.6]} />
            <meshStandardMaterial color="#d6d9e0" metalness={0.9} roughness={0.25} />
          </mesh>
          <Html position={[1.75, 0.6, 0]} center>
            <div className="scene-label">photocathode</div>
          </Html>
          <Html position={[1.6, -0.55, 0]} center>
            <div className="scene-label">dynodes ×4 each</div>
          </Html>
          <Html position={[1.3, -1.8, 0]} center>
            <div className="scene-label">anode</div>
          </Html>
        </>
      )}
      <instancedMesh ref={mesh} args={[undefined, undefined, MAXP]} frustumCulled={false}>
        <sphereGeometry args={[1, 8, 8]} />
        <meshBasicMaterial toneMapped={false} />
      </instancedMesh>
    </>
  );
}

export default function DetectorLab() {
  const [kind, setKind] = useState<Kind>('apd');
  const [rate, setRate] = useState(4);
  const pulses = useRef<number[]>([]);
  const [trace, setTrace] = useState<number[]>([]);
  useEffect(() => {
    pulses.current = [];
    const id = setInterval(() => setTrace([...pulses.current]), 120);
    return () => clearInterval(id);
  }, [kind]);
  const s = SPECS[kind];
  return (
    <Widget
      title="From photons to electrons: four detectors"
      eyebrow="3D · detectors"
      controls={
        <>
          <Segmented label="Detector" value={kind} onChange={setKind} options={[{ value: 'pin', label: 'PIN' }, { value: 'apd', label: 'APD' }, { value: 'spad', label: 'SPAD' }, { value: 'pmt', label: 'PMT' }]} />
          <Slider label="Photon arrival rate (slowed down)" value={rate} min={0.5} max={20} step={0.5} onChange={setRate} format={(v) => `${v.toFixed(1)} /s`} />
          <div style={{ fontSize: '0.86rem', display: 'grid', gap: 6 }}>
            <div>
              <strong>{s.name}</strong>
            </div>
            <div className="muted">Gain: {s.gain}</div>
            <div className="muted">Bandwidth: {s.bw}</div>
            <div className="muted">Sensitivity: {s.sens}</div>
            <div>{s.notes}</div>
          </div>
        </>
      }
      caption={
        <p>
          Yellow dots are photons, blue are electrons, pink are holes. Compare the output traces: the PIN gives a tiny, faithful pulse per photon; the APD's pulses are
          larger but vary randomly (this is the source of excess noise); the SPAD gives identical digital pulses, and photons arriving during its dead time (grey) are
          lost; the PMT multiplies the electron at each dynode. The animation is slowed by many orders of magnitude.
        </p>
      }
    >
      <Stage height={340} camera={[2.6, 1.4, 4.6]} target={[0, -0.2, 0]} bloom={1}>
        <Device kind={kind} rate={rate} pulses={pulses} />
      </Stage>
      <Plot title="Output current (arbitrary units), last few seconds" height={130} y={[0, kind === 'pin' ? 4 : 80]} series={[{ y: trace, color: 'var(--phosphor)', kind: 'line', width: 1.4 }]} hideYTicks />
    </Widget>
  );
}
