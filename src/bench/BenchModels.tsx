import { useMemo } from 'react';
import * as THREE from 'three';
import { RoundedBox } from '@react-three/drei';
import type { BenchObject } from './types';
import { catalog } from './catalog';
import { MATERIALS, nmColor, SPECTRUM_BINS } from './optics';
import { CameraBody, CpcMesh, DetectorCan, EmitterBody, LensMesh, MirrorMesh, PlateMesh, PmtTube, PrismMesh, RetroMesh, RisPanel, SolarCell } from '@/three/kit/components';
import { ALU, Car, CeilingPanel, METAL, Person, Screen, useCanvasTexture } from '@/three/kit/models';

/**
 * 3D look of every bench object. The outer group sits at the object position; the inner group applies
 * yaw/pitch (Euler 'YXZ', x = −pitch) so each model's local +Z is its optical axis. Small parts are drawn
 * enlarged (`k`) so they stay visible in a room, and further by the scenario's visual scale.
 */
const D2R = Math.PI / 180;

function specColor(o: BenchObject) {
  const bins = SPECTRUM_BINS[(o.props.spectrum as string) ?? 'white'] ?? SPECTRUM_BINS.white;
  if (bins.length > 2) return '#fff1d6';
  return nmColor(bins[0].nm);
}

function ScreenModel({ w, h }: { w: number; h: number }) {
  const tex = useCanvasTexture(
    192,
    112,
    (g, t) => {
      const n = 12;
      const seed = Math.floor(t * 8);
      for (let y = 0; y < 7; y++)
        for (let x = 0; x < n; x++) {
          const v = Math.abs(Math.sin((x + 1) * 12.9898 + (y + 1) * 78.233 + seed * 3.7)) * 43758.5453;
          const f = v - Math.floor(v);
          g.fillStyle = ['#ff4d6d', '#ffd27a', '#5ee0a8', '#6fe0ff', '#c39bff', '#f4f4f6', '#111', '#3d55e0'][Math.floor(f * 8)];
          g.fillRect(x * 16, y * 16, 15, 15);
        }
    },
    8,
  );
  return <Screen w={w} h={h} screen={tex} stand={false} />;
}

/** The model in local coordinates (+Z = facing). */
function Model({ o, k }: { o: BenchObject; k: number }) {
  const p = o.props;
  const size = (p.size as number) ?? 0.1;
  switch (o.kind) {
    case 'panel':
      return (
        <group rotation-x={-Math.PI / 2}>
          <CeilingPanel size={(p.size as number) ?? 0.6} color={specColor(o)} />
        </group>
      );
    case 'led':
    case 'rgbled':
    case 'microled':
    case 'irled':
    case 'uvled':
      return <EmitterBody scale={4 * k} color={specColor(o)} kind="led" />;
    case 'laser':
    case 'vcsel':
      return <EmitterBody scale={4 * k} color={specColor(o)} kind="laser" />;
    case 'streetlamp':
      return (
        <group>
          <RoundedBox args={[0.6 * k, 0.3 * k, 0.14 * k]} radius={0.03 * k} position={[0, 0, -0.08 * k]}>
            <meshStandardMaterial {...METAL} />
          </RoundedBox>
          <mesh position={[0, 0, 0.001]}>
            <planeGeometry args={[0.52 * k, 0.24 * k]} />
            <meshStandardMaterial color={specColor(o)} emissive={specColor(o)} emissiveIntensity={4} toneMapped={false} />
          </mesh>
        </group>
      );
    case 'headlight':
      return (
        <group>
          <mesh position={[0, 0, -0.05 * k]}>
            <boxGeometry args={[0.3 * k, 0.14 * k, 0.1 * k]} />
            <meshStandardMaterial {...METAL} />
          </mesh>
          <mesh position={[0, 0, 0.001]}>
            <planeGeometry args={[0.26 * k, 0.1 * k]} />
            <meshStandardMaterial color={specColor(o)} emissive={specColor(o)} emissiveIntensity={4} toneMapped={false} />
          </mesh>
        </group>
      );
    case 'screen': {
      const w = (p.w as number) ?? 0.6;
      return <ScreenModel w={w} h={w * 0.58} />;
    }
    case 'pin':
    case 'apd':
    case 'ingaas':
    case 'spad':
    case 'sipm': {
      const tone = { pin: '#3d55e0', apd: '#7a4fe0', ingaas: '#a0522d', spad: '#0a8f6a', sipm: '#0a8f6a' }[o.kind];
      const conc = p.concentrator as string;
      return (
        <group>
          <DetectorCan scale={5 * k} tone={tone} big={o.kind === 'sipm'} />
          {conc === 'cpc' && <CpcMesh radius={0.06 * k} length={0.12 * k} position={[0, 0, 0.005 * k]} />}
          {conc === 'lens' && <LensMesh radius={0.05 * k} position={[0, 0, 0.09 * k]} />}
          {conc === 'hemi' && (
            <mesh>
              <sphereGeometry args={[0.07 * k, 32, 16, 0, Math.PI * 2, 0, Math.PI / 2]} />
              <meshPhysicalMaterial color="#d6ecff" transparent opacity={0.35} roughness={0.02} clearcoat={1} />
            </mesh>
          )}
          {p.filter && p.filter !== 'none' && (
            <mesh position={[0, 0, 0.02 * k]}>
              <circleGeometry args={[0.05 * k, 32]} />
              <meshPhysicalMaterial color={{ blue: '#4a7dff', green: '#3ad17a', red: '#ff4a5a', ir: '#5a1020', nir: '#401020' }[p.filter as string] ?? '#888'} transparent opacity={0.5} side={THREE.DoubleSide} />
            </mesh>
          )}
        </group>
      );
    }
    case 'pmt':
      return <PmtTube scale={3 * k} />;
    case 'camera':
      return <CameraBody scale={2.5 * k} />;
    case 'solar': {
      const a = Math.sqrt(((p.area as number) ?? 1600) * 1e-6);
      return <SolarCell w={a * 1.2} h={a / 1.2} />;
    }
    case 'mirror':
      return <MirrorMesh radius={size / 2} square />;
    case 'concave':
      return <MirrorMesh radius={size / 2} curvature={1 / (2 * ((p.focal as number) ?? 0.5))} />;
    case 'convex':
      return <MirrorMesh radius={size / 2} curvature={-1 / (2 * ((p.focal as number) ?? 0.5))} />;
    case 'retro':
      return <RetroMesh size={size} />;
    case 'prism':
      return <PrismMesh size={size} height={size} />;
    case 'lens':
    case 'fresnel':
      return <LensMesh radius={size / 2} />;
    case 'lensNeg':
      return <LensMesh radius={size / 2} kind="concave" />;
    case 'diffuser':
      return <PlateMesh size={size} kind="diffuser" />;
    case 'polarizer':
      return (
        <group rotation-z={(((p.angle as number) ?? 0) * Math.PI) / 180}>
          <PlateMesh size={size} kind="polarizer" />
        </group>
      );
    case 'filter': {
      const c = nmColor((p.center as number) ?? 450);
      return <PlateMesh size={size} kind="filter" color={c} />;
    }
    case 'splitter':
      return (
        <mesh>
          <boxGeometry args={[size, size, size * 0.06]} />
          <meshPhysicalMaterial color="#cfe4ff" metalness={0.6} roughness={0.08} transparent opacity={0.45} />
        </mesh>
      );
    case 'ris':
      return <RisPanel w={size} h={size} n={8} />;
    default:
      return null;
  }
}

