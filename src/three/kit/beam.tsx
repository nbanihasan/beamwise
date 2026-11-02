import { useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';

/**
 * Light beams. A beam is an open cone between two points drawn with an additive shader: soft edges
 * (view-angle falloff), dimming with distance, and optional moving "data stripes" that make the
 * modulation visible. Used by the use-case gallery, the system view and the Optical Bench.
 */
const vert = /* glsl */ `
varying vec2 vUv;
varying vec3 vN;
varying vec3 vV;
void main() {
  vUv = uv;
  vec4 mv = modelViewMatrix * vec4(position, 1.0);
  vN = normalize(normalMatrix * normal);
  vV = normalize(-mv.xyz);
  gl_Position = projectionMatrix * mv;
}`;

const frag = /* glsl */ `
uniform vec3 uColor;
uniform float uTime;
uniform float uStripes;
uniform float uSpeed;
uniform float uMod;
uniform float uOpacity;
uniform float uFalloff;
varying vec2 vUv;
varying vec3 vN;
varying vec3 vV;
float hash(float n) { return fract(sin(n * 91.345) * 47453.5453); }
void main() {
  float along = vUv.y;
  float edge = pow(abs(dot(normalize(vN), normalize(vV))), 1.6);
  float fall = mix(1.0, uFalloff, along);
  float k = along * uStripes - uTime * uSpeed;
  float bit = step(0.5, hash(floor(k)));
  float soft = smoothstep(0.0, 0.12, fract(k)) * smoothstep(1.0, 0.88, fract(k));
  float m = 1.0 - uMod * (1.0 - bit * soft);
  float a = edge * fall * uOpacity * m;
  gl_FragColor = vec4(uColor * (0.6 + 0.8 * m), a);
}`;

export interface BeamProps {
  from: THREE.Vector3Tuple;
  to: THREE.Vector3Tuple;
  r0?: number;
  r1?: number;
  color?: THREE.ColorRepresentation;
  opacity?: number;
  /** 0 = steady light, 1 = full on/off modulation stripes */
  mod?: number;
  stripes?: number;
  speed?: number;
  falloff?: number;
  segments?: number;
}

export function Beam({ from, to, r0 = 0.02, r1 = 0.3, color = '#ffe2a0', opacity = 0.35, mod = 0.6, stripes = 14, speed = 2.2, falloff = 0.35, segments = 40 }: BeamProps) {
  const mat = useRef<THREE.ShaderMaterial>(null);
  const { position, quaternion, len } = useMemo(() => {
    const a = new THREE.Vector3(...from);
    const b = new THREE.Vector3(...to);
    const d = b.clone().sub(a);
    const l = Math.max(1e-4, d.length());
    const q = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), d.clone().normalize());
    return { position: a.add(b).multiplyScalar(0.5), quaternion: q, len: l };
  }, [from[0], from[1], from[2], to[0], to[1], to[2]]); // eslint-disable-line react-hooks/exhaustive-deps
  const uniforms = useMemo(
    () => ({
      uColor: { value: new THREE.Color(color) },
      uTime: { value: 0 },
      uStripes: { value: stripes },
      uSpeed: { value: speed },
      uMod: { value: mod },
      uOpacity: { value: opacity },
      uFalloff: { value: falloff },
    }),
    [], // eslint-disable-line react-hooks/exhaustive-deps
  );
  uniforms.uColor.value.set(color);
  uniforms.uMod.value = mod;
  uniforms.uOpacity.value = opacity;
  uniforms.uStripes.value = stripes;
  uniforms.uSpeed.value = speed;
  uniforms.uFalloff.value = falloff;
  useFrame((_, dt) => {
    if (mat.current) mat.current.uniforms.uTime.value += dt;
  });
  return (
    <mesh position={position} quaternion={quaternion} renderOrder={5}>
      {/* CylinderGeometry(radiusTop, radiusBottom): bottom sits at "from" */}
      <cylinderGeometry args={[r1, r0, len, segments, 1, true]} />
      <shaderMaterial
        ref={mat}
        vertexShader={vert}
        fragmentShader={frag}
        uniforms={uniforms}
        transparent
        depthWrite={false}
        blending={THREE.AdditiveBlending}
        side={THREE.DoubleSide}
        toneMapped={false}
      />
    </mesh>
  );
}

/** Thin glowing line between two points (laser beam, ray), with travelling pulses. */
export function Laser({ from, to, color = '#ff4d6d', width = 0.012, opacity = 0.9, mod = 0.5, stripes = 30, speed = 3 }: Omit<BeamProps, 'r0' | 'r1'> & { width?: number }) {
  return <Beam from={from} to={to} r0={width} r1={width} color={color} opacity={opacity} mod={mod} stripes={stripes} speed={speed} falloff={0.9} segments={10} />;
}

