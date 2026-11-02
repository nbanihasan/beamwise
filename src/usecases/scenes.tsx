import { useMemo, useRef, type ComponentType, type ReactNode } from 'react';
import { useFrame } from '@react-three/fiber';
import { Html, Line } from '@react-three/drei';
import * as THREE from 'three';
import { Beam, Glow, Laser, PhotonStream } from '@/three/kit/beam';
import { Ground, Particles, Starfield, StudioLights, WaterVolume } from '@/three/kit/env';
import {
  AGV,
  AUV,
  Building,
  Buoy,
  Car,
  CeilingPanel,
  Desk,
  Downlight,
  Drone,
  Earth,
  GroundStation,
  Laptop,
  Person,
  Phone,
  Road,
  RobotArm,
  Satellite,
  Screen,
  SeabedNode,
  SeatRow,
  Shelf,
  Spinning,
  StreetLamp,
  TrafficLight,
  useCanvasTexture,
} from '@/three/kit/models';
import { RetroMesh, SolarCell, DetectorCan } from '@/three/kit/components';

/**
 * One animated 3D scene per use case (ids match usecases/data.ts). Scenes are composed from the shared
 * kit, so a new scene is usually 40–80 lines.
 */
type V3 = [number, number, number];

const Label = ({ position, children }: { position: V3; children: ReactNode }) => (
  <Html position={position} center zIndexRange={[10, 0]}>
    <div className="scene-label">{children}</div>
  </Html>
);

/* ------------------------------------------------------------------ */
function Office() {
  const lights: V3[] = [
    [-1.6, 2.9, -1.4],
    [1.6, 2.9, -1.4],
    [-1.6, 2.9, 1.4],
    [1.6, 2.9, 1.4],
  ];
  const cellColors = ['#ffd27a', '#8fa6ff', '#5ee0a8', '#ff86b0'];
  const screen = useCanvasTexture(
    128,
    80,
    (g, t) => {
      g.fillStyle = '#0d1630';
      g.fillRect(0, 0, 128, 80);
      g.fillStyle = '#8fa6ff';
      for (let i = 0; i < 8; i++) g.fillRect(8, 8 + i * 8, 40 + 60 * Math.abs(Math.sin(t * 2 + i)), 4);
    },
    6,
  );
  return (
    <>
      <StudioLights intensity={0.5} />
      <Ground size={30} />
      {/* back walls */}
      <mesh position={[0, 1.5, -3.05]}>
        <planeGeometry args={[7, 3]} />
        <meshStandardMaterial color="#14151b" />
      </mesh>
      <mesh position={[-3.5, 1.5, 0]} rotation-y={Math.PI / 2}>
        <planeGeometry args={[6.1, 3]} />
        <meshStandardMaterial color="#111218" />
      </mesh>
      {lights.map((p, i) => (
        <group key={i}>
          <CeilingPanel position={p} />
          <Beam from={[p[0], p[1] - 0.05, p[2]]} to={[p[0], 0.02, p[2]]} r0={0.32} r1={1.45} color={cellColors[i]} opacity={0.16} mod={0.55} stripes={9} speed={1.5 + i * 0.2} />
          <mesh position={[p[0], 0.012, p[2]]} rotation-x={-Math.PI / 2}>
            <ringGeometry args={[1.38, 1.45, 64]} />
            <meshBasicMaterial color={cellColors[i]} transparent opacity={0.55} toneMapped={false} />
          </mesh>
        </group>
      ))}
      {[
        [-1.6, -1.2],
        [1.6, -1.2],
        [-1.6, 1.6],
        [1.6, 1.6],
      ].map(([x, z], i) => (
        <group key={i}>
          <Desk position={[x, 0, z]} w={1.2} d={0.7} />
          <Laptop position={[x, 0.77, z + 0.05]} screen={screen} />
          <Person position={[x, 0, z + 0.65]} rotation={[0, Math.PI, 0]} seated color={['#3d4a7a', '#7a4a3d', '#3d7a5a', '#6a3d7a'][i]} />
          {/* IR uplink */}
          <Laser from={[x + 0.12, 0.8, z + 0.12]} to={[lights[i][0], 2.85, lights[i][2]]} color="#ff5a7a" width={0.006} opacity={0.45} stripes={18} />
        </group>
      ))}
      <Label position={[-1.6, 3.25, -1.4]}>LiFi AP · cell 1</Label>
      <Label position={[1.6, 0.25, 1.95]}>IR uplink</Label>
    </>
  );
}

