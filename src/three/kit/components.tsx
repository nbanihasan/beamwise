import { useMemo } from 'react';
import { RoundedBox } from '@react-three/drei';
import * as THREE from 'three';
import { ALU, METAL } from './models';

/**
 * Optical and electronic components. Convention: the optical axis / facing direction is local +Z.
 * Emitters send light towards +Z, detectors accept light arriving from +Z, mirrors reflect on their +Z face.
 */
type V3 = THREE.Vector3Tuple;
interface P {
  position?: V3;
  rotation?: V3;
  scale?: number | V3;
}

const GLASS = { color: '#cfe6ff', metalness: 0, roughness: 0.04, transparent: true, opacity: 0.32, envMapIntensity: 2 };

export function LedPackage({ color = '#ffe6b0', on = 1, size = 1, ...p }: P & { color?: string; on?: number; size?: number }) {
  return (
    <group {...p} scale={size}>
      <RoundedBox args={[0.05, 0.05, 0.006]} radius={0.002} position={[0, 0, -0.003]}>
        <meshStandardMaterial color="#e9edf3" roughness={0.4} />
      </RoundedBox>
      <mesh position={[0, 0, 0]}>
        <sphereGeometry args={[0.016, 32, 16, 0, Math.PI * 2, 0, Math.PI / 2]} />
        <meshStandardMaterial color={color} emissive={color} emissiveIntensity={0.4 + 4 * on} toneMapped={false} transparent opacity={0.95} />
      </mesh>
      <group rotation-x={Math.PI / 2}>
        <mesh position={[0, 0, 0]} />
      </group>
    </group>
  );
}

/** Generic emitter body facing +Z: heat-sinked LED or laser. */
export function EmitterBody({ kind = 'led', color = '#ffe6b0', on = 1, scale = 1, ...p }: P & { kind?: 'led' | 'laser' | 'ir'; color?: string; on?: number }) {
  return (
    <group {...p} scale={scale}>
      {kind === 'laser' ? (
        <>
          <mesh rotation-x={Math.PI / 2} position={[0, 0, -0.05]}>
            <cylinderGeometry args={[0.022, 0.022, 0.1, 24]} />
            <meshStandardMaterial {...ALU} />
          </mesh>
          <mesh rotation-x={Math.PI / 2} position={[0, 0, -0.005]}>
            <cylinderGeometry args={[0.012, 0.016, 0.012, 24]} />
            <meshStandardMaterial {...METAL} />
          </mesh>
          <mesh position={[0, 0, 0.0015]}>
            <circleGeometry args={[0.005, 16]} />
            <meshStandardMaterial color={color} emissive={color} emissiveIntensity={0.5 + 6 * on} toneMapped={false} />
          </mesh>
        </>
      ) : (
        <>
          {/* finned heat sink */}
          {Array.from({ length: 6 }, (_, i) => (
            <mesh key={i} position={[(i - 2.5) * 0.012, 0, -0.03]}>
              <boxGeometry args={[0.004, 0.07, 0.04]} />
              <meshStandardMaterial {...METAL} />
            </mesh>
          ))}
          <RoundedBox args={[0.075, 0.075, 0.01]} radius={0.003} position={[0, 0, -0.006]}>
            <meshStandardMaterial {...ALU} />
          </RoundedBox>
          <mesh rotation-x={Math.PI / 2}>
            <sphereGeometry args={[0.018, 32, 16, 0, Math.PI * 2, 0, Math.PI / 2]} />
            <meshStandardMaterial color={color} emissive={color} emissiveIntensity={0.4 + 4 * on} toneMapped={false} />
          </mesh>
        </>
      )}
    </group>
  );
}