/** Environment objects: positioned at the floor, rotate in yaw only. */
function EnvModel({ o }: { o: BenchObject }) {
  const p = o.props;
  switch (o.kind) {
    case 'wall': {
      const m = MATERIALS[(p.material as string) ?? 'plaster'] ?? MATERIALS.plaster;
      const w = (p.w as number) ?? 2;
      const h = (p.h as number) ?? 2.4;
      return (
        <mesh position={[0, h / 2, 0]}>
          <boxGeometry args={[w, h, 0.06]} />
          <meshStandardMaterial color={new THREE.Color(m.color).multiplyScalar(0.55)} roughness={m.rs > 0.3 ? 0.2 : 0.85} metalness={o.props.material === 'metal' ? 0.8 : 0} transparent opacity={0.72} />
        </mesh>
      );
    }
    case 'box': {
      const m = MATERIALS[(p.material as string) ?? 'wood'] ?? MATERIALS.wood;
      const w = (p.w as number) ?? 1;
      const h = (p.h as number) ?? 0.75;
      const d = (p.d as number) ?? 0.6;
      return (
        <RoundedBox args={[w, h, d]} radius={Math.min(0.02, h / 4)} position={[0, h / 2, 0]}>
          <meshStandardMaterial color={m.color} roughness={m.rs > 0.3 ? 0.25 : 0.8} />
        </RoundedBox>
      );
    }
    case 'person':
      return <Person height={(p.height as number) ?? 1.75} />;
    case 'car':
      return <Car />;
    default:
      return null;
  }
}

export function BenchObjectModel({ o, selected, hovered, k }: { o: BenchObject; selected: boolean; hovered: boolean; k: number }) {
  const cat = catalog(o.kind);
  const env = cat.category === 'environment';
  const pole = cat.mount === 'pole';
  const halo = useMemo(() => (cat.category === 'source' ? '#ffd27a' : cat.category === 'receiver' ? '#5ee0a8' : cat.category === 'optic' ? '#8fd3ff' : '#c39bff'), [cat.category]);
  return (
    <group>
      {pole && (
        <mesh position={[0, -o.pos[1] / 2, 0]}>
          <cylinderGeometry args={[0.06 * k, 0.09 * k, o.pos[1], 12]} />
          <meshStandardMaterial {...ALU} color="#3a3d46" />
        </mesh>
      )}
      {env ? (
        <group rotation-y={o.yaw * D2R}>
          <EnvModel o={o} />
        </group>
      ) : (
        <group rotation={[-o.pitch * D2R, o.yaw * D2R, 0, 'YXZ']}>
          <Model o={o} k={k} />
          {(selected || hovered) && (
            <mesh position={[0, 0, 0.18 * k * (cat.category === 'optic' ? 0.6 : 1)]} rotation-x={Math.PI / 2}>
              <coneGeometry args={[0.03 * k, 0.09 * k, 16]} />
              <meshBasicMaterial color={halo} toneMapped={false} />
            </mesh>
          )}
        </group>
      )}
      {(selected || hovered) && (
        <mesh rotation-x={-Math.PI / 2} position={[0, env ? 0.01 : 0, 0]}>
          <ringGeometry args={[env ? 0.6 : 0.16 * k, env ? 0.64 : 0.175 * k, 48]} />
          <meshBasicMaterial color={halo} transparent opacity={selected ? 0.95 : 0.5} toneMapped={false} side={THREE.DoubleSide} depthTest={false} />
        </mesh>
      )}
    </group>
  );
}