/* ------------------------------------------------------------------ */
function Streets() {
  const lead = useRef<THREE.Group>(null);
  const follow = useRef<THREE.Group>(null);
  useFrame(({ clock }) => {
    const t = clock.getElapsedTime();
    const z = ((t * 4) % 40) - 20;
    if (lead.current) lead.current.position.z = z;
    if (follow.current) follow.current.position.z = z - 9 - Math.sin(t * 0.7);
  });
  return (
    <>
      <StudioLights intensity={0.35} env={false} />
      <fog attach="fog" args={['#06070b', 18, 70]} />
      <Ground size={90} color="#0a0b0f" grid={false} />
      <Road length={90} width={8} />
      <Road length={90} width={8} rotation={[0, Math.PI / 2, 0]} position={[0, 0.001, 8]} />
      {[-24, -12, 0, 12, 24].map((z) => (
        <group key={z}>
          <StreetLamp position={[-5.2, 0, z]} />
          <Beam from={[-3.8, 5.9, z]} to={[-2.4, 0.02, z]} r0={0.2} r1={2.6} color="#ffe6b3" opacity={0.08} mod={0.4} stripes={8} />
        </group>
      ))}
      <TrafficLight position={[4.6, 0, 5]} rotation={[0, -Math.PI / 2, 0]} state="green" />
      <group ref={lead} position={[1.9, 0, 0]}>
        <Car color="#c8ccd4" />
        {/* tail light to follower */}
        <Beam from={[0, 0.75, -2.2]} to={[0, 0.85, -7.6]} r0={0.25} r1={0.7} color="#ff2a3d" opacity={0.3} mod={0.8} stripes={10} speed={3} />
        <Label position={[0, 2, -4.5]}>V2V · tail light → PD</Label>
      </group>
      <group ref={follow} position={[1.9, 0, -9]}>
        <Car color="#5a6ba8" />
        {/* headlights forward */}
        <Beam from={[0, 0.7, 2.2]} to={[0, 0.3, 9]} r0={0.5} r1={2} color="#e6efff" opacity={0.08} mod={0.2} />
      </group>
      <Beam from={[4.4, 4.9, 5]} to={[2, 1.1, -2]} r0={0.1} r1={1.2} color="#2fe07a" opacity={0.22} mod={0.8} stripes={12} speed={2.6} />
      <Label position={[4.6, 6, 5]}>I2V · traffic light</Label>
      <Label position={[-4.2, 6.4, -12]}>I2V · street lamp</Label>
    </>
  );
}

/* ------------------------------------------------------------------ */
function Ring({ r, tilt, n, speed, color }: { r: number; tilt: number; n: number; speed: number; color: string }) {
  const pts = useMemo(() => Array.from({ length: n }, (_, i) => [r * Math.cos((i / n) * Math.PI * 2), 0, r * Math.sin((i / n) * Math.PI * 2)] as V3), [r, n]);
  const orbit = useMemo(() => Array.from({ length: 129 }, (_, i) => [r * Math.cos((i / 128) * Math.PI * 2), 0, r * Math.sin((i / 128) * Math.PI * 2)] as V3), [r]);
  return (
    <group rotation={[tilt, 0, 0]}>
      <Line points={orbit} color={color} transparent opacity={0.18} lineWidth={1} />
      <Spinning speed={speed}>
        {pts.map((p, i) => (
          <group key={i}>
            <Satellite position={p} scale={0.55} rotation={[0, -(i / n) * Math.PI * 2, 0]} />
            <Laser from={p} to={pts[(i + 1) % n]} color={color} width={0.05} opacity={0.85} stripes={40} />
          </group>
        ))}
      </Spinning>
    </group>
  );
}