/** Soft billboard glow (for LEDs, lamps, stars, receivers lighting up). */
const glowTex = (() => {
  let t: THREE.Texture | null = null;
  return () => {
    if (t) return t;
    const c = document.createElement('canvas');
    c.width = c.height = 128;
    const g = c.getContext('2d')!;
    const grd = g.createRadialGradient(64, 64, 0, 64, 64, 64);
    grd.addColorStop(0, 'rgba(255,255,255,1)');
    grd.addColorStop(0.2, 'rgba(255,255,255,0.55)');
    grd.addColorStop(0.5, 'rgba(255,255,255,0.12)');
    grd.addColorStop(1, 'rgba(255,255,255,0)');
    g.fillStyle = grd;
    g.fillRect(0, 0, 128, 128);
    t = new THREE.CanvasTexture(c);
    t.colorSpace = THREE.SRGBColorSpace;
    return t;
  };
})();

export function Glow({ position = [0, 0, 0], color = '#ffffff', size = 0.6, opacity = 1, pulse = 0 }: { position?: THREE.Vector3Tuple; color?: THREE.ColorRepresentation; size?: number; opacity?: number; pulse?: number }) {
  const ref = useRef<THREE.Sprite>(null);
  const map = useMemo(glowTex, []);
  useFrame(({ clock }) => {
    if (!ref.current || !pulse) return;
    const k = 0.75 + 0.25 * Math.sin(clock.getElapsedTime() * pulse);
    (ref.current.material as THREE.SpriteMaterial).opacity = opacity * k;
  });
  return (
    <sprite ref={ref} position={position} scale={[size, size, size]} renderOrder={6}>
      <spriteMaterial map={map} color={color} transparent opacity={opacity} depthWrite={false} blending={THREE.AdditiveBlending} toneMapped={false} />
    </sprite>
  );
}

/**
 * Photon packets travelling along a polyline. `bits` gates emission so the stream visibly carries data.
 * Instanced, so thousands of packets stay cheap.
 */
export function PhotonStream({
  path,
  color = '#ffe2a0',
  count = 160,
  speed = 3,
  size = 0.035,
  spread = 0.05,
  bits = [1, 0, 1, 1, 0, 1, 0, 0],
  bitTime = 0.18,
  rate = 60,
}: {
  path: THREE.Vector3Tuple[];
  color?: THREE.ColorRepresentation;
  count?: number;
  speed?: number;
  size?: number;
  spread?: number;
  bits?: number[];
  bitTime?: number;
  rate?: number;
}) {
  const mesh = useRef<THREE.InstancedMesh>(null);
  const seg = useMemo(() => {
    const pts = path.map((p) => new THREE.Vector3(...p));
    const lens: number[] = [];
    let total = 0;
    for (let i = 0; i < pts.length - 1; i++) {
      const l = pts[i].distanceTo(pts[i + 1]);
      lens.push(l);
      total += l;
    }
    return { pts, lens, total };
  }, [JSON.stringify(path)]); // eslint-disable-line react-hooks/exhaustive-deps
  const st = useMemo(() => {
    const s = new Float32Array(count).fill(-1);
    const off = new Float32Array(count * 3);
    for (let i = 0; i < count * 3; i++) off[i] = (Math.random() - 0.5) * 2;
    return { s, off, next: 0, acc: 0 };
  }, [count]);
  const dummy = useMemo(() => new THREE.Object3D(), []);
  const tmp = useMemo(() => new THREE.Vector3(), []);
  useFrame(({ clock }, dt) => {
    const m = mesh.current;
    if (!m) return;
    const t = clock.getElapsedTime();
    const bit = bits[Math.floor(t / bitTime) % bits.length];
    if (bit) {
      st.acc += dt * rate;
      while (st.acc > 1) {
        st.s[st.next] = 0;
        st.next = (st.next + 1) % count;
        st.acc -= 1;
      }
    }
    for (let i = 0; i < count; i++) {
      if (st.s[i] < 0) {
        dummy.scale.setScalar(0.0001);
        dummy.position.set(0, -999, 0);
      } else {
        st.s[i] += dt * speed;
        let d = st.s[i];
        if (d > seg.total) {
          st.s[i] = -1;
          dummy.scale.setScalar(0.0001);
        } else {
          let k = 0;
          while (k < seg.lens.length - 1 && d > seg.lens[k]) {
            d -= seg.lens[k];
            k++;
          }
          tmp.copy(seg.pts[k]).lerp(seg.pts[k + 1], seg.lens[k] > 0 ? d / seg.lens[k] : 0);
          dummy.position.set(tmp.x + st.off[i * 3] * spread, tmp.y + st.off[i * 3 + 1] * spread, tmp.z + st.off[i * 3 + 2] * spread);
          dummy.scale.setScalar(1);
        }
      }
      dummy.updateMatrix();
      m.setMatrixAt(i, dummy.matrix);
    }
    m.instanceMatrix.needsUpdate = true;
  });
  return (
    <instancedMesh ref={mesh} args={[undefined, undefined, count]} frustumCulled={false} renderOrder={7}>
      <sphereGeometry args={[size, 8, 8]} />
      <meshBasicMaterial color={color} toneMapped={false} transparent opacity={0.95} blending={THREE.AdditiveBlending} depthWrite={false} />
    </instancedMesh>
  );
}
