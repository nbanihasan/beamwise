import { useMemo, useState } from 'react';
import * as THREE from 'three';
import { Html, Line } from '@react-three/drei';
import { Stage } from '@/three/Stage';
import { Plot } from '@/viz/Plot';
import { GroupTitle, Readout, Readouts, Segmented, Slider, Toggle, Widget } from '@/viz/controls';
import { StudioLights } from '@/three/kit/env';
import { Beam } from '@/three/kit/beam';
import { Person } from '@/three/kit/models';
import { DetectorCan, EmitterBody } from '@/three/kit/components';
import { impulseResponse, isiLimitedRate, KOMINE_ROOM, lambertianOrder, type Vec3 } from '@/sim/lambertian';
import { dB, eng } from '@/sim/math';

/**
 * Kahn & Barry's link classification in one room: directed LOS, non-directed LOS, diffuse (NLOS) and
 * tracked links, with a person you can walk through the beam. Channel = LOS + first-order reflections
 * from walls, ceiling and floor.
 */
type Config = 'directed' | 'nondirected' | 'diffuse' | 'tracked';
const room = KOMINE_ROOM;
const T = (p: Vec3): [number, number, number] => [p[0] - room.L / 2, p[2], p[1] - room.W / 2];
const RX: Vec3 = [3.8, 1.6, 0.85];

interface Cfg {
  tx: Vec3;
  txN: Vec3;
  semi: number;
  rxN: Vec3;
  fov: number;
  label: string;
  blurb: string;
}

function unit(v: Vec3): Vec3 {
  const n = Math.hypot(...v);
  return [v[0] / n, v[1] / n, v[2] / n];
}
const toward = (a: Vec3, b: Vec3) => unit([b[0] - a[0], b[1] - a[1], b[2] - a[2]]);

const CONFIGS: Record<Config, Cfg> = {
  directed: { tx: [0.15, 1.6, 2.2], txN: toward([0.15, 1.6, 2.2], RX), semi: 6, rxN: toward(RX, [0.15, 1.6, 2.2]), fov: 12, label: 'Directed LOS', blurb: 'Narrow beam, narrow FOV, aimed at each other: lowest path loss, least ambient noise, almost no multipath, but needs alignment and fails the moment anything blocks it.' },
  nondirected: { tx: [2.5, 2.5, 3], txN: [0, 0, -1], semi: 60, rxN: [0, 0, 1], fov: 70, label: 'Non-directed LOS', blurb: 'Wide beam from the ceiling, wide-FOV receiver: no aiming needed and reflections fill in some shadows. The typical LiFi downlink.' },
  diffuse: { tx: [2.5, 2.5, 1.0], txN: [0, 0, 1], semi: 60, rxN: [0, 0, 1], fov: 80, label: 'Diffuse (NLOS)', blurb: 'The transmitter lights the ceiling, which re-radiates everywhere (Gfeller & Bapst, 1979). Very robust to blockage and orientation, but the path loss is high and the delay spread limits the rate.' },
  tracked: { tx: [0.5, 0.5, 3], txN: toward([0.5, 0.5, 3], RX), semi: 10, rxN: toward(RX, [0.5, 0.5, 3]), fov: 25, label: 'Tracked', blurb: 'A narrow beam that follows the user (beam steering): directed-LOS performance with mobility, at the cost of tracking hardware.' },
};

const PERSON_R = 0.28;
const PERSON_H = 1.8;
function segmentHitsPerson(a: Vec3, b: Vec3, px: number, py: number): boolean {
  const dx = b[0] - a[0];
  const dy = b[1] - a[1];
  const L2 = dx * dx + dy * dy;
  let t = L2 > 0 ? ((px - a[0]) * dx + (py - a[1]) * dy) / L2 : 0;
  t = Math.max(0, Math.min(1, t));
  const cx = a[0] + t * dx;
  const cy = a[1] + t * dy;
  const cz = a[2] + t * (b[2] - a[2]);
  return Math.hypot(cx - px, cy - py) < PERSON_R && cz < PERSON_H;
}