function ISL() {
  return (
    <>
      <StudioLights intensity={0.6} />
      <Starfield />
      <directionalLight position={[30, 10, 10]} intensity={2} />
      <Earth radius={9} />
      <Ring r={14} tilt={0.35} n={8} speed={0.08} color="#ff6b8a" />
      <Ring r={16.5} tilt={-0.5} n={9} speed={0.06} color="#8fa6ff" />
      <Label position={[0, 9.5, 14]}>Intra-plane laser links</Label>
    </>
  );
}

/* ------------------------------------------------------------------ */
function GroundToSpace() {
  const beam = useRef<THREE.Group>(null);
  const cloud = useRef<THREE.Group>(null);
  useFrame(({ clock }) => {
    const t = clock.getElapsedTime();
    if (beam.current) {
      beam.current.rotation.z = Math.sin(t * 3.1) * 0.006 + Math.sin(t * 7.3) * 0.004;
      beam.current.rotation.x = Math.cos(t * 2.7) * 0.006;
    }
    if (cloud.current) cloud.current.position.x = ((t * 2) % 60) - 30;
  });
  const sat: V3 = [0, 34, 0];
  return (
    <>
      <StudioLights intensity={0.5} />
      <Starfield radius={140} />
      <Ground size={120} color="#0d0f14" grid={false} />
      {/* atmosphere layers */}
      {[4, 8, 12, 16].map((y, i) => (
        <mesh key={y} position={[0, y, 0]} rotation-x={-Math.PI / 2}>
          <planeGeometry args={[80, 80]} />
          <meshBasicMaterial color="#5fb4ff" transparent opacity={0.035 - i * 0.006} depthWrite={false} side={THREE.DoubleSide} />
        </mesh>
      ))}
      <GroundStation position={[0, 0, 0]} />
      <GroundStation position={[-22, 0, -10]} scale={0.8} />
      <group ref={beam} position={[0, 2.3, 0.6]}>
        <Laser from={[0, 0, 0]} to={[0, sat[1] - 2.3, -0.6]} color="#ff5a7a" width={0.12} opacity={0.75} stripes={60} />
        <Beam from={[0, 0, 0]} to={[0, 18, -0.3]} r0={0.25} r1={1.6} color="#c39bff" opacity={0.08} mod={0} />
      </group>
      <Satellite position={sat} scale={1.4} />
      <group ref={cloud} position={[0, 14, 3]}>
        {[0, 1.6, 3, -1.5, 4.5].map((x, i) => (
          <mesh key={i} position={[x, Math.sin(i) * 0.4, Math.cos(i) * 0.8]} scale={[2.4, 1, 1.6]}>
            <sphereGeometry args={[1, 20, 14]} />
            <meshStandardMaterial color="#d8dde6" transparent opacity={0.55} roughness={1} />
          </mesh>
        ))}
      </group>
      <Particles count={500} box={[30, 16, 30]} center={[0, 9, 0]} color="#bcd4ff" size={0.08} drift={0.4} opacity={0.25} />
      <Label position={[3, 9, 0]}>Turbulence: wander + scintillation</Label>
      <Label position={[-22, 5, -10]}>Backup station (site diversity)</Label>
    </>
  );
}

