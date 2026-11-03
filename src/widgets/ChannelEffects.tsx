import { useMemo, useRef, useState } from 'react';
import * as THREE from 'three';
import { useFrame } from '@react-three/fiber';
import { Html } from '@react-three/drei';
import { Stage } from '@/three/Stage';
import { Plot } from '@/viz/Plot';
import { Readout, Readouts, Segmented, Slider, Widget } from '@/viz/controls';
import { StudioLights } from '@/three/kit/env';
import { DetectorCan, EmitterBody } from '@/three/kit/components';
import { gammaGammaParams, gammaGammaSamples, kimAttenuationDbPerKm, rytovVariance } from '@/sim/outdoor';
import { linspace, sci } from '@/sim/math';

/**
 * Channel impairments, one at a time, as photons you can watch: absorption removes them, scattering
 * bends them, turbulence steers the whole beam, scintillation makes the spot sparkle, divergence spreads
 * it, pointing error misses the aperture and weather does several of these at once.
 * Each mode pairs the animation with the model that quantifies it.
 */
type Mode = 'absorption' | 'scattering' | 'turbulence' | 'scintillation' | 'divergence' | 'pointing' | 'weather';

const L = 8; // scene length (units)
const N = 900;

interface Params {
  mode: Mode;
  a: number; // absorption coefficient per scene length
  b: number; // scattering coefficient per scene length
  g: number; // HG asymmetry
  turb: number; // 0..1
  div: number; // divergence (rad, scene)
  jitter: number; // pointing jitter (scene units)
  vis: number; // visibility km
}

function hgSample(g: number, u: number) {
  if (Math.abs(g) < 1e-3) return 2 * u - 1;
  const s = (1 - g * g) / (1 - g + 2 * g * u);
  return (1 + g * g - s * s) / (2 * g);
}

