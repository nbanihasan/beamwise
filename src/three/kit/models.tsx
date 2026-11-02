import { useEffect, useMemo, useRef, type ReactNode } from 'react';
import { useFrame } from '@react-three/fiber';
import { RoundedBox } from '@react-three/drei';
import * as THREE from 'three';

/**
 * Stylised scenery models (metres, Y up). Built from primitives so the app ships no model files.
 * Each model sits on its local origin: vehicles and furniture on the ground, lamps at their pole base.
 */
type V3 = THREE.Vector3Tuple;
interface P {
  position?: V3;
  rotation?: V3;
  scale?: number | V3;
}

export const METAL = { color: '#2a2d36', metalness: 0.7, roughness: 0.35 };
export const ALU = { color: '#b9bec9', metalness: 0.85, roughness: 0.28 };
export const MATTE = { color: '#1b1d24', metalness: 0.1, roughness: 0.8 };

/** Animated canvas texture: `draw` runs at `fps` (0 = once). */
export function useCanvasTexture(w: number, h: number, draw: (g: CanvasRenderingContext2D, t: number) => void, fps = 8) {
  const { tex, ctx } = useMemo(() => {
    const c = document.createElement('canvas');
    c.width = w;
    c.height = h;
    const g = c.getContext('2d')!;
    const t = new THREE.CanvasTexture(c);
    t.colorSpace = THREE.SRGBColorSpace;
    t.magFilter = THREE.NearestFilter;
    return { tex: t, ctx: g };
  }, [w, h]);
  const last = useRef(-1);
  useEffect(() => {
    draw(ctx, 0);
    tex.needsUpdate = true;
    return () => tex.dispose();
  }, [tex]); // eslint-disable-line react-hooks/exhaustive-deps
  useFrame(({ clock }) => {
    if (!fps) return;
    const t = clock.getElapsedTime();
    const f = Math.floor(t * fps);
    if (f !== last.current) {
      last.current = f;
      draw(ctx, t);
      tex.needsUpdate = true;
    }
  });
  return tex;
}

export function Emissive({ color = '#fff1d6', intensity = 3 }: { color?: string; intensity?: number }) {
  return <meshStandardMaterial color={color} emissive={color} emissiveIntensity={intensity} toneMapped={false} />;
}

/* ---------------- Indoor ---------------- */

export function CeilingPanel({ size = 0.6, on = true, color = '#fff3dc', ...p }: P & { size?: number; on?: boolean; color?: string }) {
  return (
    <group {...p}>
      <RoundedBox args={[size + 0.04, 0.05, size + 0.04]} radius={0.015} smoothness={3}>
        <meshStandardMaterial {...ALU} />
      </RoundedBox>
      <mesh position={[0, -0.027, 0]} rotation-x={Math.PI / 2}>
        <planeGeometry args={[size, size]} />
        <meshStandardMaterial color={color} emissive={color} emissiveIntensity={on ? 2.6 : 0.2} toneMapped={false} side={THREE.DoubleSide} />
      </mesh>
    </group>
  );
}

export function Downlight({ on = true, color = '#fff3dc', ...p }: P & { on?: boolean; color?: string }) {
  return (
    <group {...p}>
      <mesh>
        <cylinderGeometry args={[0.09, 0.11, 0.08, 32]} />
        <meshStandardMaterial {...ALU} />
      </mesh>
      <mesh position={[0, -0.041, 0]} rotation-x={Math.PI / 2}>
        <circleGeometry args={[0.08, 32]} />
        <meshStandardMaterial color={color} emissive={color} emissiveIntensity={on ? 4 : 0.2} toneMapped={false} side={THREE.DoubleSide} />
      </mesh>
    </group>
  );
}

