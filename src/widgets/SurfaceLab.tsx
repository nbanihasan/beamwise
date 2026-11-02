import { useMemo, useState } from 'react';
import * as THREE from 'three';
import { Html, Line } from '@react-three/drei';
import { Stage } from '@/three/Stage';
import { Plot } from '@/viz/Plot';
import { GroupTitle, Readout, Readouts, Select, Slider, Widget } from '@/viz/controls';
import { StudioLights } from '@/three/kit/env';
import { impulseResponse, isiLimitedRate, KOMINE_ROOM, lambertianOrder } from '@/sim/lambertian';
import { eng } from '@/sim/math';

/**
 * How a surface reflects light: the 3D reflection lobe (diffuse Lambertian + glossy Phong + optional
 * retro-reflection) for an incident ray, and what a room built from that material does to the channel.
 * Material values are illustrative visible-band figures; real reflectances depend on wavelength
 * (see Miramirkhani & Uysal 2015).
 */
interface Material {
  id: string;
  name: string;
  rd: number; // diffuse reflectance
  rs: number; // specular/glossy reflectance
  n: number; // Phong exponent
  retro?: number; // retro-reflective share
  color: string;
}

export const MATERIALS: Material[] = [
  { id: 'plaster', name: 'White plaster', rd: 0.8, rs: 0.02, n: 2, color: '#e9e6df' },
  { id: 'wood', name: 'Wood', rd: 0.45, rs: 0.08, n: 8, color: '#9a6b44' },
  { id: 'tile', name: 'Glazed tile', rd: 0.35, rs: 0.3, n: 40, color: '#c9d6e0' },
  { id: 'carpet', name: 'Carpet', rd: 0.15, rs: 0, n: 1, color: '#5a4a52' },
  { id: 'metal', name: 'Brushed metal', rd: 0.1, rs: 0.6, n: 18, color: '#aab0ba' },
  { id: 'glass', name: 'Window glass', rd: 0.0, rs: 0.08, n: 600, color: '#9cc7e8' },
  { id: 'mirror', name: 'Mirror', rd: 0.0, rs: 0.92, n: 3000, color: '#e6ecf5' },
  { id: 'retro', name: 'Retro-reflective film', rd: 0.1, rs: 0.05, n: 10, retro: 0.6, color: '#d8dbe0' },
  { id: 'black', name: 'Black curtain', rd: 0.04, rs: 0, n: 1, color: '#16161a' },
];

function Lobe({ m, inc }: { m: Material; inc: number }) {
  const geo = useMemo(() => {
    const g = new THREE.SphereGeometry(1, 96, 48, 0, Math.PI * 2, 0, Math.PI / 2);
    const pos = g.attributes.position as THREE.BufferAttribute;
    const th = (inc * Math.PI) / 180;
    const R = new THREE.Vector3(Math.sin(th), Math.cos(th), 0); // mirror direction
    const back = new THREE.Vector3(-Math.sin(th), Math.cos(th), 0); // towards the source
    const v = new THREE.Vector3();
    const rs: number[] = [];
    let max = 1e-9;
    for (let i = 0; i < pos.count; i++) {
      v.fromBufferAttribute(pos, i).normalize();
      const cosO = Math.max(0, v.y);
      const diffuse = (m.rd / Math.PI) * cosO;
      const gloss = m.rs > 0 ? ((m.rs * (m.n + 2)) / (2 * Math.PI)) * Math.pow(Math.max(0, v.dot(R)), m.n) * cosO : 0;
      const retro = m.retro ? ((m.retro * 12) / (2 * Math.PI)) * Math.pow(Math.max(0, v.dot(back)), 10) : 0;
      const r = diffuse + gloss + retro;
      rs.push(r);
      max = Math.max(max, r);
    }
    // compress the dynamic range so a mirror's needle and a Lambertian bulb both stay visible
    for (let i = 0; i < pos.count; i++) {
      v.fromBufferAttribute(pos, i).normalize();
      const r = 1.6 * Math.pow(rs[i] / max, 0.5);
      pos.setXYZ(i, v.x * r, v.y * r, v.z * r);
    }
    g.computeVertexNormals();
    return g;
  }, [m, inc]);
  return (
    <mesh geometry={geo}>
      <meshStandardMaterial color="#ffd27a" emissive="#ffb84a" emissiveIntensity={0.35} transparent opacity={0.55} roughness={0.4} side={THREE.DoubleSide} />
    </mesh>
  );
}