function Photons({ p, onStats }: { p: Params; onStats: (s: { arrived: number; lost: number; scattered: number }) => void }) {
  const mesh = useRef<THREE.InstancedMesh>(null);
  const spot = useRef<THREE.Mesh>(null);
  const beamGroup = useRef<THREE.Group>(null);
  const st = useMemo(
    () => ({
      pos: new Float32Array(N * 3),
      dir: new Float32Array(N * 3),
      alive: new Uint8Array(N),
      nsc: new Uint8Array(N),
      next: 0,
      acc: 0,
      arrived: 0,
      lost: 0,
      scat: 0,
      tick: 0,
      aim: new THREE.Vector2(),
    }),
    [],
  );
  const dummy = useMemo(() => new THREE.Object3D(), []);
  const col = useMemo(() => new THREE.Color(), []);
  const weatherA = p.mode === 'weather' ? Math.min(3, (kimAttenuationDbPerKm(p.vis, 850) / 4.343) * 0.06) : 0;

  useFrame(({ clock }, dtRaw) => {
    const m = mesh.current;
    if (!m) return;
    const dt = Math.min(0.05, dtRaw);
    const t = clock.getElapsedTime();
    const speed = 4.5;
    // turbulence: smooth wander of the beam axis (sum of slow sinusoids)
    const wanderY = p.mode === 'turbulence' ? p.turb * (0.5 * Math.sin(t * 0.9) + 0.3 * Math.sin(t * 2.3 + 1)) : 0;
    const wanderZ = p.mode === 'turbulence' ? p.turb * (0.5 * Math.cos(t * 0.7) + 0.3 * Math.sin(t * 1.7)) : 0;
    if (p.mode === 'pointing') {
      st.aim.set(p.jitter * (Math.sin(t * 1.3) + 0.5 * Math.sin(t * 4.1)), p.jitter * (Math.cos(t * 1.1) + 0.5 * Math.sin(t * 3.3)));
    } else st.aim.set(0, 0);
    if (beamGroup.current) beamGroup.current.rotation.set(0, 0, 0);

    st.acc += dt * 520;
    while (st.acc > 1) {
      st.acc -= 1;
      const i = st.next;
      st.next = (st.next + 1) % N;
      const r = Math.sqrt(Math.random()) * 0.08;
      const th = Math.random() * Math.PI * 2;
      st.pos.set([-L / 2, r * Math.cos(th), r * Math.sin(th)], i * 3);
      const div = p.mode === 'divergence' ? p.div : 0.012;
      const a1 = Math.sqrt(Math.random()) * div;
      const a2 = Math.random() * Math.PI * 2;
      const dy = Math.sin(a1) * Math.cos(a2) + st.aim.x / L;
      const dz = Math.sin(a1) * Math.sin(a2) + st.aim.y / L;
      const v = new THREE.Vector3(1, dy, dz).normalize();
      st.dir.set([v.x, v.y, v.z], i * 3);
      st.alive[i] = 1;
      st.nsc[i] = 0;
    }
    const a = p.mode === 'absorption' ? p.a / L : p.mode === 'weather' ? weatherA * 0.15 : 0;
    const b = p.mode === 'scattering' ? p.b / L : p.mode === 'weather' ? weatherA * 0.85 : 0;
    const g = p.mode === 'weather' ? 0.85 : p.g;
    for (let i = 0; i < N; i++) {
      if (!st.alive[i]) {
        dummy.position.set(0, -99, 0);
        dummy.scale.setScalar(0.0001);
        dummy.updateMatrix();
        m.setMatrixAt(i, dummy.matrix);
        continue;
      }
      const ds = speed * dt;
      // absorption
      if (a > 0 && Math.random() < a * ds) {
        st.alive[i] = 0;
        st.lost++;
        continue;
      }
      // scattering
      if (b > 0 && Math.random() < b * ds) {
        const d = new THREE.Vector3(st.dir[i * 3], st.dir[i * 3 + 1], st.dir[i * 3 + 2]);
        const mu = hgSample(g, Math.random());
        const sinT = Math.sqrt(Math.max(0, 1 - mu * mu));
        const phi = Math.random() * Math.PI * 2;
        const w = Math.abs(d.x) < 0.9 ? new THREE.Vector3(1, 0, 0) : new THREE.Vector3(0, 1, 0);
        const u1 = new THREE.Vector3().crossVectors(d, w).normalize();
        const u2 = new THREE.Vector3().crossVectors(d, u1);
        d.multiplyScalar(mu).addScaledVector(u1, sinT * Math.cos(phi)).addScaledVector(u2, sinT * Math.sin(phi)).normalize();
        st.dir.set([d.x, d.y, d.z], i * 3);
        st.nsc[i] = Math.min(9, st.nsc[i] + 1);
        st.scat++;
      }
      const x = st.pos[i * 3] + st.dir[i * 3] * ds;
      let y = st.pos[i * 3 + 1] + st.dir[i * 3 + 1] * ds;
      let z = st.pos[i * 3 + 2] + st.dir[i * 3 + 2] * ds;
      if (p.mode === 'turbulence') {
        const k = (x + L / 2) / L;
        y += wanderY * ds * 0.25 * k;
        z += wanderZ * ds * 0.25 * k;
      }
      st.pos[i * 3] = x;
      st.pos[i * 3 + 1] = y;
      st.pos[i * 3 + 2] = z;
      if (x > L / 2 || Math.abs(y) > 3 || Math.abs(z) > 3 || x < -L / 2 - 0.5) {
        st.alive[i] = 0;
        if (x > L / 2 && Math.hypot(y, z) < 0.35) st.arrived++;
        else st.lost++;
      }
      dummy.position.set(x, y, z);
      dummy.scale.setScalar(1);
      dummy.updateMatrix();
      m.setMatrixAt(i, dummy.matrix);
      const n = st.nsc[i];
      col.set(n === 0 ? '#ffe2a0' : n === 1 ? '#8fd3ff' : n < 4 ? '#8fa6ff' : '#c39bff');
      m.setColorAt(i, col);
    }
    m.instanceMatrix.needsUpdate = true;
    if (m.instanceColor) m.instanceColor.needsUpdate = true;
    // scintillation: spot brightness flickers with gamma-gamma-like fades
    if (spot.current) {
      const mat = spot.current.material as THREE.MeshBasicMaterial;
      const f = p.mode === 'scintillation' ? Math.max(0.05, 1 + p.turb * 1.6 * (Math.sin(t * 13) * 0.5 + Math.sin(t * 29 + 1) * 0.35 + Math.sin(t * 7.3) * 0.4)) : 1;
      mat.opacity = Math.min(1, 0.35 * f);
      spot.current.position.set(L / 2 - 0.02, (p.mode === 'turbulence' ? wanderY * 0.9 : 0) + st.aim.x, (p.mode === 'turbulence' ? wanderZ * 0.9 : 0) + st.aim.y);
      const s = p.mode === 'divergence' ? 0.2 + p.div * L : p.mode === 'scintillation' ? 0.35 + 0.2 * p.turb * Math.abs(Math.sin(t * 5)) : 0.3;
      spot.current.scale.set(s, s, 1);
    }
    if (++st.tick % 30 === 0) {
      onStats({ arrived: st.arrived, lost: st.lost, scattered: st.scat });
      st.arrived = 0;
      st.lost = 0;
      st.scat = 0;
    }
  });

  return (
    <group ref={beamGroup}>
      <instancedMesh ref={mesh} args={[undefined, undefined, N]} frustumCulled={false}>
        <sphereGeometry args={[0.022, 6, 6]} />
        <meshBasicMaterial toneMapped={false} transparent opacity={0.95} blending={THREE.AdditiveBlending} depthWrite={false} />
      </instancedMesh>
      <mesh ref={spot} rotation-y={-Math.PI / 2}>
        <circleGeometry args={[1, 40]} />
        <meshBasicMaterial color="#ffe2a0" transparent opacity={0.3} toneMapped={false} blending={THREE.AdditiveBlending} depthWrite={false} side={THREE.DoubleSide} />
      </mesh>
    </group>
  );
}

