import { useMemo, useRef, useState } from 'react';
import { useFrame } from '@react-three/fiber';
import { Html } from '@react-three/drei';
import * as THREE from 'three';
import { Stage } from '@/three/Stage';
import { Readout, Readouts, Segmented, Slider, Toggle, Widget } from '@/viz/controls';
import { wavelengthToHex } from '@/sim/color';

/**
 * Inside an LED: electrons from the n side and holes from the p side meet in the quantum-well
 * active region and recombine, each releasing a photon of energy ≈ the bandgap (E = hc/λ).
 * A phosphor layer on a blue die down-converts part of the light to yellow → white.
 */
const MATERIALS = [
  { id: 'ingan-b', label: 'InGaN blue', nm: 450, note: 'Blue pump of almost every white LED' },
  { id: 'ingan-g', label: 'InGaN green', nm: 525, note: 'The “green gap”: efficiency drops here' },
  { id: 'algainp', label: 'AlGaInP red', nm: 630, note: 'Red channel of RGB LEDs' },
  { id: 'gaas', label: 'GaAs IR', nm: 850, note: 'Infrared LiFi uplinks and IrDA' },
] as const;

const N_E = 160;
const N_P = 260;

function Junction({ nm, current, phosphor }: { nm: number; current: number; phosphor: boolean }) {
  const elec = useRef<THREE.InstancedMesh>(null);
  const hole = useRef<THREE.InstancedMesh>(null);
  const phot = useRef<THREE.InstancedMesh>(null);
  const flash = useRef<THREE.MeshStandardMaterial>(null);
  const colorBase = useMemo(() => new THREE.Color(nm > 780 ? '#ff3b6b' : wavelengthToHex(nm)).multiplyScalar(2.4), [nm]);
  const yellow = useMemo(() => new THREE.Color('#ffd25a').multiplyScalar(2.4), []);
  const S = useMemo(
    () => ({
      e: Array.from({ length: N_E }, () => ({ x: 99, y: 0, z: 0, v: 1 })),
      h: Array.from({ length: N_E }, () => ({ x: -99, y: 0, z: 0, v: 1 })),
      p: Array.from({ length: N_P }, () => ({ x: 0, y: -99, z: 0, vx: 0, vy: 0, vz: 0, conv: false, alive: false })),
      acc: 0,
      glow: 0,
    }),
    [],
  );
  const dummy = useMemo(() => new THREE.Object3D(), []);

  useFrame((_, dtRaw) => {
    const dt = Math.min(dtRaw, 0.05);
    S.acc += dt * current * 40;
    let spawn = Math.floor(S.acc);
    S.acc -= spawn;
    for (let i = 0; i < N_E && spawn > 0; i++) {
      if (S.e[i].x > 50) {
        S.e[i] = { x: 2.2, y: (Math.random() - 0.5) * 0.7, z: (Math.random() - 0.5) * 1.1, v: 0.8 + Math.random() * 0.6 };
        S.h[i] = { x: -2.2, y: S.e[i].y + (Math.random() - 0.5) * 0.1, z: S.e[i].z + (Math.random() - 0.5) * 0.1, v: S.e[i].v };
        spawn--;
      }
    }
    let recomb = 0;
    for (let i = 0; i < N_E; i++) {
      const e = S.e[i];
      const h = S.h[i];
      if (e.x > 50) continue;
      e.x -= e.v * dt * 1.6;
      h.x += h.v * dt * 1.6;
      if (e.x <= 0.04) {
        // radiative recombination in the quantum well
        recomb++;
        const slot = S.p.find((p) => !p.alive);
        if (slot) {
          const th = Math.random() * Math.PI * 2;
          const sp = Math.random() * 0.55;
          Object.assign(slot, { x: 0, y: e.y, z: e.z, vx: Math.cos(th) * sp, vy: 1.6 + Math.random() * 0.5, vz: Math.sin(th) * sp, conv: false, alive: true });
        }
        e.x = 99;
        h.x = -99;
      }
    }
    S.glow = THREE.MathUtils.lerp(S.glow, Math.min(1, recomb * 0.6 + current * 0.15), 0.2);
    if (flash.current) flash.current.emissiveIntensity = 0.4 + S.glow * 5;

    const draw = (mesh: THREE.InstancedMesh | null, arr: { x: number; y: number; z: number }[], scale: number, hidden: (q: { x: number }) => boolean) => {
      if (!mesh) return;
      arr.forEach((q, i) => {
        if (hidden(q)) dummy.position.set(0, -99, 0);
        else dummy.position.set(q.x, q.y, q.z);
        dummy.scale.setScalar(hidden(q) ? 0.0001 : scale);
        dummy.updateMatrix();
        mesh.setMatrixAt(i, dummy.matrix);
      });
      mesh.instanceMatrix.needsUpdate = true;
    };
    draw(elec.current, S.e, 0.07, (q) => q.x > 50);
    draw(hole.current, S.h, 0.075, (q) => q.x < -50);

    const pm = phot.current;
    if (pm) {
      S.p.forEach((p, i) => {
        if (p.alive) {
          p.x += p.vx * dt;
          p.y += p.vy * dt;
          p.z += p.vz * dt;
          if (phosphor && !p.conv && p.y > 0.86 && nm < 480) {
            p.conv = true;
            if (Math.random() < 0.62) {
              pm.setColorAt(i, yellow);
              const th = Math.random() * Math.PI * 2;
              p.vx = Math.cos(th) * 0.9;
              p.vz = Math.sin(th) * 0.9;
            } else pm.setColorAt(i, colorBase);
          } else if (!p.conv) pm.setColorAt(i, colorBase);
          if (p.y > 3.2) p.alive = false;
        }
        dummy.position.set(p.alive ? p.x : 0, p.alive ? p.y : -99, p.alive ? p.z : 0);
        dummy.scale.setScalar(p.alive ? 0.06 : 0.0001);
        dummy.updateMatrix();
        pm.setMatrixAt(i, dummy.matrix);
      });
      pm.instanceMatrix.needsUpdate = true;
      if (pm.instanceColor) pm.instanceColor.needsUpdate = true;
    }
  });

  const qwColor = nm > 780 ? '#ff3b6b' : wavelengthToHex(nm);
  return (
    <>
      <ambientLight intensity={0.35} />
      <directionalLight position={[3, 5, 4]} intensity={1.1} />
      <pointLight position={[0, 1, 0]} intensity={3} color={qwColor} distance={5} />
      {/* p region */}
      <mesh position={[-1.2, 0, 0]}>
        <boxGeometry args={[2.3, 1, 1.4]} />
        <meshPhysicalMaterial color="#7c2f4a" transparent opacity={0.28} roughness={0.2} transmission={0.2} depthWrite={false} />
      </mesh>
      {/* n region */}
      <mesh position={[1.2, 0, 0]}>
        <boxGeometry args={[2.3, 1, 1.4]} />
        <meshPhysicalMaterial color="#2d4f8a" transparent opacity={0.28} roughness={0.2} transmission={0.2} depthWrite={false} />
      </mesh>
      {/* quantum wells */}
      {[-0.06, 0, 0.06].map((x) => (
        <mesh key={x} position={[x, 0, 0]}>
          <boxGeometry args={[0.025, 1.02, 1.42]} />
          <meshStandardMaterial ref={x === 0 ? flash : undefined} color={qwColor} emissive={qwColor} emissiveIntensity={1} toneMapped={false} transparent opacity={0.8} />
        </mesh>
      ))}
      {/* contacts */}
      <mesh position={[-2.42, 0, 0]}>
        <boxGeometry args={[0.1, 1.1, 1.5]} />
        <meshStandardMaterial color="#c9ccd4" metalness={0.9} roughness={0.25} />
      </mesh>
      <mesh position={[2.42, 0, 0]}>
        <boxGeometry args={[0.1, 1.1, 1.5]} />
        <meshStandardMaterial color="#c9ccd4" metalness={0.9} roughness={0.25} />
      </mesh>
      {phosphor && nm < 480 && (
        <mesh position={[0, 0.95, 0]}>
          <boxGeometry args={[4.7, 0.16, 1.45]} />
          <meshStandardMaterial color="#e8c24a" emissive="#c89a1a" emissiveIntensity={0.25} transparent opacity={0.55} />
        </mesh>
      )}
      <instancedMesh ref={elec} args={[undefined, undefined, N_E]} frustumCulled={false}>
        <sphereGeometry args={[1, 10, 10]} />
        <meshStandardMaterial color="#6fa8ff" emissive="#3c6dff" emissiveIntensity={1.4} />
      </instancedMesh>
      <instancedMesh ref={hole} args={[undefined, undefined, N_E]} frustumCulled={false}>
        <torusGeometry args={[0.8, 0.3, 8, 16]} />
        <meshStandardMaterial color="#ff8aa8" emissive="#ff3b6b" emissiveIntensity={0.8} />
      </instancedMesh>
      <instancedMesh ref={phot} args={[undefined, undefined, N_P]} frustumCulled={false}>
        <sphereGeometry args={[1, 8, 8]} />
        <meshBasicMaterial toneMapped={false} />
      </instancedMesh>
      <Html position={[-1.3, -0.85, 0.75]} center>
        <div className="scene-label">p-type · holes ○</div>
      </Html>
      <Html position={[1.3, -0.85, 0.75]} center>
        <div className="scene-label">n-type · electrons ●</div>
      </Html>
      <Html position={[0, -1.25, 0.75]} center>
        <div className="scene-label">active region (quantum wells)</div>
      </Html>
      {phosphor && nm < 480 && (
        <Html position={[2.2, 1.25, 0]} center>
          <div className="scene-label">phosphor: blue → yellow</div>
        </Html>
      )}
    </>
  );
}