export function Desk({ w = 1.4, d = 0.7, h = 0.75, ...p }: P & { w?: number; d?: number; h?: number }) {
  const legs: V3[] = [
    [w / 2 - 0.05, h / 2, d / 2 - 0.05],
    [-w / 2 + 0.05, h / 2, d / 2 - 0.05],
    [w / 2 - 0.05, h / 2, -d / 2 + 0.05],
    [-w / 2 + 0.05, h / 2, -d / 2 + 0.05],
  ];
  return (
    <group {...p}>
      <RoundedBox args={[w, 0.035, d]} radius={0.012} position={[0, h, 0]}>
        <meshStandardMaterial color="#d9d4cb" roughness={0.6} />
      </RoundedBox>
      {legs.map((l, i) => (
        <mesh key={i} position={l}>
          <cylinderGeometry args={[0.018, 0.018, h, 12]} />
          <meshStandardMaterial {...METAL} />
        </mesh>
      ))}
    </group>
  );
}

export function Laptop({ open = 1.9, screen, ...p }: P & { open?: number; screen?: THREE.Texture }) {
  return (
    <group {...p}>
      <RoundedBox args={[0.34, 0.016, 0.24]} radius={0.006} position={[0, 0.008, 0]}>
        <meshStandardMaterial {...ALU} />
      </RoundedBox>
      <group position={[0, 0.016, -0.12]} rotation-x={-(Math.PI - open)}>
        <RoundedBox args={[0.34, 0.012, 0.23]} radius={0.005} position={[0, 0, 0.115]}>
          <meshStandardMaterial {...ALU} />
        </RoundedBox>
        <mesh position={[0, -0.007, 0.115]} rotation-x={Math.PI / 2}>
          <planeGeometry args={[0.31, 0.2]} />
          {screen ? <meshBasicMaterial map={screen} toneMapped={false} side={THREE.DoubleSide} /> : <meshStandardMaterial color="#1c2a4a" emissive="#24407a" emissiveIntensity={0.8} side={THREE.DoubleSide} />}
        </mesh>
      </group>
    </group>
  );
}

export function Person({ color = '#596079', height = 1.75, seated = false, ...p }: P & { color?: string; height?: number; seated?: boolean }) {
  const s = height / 1.75;
  return (
    <group {...p} scale={s}>
      {!seated && (
        <>
          <mesh position={[-0.09, 0.42, 0]}>
            <capsuleGeometry args={[0.065, 0.7, 4, 12]} />
            <meshStandardMaterial color="#2c3040" roughness={0.8} />
          </mesh>
          <mesh position={[0.09, 0.42, 0]}>
            <capsuleGeometry args={[0.065, 0.7, 4, 12]} />
            <meshStandardMaterial color="#2c3040" roughness={0.8} />
          </mesh>
        </>
      )}
      <mesh position={[0, seated ? 0.75 : 1.15, 0]}>
        <capsuleGeometry args={[0.19, 0.5, 6, 16]} />
        <meshStandardMaterial color={color} roughness={0.7} />
      </mesh>
      <mesh position={[0, seated ? 1.2 : 1.6, 0]}>
        <sphereGeometry args={[0.12, 24, 24]} />
        <meshStandardMaterial color="#c9a184" roughness={0.6} />
      </mesh>
    </group>
  );
}

export function Phone({ screen, w = 0.075, h = 0.155, ...p }: P & { screen?: THREE.Texture; w?: number; h?: number }) {
  return (
    <group {...p}>
      <RoundedBox args={[w, h, 0.009]} radius={0.004} smoothness={3}>
        <meshStandardMaterial color="#14151a" metalness={0.6} roughness={0.25} />
      </RoundedBox>
      <mesh position={[0, 0, 0.0047]}>
        <planeGeometry args={[w * 0.92, h * 0.94]} />
        {screen ? <meshBasicMaterial map={screen} toneMapped={false} /> : <meshStandardMaterial color="#0d1a36" emissive="#16305f" emissiveIntensity={0.7} />}
      </mesh>
      {/* rear camera */}
      <mesh position={[-w * 0.28, h * 0.38, -0.0055]} rotation-x={Math.PI / 2}>
        <cylinderGeometry args={[0.008, 0.008, 0.003, 20]} />
        <meshStandardMaterial color="#05060a" metalness={0.9} roughness={0.1} />
      </mesh>
    </group>
  );
}