function quatFor(n: Vec3) {
  // components face local +Z; map sim normal to three space
  const d = new THREE.Vector3(n[0], n[2], n[1]).normalize();
  return new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 0, 1), d);
}

export default function LinkGeometries() {
  const [cfgId, setCfgId] = useState<Config>('nondirected');
  const [personOn, setPersonOn] = useState(true);
  const [px, setPx] = useState(0.62);
  const cfg = CONFIGS[cfgId];
  const pX = 0.6 + px * 3.8;
  const pY = 1.55;

  const { ir, irFree, losBlocked, rays } = useMemo(() => {
    const tx = { pos: cfg.tx, normal: cfg.txN, m: lambertianOrder(cfg.semi) };
    const rx = { pos: RX, normal: cfg.rxN, area: 1e-4, fovDeg: cfg.fov };
    const losBlocked = personOn && segmentHitsPerson(cfg.tx, RX, pX, pY);
    const blocked = personOn ? (p: Vec3) => segmentHitsPerson(cfg.tx, p, pX, pY) || segmentHitsPerson(p, RX, pX, pY) : undefined;
    const o = { ceiling: true, floor: true, rhoFloor: 0.2, losBlocked, blocked };
    const ir = impulseResponse(room, tx, rx, 0.8, 0.2, 0.5e-9, o);
    const irFree = impulseResponse(room, tx, rx, 0.8, 0.2, 0.5e-9, { ceiling: true, floor: true, rhoFloor: 0.2 });
    // a few representative bounce points for drawing
    const pts: Vec3[] = [];
    const cand: Vec3[] = [];
    for (let x = 0.5; x < room.L; x += 1) for (let y = 0.5; y < room.W; y += 1) cand.push([x, y, room.H]);
    for (let s = 0.5; s < room.L; s += 1.25) cand.push([s, 0, 2], [s, room.W, 2], [0, s, 2], [room.L, s, 2]);
    for (const p of cand) {
      const d = toward(cfg.tx, p);
      const cosPhi = d[0] * cfg.txN[0] + d[1] * cfg.txN[1] + d[2] * cfg.txN[2];
      const r = toward(RX, p);
      const cosPsi = r[0] * cfg.rxN[0] + r[1] * cfg.rxN[1] + r[2] * cfg.rxN[2];
      if (cosPhi > Math.cos((Math.min(80, cfg.semi * 1.6) * Math.PI) / 180) && cosPsi > Math.cos((cfg.fov * Math.PI) / 180)) pts.push(p);
    }
    return { ir, irFree, losBlocked, rays: pts.slice(0, 14) };
  }, [cfg, personOn, pX]);

  const total = ir.losGain + ir.diffuseGain;
  const free = irFree.losGain + irFree.diffuseGain;
  const t = Array.from(ir.h, (_, i) => (ir.t0 + i * ir.dt) * 1e9);
  const peak = Math.max(...Array.from(irFree.h), 1e-30);

  const controls = (
    <>
      <Segmented
        label="Link geometry"
        value={cfgId}
        options={(Object.keys(CONFIGS) as Config[]).map((k) => ({ value: k, label: CONFIGS[k].label }))}
        onChange={setCfgId}
      />
      <GroupTitle>Blockage</GroupTitle>
      <Toggle label="Person in the room" checked={personOn} onChange={setPersonOn} />
      {personOn && <Slider label="Person position" value={px} min={0} max={1} step={0.01} onChange={setPx} format={(v) => `${(0.6 + v * 3.8).toFixed(1)} m`} />}
      <Readouts>
        <Readout k="Channel gain H(0)" v={total > 0 ? `${dB(total).toFixed(1)} dB` : 'no link'} tone={total > 0 ? undefined : 'bad'} />
        <Readout k="Line of sight" v={ir.losGain > 0 ? `${((ir.losGain / total) * 100).toFixed(0)} % of power` : losBlocked ? 'blocked' : 'none'} tone={ir.losGain > 0 ? 'good' : 'warn'} />
        <Readout k="Loss from blockage" v={free > 0 && total > 0 ? `${(dB(free) - dB(total)).toFixed(1)} dB` : total === 0 ? 'link lost' : '—'} tone={free / Math.max(total, 1e-30) > 10 ? 'bad' : undefined} />
        <Readout k="RMS delay spread" v={eng(ir.rmsDelay, 's')} />
        <Readout k="ISI-limited rate" v={eng(isiLimitedRate(ir.rmsDelay), 'Bd')} />
      </Readouts>
    </>
  );

  return (
    <Widget title="LOS, NLOS and everything between" eyebrow="3D · link geometry" controls={controls} caption={<p>{cfg.blurb}</p>}>
      <Stage height={320} camera={[6.2, 4.6, 6.2]} target={[0, 1.1, 0]} bloom={0.9}>
        <StudioLights intensity={0.65} />
        <mesh position={[0, room.H / 2, 0]}>
          <boxGeometry args={[room.L, room.H, room.W]} />
          <meshStandardMaterial color="#1b1d25" side={THREE.BackSide} transparent opacity={0.55} />
        </mesh>
        <lineSegments position={[0, room.H / 2, 0]}>
          <edgesGeometry args={[new THREE.BoxGeometry(room.L, room.H, room.W)]} />
          <lineBasicMaterial color="#3a3f52" />
        </lineSegments>
        <group position={T(cfg.tx)} quaternion={quatFor(cfg.txN)}>
          <EmitterBody scale={4} kind={cfg.semi < 15 ? 'laser' : 'led'} />
        </group>
        <group position={T(RX)} quaternion={quatFor(cfg.rxN)}>
          <DetectorCan scale={6} lit={Math.min(1, total * 1e5)} />
        </group>
        {ir.losGain > 0 && <Beam from={T(cfg.tx)} to={T(RX)} r0={0.05} r1={cfg.semi < 15 ? 0.25 : 0.12} color="#ffe2a0" opacity={0.4} mod={0.6} />}
        {losBlocked && <Line points={[T(cfg.tx), T(RX)]} color="#ff6f86" lineWidth={1.5} dashed dashSize={0.12} gapSize={0.08} />}
        {cfgId !== 'directed' &&
          rays.map((p, i) => {
            const blocked = personOn && (segmentHitsPerson(cfg.tx, p, pX, pY) || segmentHitsPerson(p, RX, pX, pY));
            return <Line key={i} points={[T(cfg.tx), T(p), T(RX)]} color={blocked ? '#ff6f86' : '#8fd3ff'} transparent opacity={blocked ? 0.25 : 0.35} lineWidth={1} />;
          })}
        {cfgId === 'diffuse' && <Beam from={T(cfg.tx)} to={T([cfg.tx[0], cfg.tx[1], room.H - 0.01])} r0={0.05} r1={2.6} color="#ffe2a0" opacity={0.12} mod={0.4} />}
        {personOn && <Person position={T([pX, pY, 0])} />}
        <Html position={T([RX[0], RX[1], RX[2] + 0.35])} center>
          <div className="scene-label">receiver</div>
        </Html>
      </Stage>
      <Plot
        title="Impulse response (grey: no person)"
        series={[
          { x: Array.from(irFree.h, (_, i) => (irFree.t0 + i * irFree.dt) * 1e9), y: Array.from(irFree.h, (v) => v / peak), kind: 'stem', color: 'var(--text-3)' },
          { x: t, y: Array.from(ir.h, (v) => v / peak), kind: 'stem', color: 'var(--c2)' },
        ]}
        xLabel="delay (ns)"
        y={[0, 1.05]}
        height={150}
      />
    </Widget>
  );
}