/* ------------------------------------------------------------------ */
function Underwater() {
  const auv = useRef<THREE.Group>(null);
  useFrame(({ clock }) => {
    const t = clock.getElapsedTime();
    if (auv.current) {
      auv.current.position.x = -2 + Math.sin(t * 0.3) * 1.2;
      auv.current.position.y = 2.6 + Math.sin(t * 0.7) * 0.15;
    }
  });
  return (
    <>
      <StudioLights intensity={0.45} env={false} />
      <fog attach="fog" args={['#021b27', 6, 30]} />
      <mesh rotation-x={-Math.PI / 2}>
        <planeGeometry args={[40, 40, 40, 40]} />
        <meshStandardMaterial color="#3a3a2c" roughness={1} />
      </mesh>
      <WaterVolume size={[18, 7, 12]} color="#0a4a6a" opacity={0.12} />
      <SeabedNode position={[3.5, 0, -1]} />
      <SeabedNode position={[-5, 0, 2]} />
      <group ref={auv} position={[-2, 2.6, 0]}>
        <AUV rotation={[0, 0, 0]} />
      </group>
      <Beam from={[3.5, 0.82, -1]} to={[-1.5, 2.6, 0]} r0={0.05} r1={0.5} color="#2ee6c8" opacity={0.35} mod={0.75} stripes={12} speed={2.4} />
      <Buoy position={[1, 7.2, 1]} />
      <Beam from={[1, 6.35, 1]} to={[3.5, 0.9, -1]} r0={0.06} r1={0.7} color="#3ab8ff" opacity={0.25} mod={0.7} stripes={14} />
      <Particles count={900} box={[18, 7, 12]} center={[0, 3.5, 0]} color="#9fe8ff" size={0.035} drift={0.08} opacity={0.5} />
      <Label position={[1, 8.4, 1]}>Buoy → RF / satellite</Label>
      <Label position={[0.8, 2.2, -0.5]}>Blue-green beam · scattering</Label>
    </>
  );
}

/* ------------------------------------------------------------------ */
function codeFrame(g: CanvasRenderingContext2D, t: number, w: number, h: number, n = 12, hidden = false) {
  const cw = w / n;
  const ch = h / Math.round((n * h) / w);
  const rows = Math.round(h / ch);
  const seed = Math.floor(t * 10);
  for (let y = 0; y < rows; y++)
    for (let x = 0; x < n; x++) {
      const v = Math.abs(Math.sin((x + 1) * 12.9898 + (y + 1) * 78.233 + seed * 3.7)) * 43758.5453;
      const f = v - Math.floor(v);
      if (hidden) {
        const base = 40 + 30 * Math.sin(x * 0.4 + t) + 30 * Math.cos(y * 0.5 - t * 0.7);
        const d = f > 0.5 ? 10 : -10;
        g.fillStyle = `rgb(${base + 60 + d},${base + 30 + d},${base + 90 + d})`;
      } else {
        const cols = ['#ff4d6d', '#ffd27a', '#5ee0a8', '#6fe0ff', '#c39bff', '#ffffff', '#111111', '#3d55e0'];
        g.fillStyle = cols[Math.floor(f * cols.length)];
      }
      g.fillRect(x * cw, y * ch, cw - (hidden ? 0 : 1), ch - (hidden ? 0 : 1));
    }
}

