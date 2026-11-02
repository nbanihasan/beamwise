import { useEffect, useMemo, useState } from 'react';
import * as THREE from 'three';
import { Html, Line } from '@react-three/drei';
import { Stage } from '@/three/Stage';
import { Plot } from '@/viz/Plot';
import { GroupTitle, Readout, Readouts, Segmented, Slider, Toggle, Widget } from '@/viz/controls';
import { KOMINE_LEDS, KOMINE_ROOM, lambertianOrder, losGain, powerGrid, type Emitter, type Vec3 } from '@/sim/lambertian';
import { inferno, legendGradient } from '@/three/colormap';
import { berOOK, noiseBudget } from '@/sim/receiver';
import { dB, sci } from '@/sim/math';

/**
 * The Lambertian line-of-sight channel in a room: received optical power on the desk plane for one or four
 * luminaires (Komine & Nakagawa's 5×5×3 m reference room), with a probe receiver you can move.
 */
const NX = 61;
const room = KOMINE_ROOM;

// sim coords (x, y, z-up) → three coords (x, y-up, z), centred on the room
const T = (p: Vec3): [number, number, number] => [p[0] - room.L / 2, p[2], p[1] - room.W / 2];
const dBm = (w: number) => dB(w * 1000);

interface RoomProps {
  leds: Emitter[];
  semi: number;
  zRx: number;
  grid: { grid: Float32Array; min: number; max: number };
  probe: Vec3;
  probeGains: number[];
  showCones: boolean;
}

function Room({ leds, semi, zRx, grid, probe, probeGains, showCones }: RoomProps) {
  const tex = useMemo(() => {
    const data = new Uint8Array(NX * NX * 4);
    const positive = Array.from(grid.grid).filter((v) => v > 0);
    const lo = positive.length ? dBm(Math.min(...positive)) : 0;
    const hi = dBm(grid.max);
    for (let i = 0; i < NX * NX; i++) {
      const v = grid.grid[i];
      const t = v > 0 ? (dBm(v) - lo) / Math.max(1e-6, hi - lo) : 0;
      const [r, g, b] = inferno(v > 0 ? 0.08 + 0.92 * t : 0);
      data.set([r, g, b, 240], i * 4);
    }
    const tx = new THREE.DataTexture(data, NX, NX, THREE.RGBAFormat);
    tx.magFilter = THREE.LinearFilter;
    tx.minFilter = THREE.LinearFilter;
    tx.colorSpace = THREE.SRGBColorSpace;
    tx.needsUpdate = true;
    return tx;
  }, [grid]);
  useEffect(() => () => tex.dispose(), [tex]);

  const coneH = room.H - zRx;
  const coneR = coneH * Math.tan((semi * Math.PI) / 180);
  const maxG = Math.max(...probeGains, 1e-30);
  const box = useMemo(() => new THREE.BoxGeometry(room.L, room.H, room.W), []);

  return (
    <>
      <ambientLight intensity={0.5} />
      <directionalLight position={[4, 8, 6]} intensity={0.6} />
      <lineSegments position={[0, room.H / 2, 0]}>
        <edgesGeometry args={[box]} />
        <lineBasicMaterial color="#3a4462" />
      </lineSegments>
      <mesh rotation={[-Math.PI / 2, 0, 0]}>
        <planeGeometry args={[room.L, room.W]} />
        <meshStandardMaterial color="#10131c" />
      </mesh>
      {/* Plane is rotated so its +v axis points along -z; DataTexture row j is sim y, so flip v. */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, zRx + 0.002, 0]} scale={[1, -1, 1]}>
        <planeGeometry args={[room.L, room.W]} />
        <meshBasicMaterial map={tex} transparent opacity={0.94} side={THREE.DoubleSide} toneMapped={false} />
      </mesh>
      {leds.map((l, i) => (
        <group key={i} position={T(l.pos)}>
          <mesh position={[0, -0.02, 0]}>
            <boxGeometry args={[0.6, 0.04, 0.6]} />
            <meshStandardMaterial color="#fff6e0" emissive="#fff1cc" emissiveIntensity={3.5} toneMapped={false} />
          </mesh>
          {showCones && semi < 85 && (
            <mesh position={[0, -coneH / 2, 0]}>
              <coneGeometry args={[coneR, coneH, 48, 1, true]} />
              <meshBasicMaterial color="#ffe7a8" transparent opacity={0.025} depthWrite={false} side={THREE.DoubleSide} blending={THREE.AdditiveBlending} />
            </mesh>
          )}
          <Line
            points={[
              [0, 0, 0],
              [probe[0] - l.pos[0], probe[2] - l.pos[2], probe[1] - l.pos[1]],
            ]}
            color="#5ad8ff"
            lineWidth={1 + 3 * (probeGains[i] / maxG)}
            transparent
            opacity={probeGains[i] > 0 ? 0.25 + 0.75 * (probeGains[i] / maxG) : 0.08}
            dashed={probeGains[i] === 0}
            dashSize={0.1}
            gapSize={0.08}
          />
        </group>
      ))}
      <group position={T(probe)}>
        <mesh position={[0, 0.03, 0]}>
          <cylinderGeometry args={[0.09, 0.09, 0.06, 24]} />
          <meshStandardMaterial color="#5ad8ff" emissive="#5ad8ff" emissiveIntensity={2} toneMapped={false} />
        </mesh>
        <Html position={[0, 0.32, 0]} center>
          <div className="scene-label">receiver</div>
        </Html>
      </group>
    </>
  );
}

