import { useMemo, useRef, useState } from 'react';
import * as THREE from 'three';
import { useFrame } from '@react-three/fiber';
import { Html } from '@react-three/drei';
import { Stage } from '@/three/Stage';
import { Plot } from '@/viz/Plot';
import { GroupTitle, Readout, Readouts, Segmented, Slider, Widget } from '@/viz/controls';
import { gammaGammaParams, gammaGammaSamples, kimAttenuationDbPerKm, rytovVariance } from '@/sim/outdoor';
import { sci } from '@/sim/math';

/** Free-space optics: weather attenuation (Kim model) and turbulence-induced scintillation (gamma-gamma). */
const beamVert = /* glsl */ `
varying vec2 vUv;
void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }`;
const beamFrag = /* glsl */ `
uniform float uTime; uniform float uStrength; uniform vec3 uColor; uniform float uFade;
varying vec2 vUv;
float hash(vec2 p){ return fract(sin(dot(p, vec2(127.1,311.7))) * 43758.5453); }
float noise(vec2 p){ vec2 i=floor(p), f=fract(p); vec2 u=f*f*(3.0-2.0*f);
  return mix(mix(hash(i),hash(i+vec2(1,0)),u.x), mix(hash(i+vec2(0,1)),hash(i+vec2(1,1)),u.x), u.y); }
void main(){
  float along = vUv.y;
  float n = noise(vec2(vUv.x*8.0 + uTime*0.7, along*14.0 - uTime*2.0));
  n += 0.5*noise(vec2(vUv.x*19.0 - uTime, along*30.0 + uTime*3.0));
  float flick = mix(1.0, 0.25 + 1.4*n, clamp(uStrength*along*1.4, 0.0, 1.0));
  float a = 0.33 * flick * mix(1.0, uFade, along);
  gl_FragColor = vec4(uColor * (0.8 + 0.8*flick), a);
}`;

const spotFrag = /* glsl */ `
uniform float uTime; uniform float uStrength; uniform float uFade;
varying vec2 vUv;
float hash(vec2 p){ return fract(sin(dot(p, vec2(127.1,311.7))) * 43758.5453); }
float noise(vec2 p){ vec2 i=floor(p), f=fract(p); vec2 u=f*f*(3.0-2.0*f);
  return mix(mix(hash(i),hash(i+vec2(1,0)),u.x), mix(hash(i+vec2(0,1)),hash(i+vec2(1,1)),u.x), u.y); }
void main(){
  vec2 c = vUv - 0.5; float r = length(c);
  float base = exp(-r*r*14.0);
  float s = noise(c*10.0 + vec2(uTime*0.9, -uTime*0.6)) * 0.6 + noise(c*24.0 - uTime*1.7) * 0.4;
  float speck = mix(1.0, pow(s*1.6, 2.2), clamp(uStrength, 0.0, 1.0));
  float v = base * speck * uFade;
  gl_FragColor = vec4(vec3(1.0, 0.45, 0.6) * v * 2.4, smoothstep(0.5, 0.42, r));
}`;

