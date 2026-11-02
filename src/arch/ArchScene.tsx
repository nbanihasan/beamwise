import { useEffect, useMemo, useRef, useState } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import { Html, RoundedBox } from '@react-three/drei';
import * as THREE from 'three';
import { BLOCKS, type Block } from './blocks';
import { Beam, Glow, Laser, PhotonStream } from '@/three/kit/beam';
import { Ground, StudioLights } from '@/three/kit/env';
import { Laptop, METAL } from '@/three/kit/models';
import { Chip, DetectorCan, EmitterBody, LensMesh, PlateMesh } from '@/three/kit/components';

/**
 * The end-to-end system as a 3D object: transmitter row in front, the room channel in the middle, the
 * receiver chain returning along the back row. Click a block to fly to it.
 */
const DOMAIN_COLOR = { digital: '#8fa6ff', analog: '#5ee0a8', optical: '#ffd27a' } as const;
type V3 = [number, number, number];

function aim(from: V3, to: V3): THREE.Euler {
  const d = new THREE.Vector3(to[0] - from[0], to[1] - from[1], to[2] - from[2]).normalize();
  const q = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 0, 1), d);
  return new THREE.Euler().setFromQuaternion(q);
}

const LED_POS: V3 = [2.4, 3.2, -2.6];
const RXO_POS: V3 = [4.4, 0.9, 2.6];

function BlockModel({ b, active, hover }: { b: Block; active: boolean; hover: boolean }) {
  const color = DOMAIN_COLOR[b.domain];
  const lift = active ? 0.12 : hover ? 0.06 : 0;
  switch (b.model) {
    case 'server':
      return (
        <group position={[0, lift, 0]}>
          {[0, 1, 2].map((i) => (
            <group key={i} position={[0, 0.16 + i * 0.27, 0]}>
              <RoundedBox args={[1.2, 0.22, 0.9]} radius={0.04}>
                <meshStandardMaterial color="#16171d" metalness={0.5} roughness={0.35} />
              </RoundedBox>
              {[0, 1, 2, 3].map((k) => (
                <mesh key={k} position={[-0.45 + k * 0.08, 0, 0.451]}>
                  <circleGeometry args={[0.018, 12]} />
                  <meshStandardMaterial color={color} emissive={color} emissiveIntensity={2 + ((i + k) % 2) * 2} toneMapped={false} />
                </mesh>
              ))}
            </group>
          ))}
        </group>
      );
    case 'tile':
      return (
        <group position={[0, lift, 0]}>
          <RoundedBox args={[1.4, 0.16, 1.05]} radius={0.06} position={[0, 0.08, 0]}>
            <meshPhysicalMaterial color="#1a1c26" metalness={0.2} roughness={0.15} clearcoat={1} transparent opacity={0.92} />
          </RoundedBox>
          <mesh position={[0, 0.162, 0]} rotation-x={-Math.PI / 2}>
            <planeGeometry args={[1.15, 0.8]} />
            <meshStandardMaterial color={color} emissive={color} emissiveIntensity={active ? 0.7 : 0.18} transparent opacity={active ? 0.3 : 0.12} toneMapped={false} />
          </mesh>
          <mesh position={[0, 0.17, 0]} rotation-x={-Math.PI / 2}>
            <ringGeometry args={[0.18, 0.22, 40]} />
            <meshStandardMaterial color={color} emissive={color} emissiveIntensity={2.5} toneMapped={false} />
          </mesh>
        </group>
      );
    case 'chip':
      return (
        <group position={[0, lift, 0]}>
          <Chip w={1.0} d={0.85} glow={color} pins={6} />
        </group>
      );
    case 'led':
      return (
        <group>
          <mesh position={[0, -1.55, 0]}>
            <cylinderGeometry args={[0.04, 0.04, 3.1, 12]} />
            <meshStandardMaterial {...METAL} />
          </mesh>
          <group rotation={aim(LED_POS, RXO_POS)}>
            <EmitterBody scale={9} on={1} />
          </group>
        </group>
      );
    case 'optics':
      return (
        <group rotation={aim(RXO_POS, LED_POS)}>
          <LensMesh radius={0.28} position={[0, 0, 0.2]} />
          <PlateMesh kind="filter" size={0.5} color="#5a8cff" position={[0, 0, 0]} />
        </group>
      );
    case 'pd':
      return (
        <group position={[0, 0.25 + lift, 0]} rotation={[-Math.PI / 2 + 0.2, 0, 0]}>
          <DetectorCan scale={11} tone="#3d55e0" lit={0.4} />
        </group>
      );
    case 'laptop':
      return (
        <group position={[0, lift, 0]} rotation={[0, Math.PI, 0]}>
          <Laptop scale={3} />
        </group>
      );
    case 'channel':
      return (
        <mesh position={[0, -1.55, 0]} rotation-x={-Math.PI / 2}>
          <ringGeometry args={[0.5, 0.56, 48]} />
          <meshStandardMaterial color={color} emissive={color} emissiveIntensity={active ? 3 : 1} toneMapped={false} transparent opacity={0.8} />
        </mesh>
      );
  }
}

