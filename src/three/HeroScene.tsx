import { useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { Html } from '@react-three/drei';

/**
 * Landing scene: a ceiling luminaire sends an on-off-keyed photon stream across the room to a photodiode.
 * Photons are blue (pump) or yellow (phosphor), like a real white LED; the detector flashes as they land.
 */
const BITS = [1, 0, 1, 1, 0, 0, 1, 0, 1, 1, 1, 0, 1, 0, 0, 1];
const SLOT = 0.22; // seconds per bit
const COUNT = 900;

export function HeroScene() {
  const tx = useMemo(() => new THREE.Vector3(-2.7, 2.2, 0), []);
  const rx = useMemo(() => new THREE.Vector3(2.7, -1.6, 0.2), []);
  const dir = useMemo(() => rx.clone().sub(tx).normalize(), [tx, rx]);
  const dist = tx.distanceTo(rx);
  const mesh = useRef<THREE.InstancedMesh>(null);
  const pd = useRef<THREE.MeshStandardMaterial>(null);
  const led = useRef<THREE.MeshStandardMaterial>(null);
  const hit = useRef(0);

  const state = useMemo(() => {
    const born = new Float32Array(COUNT).fill(-99);
    const offs = new Float32Array(COUNT * 2);
    for (let i = 0; i < COUNT; i++) {
      const r = Math.sqrt(Math.random()) * 0.32;
      const a = Math.random() * Math.PI * 2;
      offs[i * 2] = r * Math.cos(a);
      offs[i * 2 + 1] = r * Math.sin(a);
    }
    return { born, offs, next: 0, acc: 0 };
  }, []);

  const colors = useMemo(() => {
    const blue = new THREE.Color('#6f8dff').multiplyScalar(2.2);
    const yellow = new THREE.Color('#ffcf6b').multiplyScalar(2.0);
    const arr = new Float32Array(COUNT * 3);
    for (let i = 0; i < COUNT; i++) (Math.random() < 0.35 ? blue : yellow).toArray(arr, i * 3);
    return arr;
  }, []);

  // orthonormal basis around the beam direction
  const basis = useMemo(() => {
    const up = Math.abs(dir.y) > 0.9 ? new THREE.Vector3(1, 0, 0) : new THREE.Vector3(0, 1, 0);
    const u = new THREE.Vector3().crossVectors(dir, up).normalize();
    const v = new THREE.Vector3().crossVectors(dir, u).normalize();
    return { u, v };
  }, [dir]);

  const dummy = useMemo(() => new THREE.Object3D(), []);
  const speed = 4.2;

  useFrame(({ clock }, dt) => {
    const t = clock.getElapsedTime();
    const bit = BITS[Math.floor(t / SLOT) % BITS.length];
    if (led.current) led.current.emissiveIntensity = THREE.MathUtils.lerp(led.current.emissiveIntensity, bit ? 6 : 0.6, 0.35);
    // emit
    if (bit) {
      state.acc += dt * 260;
      while (state.acc > 1) {
        state.born[state.next] = t;
        state.next = (state.next + 1) % COUNT;
        state.acc -= 1;
      }
    }
    const m = mesh.current;
    if (!m) return;
    let arrivals = 0;
    for (let i = 0; i < COUNT; i++) {
      const age = t - state.born[i];
      const s = age * speed;
      if (age < 0 || s > dist) {
        if (s > dist && s < dist + speed * dt * 1.5) arrivals++;
        dummy.position.set(0, -999, 0);
        dummy.scale.setScalar(0.0001);
      } else {
        const spread = (s / dist) * 1.0;
        dummy.position
          .copy(tx)
          .addScaledVector(dir, s)
          .addScaledVector(basis.u, state.offs[i * 2] * spread)
          .addScaledVector(basis.v, state.offs[i * 2 + 1] * spread);
        dummy.scale.setScalar(0.035);
      }
      dummy.updateMatrix();
      m.setMatrixAt(i, dummy.matrix);
    }
    m.instanceMatrix.needsUpdate = true;
    hit.current = THREE.MathUtils.lerp(hit.current, Math.min(1, arrivals / 3), 0.25);
    if (pd.current) pd.current.emissiveIntensity = 0.3 + hit.current * 5;
  });

  const beam = useMemo(() => {
    const len = dist;
    const geo = new THREE.ConeGeometry(1.0, len, 48, 1, true);
    geo.translate(0, -len / 2, 0);
    const q = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, -1, 0), dir);
    return { geo, q };
  }, [dir, dist]);

  return (
    <>
      <ambientLight intensity={0.25} />
      <pointLight position={tx.toArray()} intensity={18} color="#dfe6ff" distance={14} />
      <directionalLight position={[4, 6, 5]} intensity={0.6} />

      {/* luminaire */}
      <group position={tx.toArray()} quaternion={beam.q}>
        <mesh rotation={[0, 0, 0]}>
          <cylinderGeometry args={[0.55, 0.62, 0.16, 48]} />
          <meshStandardMaterial color="#2a2f3d" metalness={0.7} roughness={0.35} />
        </mesh>
        <mesh position={[0, -0.085, 0]} rotation={[Math.PI / 2, 0, 0]}>
          <circleGeometry args={[0.48, 48]} />
          <meshStandardMaterial ref={led} color="#ffffff" emissive="#fff3d6" emissiveIntensity={4} toneMapped={false} />
        </mesh>
      </group>

      {/* beam volume */}
      <mesh geometry={beam.geo} position={tx.toArray()} quaternion={beam.q}>
        <meshBasicMaterial color="#9fb4ff" transparent opacity={0.028} depthWrite={false} blending={THREE.AdditiveBlending} side={THREE.DoubleSide} />
      </mesh>

      {/* photons */}
      <instancedMesh ref={mesh} args={[undefined, undefined, COUNT]} frustumCulled={false}>
        <sphereGeometry args={[1, 8, 8]}>
          <instancedBufferAttribute attach="attributes-color" args={[colors, 3]} />
        </sphereGeometry>
        <meshBasicMaterial vertexColors toneMapped={false} />
      </instancedMesh>

      {/* photodiode */}
      <group position={rx.toArray()} rotation={[0, 0, Math.atan2(dir.x, -dir.y)]}>
        <mesh>
          <boxGeometry args={[0.9, 0.18, 0.9]} />
          <meshStandardMaterial color="#1b1f2a" metalness={0.5} roughness={0.4} />
        </mesh>
        <mesh position={[0, 0.095, 0]} rotation={[-Math.PI / 2, 0, 0]}>
          <planeGeometry args={[0.52, 0.52]} />
          <meshStandardMaterial ref={pd} color="#24304f" emissive="#5ad8ff" emissiveIntensity={0.3} toneMapped={false} />
        </mesh>
        <Html position={[0, -0.55, 0]} center>
          <div className="scene-label">photodiode → i(t)</div>
        </Html>
      </group>
      <Html position={[tx.x, tx.y + 0.75, 0]} center>
        <div className="scene-label">LED · on-off keying</div>
      </Html>

      <gridHelper args={[20, 40, '#1d2333', '#141925']} position={[0, -2.4, 0]} />
    </>
  );
}