function Link({ strength, fade, nm }: { strength: number; fade: number; nm: number }) {
  const beam = useRef<THREE.ShaderMaterial>(null);
  const spot = useRef<THREE.ShaderMaterial>(null);
  const fog = useRef<THREE.Points>(null);
  const color = nm < 1000 ? new THREE.Color('#ff5c8a') : new THREE.Color('#ff7a5c');
  const fogGeo = useMemo(() => {
    const g = new THREE.BufferGeometry();
    const n = 1400;
    const pos = new Float32Array(n * 3);
    for (let i = 0; i < n; i++) {
      pos[i * 3] = (Math.random() - 0.5) * 12;
      pos[i * 3 + 1] = (Math.random() - 0.5) * 3;
      pos[i * 3 + 2] = (Math.random() - 0.5) * 3;
    }
    g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    return g;
  }, []);
  useFrame(({ clock }) => {
    const t = clock.getElapsedTime();
    if (beam.current) {
      beam.current.uniforms.uTime.value = t;
      beam.current.uniforms.uStrength.value = strength;
      beam.current.uniforms.uFade.value = fade;
    }
    if (spot.current) {
      spot.current.uniforms.uTime.value = t;
      spot.current.uniforms.uStrength.value = strength;
      spot.current.uniforms.uFade.value = 0.25 + 0.75 * fade;
    }
    if (fog.current) {
      fog.current.rotation.x = t * 0.02;
      (fog.current.material as THREE.PointsMaterial).opacity = Math.min(0.7, (1 - fade) * 0.9);
    }
  });
  const uniforms = useMemo(() => ({ uTime: { value: 0 }, uStrength: { value: 0 }, uColor: { value: color }, uFade: { value: 1 } }), []); // eslint-disable-line react-hooks/exhaustive-deps
  const spotUniforms = useMemo(() => ({ uTime: { value: 0 }, uStrength: { value: 0 }, uFade: { value: 1 } }), []);
  return (
    <>
      <ambientLight intensity={0.4} />
      <directionalLight position={[2, 5, 3]} intensity={0.8} />
      {/* transmitter telescope */}
      <mesh position={[-5.6, 0, 0]} rotation={[0, 0, Math.PI / 2]}>
        <cylinderGeometry args={[0.3, 0.3, 0.8, 32]} />
        <meshStandardMaterial color="#2b3040" metalness={0.6} roughness={0.3} />
      </mesh>
      {/* beam: a slowly widening cone along +x */}
      <mesh position={[0, 0, 0]} rotation={[0, 0, -Math.PI / 2]}>
        <cylinderGeometry args={[0.55, 0.16, 11, 48, 40, true]} />
        <shaderMaterial ref={beam} vertexShader={beamVert} fragmentShader={beamFrag} uniforms={uniforms} transparent depthWrite={false} blending={THREE.AdditiveBlending} side={THREE.DoubleSide} />
      </mesh>
      {/* receiver aperture */}
      <mesh position={[5.75, 0, 0]} rotation={[0, -Math.PI / 2, 0]}>
        <planeGeometry args={[1.5, 1.5]} />
        <shaderMaterial ref={spot} vertexShader={beamVert} fragmentShader={spotFrag} uniforms={spotUniforms} transparent toneMapped={false} />
      </mesh>
      <mesh position={[5.9, 0, 0]} rotation={[0, 0, Math.PI / 2]}>
        <cylinderGeometry args={[0.8, 0.8, 0.2, 32, 1, true]} />
        <meshStandardMaterial color="#2b3040" metalness={0.6} roughness={0.3} side={THREE.DoubleSide} />
      </mesh>
      <points ref={fog} geometry={fogGeo}>
        <pointsMaterial size={0.06} color="#b9c3d8" transparent opacity={0.2} depthWrite={false} />
      </points>
      <Html position={[-5.6, -0.7, 0]} center>
        <div className="scene-label">laser TX</div>
      </Html>
      <Html position={[5.8, -1.05, 0]} center>
        <div className="scene-label">aperture · speckle</div>
      </Html>
    </>
  );
}

