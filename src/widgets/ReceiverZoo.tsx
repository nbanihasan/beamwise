import { useMemo, useRef, useState } from 'react';
import * as THREE from 'three';
import { useFrame } from '@react-three/fiber';
import { Html, RoundedBox } from '@react-three/drei';
import { Stage } from '@/three/Stage';
import { Readout, Readouts, Select, Widget } from '@/viz/controls';
import { StudioLights } from '@/three/kit/env';

/**
 * Eight optical receivers as animated cut-aways. Yellow = photons, blue = electrons, red = holes.
 * The point is the mechanism: where the photon is absorbed, how charge moves, where gain comes from,
 * and what limits speed.
 */
type Kind = 'pin' | 'apd' | 'spad' | 'sipm' | 'pmt' | 'cmos' | 'solar' | 'led';

interface Info {
  name: string;
  how: string;
  gain: string;
  speed: string;
  sens: string;
  use: string;
}
const INFO: Record<Kind, Info> = {
  pin: { name: 'PIN photodiode', how: 'A photon absorbed in the wide intrinsic (undoped) layer creates one electron–hole pair. The reverse-bias field sweeps electron and hole to opposite contacts: one photon, at most one electron of current.', gain: '1', speed: 'MHz – tens of GHz (smaller = faster)', sens: 'Limited by amplifier (thermal) noise', use: 'Most VLC/LiFi receivers' },
  apd: { name: 'Avalanche photodiode (APD)', how: 'Same absorption, but electrons then cross a thin high-field layer where they gain enough energy to knock out new pairs by impact ionisation. One photon gives M electrons, with extra randomness (excess noise F).', gain: '10 – 200', speed: 'Up to ~10 GHz', sens: '5–10 dB better than PIN when thermal noise dominates', use: 'FSO, long indoor links' },
  spad: { name: 'Single-photon avalanche diode (SPAD)', how: 'Biased above breakdown (Geiger mode): a single photon triggers a self-sustaining avalanche, a digital click. A quench circuit then stops it, and the diode is blind for its dead time before it can count again.', gain: '10⁵ – 10⁶ (digital pulse)', speed: 'Counts up to ~1/dead-time (10–100 ns)', sens: 'Single photons, with dark counts and afterpulsing', use: 'Photon-starved links, underwater, long range' },
  sipm: { name: 'Silicon photomultiplier (SiPM)', how: 'Hundreds to thousands of SPAD micro-cells in parallel, summed into one output. While one cell is dead the others still count, so the array handles far higher photon rates than a single SPAD.', gain: '~10⁶', speed: 'Gb/s demonstrated with OOK', sens: 'Near single-photon, large area', use: 'Gb/s VLC, LiDAR, underwater' },
  pmt: { name: 'Photomultiplier tube (PMT)', how: 'A photon frees an electron from the photocathode (photoelectric effect). A chain of dynodes at rising voltage multiplies it: each impact releases several secondary electrons, ×10⁶ after ten stages.', gain: '10⁵ – 10⁷', speed: 'Hundreds of MHz', sens: 'Single photon, very large area, low dark current', use: 'Underwater, deep-space and lab links' },
  cmos: { name: 'CMOS image sensor (camera)', how: 'A grid of tiny photodiodes; each integrates charge during its exposure. A rolling shutter reads one row after another, so a fast-flickering LED appears as stripes: each row samples a different instant.', gain: 'Per pixel ~1, digital', speed: 'Frame rate 30–1000 fps; rows at tens of kHz', sens: 'Separates sources spatially: built-in imaging MIMO', use: 'OCC, V2X, positioning, screen–camera' },
  solar: { name: 'Solar cell', how: 'A huge-area photodiode with no bias. It harvests the DC part of the light as power while its AC part carries data: simultaneous lightwave information and power transfer (SLIPT).', gain: '1', speed: 'kHz – a few MHz (large capacitance)', sens: 'Very large area collects lots of light', use: 'Self-powered IoT receivers' },
  led: { name: 'LED as a receiver', how: 'Any LED is also a (poor) photodiode: reverse-biased, it generates current for light at wavelengths shorter than its own emission. One part can both send and receive.', gain: '1', speed: 'kHz – MHz', sens: 'Low responsivity, narrow spectral response', use: 'Low-cost bidirectional links, LED-to-LED' },
};