export function Screen({ screen, w = 1.2, h = 0.7, stand = true, ...p }: P & { screen?: THREE.Texture; w?: number; h?: number; stand?: boolean }) {
  return (
    <group {...p}>
      <RoundedBox args={[w + 0.03, h + 0.03, 0.035]} radius={0.01} position={[0, 0, 0]}>
        <meshStandardMaterial color="#111216" metalness={0.5} roughness={0.35} />
      </RoundedBox>
      <mesh position={[0, 0, 0.0185]}>
        <planeGeometry args={[w, h]} />
        {screen ? <meshBasicMaterial map={screen} toneMapped={false} /> : <meshStandardMaterial color="#0a0f1e" />}
      </mesh>
      {stand && (
        <>
          <mesh position={[0, -h / 2 - 0.12, -0.02]}>
            <boxGeometry args={[0.06, 0.24, 0.03]} />
            <meshStandardMaterial {...METAL} />
          </mesh>
          <mesh position={[0, -h / 2 - 0.24, 0]}>
            <boxGeometry args={[w * 0.4, 0.015, 0.22]} />
            <meshStandardMaterial {...METAL} />
          </mesh>
        </>
      )}
    </group>
  );
}

export function Shelf({ w = 3, h = 1.8, d = 0.5, seed = 1, ...p }: P & { w?: number; h?: number; d?: number; seed?: number }) {
  const boxes = useMemo(() => {
    const out: { pos: V3; size: V3; color: string }[] = [];
    let s = seed * 9301;
    const r = () => ((s = (s * 9301 + 49297) % 233280) / 233280);
    const cols = ['#e2574c', '#f2b134', '#4fb3bf', '#7a6ff0', '#58c472', '#ef8bb0', '#d9d4cb'];
    for (let lv = 0; lv < 4; lv++) {
      let x = -w / 2 + 0.05;
      while (x < w / 2 - 0.2) {
        const bw = 0.12 + r() * 0.18;
        const bh = 0.15 + r() * 0.22;
        out.push({ pos: [x + bw / 2, 0.06 + lv * (h / 4) + bh / 2, 0], size: [bw * 0.92, bh, d * 0.8], color: cols[Math.floor(r() * cols.length)] });
        x += bw;
      }
    }
    return out;
  }, [w, h, d, seed]);
  return (
    <group {...p}>
      {[0, 1, 2, 3].map((lv) => (
        <mesh key={lv} position={[0, 0.04 + lv * (h / 4), 0]}>
          <boxGeometry args={[w, 0.03, d]} />
          <meshStandardMaterial color="#cfd2d8" metalness={0.4} roughness={0.5} />
        </mesh>
      ))}
      <mesh position={[0, h / 2, -d / 2]}>
        <boxGeometry args={[w, h, 0.02]} />
        <meshStandardMaterial color="#9aa0aa" metalness={0.3} roughness={0.6} />
      </mesh>
      {boxes.map((b, i) => (
        <mesh key={i} position={b.pos}>
          <boxGeometry args={b.size} />
          <meshStandardMaterial color={b.color} roughness={0.7} />
        </mesh>
      ))}
    </group>
  );
}

/* ---------------- Street & vehicles ---------------- */

export function StreetLamp({ height = 6, arm = 1.4, on = true, color = '#fff0d0', ...p }: P & { height?: number; arm?: number; on?: boolean; color?: string }) {
  return (
    <group {...p}>
      <mesh position={[0, height / 2, 0]}>
        <cylinderGeometry args={[0.06, 0.1, height, 16]} />
        <meshStandardMaterial {...METAL} />
      </mesh>
      <mesh position={[arm / 2, height, 0]} rotation-z={Math.PI / 2}>
        <cylinderGeometry args={[0.04, 0.04, arm, 12]} />
        <meshStandardMaterial {...METAL} />
      </mesh>
      <RoundedBox args={[0.6, 0.1, 0.3]} radius={0.03} position={[arm, height - 0.02, 0]}>
        <meshStandardMaterial {...METAL} />
      </RoundedBox>
      <mesh position={[arm, height - 0.075, 0]} rotation-x={Math.PI / 2}>
        <planeGeometry args={[0.5, 0.22]} />
        <meshStandardMaterial color={color} emissive={color} emissiveIntensity={on ? 4 : 0.2} toneMapped={false} side={THREE.DoubleSide} />
      </mesh>
    </group>
  );
}