export default function LedJunction() {
  const [mat, setMat] = useState<(typeof MATERIALS)[number]['id']>('ingan-b');
  const [current, setCurrent] = useState(1);
  const [phosphor, setPhosphor] = useState(true);
  const m = MATERIALS.find((x) => x.id === mat)!;
  const eV = 1239.84 / m.nm;
  return (
    <Widget
      title="Inside an LED: recombination makes light"
      eyebrow="3D · interactive"
      controls={
        <>
          <Segmented label="Semiconductor" value={mat} onChange={setMat} options={MATERIALS.map((x) => ({ value: x.id, label: x.label }))} />
          <Slider label="Forward current" value={current} min={0.1} max={3} step={0.05} onChange={setCurrent} format={(v) => `${(v * 100).toFixed(0)} mA`} />
          <Toggle label="Phosphor layer (white LED)" checked={phosphor} onChange={setPhosphor} />
          <Readouts>
            <Readout k="Peak λ" v={`${m.nm} nm`} />
            <Readout k="Photon energy" v={`${eV.toFixed(2)} eV`} />
          </Readouts>
          <p className="muted" style={{ margin: 0, fontSize: '0.84rem' }}>
            {m.note}. {phosphor && m.nm < 480 ? 'Part of the blue light is absorbed by the phosphor and re-emitted as yellow; the mix looks white.' : ''}
          </p>
        </>
      }
      caption={
        <p>
          Forward bias pushes electrons (blue) and holes (pink rings) into the thin quantum wells, where they recombine. Each radiative recombination emits one photon with
          energy close to the bandgap, E = hc/λ ≈ 1240 eV·nm / λ. More current means more recombinations per second, so the light output tracks the drive current. That
          is exactly why we can modulate data onto an LED.
        </p>
      }
    >
      <Stage height={360} camera={[3.2, 2.6, 5.4]} target={[0, 0.5, 0]} bloom={1.1}>
        <Junction nm={m.nm} current={current} phosphor={phosphor} />
      </Stage>
    </Widget>
  );
}
