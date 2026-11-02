import { useMemo, useRef, type ReactNode } from 'react';
import { useFrame } from '@react-three/fiber';
import { Environment, Lightformer } from '@react-three/drei';
import * as THREE from 'three';

/**
 * Shared lighting and environments. The studio environment is generated locally from Lightformers
 * (no HDR download), so reflections on metal and glass work offline and inside a single-file build.
 */
export function StudioLights({ intensity = 1, env = true, warm = false }: { intensity?: number; env?: boolean; warm?: boolean }) {
  return (
    <>
      <ambientLight intensity={0.25 * intensity} />
      <hemisphereLight args={['#c9d4ff', '#0b0b12', 0.55 * intensity]} />
      <directionalLight position={[6, 10, 4]} intensity={1.3 * intensity} color={warm ? '#ffe6c4' : '#ffffff'} />
      <directionalLight position={[-6, 4, -6]} intensity={0.45 * intensity} color="#9fb4ff" />
      {env && (
        <Environment resolution={128} frames={1}>
          <Lightformer form="rect" intensity={2.2} position={[0, 6, 0]} rotation-x={Math.PI / 2} scale={[10, 10, 1]} />
          <Lightformer form="rect" intensity={1.2} color="#9fb4ff" position={[-6, 2, 0]} rotation-y={Math.PI / 2} scale={[8, 3, 1]} />
          <Lightformer form="rect" intensity={1.2} color="#ffd9a0" position={[6, 2, 0]} rotation-y={-Math.PI / 2} scale={[8, 3, 1]} />
          <Lightformer form="ring" intensity={1.5} position={[0, 3, 6]} scale={3} />
        </Environment>
      )}
    </>
  );
}

/** Infinite-looking floor: soft radial fade and a fine grid. */
export function Ground({ size = 40, y = 0, color = '#0c0d12', grid = true, gridColor = '#2a2d3a', fade = true }: { size?: number; y?: number; color?: string; grid?: boolean; gridColor?: string; fade?: boolean }) {
  const tex = useMemo(() => {
    const c = document.createElement('canvas');
    c.width = c.height = 256;
    const g = c.getContext('2d')!;
    const grd = g.createRadialGradient(128, 128, 0, 128, 128, 128);
    grd.addColorStop(0, 'rgba(255,255,255,1)');
    grd.addColorStop(0.55, 'rgba(255,255,255,0.7)');
    grd.addColorStop(1, 'rgba(255,255,255,0)');
    g.fillStyle = grd;
    g.fillRect(0, 0, 256, 256);
    const t = new THREE.CanvasTexture(c);
    return t;
  }, []);
  return (
    <group position={[0, y, 0]}>
      <mesh rotation-x={-Math.PI / 2} receiveShadow>
        <planeGeometry args={[size, size]} />
        <meshStandardMaterial color={color} roughness={0.85} metalness={0.1} transparent={fade} alphaMap={fade ? tex : undefined} />
      </mesh>
      {grid && <gridHelper args={[size * 0.7, Math.round(size * 0.7), gridColor, gridColor]} position={[0, 0.002, 0]} material-transparent material-opacity={0.35} />}
    </group>
  );
}

/** Points drifting slowly in a box: dust, marine snow, fog droplets, stars. */
export function Particles({
  count = 600,
  box = [10, 4, 10],
  center = [0, 2, 0],
  color = '#9fc8ff',
  size = 0.03,
  drift = 0.05,
  opacity = 0.6,
}: {
  count?: number;
  box?: [number, number, number];
  center?: THREE.Vector3Tuple;
  color?: THREE.ColorRepresentation;
  size?: number;
  drift?: number;
  opacity?: number;
}) {
  const ref = useRef<THREE.Points>(null);
  const geo = useMemo(() => {
    const g = new THREE.BufferGeometry();
    const p = new Float32Array(count * 3);
    for (let i = 0; i < count; i++) {
      p[i * 3] = (Math.random() - 0.5) * box[0];
      p[i * 3 + 1] = (Math.random() - 0.5) * box[1];
      p[i * 3 + 2] = (Math.random() - 0.5) * box[2];
    }
    g.setAttribute('position', new THREE.BufferAttribute(p, 3));
    return g;
  }, [count, box[0], box[1], box[2]]); // eslint-disable-line react-hooks/exhaustive-deps
  useFrame((_, dt) => {
    if (!drift || !ref.current) return;
    const a = geo.attributes.position as THREE.BufferAttribute;
    const arr = a.array as Float32Array;
    for (let i = 0; i < count; i++) {
      arr[i * 3 + 1] -= dt * drift * (0.5 + (i % 7) / 7);
      arr[i * 3] += Math.sin(i + arr[i * 3 + 1] * 2) * dt * drift * 0.3;
      if (arr[i * 3 + 1] < -box[1] / 2) arr[i * 3 + 1] = box[1] / 2;
    }
    a.needsUpdate = true;
  });
  return (
    <points ref={ref} geometry={geo} position={center}>
      <pointsMaterial color={color} size={size} sizeAttenuation transparent opacity={opacity} depthWrite={false} blending={THREE.AdditiveBlending} />
    </points>
  );
}