export function TrafficLight({ state = 'red', height = 4.5, ...p }: P & { state?: 'red' | 'amber' | 'green'; height?: number }) {
  const lamps: [string, string][] = [
    ['red', '#ff3b3b'],
    ['amber', '#ffb020'],
    ['green', '#2fe07a'],
  ];
  return (
    <group {...p}>
      <mesh position={[0, height / 2, 0]}>
        <cylinderGeometry args={[0.07, 0.09, height, 16]} />
        <meshStandardMaterial {...METAL} />
      </mesh>
      <RoundedBox args={[0.34, 0.95, 0.28]} radius={0.04} position={[0, height + 0.3, 0.05]}>
        <meshStandardMaterial color="#15161b" metalness={0.4} roughness={0.5} />
      </RoundedBox>
      {lamps.map(([k, c], i) => (
        <mesh key={k} position={[0, height + 0.6 - i * 0.3, 0.195]}>
          <circleGeometry args={[0.1, 28]} />
          <meshStandardMaterial color={c} emissive={c} emissiveIntensity={state === k ? 5 : 0.08} toneMapped={false} />
        </mesh>
      ))}
    </group>
  );
}

export function Car({ color = '#d0d4dc', lights = true, ...p }: P & { color?: string; lights?: boolean }) {
  const wheels: V3[] = [
    [0.78, 0.32, 1.25],
    [-0.78, 0.32, 1.25],
    [0.78, 0.32, -1.3],
    [-0.78, 0.32, -1.3],
  ];
  return (
    <group {...p}>
      <RoundedBox args={[1.75, 0.55, 4.3]} radius={0.18} smoothness={4} position={[0, 0.62, 0]}>
        <meshPhysicalMaterial color={color} metalness={0.6} roughness={0.28} clearcoat={1} clearcoatRoughness={0.1} />
      </RoundedBox>
      <RoundedBox args={[1.55, 0.5, 2.2]} radius={0.2} smoothness={4} position={[0, 1.08, -0.25]}>
        <meshPhysicalMaterial color="#0d1018" metalness={0.9} roughness={0.08} clearcoat={1} />
      </RoundedBox>
      {wheels.map((w, i) => (
        <mesh key={i} position={w} rotation-z={Math.PI / 2}>
          <cylinderGeometry args={[0.32, 0.32, 0.24, 24]} />
          <meshStandardMaterial color="#0b0b0d" roughness={0.9} />
        </mesh>
      ))}
      {/* headlights (+z front) */}
      {[-0.6, 0.6].map((x) => (
        <mesh key={`h${x}`} position={[x, 0.7, 2.151]}>
          <planeGeometry args={[0.38, 0.12]} />
          <meshStandardMaterial color="#eaf2ff" emissive="#eaf2ff" emissiveIntensity={lights ? 5 : 0.3} toneMapped={false} />
        </mesh>
      ))}
      {[-0.65, 0.65].map((x) => (
        <mesh key={`t${x}`} position={[x, 0.75, -2.151]} rotation-y={Math.PI}>
          <planeGeometry args={[0.36, 0.1]} />
          <meshStandardMaterial color="#ff2a3d" emissive="#ff2a3d" emissiveIntensity={lights ? 4 : 0.3} toneMapped={false} />
        </mesh>
      ))}
    </group>
  );
}

export function Road({ length = 80, width = 8, ...p }: P & { length?: number; width?: number }) {
  return (
    <group {...p}>
      <mesh rotation-x={-Math.PI / 2} position={[0, 0.005, 0]}>
        <planeGeometry args={[width, length]} />
        <meshStandardMaterial color="#17181d" roughness={0.92} />
      </mesh>
      {Array.from({ length: Math.floor(length / 4) }, (_, i) => (
        <mesh key={i} rotation-x={-Math.PI / 2} position={[0, 0.01, -length / 2 + 2 + i * 4]}>
          <planeGeometry args={[0.12, 2]} />
          <meshStandardMaterial color="#d8d8d0" emissive="#d8d8d0" emissiveIntensity={0.15} />
        </mesh>
      ))}
      {[-1, 1].map((s) => (
        <mesh key={s} rotation-x={-Math.PI / 2} position={[(s * width) / 2 - s * 0.15, 0.01, 0]}>
          <planeGeometry args={[0.1, length]} />
          <meshStandardMaterial color="#d8d8d0" />
        </mesh>
      ))}
    </group>
  );
}