function TvPhone() {
  const tv = useCanvasTexture(256, 144, (g, t) => codeFrame(g, t, 256, 144, 24, true), 12);
  const phone = useCanvasTexture(
    64,
    128,
    (g, t) => {
      g.fillStyle = '#0b0f1c';
      g.fillRect(0, 0, 64, 128);
      g.fillStyle = '#6fe0ff';
      g.font = '8px monospace';
      for (let i = 0; i < 12; i++) g.fillText(Math.abs(Math.sin(t * 3 + i)) > 0.5 ? '1 0 1 1 0' : '0 1 1 0 1', 6, 14 + i * 9);
    },
    6,
  );
  return (
    <>
      <StudioLights intensity={0.6} />
      <Ground size={14} />
      <Screen position={[0, 1.25, -1.2]} w={1.6} h={0.9} screen={tv} />
      <mesh position={[0, 0.25, -1.2]}>
        <boxGeometry args={[1.8, 0.5, 0.45]} />
        <meshStandardMaterial color="#1c1d24" roughness={0.6} />
      </mesh>
      {/* sofa */}
      <group position={[0, 0, 1.6]}>
        <mesh position={[0, 0.25, 0]}>
          <boxGeometry args={[2.2, 0.5, 0.9]} />
          <meshStandardMaterial color="#2b3350" roughness={0.9} />
        </mesh>
        <mesh position={[0, 0.65, 0.38]}>
          <boxGeometry args={[2.2, 0.7, 0.2]} />
          <meshStandardMaterial color="#2b3350" roughness={0.9} />
        </mesh>
      </group>
      <Person position={[0.3, 0.35, 1.5]} rotation={[0, Math.PI, 0]} seated />
      <Phone position={[0.38, 1.1, 1.05]} rotation={[0, Math.PI, 0]} screen={phone} />
      <Beam from={[0, 1.25, -1.15]} to={[0.4, 1.12, 1.06]} r0={0.75} r1={0.02} color="#6fe0ff" opacity={0.08} mod={0.8} stripes={14} speed={-2} />
      <Line points={[[0.4, 1.12, 1.05], [-0.8, 1.7, -1.17], [0.8, 1.7, -1.17], [0.4, 1.12, 1.05], [-0.8, 0.8, -1.17], [0.8, 0.8, -1.17], [0.4, 1.12, 1.05]]} color="#6fe0ff" transparent opacity={0.4} lineWidth={1} />
      <Label position={[0, 2, -1.2]}>Imperceptible data in the picture</Label>
      <Label position={[0.6, 1.4, 1.05]}>Camera decodes</Label>
    </>
  );
}

/* ------------------------------------------------------------------ */
function DisplayToDisplay() {
  const code = useCanvasTexture(64, 128, (g, t) => codeFrame(g, t, 64, 128, 8), 8);
  const view = useCanvasTexture(
    64,
    128,
    (g, t) => {
      codeFrame(g, t - 0.1, 64, 128, 8);
      g.fillStyle = 'rgba(5,8,16,0.55)';
      g.fillRect(0, 0, 64, 128);
      g.strokeStyle = '#5ee0a8';
      g.lineWidth = 2;
      g.strokeRect(6, 14, 52, 100);
      g.fillStyle = '#5ee0a8';
      g.fillRect(6, 118, 52 * ((t * 0.25) % 1), 4);
    },
    8,
  );
  return (
    <>
      <StudioLights intensity={0.8} />
      <mesh position={[0, -0.002, 0]} rotation-x={-Math.PI / 2}>
        <circleGeometry args={[1.2, 64]} />
        <meshStandardMaterial color="#1a1b21" roughness={0.4} metalness={0.3} />
      </mesh>
      <group position={[0, 0.14, -0.18]} rotation={[-0.25, 0, 0]}>
        <Phone screen={code} />
      </group>
      <group position={[0, 0.17, 0.2]} rotation={[0.2, Math.PI, 0]}>
        <Phone screen={view} />
      </group>
      <Beam from={[0, 0.14, -0.17]} to={[-0.02, 0.18, 0.19]} r0={0.05} r1={0.012} color="#ff86b0" opacity={0.12} mod={0.9} stripes={10} speed={2} />
      <Label position={[0, 0.27, -0.2]}>Colour barcode stream</Label>
      <Label position={[0, 0.3, 0.22]}>Camera view + decoder</Label>
    </>
  );
}