type P = { kind: 'ph' | 'e' | 'h'; p: THREE.Vector3; v: THREE.Vector3; life: number; gen: number };

function Particles({ kind, onCount }: { kind: Kind; onCount: (n: number) => void }) {
  const N = 600;
  const mesh = useRef<THREE.InstancedMesh>(null);
  const flash = useRef<THREE.MeshStandardMaterial>(null);
  const cells = useRef<THREE.InstancedMesh>(null);
  const st = useMemo(() => ({ parts: [] as P[], acc: 0, dead: 0, count: 0, tick: 0, cellDead: new Float32Array(64), row: 0 }), []);
  const dummy = useMemo(() => new THREE.Object3D(), []);
  const col = useMemo(() => new THREE.Color(), []);
  const C = { ph: new THREE.Color('#ffd27a').multiplyScalar(2), e: new THREE.Color('#5aa8ff').multiplyScalar(1.8), h: new THREE.Color('#ff6f86').multiplyScalar(1.6) };

  useFrame((_, dtRaw) => {
    const dt = Math.min(0.05, dtRaw);
    const parts = st.parts;
    const rate = kind === 'spad' || kind === 'pmt' ? 3 : kind === 'solar' ? 30 : 12;
    st.acc += dt * rate;
    while (st.acc > 1 && parts.length < N - 40) {
      st.acc -= 1;
      const x = (Math.random() - 0.5) * (kind === 'solar' ? 3.4 : kind === 'cmos' || kind === 'sipm' ? 2.2 : 1.6);
      const z = (Math.random() - 0.5) * (kind === 'solar' ? 2.2 : 1.2);
      if (kind === 'pmt') parts.push({ kind: 'ph', p: new THREE.Vector3(-3, (Math.random() - 0.5) * 0.6, z * 0.5), v: new THREE.Vector3(3, 0, 0), life: 0, gen: 0 });
      else parts.push({ kind: 'ph', p: new THREE.Vector3(x, 2.4, z), v: new THREE.Vector3(0, -3.2, 0), life: 0, gen: 0 });
    }
    st.dead = Math.max(0, st.dead - dt);
    for (let i = 0; i < 64; i++) st.cellDead[i] = Math.max(0, st.cellDead[i] - dt);
    const add: P[] = [];
    for (const q of parts) {
      q.life += dt;
      q.p.addScaledVector(q.v, dt);
      if (q.kind === 'ph') {
        const absorbY = kind === 'pmt' ? null : kind === 'cmos' ? 0.25 : kind === 'led' ? 0.45 : 0.1 + Math.random() * 0.02;
        if (kind === 'pmt' && q.p.x > -2.1) {
          q.life = 99;
          if (Math.random() < 0.3) add.push({ kind: 'e', p: new THREE.Vector3(-2.1, q.p.y, q.p.z), v: new THREE.Vector3(1.2, 0.6, 0), life: 0, gen: 0 });
        } else if (absorbY !== null && q.p.y < absorbY + (kind === 'pin' || kind === 'apd' ? Math.random() * 0.6 - 0.3 : 0)) {
          q.life = 99;
          if (kind === 'spad') {
            if (st.dead <= 0) {
              st.dead = 0.9;
              st.count++;
              for (let k = 0; k < 40; k++) add.push({ kind: k % 2 ? 'h' : 'e', p: q.p.clone(), v: new THREE.Vector3((Math.random() - 0.5) * 3, (Math.random() - 0.5) * 3, (Math.random() - 0.5) * 3), life: 0.6, gen: 9 });
            }
          } else if (kind === 'sipm') {
            const cx = Math.min(7, Math.max(0, Math.floor((q.p.x / 2.2 + 0.5) * 8)));
            const cz = Math.min(7, Math.max(0, Math.floor((q.p.z / 1.2 + 0.5) * 8)));
            const idx = cz * 8 + cx;
            if (st.cellDead[idx] <= 0) {
              st.cellDead[idx] = 0.8;
              st.count++;
            }
          } else if (kind === 'cmos') {
            st.count++;
          } else {
            add.push({ kind: 'e', p: q.p.clone(), v: new THREE.Vector3(0, -1.1, 0), life: 0, gen: 0 });
            add.push({ kind: 'h', p: q.p.clone(), v: new THREE.Vector3(0, 1.1, 0), life: 0, gen: 0 });
            st.count++;
          }
        }
      } else if (kind === 'apd' && q.kind === 'e' && q.gen < 4 && q.p.y < -0.35 && q.p.y > -0.55 && Math.random() < dt * 9) {
        add.push({ kind: 'e', p: q.p.clone(), v: new THREE.Vector3((Math.random() - 0.5) * 0.4, -1.1, (Math.random() - 0.5) * 0.4), life: 0, gen: q.gen + 1 });
        add.push({ kind: 'h', p: q.p.clone(), v: new THREE.Vector3(0, 1.1, 0), life: 0, gen: q.gen + 1 });
        q.gen++;
        st.count++;
      } else if (kind === 'pmt' && q.kind === 'e') {
        // bounce between dynodes left→right, multiplying
        const stage = Math.floor((q.p.x + 2.1) / 0.5);
        if (q.p.y > 0.35 && q.v.y > 0) {
          q.v.y = -Math.abs(q.v.y);
          if (stage < 8 && Math.random() < 0.8 && parts.length + add.length < N - 20) add.push({ kind: 'e', p: q.p.clone(), v: new THREE.Vector3(1.2, -0.6 - Math.random() * 0.3, (Math.random() - 0.5) * 0.3), life: 0, gen: q.gen + 1 });
        } else if (q.p.y < -0.35 && q.v.y < 0) {
          q.v.y = Math.abs(q.v.y);
          if (stage < 8 && Math.random() < 0.8 && parts.length + add.length < N - 20) add.push({ kind: 'e', p: q.p.clone(), v: new THREE.Vector3(1.2, 0.6 + Math.random() * 0.3, (Math.random() - 0.5) * 0.3), life: 0, gen: q.gen + 1 });
        }
        if (q.p.x > 2.2) q.life = 99;
      }
      if (q.kind !== 'ph' && kind !== 'pmt' && (Math.abs(q.p.y) > 1.3 || q.life > 2.5)) q.life = 99;
      if (q.gen === 9 && q.life > 1.0) q.life = 99;
    }
    st.parts = parts.filter((q) => q.life < 98).concat(add).slice(-N);
    const m = mesh.current;
    if (m) {
      for (let i = 0; i < N; i++) {
        const q = st.parts[i];
        if (!q) {
          dummy.position.set(0, -99, 0);
          dummy.scale.setScalar(0.0001);
        } else {
          dummy.position.copy(q.p);
          dummy.scale.setScalar(q.kind === 'ph' ? 1 : 0.8);
          m.setColorAt(i, col.copy(C[q.kind]));
        }
        dummy.updateMatrix();
        m.setMatrixAt(i, dummy.matrix);
      }
      m.instanceMatrix.needsUpdate = true;
      if (m.instanceColor) m.instanceColor.needsUpdate = true;
    }
    if (flash.current) flash.current.emissiveIntensity = kind === 'spad' ? (st.dead > 0.6 ? 4 : st.dead > 0 ? 0.05 : 0.6) : 0.3;
    if (cells.current) {
      for (let i = 0; i < 64; i++) cells.current.setColorAt(i, col.set(st.cellDead[i] > 0.55 ? '#ffd27a' : st.cellDead[i] > 0 ? '#2a2f45' : '#4a5a9a'));
      if (cells.current.instanceColor) cells.current.instanceColor.needsUpdate = true;
    }
    if (++st.tick % 20 === 0) onCount(st.count);
  });

  return (
    <>
      <instancedMesh ref={mesh} args={[undefined, undefined, N]} frustumCulled={false}>
        <sphereGeometry args={[0.035, 8, 8]} />
        <meshBasicMaterial toneMapped={false} />
      </instancedMesh>
      {kind === 'spad' && (
        <mesh position={[0, 0.02, 0]} rotation-x={-Math.PI / 2}>
          <circleGeometry args={[0.8, 48]} />
          <meshStandardMaterial ref={flash} color="#ffd27a" emissive="#ff9a3c" emissiveIntensity={0.5} transparent opacity={0.5} toneMapped={false} />
        </mesh>
      )}
      {kind === 'sipm' && (
        <instancedMesh
          ref={(r) => {
            (cells as { current: THREE.InstancedMesh | null }).current = r;
            if (r)
              for (let i = 0; i < 64; i++) {
                dummy.position.set(((i % 8) - 3.5) * 0.275, 0.03, (Math.floor(i / 8) - 3.5) * 0.15);
                dummy.scale.set(1, 1, 1);
                dummy.updateMatrix();
                r.setMatrixAt(i, dummy.matrix);
              }
          }}
          args={[undefined, undefined, 64]}
        >
          <boxGeometry args={[0.24, 0.04, 0.12]} />
          <meshStandardMaterial toneMapped={false} emissive="#ffd27a" emissiveIntensity={0.35} />
        </instancedMesh>
      )}
    </>
  );
}