export function Building({ w = 8, h = 30, d = 8, seed = 1, color = '#1a1d26', ...p }: P & { w?: number; h?: number; d?: number; seed?: number; color?: string }) {
  const tex = useMemo(() => {
    const c = document.createElement('canvas');
    c.width = 64;
    c.height = 128;
    const g = c.getContext('2d')!;
    g.fillStyle = color;
    g.fillRect(0, 0, 64, 128);
    let s = seed * 7919;
    const r = () => ((s = (s * 9301 + 49297) % 233280) / 233280);
    for (let y = 2; y < 128; y += 6)
      for (let x = 3; x < 64; x += 7) {
        const lit = r() < 0.35;
        g.fillStyle = lit ? `rgba(255,${200 + r() * 40},${140 + r() * 60},${0.55 + r() * 0.4})` : 'rgba(120,140,170,0.12)';
        g.fillRect(x, y, 4, 3);
      }
    const t = new THREE.CanvasTexture(c);
    t.colorSpace = THREE.SRGBColorSpace;
    t.wrapS = t.wrapT = THREE.RepeatWrapping;
    t.repeat.set(Math.max(1, w / 8), Math.max(1, h / 16));
    return t;
  }, [w, h, seed, color]);
  return (
    <group {...p}>
      <mesh position={[0, h / 2, 0]}>
        <boxGeometry args={[w, h, d]} />
        <meshStandardMaterial color="#ffffff" map={tex} emissiveMap={tex} emissive="#ffffff" emissiveIntensity={0.55} roughness={0.6} metalness={0.2} />
      </mesh>
      <mesh position={[0, h + 0.15, 0]}>
        <boxGeometry args={[w * 1.02, 0.3, d * 1.02]} />
        <meshStandardMaterial {...METAL} />
      </mesh>
    </group>
  );
}

/* ---------------- Space ---------------- */

export function Satellite({ color = '#d4a347', panel = 2.4, ...p }: P & { color?: string; panel?: number }) {
  return (
    <group {...p}>
      <RoundedBox args={[0.8, 0.8, 1.1]} radius={0.06}>
        <meshStandardMaterial color={color} metalness={0.95} roughness={0.3} />
      </RoundedBox>
      {[-1, 1].map((s) => (
        <group key={s} position={[s * (0.4 + panel / 2 + 0.12), 0, 0]}>
          <mesh position={[(-s * (panel / 2 + 0.06)) / 2, 0, 0]} rotation-z={Math.PI / 2}>
            <cylinderGeometry args={[0.025, 0.025, 0.24, 8]} />
            <meshStandardMaterial {...ALU} />
          </mesh>
          <mesh>
            <boxGeometry args={[panel, 0.03, 0.9]} />
            <meshStandardMaterial color="#1b2f7a" metalness={0.7} roughness={0.25} emissive="#0c1a4a" emissiveIntensity={0.4} />
          </mesh>
          <gridHelper args={[panel, 6, '#6a86ff', '#3a4f9a']} position={[0, 0.017, 0]} scale={[1, 1, 0.9 / panel]} />
        </group>
      ))}
      {/* optical terminal */}
      <group position={[0, 0.5, 0.2]}>
        <mesh>
          <cylinderGeometry args={[0.16, 0.16, 0.25, 24]} />
          <meshStandardMaterial {...ALU} />
        </mesh>
        <mesh position={[0, 0.13, 0]} rotation-x={-Math.PI / 2}>
          <circleGeometry args={[0.13, 24]} />
          <meshStandardMaterial color="#1a1030" metalness={1} roughness={0.05} />
        </mesh>
      </group>
    </group>
  );
}