/** Photodetector in a TO-can, window facing +Z. `tone` tints the die (PIN, APD, SPAD...). */
export function DetectorCan({ tone = '#3d5afe', lit = 0, big = false, scale = 1, ...p }: P & { tone?: string; lit?: number; big?: boolean }) {
  const r = big ? 0.03 : 0.016;
  return (
    <group {...p} scale={scale}>
      <mesh rotation-x={Math.PI / 2} position={[0, 0, -0.008]}>
        <cylinderGeometry args={[r, r * 1.15, 0.016, 32]} />
        <meshStandardMaterial {...ALU} />
      </mesh>
      <mesh position={[0, 0, 0.0005]}>
        <circleGeometry args={[r * 0.72, 32]} />
        <meshStandardMaterial color={tone} metalness={0.6} roughness={0.2} emissive={tone} emissiveIntensity={0.15 + lit * 3} toneMapped={false} />
      </mesh>
      {[-1, 1].map((s) => (
        <mesh key={s} position={[s * r * 0.4, 0, -0.03]} rotation-x={Math.PI / 2}>
          <cylinderGeometry args={[0.0015, 0.0015, 0.03, 6]} />
          <meshStandardMaterial {...ALU} />
        </mesh>
      ))}
    </group>
  );
}

/** Photomultiplier tube along Z: photocathode window at +Z, dynode chain inside the glass. */
export function PmtTube({ scale = 1, lit = 0, ...p }: P & { lit?: number }) {
  return (
    <group {...p} scale={scale}>
      <mesh rotation-x={Math.PI / 2} position={[0, 0, -0.06]}>
        <cylinderGeometry args={[0.028, 0.028, 0.13, 32, 1, true]} />
        <meshStandardMaterial {...GLASS} side={THREE.DoubleSide} />
      </mesh>
      <mesh position={[0, 0, 0.005]}>
        <circleGeometry args={[0.027, 32]} />
        <meshStandardMaterial color="#6a4bd8" metalness={0.5} roughness={0.2} emissive="#7c5cff" emissiveIntensity={0.2 + lit * 3} toneMapped={false} />
      </mesh>
      {Array.from({ length: 8 }, (_, i) => (
        <mesh key={i} position={[(i % 2 ? 1 : -1) * 0.009, 0, -0.012 - i * 0.012]} rotation-y={(i % 2 ? 1 : -1) * 0.6}>
          <boxGeometry args={[0.016, 0.03, 0.002]} />
          <meshStandardMaterial color="#c08a52" metalness={0.9} roughness={0.3} />
        </mesh>
      ))}
      <mesh rotation-x={Math.PI / 2} position={[0, 0, -0.135]}>
        <cylinderGeometry args={[0.03, 0.03, 0.02, 32]} />
        <meshStandardMaterial {...METAL} />
      </mesh>
    </group>
  );
}

/** Camera module: body plus lens barrel pointing +Z. */
export function CameraBody({ scale = 1, ...p }: P) {
  return (
    <group {...p} scale={scale}>
      <RoundedBox args={[0.07, 0.05, 0.04]} radius={0.006} position={[0, 0, -0.02]}>
        <meshStandardMaterial color="#1a1b20" metalness={0.5} roughness={0.35} />
      </RoundedBox>
      <mesh rotation-x={Math.PI / 2} position={[0, 0, 0.012]}>
        <cylinderGeometry args={[0.017, 0.019, 0.025, 32]} />
        <meshStandardMaterial {...METAL} />
      </mesh>
      <mesh position={[0, 0, 0.0246]}>
        <circleGeometry args={[0.013, 32]} />
        <meshStandardMaterial color="#120a2a" metalness={1} roughness={0.05} />
      </mesh>
    </group>
  );
}

export function SolarCell({ w = 0.2, h = 0.14, scale = 1, ...p }: P & { w?: number; h?: number }) {
  return (
    <group {...p} scale={scale}>
      <mesh position={[0, 0, -0.003]}>
        <boxGeometry args={[w + 0.01, h + 0.01, 0.006]} />
        <meshStandardMaterial {...ALU} />
      </mesh>
      <mesh position={[0, 0, 0.0005]}>
        <planeGeometry args={[w, h]} />
        <meshStandardMaterial color="#13235e" metalness={0.6} roughness={0.25} />
      </mesh>
      <gridHelper args={[1, 6, '#5c74d6', '#5c74d6']} rotation-x={Math.PI / 2} position={[0, 0, 0.001]} scale={[w, 1, h]} />
    </group>
  );
}