function Layers({ kind }: { kind: Kind }) {
  if (kind === 'pmt') {
    return (
      <group>
        <mesh rotation-z={Math.PI / 2}>
          <cylinderGeometry args={[0.85, 0.85, 4.8, 40, 1, true]} />
          <meshPhysicalMaterial color="#cfe6ff" transparent opacity={0.12} roughness={0.05} side={THREE.DoubleSide} />
        </mesh>
        <mesh position={[-2.2, 0, 0]} rotation-y={Math.PI / 2}>
          <circleGeometry args={[0.8, 40]} />
          <meshStandardMaterial color="#7c5cff" emissive="#7c5cff" emissiveIntensity={0.4} side={THREE.DoubleSide} />
        </mesh>
        {Array.from({ length: 8 }, (_, i) => (
          <mesh key={i} position={[-1.85 + i * 0.5, i % 2 ? -0.45 : 0.45, 0]}>
            <boxGeometry args={[0.32, 0.05, 0.6]} />
            <meshStandardMaterial color="#c08a52" metalness={0.9} roughness={0.3} />
          </mesh>
        ))}
        <mesh position={[2.3, 0, 0]}>
          <boxGeometry args={[0.08, 0.9, 0.7]} />
          <meshStandardMaterial color="#9aa0aa" metalness={0.9} roughness={0.3} />
        </mesh>
        <Html position={[-2.2, -1.1, 0]} center>
          <div className="scene-label">photocathode</div>
        </Html>
        <Html position={[0, -1.1, 0]} center>
          <div className="scene-label">dynodes ×10⁶</div>
        </Html>
        <Html position={[2.3, -1.1, 0]} center>
          <div className="scene-label">anode</div>
        </Html>
      </group>
    );
  }
  if (kind === 'cmos') {
    return (
      <group>
        {Array.from({ length: 64 }, (_, i) => (
          <RoundedBox key={i} args={[0.24, 0.3, 0.24]} radius={0.02} position={[((i % 8) - 3.5) * 0.27, 0.1, (Math.floor(i / 8) - 3.5) * 0.15 * 1.8]} scale={[1, 1, 0.55]}>
            <meshStandardMaterial color={['#c33', '#3a3', '#33c', '#3a3'][(i % 2) + (Math.floor(i / 8) % 2) * 2]} transparent opacity={0.75} />
          </RoundedBox>
        ))}
        <RollingRow />
        <Html position={[0, -0.5, 1.4]} center>
          <div className="scene-label">rolling shutter: rows read one by one</div>
        </Html>
      </group>
    );
  }
  const stack: { y: number; h: number; c: string; label: string }[] =
    kind === 'pin'
      ? [
          { y: 0.95, h: 0.1, c: '#c76b6b', label: 'p⁺' },
          { y: 0.0, h: 1.8, c: '#3a3f58', label: 'intrinsic (absorption)' },
          { y: -0.95, h: 0.1, c: '#5a7ac7', label: 'n⁺' },
        ]
      : kind === 'apd'
        ? [
            { y: 0.95, h: 0.1, c: '#c76b6b', label: 'p⁺' },
            { y: 0.25, h: 1.3, c: '#3a3f58', label: 'absorption' },
            { y: -0.45, h: 0.12, c: '#e0a24a', label: 'multiplication (high field)' },
            { y: -0.8, h: 0.5, c: '#4a5070', label: '' },
            { y: -1.08, h: 0.06, c: '#5a7ac7', label: 'n⁺' },
          ]
        : kind === 'spad' || kind === 'sipm'
          ? [
              { y: -0.15, h: 0.3, c: '#3a3f58', label: kind === 'spad' ? 'Geiger-mode junction' : '64 SPAD micro-cells' },
              { y: -0.4, h: 0.2, c: '#22263a', label: '' },
            ]
          : kind === 'solar'
            ? [
                { y: 0.0, h: 0.2, c: '#1b2f7a', label: 'large-area pn junction' },
                { y: -0.2, h: 0.15, c: '#9aa0aa', label: '' },
              ]
            : [
                { y: 0.2, h: 0.5, c: '#3a3f58', label: 'LED die (reverse-biased)' },
                { y: -0.2, h: 0.2, c: '#9aa0aa', label: '' },
              ];
  const w = kind === 'solar' ? 3.6 : kind === 'sipm' ? 2.3 : 1.8;
  const d = kind === 'solar' ? 2.4 : 1.3;
  return (
    <group>
      {stack.map((s, i) => (
        <group key={i}>
          <mesh position={[0, s.y, 0]}>
            <boxGeometry args={[w, s.h, d]} />
            <meshStandardMaterial color={s.c} transparent opacity={0.55} roughness={0.5} />
          </mesh>
          {s.label && (
            <Html position={[w / 2 + 0.15, s.y, d / 2]} center={false} style={{ transform: 'translateY(-50%)' }}>
              <div className="scene-label" style={{ transform: 'none' }}>
                {s.label}
              </div>
            </Html>
          )}
        </group>
      ))}
      {kind === 'led' && (
        <mesh position={[0, 0.45, 0]}>
          <sphereGeometry args={[0.7, 32, 16, 0, Math.PI * 2, 0, Math.PI / 2]} />
          <meshPhysicalMaterial color="#ffe6b0" transparent opacity={0.25} roughness={0.1} />
        </mesh>
      )}
    </group>
  );
}