const atmoVert = /* glsl */ `varying vec3 vN; varying vec3 vV; void main(){ vec4 mv = modelViewMatrix*vec4(position,1.); vN = normalize(normalMatrix*normal); vV = normalize(-mv.xyz); gl_Position = projectionMatrix*mv; }`;
const atmoFrag = /* glsl */ `uniform vec3 c; varying vec3 vN; varying vec3 vV; void main(){ float f = pow(1.0 - abs(dot(vN, vV)), 3.0); gl_FragColor = vec4(c, f); }`;

export function Earth({ radius = 10, ...p }: P & { radius?: number }) {
  const tex = useMemo(() => {
    const c = document.createElement('canvas');
    c.width = 512;
    c.height = 256;
    const g = c.getContext('2d')!;
    const grd = g.createLinearGradient(0, 0, 0, 256);
    grd.addColorStop(0, '#0b2a4f');
    grd.addColorStop(0.5, '#0c3d6e');
    grd.addColorStop(1, '#0b2a4f');
    g.fillStyle = grd;
    g.fillRect(0, 0, 512, 256);
    let s = 4242;
    const r = () => ((s = (s * 9301 + 49297) % 233280) / 233280);
    for (let i = 0; i < 26; i++) {
      const cx = r() * 512;
      const cy = 50 + r() * 156;
      for (let k = 0; k < 40; k++) {
        g.fillStyle = `rgba(${60 + r() * 50},${100 + r() * 60},${60 + r() * 30},0.9)`;
        g.beginPath();
        g.ellipse(cx + (r() - 0.5) * 70, cy + (r() - 0.5) * 40, 6 + r() * 16, 4 + r() * 10, r() * 3, 0, Math.PI * 2);
        g.fill();
      }
    }
    for (let i = 0; i < 120; i++) {
      g.fillStyle = `rgba(255,255,255,${0.15 + r() * 0.35})`;
      g.beginPath();
      g.ellipse(r() * 512, r() * 256, 10 + r() * 30, 2 + r() * 5, r() * 0.4, 0, Math.PI * 2);
      g.fill();
    }
    const t = new THREE.CanvasTexture(c);
    t.colorSpace = THREE.SRGBColorSpace;
    return t;
  }, []);
  const uniforms = useMemo(() => ({ c: { value: new THREE.Color('#5fb4ff') } }), []);
  return (
    <group {...p}>
      <Spinning speed={0.02}>
        <mesh>
          <sphereGeometry args={[radius, 96, 64]} />
          <meshStandardMaterial map={tex} roughness={0.8} metalness={0.05} emissive="#0a1830" emissiveIntensity={0.25} />
        </mesh>
      </Spinning>
      <mesh scale={1.06}>
        <sphereGeometry args={[radius, 64, 48]} />
        <shaderMaterial vertexShader={atmoVert} fragmentShader={atmoFrag} uniforms={uniforms} transparent blending={THREE.AdditiveBlending} side={THREE.BackSide} depthWrite={false} />
      </mesh>
    </group>
  );
}

export function Spinning({ speed = 0.2, children }: { speed?: number; children: ReactNode }) {
  const g = useRef<THREE.Group>(null);
  useFrame((_, dt) => {
    if (g.current) g.current.rotation.y += dt * speed;
  });
  return <group ref={g}>{children}</group>;
}

export function GroundStation({ ...p }: P) {
  return (
    <group {...p}>
      <mesh position={[0, 0.6, 0]}>
        <cylinderGeometry args={[1.6, 1.6, 1.2, 40]} />
        <meshStandardMaterial color="#d9dce2" roughness={0.5} />
      </mesh>
      <mesh position={[0, 1.2, 0]}>
        <sphereGeometry args={[1.6, 40, 20, 0, Math.PI * 2, 0, Math.PI / 2]} />
        <meshStandardMaterial color="#eef0f4" roughness={0.35} metalness={0.2} />
      </mesh>
      <mesh position={[0, 2.2, 0.4]} rotation-x={-0.5}>
        <cylinderGeometry args={[0.32, 0.32, 1.6, 24]} />
        <meshStandardMaterial {...METAL} />
      </mesh>
    </group>
  );
}