/** A starfield shell for space scenes. */
export function Starfield({ count = 1500, radius = 120 }: { count?: number; radius?: number }) {
  const geo = useMemo(() => {
    const g = new THREE.BufferGeometry();
    const p = new Float32Array(count * 3);
    for (let i = 0; i < count; i++) {
      const u = Math.random() * 2 - 1;
      const a = Math.random() * Math.PI * 2;
      const r = radius * (0.8 + Math.random() * 0.2);
      const s = Math.sqrt(1 - u * u);
      p[i * 3] = r * s * Math.cos(a);
      p[i * 3 + 1] = r * u;
      p[i * 3 + 2] = r * s * Math.sin(a);
    }
    g.setAttribute('position', new THREE.BufferAttribute(p, 3));
    return g;
  }, [count, radius]);
  return (
    <points geometry={geo}>
      <pointsMaterial color="#dfe6ff" size={0.35} sizeAttenuation transparent opacity={0.8} depthWrite={false} />
    </points>
  );
}

/** Slowly rotating group (turntables, orbits). */
export function Spin({ speed = 0.2, axis = 'y', children }: { speed?: number; axis?: 'x' | 'y' | 'z'; children: ReactNode }) {
  const g = useRef<THREE.Group>(null);
  useFrame((_, dt) => {
    if (g.current) g.current.rotation[axis] += dt * speed;
  });
  return <group ref={g}>{children}</group>;
}

/** Translucent water volume with a moving surface. */
export function WaterVolume({ size = [16, 6, 10], color = '#0a4a6a', opacity = 0.18, surface = true }: { size?: [number, number, number]; color?: string; opacity?: number; surface?: boolean }) {
  const surf = useRef<THREE.Mesh>(null);
  const geo = useMemo(() => new THREE.PlaneGeometry(size[0], size[2], 48, 32), [size[0], size[2]]); // eslint-disable-line react-hooks/exhaustive-deps
  const base = useMemo(() => Float32Array.from(geo.attributes.position.array as Float32Array), [geo]);
  useFrame(({ clock }) => {
    if (!surface) return;
    const t = clock.getElapsedTime();
    const a = geo.attributes.position as THREE.BufferAttribute;
    const arr = a.array as Float32Array;
    for (let i = 0; i < arr.length; i += 3) {
      const x = base[i];
      const y = base[i + 1];
      arr[i + 2] = Math.sin(x * 0.9 + t * 0.9) * 0.06 + Math.cos(y * 1.3 + t * 0.7) * 0.05;
    }
    a.needsUpdate = true;
    geo.computeVertexNormals();
  });
  return (
    <group>
      <mesh position={[0, size[1] / 2, 0]}>
        <boxGeometry args={size} />
        <meshStandardMaterial color={color} transparent opacity={opacity} depthWrite={false} side={THREE.BackSide} />
      </mesh>
      {surface && (
        <mesh ref={surf} geometry={geo} rotation-x={-Math.PI / 2} position={[0, size[1], 0]}>
          <meshStandardMaterial color="#6fc3ff" transparent opacity={0.35} metalness={0.3} roughness={0.15} side={THREE.DoubleSide} />
        </mesh>
      )}
    </group>
  );
}