function RollingRow() {
  const ref = useRef<THREE.Mesh>(null);
  useFrame(({ clock }) => {
    if (ref.current) ref.current.position.z = ((clock.getElapsedTime() * 1.2) % 2.2) - 1.1 - 0.2;
  });
  return (
    <mesh ref={ref} position={[0, 0.3, 0]}>
      <boxGeometry args={[2.3, 0.02, 0.26]} />
      <meshBasicMaterial color="#5ee0a8" transparent opacity={0.5} toneMapped={false} />
    </mesh>
  );
}

export default function ReceiverZoo() {
  const [kind, setKind] = useState<Kind>('apd');
  const [count, setCount] = useState(0);
  const info = INFO[kind];
  const opts = (Object.keys(INFO) as Kind[]).map((k) => ({ value: k, label: INFO[k].name }));
  const controls = (
    <>
      <Select label="Detector" value={kind} options={opts} onChange={(k) => (setKind(k), setCount(0))} />
      <Readouts>
        <Readout k="Internal gain" v={info.gain} />
        <Readout k="Speed" v={info.speed} />
        <Readout k="Sensitivity" v={info.sens} />
        <Readout k="Typical use" v={info.use} />
        <Readout k={kind === 'spad' || kind === 'sipm' ? 'Counts so far' : kind === 'cmos' ? 'Photons integrated' : 'Carriers collected'} v={count} />
      </Readouts>
    </>
  );
  return (
    <Widget title="The receiver zoo" eyebrow="3D · cut-aways" controls={controls} caption={<p>{info.how}</p>}>
      <Stage key={kind} height={330} camera={kind === 'pmt' ? [0.5, 2.4, 5.4] : kind === 'solar' ? [3, 3.4, 4.4] : [2.6, 2.2, 3.6]} target={[0, 0, 0]} bloom={1.1}>
        <StudioLights intensity={0.75} />
        <Layers kind={kind} />
        <Particles kind={kind} onCount={setCount} />
      </Stage>
    </Widget>
  );
}