/* ---------------- Water ---------------- */

export function AUV({ color = '#ffc21a', ...p }: P & { color?: string }) {
  return (
    <group {...p}>
      <mesh rotation-z={Math.PI / 2}>
        <capsuleGeometry args={[0.18, 1.4, 8, 24]} />
        <meshStandardMaterial color={color} metalness={0.3} roughness={0.35} />
      </mesh>
      <mesh position={[-0.95, 0, 0]} rotation-z={Math.PI / 2}>
        <coneGeometry args={[0.12, 0.25, 4]} />
        <meshStandardMaterial {...METAL} />
      </mesh>
      {[0, Math.PI / 2].map((r) => (
        <mesh key={r} position={[-0.75, 0, 0]} rotation-x={r}>
          <boxGeometry args={[0.25, 0.5, 0.02]} />
          <meshStandardMaterial {...METAL} />
        </mesh>
      ))}
      <mesh position={[0.88, 0, 0]} rotation-z={-Math.PI / 2}>
        <circleGeometry args={[0.1, 24]} />
        <meshStandardMaterial color="#7af2ff" emissive="#7af2ff" emissiveIntensity={4} toneMapped={false} side={THREE.DoubleSide} />
      </mesh>
    </group>
  );
}

export function Buoy({ ...p }: P) {
  return (
    <group {...p}>
      <mesh>
        <cylinderGeometry args={[0.6, 0.45, 0.6, 32]} />
        <meshStandardMaterial color="#ff6a2a" roughness={0.5} />
      </mesh>
      <mesh position={[0, 0.9, 0]}>
        <cylinderGeometry args={[0.05, 0.05, 1.4, 12]} />
        <meshStandardMaterial {...ALU} />
      </mesh>
      <mesh position={[0, -0.55, 0]}>
        <cylinderGeometry args={[0.15, 0.15, 0.5, 16]} />
        <meshStandardMaterial {...METAL} />
      </mesh>
      <mesh position={[0, -0.81, 0]} rotation-x={Math.PI / 2}>
        <circleGeometry args={[0.13, 24]} />
        <meshStandardMaterial color="#5ff0d0" emissive="#5ff0d0" emissiveIntensity={4} toneMapped={false} side={THREE.DoubleSide} />
      </mesh>
    </group>
  );
}

export function SeabedNode({ ...p }: P) {
  return (
    <group {...p}>
      {[0, 2.1, 4.2].map((a) => (
        <mesh key={a} position={[Math.cos(a) * 0.25, 0.25, Math.sin(a) * 0.25]} rotation={[Math.sin(a) * 0.4, 0, -Math.cos(a) * 0.4]}>
          <cylinderGeometry args={[0.025, 0.025, 0.6, 8]} />
          <meshStandardMaterial {...METAL} />
        </mesh>
      ))}
      <mesh position={[0, 0.6, 0]}>
        <sphereGeometry args={[0.2, 24, 16]} />
        <meshStandardMaterial color="#e6e9ef" metalness={0.5} roughness={0.3} />
      </mesh>
      <mesh position={[0, 0.81, 0]}>
        <sphereGeometry args={[0.05, 16, 12]} />
        <meshStandardMaterial color="#5ff0d0" emissive="#5ff0d0" emissiveIntensity={4} toneMapped={false} />
      </mesh>
    </group>
  );
}

/* ---------------- Machines ---------------- */