function lensProfile(R: number, t: number, kind: 'convex' | 'concave') {
  const pts: THREE.Vector2[] = [];
  const n = 24;
  for (let i = 0; i <= n; i++) {
    const r = (R * i) / n;
    const s = (r / R) ** 2;
    const y = kind === 'convex' ? (t / 2) * (1 - s) + 0.0015 : 0.0015 + (t / 2) * s;
    pts.push(new THREE.Vector2(r, y));
  }
  for (let i = n; i >= 0; i--) {
    const r = (R * i) / n;
    const s = (r / R) ** 2;
    const y = kind === 'convex' ? -(t / 2) * (1 - s) - 0.0015 : -0.0015 - (t / 2) * s;
    pts.push(new THREE.Vector2(r, y));
  }
  return pts;
}

/** Thin lens with optical axis along Z. Radius in metres. */
export function LensMesh({ radius = 0.025, kind = 'convex', ...p }: P & { radius?: number; kind?: 'convex' | 'concave' }) {
  const geo = useMemo(() => new THREE.LatheGeometry(lensProfile(radius, radius * 0.5, kind), 48), [radius, kind]);
  return (
    <group {...p}>
      <mesh geometry={geo} rotation-x={Math.PI / 2}>
        <meshPhysicalMaterial color="#d6ecff" roughness={0.02} metalness={0} transparent opacity={0.4} clearcoat={1} envMapIntensity={2.5} side={THREE.DoubleSide} />
      </mesh>
      <mesh>
        <torusGeometry args={[radius * 1.02, radius * 0.06, 8, 48]} />
        <meshStandardMaterial {...METAL} />
      </mesh>
    </group>
  );
}

/** Compound parabolic concentrator (CPC) opening towards +Z. */
export function CpcMesh({ radius = 0.02, length = 0.05, ...p }: P & { radius?: number; length?: number }) {
  const geo = useMemo(() => {
    const pts: THREE.Vector2[] = [];
    for (let i = 0; i <= 20; i++) {
      const t = i / 20;
      pts.push(new THREE.Vector2(radius * 0.35 + radius * 0.65 * t * t, t * length));
    }
    return new THREE.LatheGeometry(pts, 40);
  }, [radius, length]);
  return (
    <mesh geometry={geo} rotation-x={Math.PI / 2} {...p}>
      <meshStandardMaterial color="#dfe4ee" metalness={1} roughness={0.12} side={THREE.DoubleSide} />
    </mesh>
  );
}

export function MirrorMesh({ radius = 0.05, curvature = 0, square = false, ...p }: P & { radius?: number; curvature?: number; square?: boolean }) {
  // curvature: +1/R concave towards +Z, -1/R convex, 0 flat (for display only)
  const geo = useMemo(() => {
    if (square || Math.abs(curvature) < 1e-6) return null;
    const R = 1 / Math.abs(curvature);
    const th = Math.asin(Math.min(0.99, radius / R));
    const g = new THREE.SphereGeometry(R, 48, 12, 0, Math.PI * 2, 0, th);
    // cap around +Y; move so the vertex sits at the origin
    g.translate(0, -R, 0);
    if (curvature > 0) g.scale(1, -1, 1); // concave: hollow towards +Y
    g.rotateX(Math.PI / 2);
    return g;
  }, [radius, curvature, square]);
  return (
    <group {...p}>
      {geo ? (
        <mesh geometry={geo}>
          <meshStandardMaterial color="#e9eef7" metalness={1} roughness={0.04} side={THREE.DoubleSide} envMapIntensity={2} />
        </mesh>
      ) : square ? (
        <mesh>
          <planeGeometry args={[radius * 2, radius * 2]} />
          <meshStandardMaterial color="#e9eef7" metalness={1} roughness={0.04} side={THREE.DoubleSide} envMapIntensity={2} />
        </mesh>
      ) : (
        <mesh>
          <circleGeometry args={[radius, 48]} />
          <meshStandardMaterial color="#e9eef7" metalness={1} roughness={0.04} side={THREE.DoubleSide} envMapIntensity={2} />
        </mesh>
      )}
      {!square && (
        <mesh position={[0, 0, -0.004]}>
          <cylinderGeometry args={[radius * 1.04, radius * 1.04, 0.006, 48]} />
          <meshStandardMaterial {...METAL} />
        </mesh>
      )}
    </group>
  );
}