function CameraRig({ selected }: { selected: string | null }) {
  const { camera, controls } = useThree() as unknown as { camera: THREE.PerspectiveCamera; controls: { target: THREE.Vector3; update: () => void } | null };
  const goal = useRef<{ pos: THREE.Vector3; tgt: THREE.Vector3; t: number } | null>(null);
  useEffect(() => {
    const b = BLOCKS.find((x) => x.id === selected);
    const tgt = b ? new THREE.Vector3(...b.pos) : new THREE.Vector3(-2.2, 0.2, 2.2);
    const pos = b ? tgt.clone().add(b.pos[2] < 0 ? new THREE.Vector3(0.8, 4.6, 4.4) : new THREE.Vector3(0.8, 3.2, 5.2)) : new THREE.Vector3(-2.2, 7.4, 16.5);
    if (b?.id === 'channel') pos.set(-1.5, 5.5, 8);
    goal.current = { pos, tgt, t: 0 };
  }, [selected]);
  useFrame((_, dt) => {
    const g = goal.current;
    if (!g || !controls) return;
    g.t += dt;
    const k = 1 - Math.exp(-dt * 3.2);
    camera.position.lerp(g.pos, k);
    controls.target.lerp(g.tgt, k);
    controls.update();
    if (g.t > 1.8) goal.current = null;
  });
  return null;
}