function Medium({ p }: { p: Params }) {
  const pts = useRef<THREE.Points>(null);
  const eddies = useRef<THREE.Group>(null);
  const density = p.mode === 'scattering' ? Math.min(900, 80 + p.b * 160) : p.mode === 'weather' ? Math.min(1200, 60 + 900 / Math.max(0.2, p.vis)) : p.mode === 'absorption' ? 160 : 0;
  const geo = useMemo(() => {
    const g = new THREE.BufferGeometry();
    const arr = new Float32Array(1200 * 3);
    for (let i = 0; i < 1200; i++) arr.set([(Math.random() - 0.5) * L, (Math.random() - 0.5) * 2.6, (Math.random() - 0.5) * 2.6], i * 3);
    g.setAttribute('position', new THREE.BufferAttribute(arr, 3));
    return g;
  }, []);
  geo.setDrawRange(0, Math.round(density));
  useFrame(({ clock }) => {
    const t = clock.getElapsedTime();
    if (pts.current && p.mode === 'weather') pts.current.position.y = -((t * 0.6) % 0.5);
    eddies.current?.children.forEach((c, i) => {
      c.position.x = ((i * 1.3 + t * 0.6) % L) - L / 2;
      c.rotation.z = t * 0.3 + i;
    });
  });
  return (
    <>
      {density > 0 && (
        <points ref={pts} geometry={geo}>
          <pointsMaterial
            color={p.mode === 'absorption' ? '#3a7a9a' : p.mode === 'weather' ? '#dfe8ff' : '#9fc8ff'}
            size={p.mode === 'weather' ? 0.05 : 0.035}
            transparent
            opacity={0.55}
            depthWrite={false}
          />
        </points>
      )}
      {(p.mode === 'turbulence' || p.mode === 'scintillation') && (
        <group ref={eddies}>
          {Array.from({ length: 7 }, (_, i) => (
            <mesh key={i} position={[0, Math.sin(i * 2.1) * 0.5, Math.cos(i * 1.7) * 0.5]} scale={[0.6 + (i % 3) * 0.25, 0.45 + (i % 2) * 0.3, 0.5]}>
              <sphereGeometry args={[1, 18, 12]} />
              <meshBasicMaterial color={i % 2 ? '#7fb8ff' : '#ffb27f'} transparent opacity={0.035 + p.turb * 0.05} depthWrite={false} />
            </mesh>
          ))}
        </group>
      )}
      {p.mode === 'absorption' && (
        <mesh>
          <boxGeometry args={[L, 2.6, 2.6]} />
          <meshBasicMaterial color="#0d4a6a" transparent opacity={0.06 + p.a * 0.015} depthWrite={false} side={THREE.BackSide} />
        </mesh>
      )}
    </>
  );
}

const MODES: { value: Mode; label: string }[] = [
  { value: 'absorption', label: 'Absorption' },
  { value: 'scattering', label: 'Scattering' },
  { value: 'turbulence', label: 'Turbulence' },
  { value: 'scintillation', label: 'Scintillation' },
  { value: 'divergence', label: 'Divergence' },
  { value: 'pointing', label: 'Pointing' },
  { value: 'weather', label: 'Fog & rain' },
];