export function Drone({ ...p }: P) {
  const rot = useRef<THREE.Group>(null);
  useFrame((_, dt) => {
    rot.current?.children.forEach((c) => (c.rotation.y += dt * 40));
  });
  const arms: V3[] = [
    [0.35, 0, 0.35],
    [-0.35, 0, 0.35],
    [0.35, 0, -0.35],
    [-0.35, 0, -0.35],
  ];
  return (
    <group {...p}>
      <RoundedBox args={[0.32, 0.12, 0.32]} radius={0.04}>
        <meshStandardMaterial color="#e8eaee" metalness={0.3} roughness={0.4} />
      </RoundedBox>
      {arms.map((a, i) => (
        <mesh key={i} position={[a[0] / 2, 0, a[2] / 2]} rotation-y={Math.atan2(a[0], a[2])}>
          <boxGeometry args={[0.03, 0.03, 0.5]} />
          <meshStandardMaterial {...METAL} />
        </mesh>
      ))}
      <group ref={rot}>
        {arms.map((a, i) => (
          <mesh key={i} position={[a[0], 0.06, a[2]]}>
            <boxGeometry args={[0.32, 0.005, 0.03]} />
            <meshStandardMaterial color="#222" transparent opacity={0.6} />
          </mesh>
        ))}
      </group>
      <mesh position={[0, -0.09, 0]} rotation-x={Math.PI / 2}>
        <circleGeometry args={[0.05, 20]} />
        <meshStandardMaterial color="#9ff" emissive="#9ff" emissiveIntensity={4} toneMapped={false} side={THREE.DoubleSide} />
      </mesh>
    </group>
  );
}

export function RobotArm({ color = '#ff8a2a', phase = 0, ...p }: P & { color?: string; phase?: number }) {
  const a1 = useRef<THREE.Group>(null);
  const a2 = useRef<THREE.Group>(null);
  useFrame(({ clock }) => {
    const t = clock.getElapsedTime() + phase;
    if (a1.current) a1.current.rotation.z = 0.5 + 0.35 * Math.sin(t * 0.8);
    if (a2.current) a2.current.rotation.z = -1.2 + 0.4 * Math.sin(t * 1.1);
  });
  return (
    <group {...p}>
      <mesh position={[0, 0.15, 0]}>
        <cylinderGeometry args={[0.3, 0.36, 0.3, 32]} />
        <meshStandardMaterial {...METAL} />
      </mesh>
      <group position={[0, 0.35, 0]} ref={a1}>
        <mesh position={[0, 0.5, 0]}>
          <boxGeometry args={[0.16, 1, 0.16]} />
          <meshStandardMaterial color={color} roughness={0.4} metalness={0.3} />
        </mesh>
        <group position={[0, 1, 0]} ref={a2}>
          <mesh position={[0, 0.4, 0]}>
            <boxGeometry args={[0.12, 0.8, 0.12]} />
            <meshStandardMaterial color={color} roughness={0.4} metalness={0.3} />
          </mesh>
          <mesh position={[0, 0.85, 0]}>
            <sphereGeometry args={[0.07, 16, 12]} />
            <meshStandardMaterial color="#9ff" emissive="#9ff" emissiveIntensity={3} toneMapped={false} />
          </mesh>
        </group>
      </group>
    </group>
  );
}

export function AGV({ ...p }: P) {
  return (
    <group {...p}>
      <RoundedBox args={[0.9, 0.3, 0.6]} radius={0.06} position={[0, 0.2, 0]}>
        <meshStandardMaterial color="#e6e8ec" roughness={0.4} />
      </RoundedBox>
      <mesh position={[0, 0.42, 0]}>
        <cylinderGeometry args={[0.05, 0.05, 0.12, 12]} />
        <meshStandardMaterial {...METAL} />
      </mesh>
      <mesh position={[0, 0.49, 0]}>
        <sphereGeometry args={[0.05, 16, 12]} />
        <meshStandardMaterial color="#9ff" emissive="#9ff" emissiveIntensity={3} toneMapped={false} />
      </mesh>
    </group>
  );
}

export function SeatRow({ seats = 3, ...p }: P & { seats?: number }) {
  return (
    <group {...p}>
      {Array.from({ length: seats }, (_, i) => (
        <group key={i} position={[(i - (seats - 1) / 2) * 0.5, 0, 0]}>
          <RoundedBox args={[0.46, 0.12, 0.48]} radius={0.04} position={[0, 0.45, 0]}>
            <meshStandardMaterial color="#2c3550" roughness={0.8} />
          </RoundedBox>
          <RoundedBox args={[0.46, 0.75, 0.1]} radius={0.04} position={[0, 0.85, -0.22]}>
            <meshStandardMaterial color="#2c3550" roughness={0.8} />
          </RoundedBox>
        </group>
      ))}
    </group>
  );
}