/* ------------------------------------------------------------------ */
function Retail() {
  const lights: V3[] = [];
  for (let x = -3; x <= 3; x += 2) for (let z = -3; z <= 3; z += 2) lights.push([x, 3.2, z]);
  const user: V3 = [0.9, 1.3, 0.4];
  const near = lights
    .map((l) => ({ l, d: Math.hypot(l[0] - user[0], l[2] - user[2]) }))
    .sort((a, b) => a.d - b.d)
    .slice(0, 3)
    .map((x) => x.l);
  const map = useCanvasTexture(
    64,
    128,
    (g, t) => {
      g.fillStyle = '#0b1220';
      g.fillRect(0, 0, 64, 128);
      g.fillStyle = '#26324d';
      for (let i = 0; i < 4; i++) g.fillRect(8 + i * 14, 20, 6, 90);
      g.fillStyle = '#5ee0a8';
      g.beginPath();
      g.arc(34 + Math.sin(t) * 2, 64, 4, 0, Math.PI * 2);
      g.fill();
    },
    8,
  );
  return (
    <>
      <StudioLights intensity={0.6} />
      <Ground size={24} />
      {[-2, 0, 2].map((x, i) => (
        <Shelf key={x} position={[x + 0.6, 0, 0]} rotation={[0, Math.PI / 2, 0]} w={6} seed={i + 2} />
      ))}
      {lights.map((p, i) => (
        <group key={i}>
          <Downlight position={p} />
          <Glow position={[p[0], p[1] - 0.06, p[2]]} size={0.7} color="#fff0d0" pulse={6 + i} />
        </group>
      ))}
      <Person position={[user[0], 0, user[2] + 0.2]} color="#3d6a7a" />
      <Phone position={user} rotation={[-Math.PI / 2 + 0.3, 0, 0]} screen={map} />
      {near.map((l, i) => (
        <Beam key={i} from={[l[0], l[1] - 0.05, l[2]]} to={user} r0={0.06} r1={0.02} color="#5ee0a8" opacity={0.35} mod={0.85} stripes={8} speed={1.5 + i} />
      ))}
      <Label position={[user[0], 2.2, user[2]]}>Phone sees 3 light IDs → position</Label>
    </>
  );
}

/* ------------------------------------------------------------------ */
function BuildingFso() {
  return (
    <>
      <StudioLights intensity={0.45} />
      <fog attach="fog" args={['#05060a', 80, 220]} />
      <Ground size={260} color="#0a0b10" grid={false} />
      <Building position={[-30, 0, 0]} w={14} h={36} d={14} seed={3} />
      <Building position={[32, 0, 6]} w={12} h={28} d={12} seed={7} />
      {[
        [-60, -30, 50, 4],
        [5, -40, 22, 9],
        [55, -35, 44, 11],
        [-10, 30, 18, 13],
        [-55, 25, 26, 17],
      ].map(([x, z, h, s], i) => (
        <Building key={i} position={[x, 0, z]} w={10} h={h} d={10} seed={s} />
      ))}
      <group position={[-25, 36.3, 3]}>
        <mesh>
          <boxGeometry args={[1.2, 0.8, 0.8]} />
          <meshStandardMaterial color="#e6e8ee" metalness={0.4} roughness={0.3} />
        </mesh>
      </group>
      <group position={[27, 28.3, 6]}>
        <mesh>
          <boxGeometry args={[1.2, 0.8, 0.8]} />
          <meshStandardMaterial color="#e6e8ee" metalness={0.4} roughness={0.3} />
        </mesh>
      </group>
      <Laser from={[-24.3, 36.4, 3]} to={[26.3, 28.4, 6]} color="#ff7a5c" width={0.18} opacity={0.85} stripes={50} />
      <Beam from={[-24.3, 36.4, 3]} to={[26.3, 28.4, 6]} r0={0.2} r1={1.4} color="#ff9a6b" opacity={0.06} mod={0} />
      <Particles count={700} box={[90, 30, 40]} center={[0, 30, 4]} color="#cfd8ff" size={0.25} drift={0.2} opacity={0.18} />
      <Label position={[0, 36, 4]}>~ 500 m laser link</Label>
    </>
  );
}