const EXPLAIN: Record<Mode, string> = {
  absorption: 'Photons are absorbed by molecules (water, gases) and vanish as heat. Power falls exponentially with distance: Beer–Lambert, P = P₀·e^(−a·L).',
  scattering: 'Particles redirect photons without destroying them. Forward scattering (g → 1) keeps them near the beam; isotropic scattering (g → 0) throws them anywhere. Scattered photons arrive late and from the wrong direction.',
  turbulence: 'Warm and cool air (or water) cells have slightly different refractive indices and act like weak, moving lenses. Large eddies near the transmitter steer the whole beam: beam wander.',
  scintillation: 'Small eddies make different parts of the beam interfere, so the spot breaks into speckle and the received power twinkles. Strength is set by the Rytov variance σ_R².',
  divergence: 'Every beam spreads. Received power drops with the spot area while the aperture stays the same: geometric loss, ≈ (D / (θ·L))².',
  pointing: 'Vibration, building sway or platform motion moves the beam off the receiver. Narrow beams go further but need better pointing.',
  weather: 'Fog droplets (≈ wavelength size) scatter strongly; attenuation follows visibility (Kim model), from < 1 dB/km in clear air to > 100 dB/km in dense fog.',
};

export default function ChannelEffects() {
  const [mode, setMode] = useState<Mode>('scattering');
  const [a, setA] = useState(2);
  const [b, setB] = useState(3);
  const [g, setG] = useState(0.8);
  const [turb, setTurb] = useState(0.6);
  const [div, setDiv] = useState(0.05);
  const [jitter, setJitter] = useState(0.3);
  const [vis, setVis] = useState(0.8);
  const [stats, setStats] = useState({ arrived: 0, lost: 0, scattered: 0 });
  const p: Params = { mode, a, b, g, turb, div, jitter, vis };
  const frac = stats.arrived / Math.max(1, stats.arrived + stats.lost);

  const plot = useMemo(() => {
    const zs = linspace(0, 1, 60);
    switch (mode) {
      case 'absorption':
        return { title: 'Received fraction vs distance', series: [{ x: zs.map((z) => z * L), y: zs.map((z) => Math.exp(-a * z)), color: 'var(--c2)', label: `e^(−a·L), a = ${a.toFixed(1)}` }], xLabel: 'distance (scene units)', y: [0, 1] as [number, number] };
      case 'scattering':
        return {
          title: 'Ballistic (unscattered) vs total surviving light',
          series: [
            { x: zs.map((z) => z * L), y: zs.map((z) => Math.exp(-b * z)), color: 'var(--c2)', label: 'unscattered e^(−b·L)' },
            { x: zs.map((z) => z * L), y: zs.map((z) => Math.exp(-b * (1 - g) * z)), color: 'var(--c1)', label: 'forward-peaked estimate e^(−b(1−g)L)' },
          ],
          xLabel: 'distance (scene units)',
          y: [0, 1] as [number, number],
        };
      case 'turbulence':
      case 'scintillation': {
        const Cn2 = 10 ** (-16 + turb * 3.3);
        const ls = linspace(100, 5000, 60);
        const s = ls.map((Lm) => rytovVariance(Cn2, 1550, Lm));
        if (mode === 'turbulence') return { title: `Rytov variance vs range (C²ₙ = ${sci(Cn2, 1)} m⁻²ᐟ³, 1550 nm)`, series: [{ x: ls, y: s, color: 'var(--c5)', label: 'σ²_R' }], xLabel: 'range (m)', logY: true };
        const s2 = rytovVariance(Cn2, 1550, 1000);
        const { alpha, beta } = gammaGammaParams(Math.max(0.05, s2));
        const smp = gammaGammaSamples(alpha, beta, 4000, 9);
        const bins = linspace(0, 3, 40);
        const h = new Array(40).fill(0);
        for (const v of smp) h[Math.min(39, Math.floor((v / 3) * 40))]++;
        return { title: `Irradiance histogram at 1 km (σ²_R = ${s2.toFixed(2)})`, series: [{ x: bins, y: h.map((c) => c / smp.length / (3 / 40)), kind: 'area' as const, color: 'var(--c4)', label: 'gamma-gamma samples' }], xLabel: 'normalised irradiance I / ⟨I⟩' };
      }
      case 'divergence': {
        const ls = linspace(10, 2000, 60);
        return { title: 'Captured fraction, 5 cm aperture', series: [{ x: ls, y: ls.map((Lm) => Math.min(1, (0.05 / (0.01 + div * 1e-3 * 20 * Lm)) ** 2)), color: 'var(--c3)', label: `θ = ${(div * 20).toFixed(1)} mrad` }], xLabel: 'range (m)', logY: true };
      }
      case 'pointing': {
        const js = linspace(0, 1, 60);
        return { title: 'Mean captured fraction vs jitter / beam radius', series: [{ x: js, y: js.map((j) => 1 / (1 + 2 * j * j)), color: 'var(--c6)', label: 'Gaussian beam, Rayleigh jitter' }], xLabel: 'σ_jitter / w', y: [0, 1] as [number, number] };
      }
      case 'weather': {
        const vs = linspace(0.05, 20, 80);
        return {
          title: 'Kim model attenuation vs visibility',
          series: [
            { x: vs, y: vs.map((v) => kimAttenuationDbPerKm(v, 850)), color: 'var(--c4)', label: '850 nm' },
            { x: vs, y: vs.map((v) => kimAttenuationDbPerKm(v, 1550)), color: 'var(--c1)', label: '1550 nm' },
          ],
          xLabel: 'visibility (km)',
          logY: true,
          logX: true,
        };
      }
    }
  }, [mode, a, b, g, turb, div, vis]);

  const controls = (
    <>
      <Segmented label="Impairment" value={mode} options={MODES} onChange={setMode} />
      {mode === 'absorption' && <Slider label="Absorption a·L" value={a} min={0} max={6} step={0.1} onChange={setA} />}
      {mode === 'scattering' && (
        <>
          <Slider label="Scattering b·L" value={b} min={0} max={10} step={0.1} onChange={setB} />
          <Slider label="Asymmetry g" value={g} min={0} max={0.95} step={0.01} onChange={setG} />
        </>
      )}
      {(mode === 'turbulence' || mode === 'scintillation') && <Slider label="Turbulence strength" value={turb} min={0} max={1} step={0.01} onChange={setTurb} format={(v) => `C²ₙ ≈ ${sci(10 ** (-16 + v * 3.3), 1)}`} />}
      {mode === 'divergence' && <Slider label="Divergence" value={div} min={0.005} max={0.25} step={0.005} onChange={setDiv} format={(v) => `${(v * 20).toFixed(1)} mrad`} />}
      {mode === 'pointing' && <Slider label="Pointing jitter" value={jitter} min={0} max={1} step={0.01} onChange={setJitter} />}
      {mode === 'weather' && <Slider label="Visibility" value={vis} min={0.05} max={20} log onChange={setVis} format={(v) => `${v < 1 ? (v * 1000).toFixed(0) + ' m' : v.toFixed(1) + ' km'}`} />}
      <Readouts>
        <Readout k="Reaching the receiver" v={`${(frac * 100).toFixed(0)} %`} tone={frac > 0.5 ? 'good' : frac > 0.15 ? 'warn' : 'bad'} />
        <Readout k="Scattering events / s" v={Math.round(stats.scattered * 2)} />
        {mode === 'weather' && <Readout k="850 nm loss" v={`${kimAttenuationDbPerKm(vis, 850).toFixed(1)} dB/km`} />}
      </Readouts>
    </>
  );

  return (
    <Widget title="Channel impairments, photon by photon" eyebrow="3D · Monte Carlo" controls={controls} caption={<p>{EXPLAIN[mode]}</p>}>
      <Stage height={330} camera={[0.5, 2.4, 7.2]} target={[0, 0, 0]} bloom={1.1}>
        <StudioLights intensity={0.7} />
        <group position={[-L / 2 - 0.15, 0, 0]} rotation={[0, Math.PI / 2, 0]}>
          <EmitterBody scale={5} kind="laser" color="#ffe2a0" />
        </group>
        <group position={[L / 2 + 0.12, 0, 0]} rotation={[0, -Math.PI / 2, 0]}>
          <DetectorCan scale={14} tone="#3d55e0" lit={frac} big />
        </group>
        <Photons p={p} onStats={setStats} />
        <Medium p={p} />
        <Html position={[-L / 2, -0.7, 0]} center>
          <div className="scene-label">Transmitter</div>
        </Html>
        <Html position={[L / 2, -0.7, 0]} center>
          <div className="scene-label">Receiver aperture</div>
        </Html>
      </Stage>
      <Plot
        title={plot.title}
        series={plot.series}
        xLabel={plot.xLabel}
        y={'y' in plot ? plot.y : undefined}
        logY={'logY' in plot ? plot.logY : undefined}
        logX={'logX' in plot ? plot.logX : undefined}
        height={180}
        legend
      />
    </Widget>
  );
}