export function ArchScene({ selected, onSelect, showLabels }: { selected: string | null; onSelect: (id: string) => void; showLabels: boolean }) {
  const [hover, setHover] = useState<string | null>(null);
  const tx = BLOCKS.filter((b) => b.side === 'tx' && b.id !== 'led').map((b) => [b.pos[0], 0.12, b.pos[2]] as V3);
  const txBus: V3[] = [...tx, [LED_POS[0], 0.12, LED_POS[2]], [LED_POS[0], LED_POS[1] - 0.3, LED_POS[2]]];
  const rxBlocks = BLOCKS.filter((b) => b.side === 'rx' && b.id !== 'rxoptics');
  const rxBus: V3[] = [RXO_POS, [RXO_POS[0], 0.12, RXO_POS[2]], ...rxBlocks.map((b) => [b.pos[0], 0.12, b.pos[2]] as V3)];
  const wallPt: V3 = [6.3, 2.4, -0.2];
  const sun: V3 = [8, 4.4, 0.6];
  useEffect(() => {
    document.body.style.cursor = hover ? 'pointer' : '';
    return () => {
      document.body.style.cursor = '';
    };
  }, [hover]);
  const reduced = useMemo(() => typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches, []);

  return (
    <>
      <StudioLights intensity={0.6} />
      <Ground size={60} color="#08090d" gridColor="#1c1f2a" />
      <CameraRig selected={selected} />

      {/* TX / RX platforms */}
      <RoundedBox args={[15, 0.06, 1.8]} radius={0.03} position={[-4.2, -0.03, -2.6]}>
        <meshStandardMaterial color="#0f1016" metalness={0.3} roughness={0.5} />
      </RoundedBox>
      <RoundedBox args={[17.6, 0.06, 1.8]} radius={0.03} position={[-3.5, -0.03, 2.6]}>
        <meshStandardMaterial color="#0f1016" metalness={0.3} roughness={0.5} />
      </RoundedBox>

      {/* channel: side wall, window and a flickering lamp */}
      <mesh position={[6.5, 2.2, 0]} rotation-y={-Math.PI / 2}>
        <planeGeometry args={[7.6, 4.4]} />
        <meshStandardMaterial color="#1b1d26" roughness={0.95} />
      </mesh>
      <mesh position={[6.48, 3.3, 1.2]} rotation-y={-Math.PI / 2}>
        <planeGeometry args={[1.6, 1.6]} />
        <meshStandardMaterial color="#ffe6a8" emissive="#ffe6a8" emissiveIntensity={1.6} toneMapped={false} />
      </mesh>
      <Glow position={sun} color="#ffd27a" size={4} opacity={0.6} />
      <Glow position={[6.3, 3.9, -2]} color="#cfe2ff" size={1.2} pulse={14} />

      {/* light: LOS + one diffuse bounce + ambient */}
      <Beam from={LED_POS} to={RXO_POS} r0={0.12} r1={0.6} color="#ffe2a0" opacity={0.32} mod={reduced ? 0 : 0.75} stripes={10} speed={2} />
      <Beam from={LED_POS} to={wallPt} r0={0.1} r1={0.35} color="#ffe2a0" opacity={0.08} mod={0.5} />
      <Beam from={wallPt} to={RXO_POS} r0={0.3} r1={0.5} color="#ffe2a0" opacity={0.06} mod={0.4} />
      <Beam from={[6.4, 3.3, 1.2]} to={RXO_POS} r0={0.6} r1={0.4} color="#ffcf6b" opacity={0.05} mod={0} />

      {/* data in motion */}
      {!reduced && (
        <>
          <PhotonStream path={txBus} color="#8fa6ff" count={140} speed={3.4} size={0.05} spread={0.03} rate={18} />
          <PhotonStream path={[LED_POS, RXO_POS]} color="#ffe2a0" count={100} speed={4} size={0.05} spread={0.12} rate={22} />
          <PhotonStream path={rxBus} color="#5ee0a8" count={160} speed={3.4} size={0.05} spread={0.03} rate={18} />
        </>
      )}
      {/* IR uplink back to the luminaire */}
      <Laser from={[-11.8, 0.7, 2.6]} to={[LED_POS[0] - 0.2, LED_POS[1] - 0.1, LED_POS[2]]} color="#ff5a7a" width={0.02} opacity={0.6} stripes={20} />

      {BLOCKS.map((b) => {
        const active = selected === b.id;
        return (
          <group
            key={b.id}
            position={b.pos}
            onClick={(e) => {
              e.stopPropagation();
              onSelect(b.id);
            }}
            onPointerOver={(e) => {
              e.stopPropagation();
              setHover(b.id);
            }}
            onPointerOut={() => setHover((h) => (h === b.id ? null : h))}
          >
            <BlockModel b={b} active={active} hover={hover === b.id} />
            {/* generous invisible hit target */}
            <mesh visible={false} position={[0, b.model === 'led' ? 0 : 0.4, 0]}>
              <boxGeometry args={[1.5, b.model === 'led' ? 1.2 : 1, 1.2]} />
              <meshBasicMaterial />
            </mesh>
            {active && b.model !== 'channel' && (
              <mesh position={[0, b.model === 'led' || b.model === 'optics' ? -b.pos[1] + 0.01 : 0.01, 0]} rotation-x={-Math.PI / 2}>
                <ringGeometry args={[0.86, 0.9, 64]} />
                <meshBasicMaterial color={DOMAIN_COLOR[b.domain]} toneMapped={false} />
              </mesh>
            )}
            {(
              <Html position={[0, b.model === 'led' ? 0.7 : b.model === 'channel' ? 0.2 : 1.05, 0]} center zIndexRange={[20, 0]}>
                <button type="button" className={`arch-label ${active ? 'on' : ''} ${showLabels || active || hover === b.id ? '' : 'compact'}`} style={{ ['--d' as string]: DOMAIN_COLOR[b.domain] }} onClick={() => onSelect(b.id)}>
                  <span className="mono">{String(b.n).padStart(2, '0')}</span>
                  <em>{b.name}</em>
                </button>
              </Html>
            )}
          </group>
        );
      })}
    </>
  );
}