export default function TurbulenceLab() {
  const [cn2Exp, setCn2] = useState(-14);
  const [Lkm, setL] = useState(1.5);
  const [nm, setNm] = useState<850 | 1550>(1550);
  const [vis, setVis] = useState(10);
  const Cn2 = Math.pow(10, cn2Exp);
  const s2 = rytovVariance(Cn2, nm, Lkm * 1000);
  const gg = gammaGammaParams(s2);
  const attDb = kimAttenuationDbPerKm(vis, nm) * Lkm;
  const samples = useMemo(() => gammaGammaSamples(gg.alpha, gg.beta, 4000, 9), [gg.alpha, gg.beta]);
  const thr = 0.3; // outage if irradiance < 30% of mean (≈ −5 dB fade)
  const outage = samples.filter((v) => v < thr).length / samples.length;
  const hist = useMemo(() => {
    const bins = 60;
    const max = 4;
    const h = new Array(bins).fill(0);
    samples.forEach((v) => {
      const b = Math.min(bins - 1, Math.floor((v / max) * bins));
      h[b]++;
    });
    return { x: h.map((_, i) => ((i + 0.5) * max) / bins), y: h.map((c) => c / samples.length / (max / bins)) };
  }, [samples]);
  const regime = s2 < 1 ? 'weak' : s2 < 10 ? 'moderate' : 'strong';
  const fade = Math.pow(10, -Math.min(attDb, 60) / 30);

  return (
    <Widget
      title="Free-space optics: fog, haze and twinkling air"
      eyebrow="3D · turbulence"
      controls={
        <>
          <GroupTitle>Path</GroupTitle>
          <Slider label="Link distance" value={Lkm} min={0.1} max={5} step={0.05} onChange={setL} format={(v) => `${v.toFixed(2)} km`} />
          <Segmented label="Wavelength" value={nm} onChange={setNm} options={[{ value: 850, label: '850 nm' }, { value: 1550, label: '1550 nm' }]} />
          <GroupTitle>Atmosphere</GroupTitle>
          <Slider label="Turbulence Cn²" value={cn2Exp} min={-17} max={-12} step={0.1} onChange={setCn2} format={(v) => `1e${v.toFixed(1)} m⁻²ᐟ³`} />
          <Slider label="Visibility" value={vis} min={0.05} max={50} log onChange={setVis} format={(v) => (v < 1 ? `${(v * 1000).toFixed(0)} m` : `${v.toFixed(1)} km`)} />
          <Readouts>
            <Readout k="Rytov σR²" v={`${sci(s2, 2)} · ${regime}`} />
            <Readout k="Scintillation σI²" v={sci(gg.scintillationIndex, 2)} />
            <Readout k="Weather loss" v={`${attDb.toFixed(1)} dB`} tone={attDb < 10 ? 'good' : attDb < 40 ? 'warn' : 'bad'} />
            <Readout k="P(fade > 5 dB)" v={`${(outage * 100).toFixed(1)} %`} tone={outage < 0.01 ? 'good' : outage < 0.1 ? 'warn' : 'bad'} />
          </Readouts>
        </>
      }
      caption={
        <p>
          Two separate effects. <strong>Attenuation</strong> from fog and haze is steady and set by visibility (Kim model): dense fog can cost hundreds of dB per km.
          <strong> Turbulence</strong> makes the received irradiance twinkle, like stars. Its strength along the path is the Rytov variance σ<sub>R</sub>² = 1.23 C<sub>n</sub>²
          k<sup>7/6</sup> L<sup>11/6</sup>, and the fluctuations follow a gamma-gamma distribution. Deep fades cause outages even in clear weather.
        </p>
      }
    >
      <Stage height={300} camera={[0, 2.4, 9.5]} bloom={1.2} target={[0, 0, 0]}>
        <Link strength={Math.min(1, Math.sqrt(gg.scintillationIndex))} fade={fade} nm={nm} />
      </Stage>
      <div className="grid-2">
        <Plot
          title="Received irradiance over time (I / ⟨I⟩)"
          height={180}
          y={[0, Math.max(3, Math.min(8, Math.max(...Array.from(samples.slice(0, 300)))))]}
          series={[{ y: Array.from(samples.slice(0, 300)), color: 'var(--c4)', width: 1.2 }]}
          hlines={[{ y: thr, label: '−5 dB fade', color: 'var(--bad)' }]}
        />
        <Plot
          title={`Histogram vs gamma-gamma (α=${gg.alpha.toFixed(1)}, β=${gg.beta.toFixed(1)})`}
          height={180}
          x={[0, 4]}
          xLabel="normalised irradiance"
          series={[{ x: hist.x, y: hist.y, color: 'var(--c4)', kind: 'area', width: 1.6 }]}
          vlines={[{ x: 1, label: 'mean' }]}
        />
      </div>
    </Widget>
  );
}