export default function SurfaceLab() {
  const [mid, setMid] = useState('plaster');
  const [inc, setInc] = useState(35);
  const [fov, setFov] = useState(70);
  const m = MATERIALS.find((x) => x.id === mid)!;
  const th = (inc * Math.PI) / 180;

  const ir = useMemo(() => {
    const room = KOMINE_ROOM;
    return impulseResponse(
      room,
      { pos: [2.5, 2.5, 3], normal: [0, 0, -1], m: lambertianOrder(60) },
      { pos: [1.0, 1.2, 0.85], normal: [0, 0, 1], area: 1e-4, fovDeg: fov },
      Math.max(0.001, m.rd),
      0.1,
      0.5e-9,
    );
  }, [m, fov]);
  const total = ir.losGain + ir.diffuseGain;
  const t = Array.from(ir.h, (_, i) => (ir.t0 + i * ir.dt) * 1e9);
  const hn = Array.from(ir.h, (v) => v / Math.max(...ir.h));

  const controls = (
    <>
      <GroupTitle>Surface</GroupTitle>
      <Select value={mid} options={MATERIALS.map((x) => ({ value: x.id, label: x.name }))} onChange={setMid} />
      <Slider label="Angle of incidence" value={inc} min={0} max={80} step={1} unit="°" onChange={setInc} />
      <GroupTitle>Room made of it</GroupTitle>
      <Slider label="Receiver FOV" value={fov} min={20} max={90} step={1} unit="°" onChange={setFov} />
      <Readouts>
        <Readout k="Diffuse ρ_d / glossy ρ_s" v={`${m.rd.toFixed(2)} / ${m.rs.toFixed(2)}`} />
        <Readout k="Reflected share of power" v={`${((ir.diffuseGain / Math.max(1e-30, total)) * 100).toFixed(0)} %`} />
        <Readout k="RMS delay spread" v={eng(ir.rmsDelay, 's')} />
        <Readout k="ISI-limited rate ≈ 1/(10τ)" v={eng(isiLimitedRate(ir.rmsDelay), 'Bd')} tone={isiLimitedRate(ir.rmsDelay) > 2e8 ? 'good' : 'warn'} />
      </Readouts>
    </>
  );

  return (
    <Widget
      title="Surface reflection: from Lambertian to mirror"
      eyebrow="3D · BRDF"
      controls={controls}
      caption={
        <p>
          The golden lobe is the reflected intensity in every direction for a ray arriving at {inc}° (shown in white; dashed = mirror direction). Matte surfaces re-emit like a Lambertian source whatever the incidence;
          glossy ones push light towards the mirror direction; retro-reflectors send it back to the source. The plot uses only the diffuse part (first-order Lambertian walls), the standard channel model.
        </p>
      }
    >
      <Stage height={300} camera={[3.2, 2.6, 3.4]} target={[0, 0.7, 0]} bloom={0.6}>
        <StudioLights intensity={0.8} />
        <mesh rotation-x={-Math.PI / 2}>
          <circleGeometry args={[2.2, 64]} />
          <meshStandardMaterial color={m.color} roughness={m.rs > 0.5 ? 0.05 : 0.85} metalness={m.id === 'metal' || m.id === 'mirror' ? 0.9 : 0} />
        </mesh>
        <Lobe m={m} inc={inc} />
        <Line points={[[-Math.sin(th) * 2.4, Math.cos(th) * 2.4, 0], [0, 0, 0]]} color="#ffffff" lineWidth={2.5} />
        <Line points={[[0, 0, 0], [Math.sin(th) * 2.4, Math.cos(th) * 2.4, 0]]} color="#ffffff" lineWidth={1} dashed dashSize={0.08} gapSize={0.06} />
        <Line points={[[0, 0, 0], [0, 2, 0]]} color="#8fa6ff" lineWidth={1} />
        <Html position={[-Math.sin(th) * 2.5, Math.cos(th) * 2.5 + 0.1, 0]} center>
          <div className="scene-label">incident</div>
        </Html>
        <Html position={[0, 2.1, 0]} center>
          <div className="scene-label">normal</div>
        </Html>
      </Stage>
      <Plot
        title="Room impulse response (LOS + first-order reflections)"
        series={[{ x: t, y: hn, kind: 'stem', color: 'var(--c2)' }]}
        xLabel="delay (ns)"
        y={[0, 1.05]}
        height={160}
      />
    </Widget>
  );
}