/** Equilateral prism, apex edge along Y, faces around Z. */
export function PrismMesh({ size = 0.05, height = 0.05, ...p }: P & { size?: number; height?: number }) {
  const geo = useMemo(() => {
    const s = new THREE.Shape();
    const r = size / Math.sqrt(3);
    for (let i = 0; i < 3; i++) {
      const a = Math.PI / 2 + (i * 2 * Math.PI) / 3;
      const x = r * Math.cos(a);
      const y = r * Math.sin(a);
      if (i === 0) s.moveTo(x, y);
      else s.lineTo(x, y);
    }
    s.closePath();
    const g = new THREE.ExtrudeGeometry(s, { depth: height, bevelEnabled: false });
    g.translate(0, 0, -height / 2);
    g.rotateX(Math.PI / 2); // extrusion along Y; triangle in XZ plane
    return g;
  }, [size, height]);
  return (
    <mesh geometry={geo} {...p}>
      <meshPhysicalMaterial color="#e4f0ff" roughness={0.02} transparent opacity={0.38} clearcoat={1} envMapIntensity={2.5} side={THREE.DoubleSide} />
    </mesh>
  );
}

/** Corner-cube retroreflector array facing +Z. */
export function RetroMesh({ size = 0.08, ...p }: P & { size?: number }) {
  const n = 4;
  const cell = size / n;
  return (
    <group {...p}>
      <mesh position={[0, 0, -0.004]}>
        <boxGeometry args={[size * 1.06, size * 1.06, 0.008]} />
        <meshStandardMaterial {...METAL} />
      </mesh>
      {Array.from({ length: n * n }, (_, i) => (
        <mesh key={i} position={[(-n / 2 + 0.5 + (i % n)) * cell, (-n / 2 + 0.5 + Math.floor(i / n)) * cell, 0.002]} rotation-x={-Math.PI / 2}>
          <coneGeometry args={[cell * 0.6, cell * 0.5, 3]} />
          <meshStandardMaterial color="#f2f5fa" metalness={1} roughness={0.08} />
        </mesh>
      ))}
    </group>
  );
}

export function PlateMesh({ size = 0.06, kind = 'diffuser', color, ...p }: P & { size?: number; kind?: 'diffuser' | 'polarizer' | 'filter' | 'splitter' | 'blocker'; color?: string }) {
  const lines = useMemo(() => {
    if (kind !== 'polarizer') return null;
    const c = document.createElement('canvas');
    c.width = c.height = 128;
    const g = c.getContext('2d')!;
    g.fillStyle = 'rgba(40,44,60,0.55)';
    g.fillRect(0, 0, 128, 128);
    g.strokeStyle = 'rgba(220,230,255,0.55)';
    g.lineWidth = 2;
    for (let x = 4; x < 128; x += 8) {
      g.beginPath();
      g.moveTo(x, 0);
      g.lineTo(x, 128);
      g.stroke();
    }
    const t = new THREE.CanvasTexture(c);
    t.colorSpace = THREE.SRGBColorSpace;
    return t;
  }, [kind]);
  if (kind === 'splitter') {
    return (
      <group {...p}>
        <mesh>
          <boxGeometry args={[size, size, size]} />
          <meshPhysicalMaterial color="#d9ecff" transparent opacity={0.28} roughness={0.02} clearcoat={1} envMapIntensity={2.5} />
        </mesh>
        <mesh rotation-y={Math.PI / 4}>
          <planeGeometry args={[size * 1.41, size]} />
          <meshStandardMaterial color="#bcd6ff" metalness={0.8} roughness={0.1} transparent opacity={0.5} side={THREE.DoubleSide} />
        </mesh>
      </group>
    );
  }
  if (kind === 'blocker') {
    return (
      <mesh {...p}>
        <boxGeometry args={[size, size, 0.02]} />
        <meshStandardMaterial color="#2a2c33" roughness={0.9} />
      </mesh>
    );
  }
  return (
    <group {...p}>
      <mesh>
        <circleGeometry args={[size / 2, 48]} />
        {kind === 'diffuser' ? (
          <meshPhysicalMaterial color="#f4f6fb" roughness={0.9} transmission={0} transparent opacity={0.7} side={THREE.DoubleSide} />
        ) : kind === 'polarizer' ? (
          <meshStandardMaterial map={lines!} transparent side={THREE.DoubleSide} />
        ) : (
          <meshPhysicalMaterial color={color ?? '#58a6ff'} roughness={0.05} transparent opacity={0.5} side={THREE.DoubleSide} />
        )}
      </mesh>
      <mesh>
        <torusGeometry args={[size / 2, size * 0.04, 8, 48]} />
        <meshStandardMaterial {...METAL} />
      </mesh>
    </group>
  );
}