/* ------------------------------------------------------------------ */
function Cabin() {
  const rows = [0, 1, 2, 3, 4, 5];
  return (
    <>
      <StudioLights intensity={0.45} />
      <mesh position={[0, 1.1, 2]} rotation-z={Math.PI / 2}>
        <cylinderGeometry args={[1.9, 1.9, 9, 48, 1, true, 0, Math.PI]} />
        <meshStandardMaterial color="#d9dbe0" side={THREE.BackSide} roughness={0.7} />
      </mesh>
      <mesh position={[0, 0, 2]} rotation-x={-Math.PI / 2}>
        <planeGeometry args={[3.4, 9]} />
        <meshStandardMaterial color="#2c3248" roughness={0.9} />
      </mesh>
      {rows.map((r) => (
        <group key={r} position={[0, 0, r * 0.85]}>
          <SeatRow seats={2} position={[-0.75, 0, 0]} />
          <SeatRow seats={2} position={[0.75, 0, 0]} />
          {[-1, -0.5, 0.5, 1].map((x) => (
            <group key={x}>
              <Downlight position={[x, 2.15, -0.05]} scale={0.6} />
              <Beam from={[x, 2.12, -0.05]} to={[x, 0.95, 0.05]} r0={0.04} r1={0.22} color="#ffe6b0" opacity={0.18} mod={0.6} stripes={6} speed={1.5 + r * 0.2} />
            </group>
          ))}
        </group>
      ))}
      <Label position={[0.5, 2.4, 0]}>Each reading light = private AP</Label>
    </>
  );
}

/* ------------------------------------------------------------------ */
function Factory() {
  const agv = useRef<THREE.Group>(null);
  useFrame(({ clock }) => {
    const t = clock.getElapsedTime() * 0.4;
    if (agv.current) {
      agv.current.position.set(Math.cos(t) * 3, 0, Math.sin(t) * 2);
      agv.current.rotation.y = -t;
    }
  });
  const aps: V3[] = [
    [-2, 4, -1.5],
    [2, 4, -1.5],
    [0, 4, 2],
  ];
  return (
    <>
      <StudioLights intensity={0.55} />
      <Ground size={30} gridColor="#3a3420" />
      {aps.map((p, i) => (
        <group key={i}>
          <CeilingPanel position={p} size={0.5} color="#ffd9e0" />
          <Beam from={[p[0], p[1] - 0.05, p[2]]} to={[p[0], 0.05, p[2]]} r0={0.3} r1={2.1} color="#ff8fa3" opacity={0.08} mod={0.6} stripes={10} speed={2} />
        </group>
      ))}
      <RobotArm position={[-2, 0, -1.5]} />
      <RobotArm position={[2, 0, -1.5]} phase={1.7} color="#5aa0ff" />
      <Beam from={[-2, 3.95, -1.5]} to={[-1.4, 1.8, -1.5]} r0={0.05} r1={0.15} color="#ff6b8a" opacity={0.45} mod={0.8} stripes={8} />
      <group ref={agv}>
        <AGV />
      </group>
      <Label position={[0, 4.5, 2]}>IR optical AP</Label>
      <Label position={[-2, 2.8, -0.8]}>Robot control link</Label>
    </>
  );
}