export default function LambertianRoom() {
  const [layout, setLayout] = useState<'one' | 'four'>('four');
  const [semi, setSemi] = useState(70);
  const [fov, setFov] = useState(60);
  const [zRx, setZRx] = useState(0.85);
  const [powerW, setPowerW] = useState(20);
  const [px, setPx] = useState(1.0);
  const [py, setPy] = useState(2.5);
  const [cones, setCones] = useState(false);
  const area = 1e-4;

  const m = lambertianOrder(semi);
  const leds: Emitter[] = useMemo(() => {
    const pos: Vec3[] = layout === 'four' ? KOMINE_LEDS : [[2.5, 2.5, 3]];
    return pos.map((p) => ({ pos: p, normal: [0, 0, -1] as Vec3, m, power: powerW }));
  }, [layout, m, powerW]);

  const grid = useMemo(() => powerGrid(room, leds, { area, fovDeg: fov, Ts: 1 }, zRx, NX, NX), [leds, fov, zRx]);
  const probe: Vec3 = [px, py, zRx];
  const gains = leds.map((l) => losGain(l, { area, fovDeg: fov, pos: probe, normal: [0, 0, 1] }).H);
  const Pr = gains.reduce((s, g, i) => s + g * (leds[i].power ?? 1), 0);
  const Hprobe = gains.reduce((a, b) => a + b, 0);
  // Silicon PIN (0.54 A/W), 10 MHz, 5 pA/√Hz amplifier, modest ambient light (50 µA background)
  const nb = noiseBudget({ R: 0.54, Pr, Ibg: 50e-6, B: 10e6, inputNoise: 5e-12 });
  const row = Math.round((py / room.W) * (NX - 1));
  const xs = Array.from({ length: NX }, (_, i) => (i * room.L) / (NX - 1));
  const cut = xs.map((_, i) => (grid.grid[row * NX + i] > 0 ? dBm(grid.grid[row * NX + i]) : NaN));
  const noLight = grid.min === 0;

  return (
    <Widget
      title="Received power across a room"
      eyebrow="3D · Lambertian channel"
      controls={
        <>
          <GroupTitle>Transmitters</GroupTitle>
          <Segmented value={layout} onChange={setLayout} options={[{ value: 'one', label: '1 luminaire' }, { value: 'four', label: '4 luminaires' }]} />
          <Slider label="Semi-angle Φ½" value={semi} min={10} max={80} step={1} onChange={setSemi} format={(v) => `${v.toFixed(0)}° · m = ${lambertianOrder(v).toFixed(2)}`} />
          <Slider label="Optical power per luminaire" value={powerW} min={1} max={60} step={1} onChange={setPowerW} unit="W" />
          <Toggle label="Show half-power cones" checked={cones} onChange={setCones} />
          <GroupTitle>Receiver</GroupTitle>
          <Slider label="Field of view Ψc" value={fov} min={15} max={90} step={1} onChange={setFov} format={(v) => `${v.toFixed(0)}°`} />
          <Slider label="Desk height" value={zRx} min={0} max={2} step={0.05} onChange={setZRx} format={(v) => `${v.toFixed(2)} m`} />
          <Slider label="Probe x" value={px} min={0} max={5} step={0.05} onChange={setPx} format={(v) => `${v.toFixed(2)} m`} />
          <Slider label="Probe y" value={py} min={0} max={5} step={0.05} onChange={setPy} format={(v) => `${v.toFixed(2)} m`} />
        </>
      }
      caption={
        <p>
          Colours show received optical power on the desk plane from the LOS model with a 1 cm² detector. Narrow the semi-angle and light concentrates under each
          luminaire. Narrow the receiver FOV and the corners go black: the luminaires fall outside the cone the receiver accepts, and H(0) drops to exactly zero.
          Defaults follow the Komine &amp; Nakagawa reference room.
        </p>
      }
    >
      <Stage height={380} camera={[5.2, 5.4, 6.4]} target={[0, 0.8, 0]} bloom={0.35} maxDistance={20}>
        <Room leds={leds} semi={semi} zRx={zRx} grid={grid} probe={probe} probeGains={gains} showCones={cones} />
      </Stage>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, fontFamily: 'var(--font-mono)', fontSize: '0.72rem', color: 'var(--text-3)' }}>
        <span>{noLight ? 'no LOS' : `${dBm(grid.min).toFixed(1)} dBm`}</span>
        <span style={{ flex: 1, height: 8, borderRadius: 4, background: legendGradient() }} />
        <span>{dBm(grid.max).toFixed(1)} dBm</span>
      </div>
      <Readouts>
        <Readout k="Probe H(0)" v={sci(Hprobe, 2)} />
        <Readout k="Probe Pr" v={Pr > 0 ? `${dBm(Pr).toFixed(1)} dBm` : 'no LOS'} tone={Pr > 0 ? undefined : 'bad'} />
        <Readout k="SNR @ 10 MHz" v={Pr > 0 ? `${dB(nb.snr).toFixed(1)} dB` : '—'} />
        <Readout k="OOK BER" v={Pr > 0 ? sci(berOOK(nb.snr), 1) : '—'} />
        <Readout k="Max − min" v={noLight ? 'dark spots' : `${(dBm(grid.max) - dBm(grid.min)).toFixed(1)} dB`} tone={noLight ? 'warn' : undefined} />
      </Readouts>
      <Plot
        title={`Cross-section at y = ${py.toFixed(2)} m`}
        height={150}
        xLabel="x (m)"
        yLabel="dBm"
        x={[0, 5]}
        series={[{ x: xs, y: cut, color: 'var(--phosphor)', width: 2 }]}
        vlines={[{ x: px, label: 'probe', color: 'var(--c6)' }]}
      />
    </Widget>
  );
}