/** Reconfigurable intelligent surface: a tile grid facing +Z. */
export function RisPanel({ w = 0.6, h = 0.6, n = 8, ...p }: P & { w?: number; h?: number; n?: number }) {
  return (
    <group {...p}>
      <mesh position={[0, 0, -0.01]}>
        <boxGeometry args={[w * 1.04, h * 1.04, 0.02]} />
        <meshStandardMaterial {...METAL} />
      </mesh>
      {Array.from({ length: n * n }, (_, i) => {
        const x = ((i % n) + 0.5) / n - 0.5;
        const y = (Math.floor(i / n) + 0.5) / n - 0.5;
        const hue = 0.55 + 0.1 * Math.sin(i * 1.7);
        return (
          <mesh key={i} position={[x * w, y * h, 0.002]}>
            <planeGeometry args={[(w / n) * 0.86, (h / n) * 0.86]} />
            <meshStandardMaterial color={new THREE.Color().setHSL(hue, 0.5, 0.6)} metalness={0.9} roughness={0.15} />
          </mesh>
        );
      })}
    </group>
  );
}

/** Integrated circuit (QFN-style) chip with pins: TIA, ADC, FPGA... `glow` lights the top. */
export function Chip({ w = 0.6, d = 0.6, label, glow = '#8fa6ff', pins = 8, ...p }: P & { w?: number; d?: number; label?: string; glow?: string; pins?: number }) {
  void label;
  return (
    <group {...p}>
      <RoundedBox args={[w, 0.08, d]} radius={0.02} position={[0, 0.04, 0]}>
        <meshStandardMaterial color="#121318" metalness={0.4} roughness={0.45} />
      </RoundedBox>
      <mesh position={[0, 0.081, 0]} rotation-x={-Math.PI / 2}>
        <planeGeometry args={[w * 0.5, d * 0.5]} />
        <meshStandardMaterial color={glow} emissive={glow} emissiveIntensity={1.4} toneMapped={false} transparent opacity={0.9} />
      </mesh>
      {Array.from({ length: pins }, (_, i) => {
        const t = (i + 0.5) / pins - 0.5;
        return (
          <group key={i}>
            <mesh position={[t * w * 0.9, 0.015, d / 2 + 0.02]}>
              <boxGeometry args={[(w / pins) * 0.45, 0.02, 0.05]} />
              <meshStandardMaterial {...ALU} />
            </mesh>
            <mesh position={[t * w * 0.9, 0.015, -d / 2 - 0.02]}>
              <boxGeometry args={[(w / pins) * 0.45, 0.02, 0.05]} />
              <meshStandardMaterial {...ALU} />
            </mesh>
          </group>
        );
      })}
    </group>
  );
}