/* ------------------------------------------------------------------ */
function DroneRelay() {
  const d = useRef<THREE.Group>(null);
  useFrame(({ clock }) => {
    const t = clock.getElapsedTime();
    if (d.current) d.current.position.set(Math.sin(t * 1.3) * 0.08, 5 + Math.sin(t * 1.9) * 0.1, Math.cos(t * 1.1) * 0.08);
  });
  return (
    <>
      <StudioLights intensity={0.45} />
      <fog attach="fog" args={['#07080c', 18, 60]} />
      <Ground size={60} color="#101114" />
      {[
        [-6, -4, 3],
        [-3, -6, 5],
        [4, -5, 2.5],
      ].map(([x, z, h], i) => (
        <mesh key={i} position={[x, h / 2, z]} rotation={[0.05 * i, 0.4 * i, 0.08 * (i - 1)]}>
          <boxGeometry args={[2.5, h, 2.5]} />
          <meshStandardMaterial color="#2a2b30" roughness={0.9} />
        </mesh>
      ))}
      <group ref={d} position={[0, 5, 0]}>
        <Drone scale={2.2} />
      </group>
      <group position={[7, 0, 4]}>
        <mesh position={[0, 0.8, 0]}>
          <boxGeometry args={[2.4, 1.4, 1.4]} />
          <meshStandardMaterial color="#c9ccd4" metalness={0.3} roughness={0.5} />
        </mesh>
        <mesh position={[0, 2.4, 0]}>
          <cylinderGeometry args={[0.06, 0.06, 2, 10]} />
          <meshStandardMaterial color="#888" />
        </mesh>
      </group>
      <Laser from={[7, 3.4, 4]} to={[0, 5, 0]} color="#ff6b8a" width={0.05} opacity={0.85} stripes={30} />
      <Laser from={[0, 5, 0]} to={[-14, 9, -12]} color="#ff6b8a" width={0.05} opacity={0.85} stripes={40} />
      <Beam from={[0, 4.8, 0]} to={[-2, 0.02, -3]} r0={0.1} r1={2.4} color="#e6f4ff" opacity={0.1} mod={0.5} />
      <Person position={[-2.2, 0, -3]} />
      <Label position={[0, 6.4, 0]}>Hovering relay</Label>
      <Label position={[7, 4.2, 4]}>Ground FSO node</Label>
    </>
  );
}

/* ------------------------------------------------------------------ */
function RetroTags() {
  const tag: V3 = [0.6, 0.78, 0.2];
  const lamp: V3 = [0, 2.9, 0];
  const shutter = useRef<THREE.MeshStandardMaterial>(null);
  useFrame(({ clock }) => {
    const bit = [1, 0, 1, 1, 0, 0, 1, 0][Math.floor(clock.getElapsedTime() * 3) % 8];
    if (shutter.current) shutter.current.opacity = bit ? 0.05 : 0.85;
  });
  return (
    <>
      <StudioLights intensity={0.6} />
      <Ground size={14} />
      <Desk position={[0.4, 0, 0.2]} w={1.4} d={0.8} />
      <CeilingPanel position={lamp} size={0.45} />
      <DetectorCan position={[0.32, 2.86, 0]} rotation={[Math.PI / 2, 0, 0]} scale={3} />
      <Beam from={[0, 2.85, 0]} to={tag} r0={0.2} r1={0.06} color="#ffe6b0" opacity={0.18} mod={0.2} />
      <Beam from={tag} to={[0.32, 2.82, 0]} r0={0.05} r1={0.09} color="#c39bff" opacity={0.4} mod={0.9} stripes={6} speed={1.5} />
      <group position={tag} rotation={[-Math.PI / 2 + 0.25, 0, 0.2]}>
        <RetroMesh size={0.1} />
        <mesh position={[0, 0, 0.012]}>
          <planeGeometry args={[0.1, 0.1]} />
          <meshStandardMaterial ref={shutter} color="#101018" transparent opacity={0.5} />
        </mesh>
        <SolarCell position={[0.11, 0, 0]} w={0.08} h={0.1} />
      </group>
      <Label position={[0.7, 1.05, 0.2]}>Retroreflector + LCD shutter</Label>
      <Label position={[0.4, 3.15, 0]}>PD next to the lamp</Label>
    </>
  );
}

export const SCENES: Record<string, ComponentType> = {
  office: Office,
  streets: Streets,
  isl: ISL,
  ground: GroundToSpace,
  underwater: Underwater,
  tv: TvPhone,
  display: DisplayToDisplay,
  retail: Retail,
  fso: BuildingFso,
  cabin: Cabin,
  factory: Factory,
  drone: DroneRelay,
  retro: RetroTags,
};

/** Re-exported so other pages can stream photons along a path without importing the kit directly. */
export { PhotonStream };
