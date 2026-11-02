/**
 * Optical Bench ray tracer.
 *
 * Light transport combines two estimators so that both wide LED beams and µrad laser beams work:
 *  1. Next-event estimation (NEE): at the source and at every diffuse event (wall bounce, scattering in
 *     water or fog, transmission through a diffuser) the exact contribution to each receiver is added
 *     analytically, with a shadow test that blocks on opaque objects and attenuates through filters,
 *     polarizers and splitters. This is the textbook Lambertian channel model generalised to any scene.
 *  2. Monte Carlo rays: rays sampled from each source's emission pattern are followed through mirrors,
 *     curved mirrors, lenses, prisms, retroreflectors, RIS panels and splitters. A ray that reaches a
 *     receiver after at least one such specular optic since its last diffuse event is counted (paths
 *     that NEE cannot see), so nothing is double-counted.
 * Each contribution keeps its path delay, giving a per-receiver impulse response.
 */
import type { BenchObject, Environment, Vec3 } from './types';
import { catalog } from './catalog';
import type { Scenario } from './scenarios';
import { filterT, glassIndex, MATERIALS, mediumAt, responsivity, SPECTRUM_BINS, type Bin, type Material, type MediumOptics } from './optics';

// ---------------------------------------------------------------- vector helpers
export const add = (a: Vec3, b: Vec3): Vec3 => [a[0] + b[0], a[1] + b[1], a[2] + b[2]];
export const sub = (a: Vec3, b: Vec3): Vec3 => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
export const mul = (a: Vec3, s: number): Vec3 => [a[0] * s, a[1] * s, a[2] * s];
export const dot = (a: Vec3, b: Vec3) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
export const cross = (a: Vec3, b: Vec3): Vec3 => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
export const len = (a: Vec3) => Math.hypot(a[0], a[1], a[2]);
export const norm = (a: Vec3): Vec3 => {
  const l = len(a) || 1;
  return [a[0] / l, a[1] / l, a[2] / l];
};
const reflect = (d: Vec3, n: Vec3): Vec3 => sub(d, mul(n, 2 * dot(d, n)));
const D2R = Math.PI / 180;

/** Facing direction from yaw/pitch in degrees (yaw 0 → +Z, pitch −90 → down). */
export function facing(yaw: number, pitch: number): Vec3 {
  const y = yaw * D2R;
  const p = pitch * D2R;
  return [Math.cos(p) * Math.sin(y), Math.sin(p), Math.cos(p) * Math.cos(y)];
}
/** Yaw/pitch (degrees) that face direction d. */
export function yawPitchOf(d: Vec3): { yaw: number; pitch: number } {
  const n = norm(d);
  return { yaw: Math.atan2(n[0], n[2]) / D2R, pitch: Math.asin(Math.max(-1, Math.min(1, n[1]))) / D2R };
}
/** Local → world rotation (Ry(yaw)·Rx(−pitch)), matching three.js Euler order 'YXZ'. */
export function rotate(o: { yaw: number; pitch: number }, l: Vec3): Vec3 {
  const y = o.yaw * D2R;
  const t = -o.pitch * D2R;
  const x1 = l[0];
  const y1 = l[1] * Math.cos(t) - l[2] * Math.sin(t);
  const z1 = l[1] * Math.sin(t) + l[2] * Math.cos(t);
  return [x1 * Math.cos(y) + z1 * Math.sin(y), y1, -x1 * Math.sin(y) + z1 * Math.cos(y)];
}
function basis(n: Vec3): [Vec3, Vec3] {
  const a: Vec3 = Math.abs(n[1]) < 0.95 ? [0, 1, 0] : [1, 0, 0];
  const u = norm(cross(a, n));
  return [u, cross(n, u)];
}

// ---------------------------------------------------------------- random numbers
function mulberry(seed: number) {
  let s = seed >>> 0;
  return () => {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// ---------------------------------------------------------------- scene description
type Behaviour =
  | { t: 'absorb' }
  | { t: 'material'; m: Material }
  | { t: 'mirror'; R: number }
  | { t: 'thinlens'; f: number; eff: number }
  | { t: 'retro'; eff: number; spread: number }
  | { t: 'diffuser'; sigma: number; eff: number }
  | { t: 'polarizer'; angle: number }
  | { t: 'filter'; center: number; width: number; T: number }
  | { t: 'splitter'; ratio: number }
  | { t: 'ris'; target: Vec3 | null; eff: number; spread: number }
  | { t: 'refract'; glass: string };

interface SurfBase {
  obj: string;
  beh: Behaviour;
  front?: boolean; // only the +n side interacts (mirrors, RIS, retro)
}
type Surf =
  | (SurfBase & { shape: 'rect'; c: Vec3; n: Vec3; u: Vec3; v: Vec3; hu: number; hv: number })
  | (SurfBase & { shape: 'disk'; c: Vec3; n: Vec3; r: number })
  | (SurfBase & { shape: 'cap'; vtx: Vec3; axis: Vec3; R: number; ap: number; concave: boolean })
  | (SurfBase & { shape: 'cyl'; base: Vec3; r: number; h: number })
  | (SurfBase & { shape: 'box'; c: Vec3; ax: [Vec3, Vec3, Vec3]; half: Vec3 })
  | (SurfBase & { shape: 'poly'; planes: { n: Vec3; d: number }[] });

interface Hit {
  t: number;
  p: Vec3;
  n: Vec3; // geometric normal (outward for solids)
  s: Surf;
}

export interface SourceDef {
  id: string;
  name: string;
  pos: Vec3;
  n: Vec3;
  power: number;
  m: number; // Lambertian order (if lambertian)
  gaussW: number; // 1/e² half-angle [rad] (if laser)
  laser: boolean;
  bins: Bin[];
  polarized: boolean;
  bwMHz: number;
  kind: string;
}

export interface ReceiverDef {
  id: string;
  name: string;
  kind: string;
  pos: Vec3;
  n: Vec3;
  area: number; // m²
  fov: number; // rad
  gmax: number;
  gain: (psi: number) => number;
  filter: string;
  props: BenchObject['props'];
}

export interface Contribution {
  src: number;
  delay: number;
  gain: number; // fraction of that source's power, already × filter (per bin summed)
  current: number; // A per W of source power (gain × filter × responsivity)
  path: 'los' | 'diffuse' | 'scatter' | 'optics';
}

export interface RayPath {
  pts: Vec3[];
  nm: number;
  w: number; // relative strength 0..1
  hit: boolean;
}

export interface ReceiverResult {
  rx: ReceiverDef;
  perSource: { gain: number; current: number; los: number; diffuse: number; scatter: number; optics: number; losVisible: boolean; inFov: boolean }[];
  contribs: Contribution[];
}

export interface TraceResult {
  sources: SourceDef[];
  receivers: ReceiverResult[];
  rays: RayPath[];
  losLinks: { from: Vec3; to: Vec3; gain: number; blocked: boolean; src: number; rx: number }[];
  stats: { rays: number; ms: number; surfaces: number };
}

// ---------------------------------------------------------------- receivers & sources from objects
export function concentratorGain(kind: string, fovRad: number): { gmax: number; g: (psi: number) => number } {
  const s2 = Math.max(1e-8, Math.sin(Math.min(fovRad, Math.PI / 2)) ** 2);
  switch (kind) {
    case 'cpc': {
      const gm = Math.min(1e6, (1.5 * 1.5) / s2);
      return { gmax: gm, g: (psi) => (psi <= fovRad ? gm : 0) };
    }
    case 'lens': {
      const gm = Math.min(1e6, 0.9 / s2);
      return { gmax: gm, g: (psi) => (psi <= fovRad ? gm : 0) };
    }
    case 'hemi':
      return { gmax: 2.25, g: (psi) => (psi <= fovRad ? 2.25 : 0) };
    default:
      return { gmax: 1, g: (psi) => (psi <= fovRad ? 1 : 0) };
  }
}

const num = (o: BenchObject, k: string, d = 0) => (typeof o.props[k] === 'number' ? (o.props[k] as number) : d);
const str = (o: BenchObject, k: string, d = '') => (typeof o.props[k] === 'string' ? (o.props[k] as string) : d);

export function sourceOf(o: BenchObject): SourceDef {
  const isLaser = o.kind === 'laser' || o.kind === 'vcsel';
  const semi = Math.max(1, num(o, 'semi', 60));
  const m = -Math.log(2) / Math.log(Math.cos(semi * D2R));
  return {
    id: o.id,
    name: o.name,
    kind: o.kind,
    pos: o.pos,
    n: facing(o.yaw, o.pitch),
    power: Math.max(0, num(o, 'power', 1)),
    m,
    gaussW: (num(o, 'div', 2) * 1e-3) / 2,
    laser: isLaser,
    bins: SPECTRUM_BINS[str(o, 'spectrum', 'white')] ?? SPECTRUM_BINS.white,
    polarized: isLaser,
    bwMHz: num(o, 'bw', 5),
  };
}

export function receiverOf(o: BenchObject): ReceiverDef {
  const fov = Math.max(0.05, num(o, 'fov', 60)) * D2R;
  const conc = concentratorGain(str(o, 'concentrator', 'none'), fov);
  const area = o.kind === 'camera' ? 2e-5 : Math.max(1e-9, num(o, 'area', 1) * 1e-6);
  return { id: o.id, name: o.name, kind: o.kind, pos: o.pos, n: facing(o.yaw, o.pitch), area, fov, gmax: conc.gmax, gain: conc.g, filter: str(o, 'filter', 'none'), props: o.props };
}

/** Intensity pattern I(θ)/P [1/sr] towards direction d. */
export function pattern(s: SourceDef, d: Vec3): number {
  const c = dot(s.n, d);
  if (c <= 0) return 0;
  if (s.laser) {
    const th = Math.acos(Math.min(1, c));
    const w = Math.max(1e-7, s.gaussW);
    return (2 / (Math.PI * w * w)) * Math.exp((-2 * th * th) / (w * w));
  }
  return ((s.m + 1) / (2 * Math.PI)) * Math.pow(c, s.m);
}

function sampleSourceDir(s: SourceDef, r: () => number): Vec3 {
  const [u, v] = basis(s.n);
  let th: number;
  if (s.laser) th = s.gaussW * Math.sqrt(-Math.log(Math.max(1e-12, r())) / 2);
  else th = Math.acos(Math.pow(r(), 1 / (s.m + 1)));
  const ph = r() * 2 * Math.PI;
  const st = Math.sin(th);
  return norm(add(add(mul(s.n, Math.cos(th)), mul(u, st * Math.cos(ph))), mul(v, st * Math.sin(ph))));
}

// ---------------------------------------------------------------- build surfaces
export function buildSurfaces(objects: BenchObject[], sc: Scenario, env: Environment): Surf[] {
  const S: Surf[] = [];
  const mat = (id: string) => MATERIALS[id] ?? MATERIALS.plaster;
  if (sc.room && (sc.kind === 'indoor' || sc.kind === 'lab')) {
    const { L, W, H } = sc.room;
    const room = (obj: string, c: Vec3, n: Vec3, u: Vec3, v: Vec3, hu: number, hv: number, m: string) =>
      S.push({ shape: 'rect', obj, c, n, u, v, hu, hv, beh: { t: 'material', m: mat(m) } });
    room('floor', [0, 0, 0], [0, 1, 0], [1, 0, 0], [0, 0, 1], L / 2, W / 2, env.floorMaterial);
    room('ceiling', [0, H, 0], [0, -1, 0], [1, 0, 0], [0, 0, 1], L / 2, W / 2, env.ceilingMaterial);
    room('wall-x-', [-L / 2, H / 2, 0], [1, 0, 0], [0, 0, 1], [0, 1, 0], W / 2, H / 2, env.wallMaterial);
    room('wall-x+', [L / 2, H / 2, 0], [-1, 0, 0], [0, 0, 1], [0, 1, 0], W / 2, H / 2, env.wallMaterial);
    room('wall-z-', [0, H / 2, -W / 2], [0, 0, 1], [1, 0, 0], [0, 1, 0], L / 2, H / 2, env.wallMaterial);
    room('wall-z+', [0, H / 2, W / 2], [0, 0, -1], [1, 0, 0], [0, 1, 0], L / 2, H / 2, env.wallMaterial);
  } else if (sc.kind === 'outdoor' || sc.kind === 'underwater') {
    const big = 5000;
    S.push({ shape: 'rect', obj: 'ground', c: [0, 0, 0], n: [0, 1, 0], u: [1, 0, 0], v: [0, 0, 1], hu: big, hv: big, beh: { t: 'material', m: mat(sc.kind === 'underwater' ? 'sand' : 'asphalt') } });
  }
  for (const o of objects) {
    const R = (l: Vec3) => rotate(o, l);
    const P = (l: Vec3) => add(o.pos, R(l));
    const size = num(o, 'size', 0.1);
    const n = facing(o.yaw, o.pitch);
    const u = R([1, 0, 0]);
    const v = R([0, 1, 0]);
    switch (o.kind) {
      case 'mirror':
        S.push({ shape: 'rect', obj: o.id, c: o.pos, n, u, v, hu: size / 2, hv: size / 2, front: true, beh: { t: 'mirror', R: num(o, 'refl', 0.95) } });
        break;
      case 'concave':
      case 'convex':
        S.push({ shape: 'cap', obj: o.id, vtx: o.pos, axis: n, R: 2 * num(o, 'focal', 0.5), ap: size / 2, concave: o.kind === 'concave', front: true, beh: { t: 'mirror', R: num(o, 'refl', 0.95) } });
        break;
      case 'retro':
        S.push({ shape: 'rect', obj: o.id, c: o.pos, n, u, v, hu: size / 2, hv: size / 2, front: true, beh: { t: 'retro', eff: num(o, 'eff', 0.6), spread: num(o, 'spread', 1) * D2R } });
        break;
      case 'ris': {
        const tgt = objects.find((x) => x.id === str(o, 'target'));
        S.push({ shape: 'rect', obj: o.id, c: o.pos, n, u, v, hu: size / 2, hv: size / 2, front: true, beh: { t: 'ris', target: tgt ? tgt.pos : null, eff: num(o, 'eff', 0.8), spread: 2 * D2R } });
        break;
      }
      case 'lens':
      case 'lensNeg':
      case 'fresnel':
        S.push({ shape: 'disk', obj: o.id, c: o.pos, n, r: size / 2, beh: { t: 'thinlens', f: (o.kind === 'lensNeg' ? -1 : 1) * num(o, 'focal', 0.2), eff: o.kind === 'fresnel' ? num(o, 'eff', 0.88) : 0.96 } });
        break;
      case 'diffuser':
        S.push({ shape: 'disk', obj: o.id, c: o.pos, n, r: size / 2, beh: { t: 'diffuser', sigma: num(o, 'angle', 20) * D2R, eff: num(o, 'eff', 0.9) } });
        break;
      case 'polarizer':
        S.push({ shape: 'disk', obj: o.id, c: o.pos, n, r: size / 2, beh: { t: 'polarizer', angle: num(o, 'angle', 0) } });
        break;
      case 'filter':
        S.push({ shape: 'disk', obj: o.id, c: o.pos, n, r: size / 2, beh: { t: 'filter', center: num(o, 'center', 450), width: num(o, 'width', 40), T: num(o, 'T', 0.9) } });
        break;
      case 'splitter':
        S.push({ shape: 'rect', obj: o.id, c: o.pos, n, u, v, hu: size / 2, hv: size / 2, beh: { t: 'splitter', ratio: num(o, 'ratio', 0.5) } });
        break;
      case 'prism': {
        const r = size / Math.sqrt(3);
        const verts = [90, 210, 330].map((a) => [r * Math.cos(a * D2R), r * Math.sin(a * D2R)]);
        const planes: { n: Vec3; d: number }[] = [];
        for (let i = 0; i < 3; i++) {
          const [x0, z0] = verts[i];
          const [x1, z1] = verts[(i + 1) % 3];
          const nl = norm([z1 - z0, 0, -(x1 - x0)]); // outward for CCW order
          const nw = R(nl);
          planes.push({ n: nw, d: dot(nw, P([x0, 0, z0])) });
        }
        planes.push({ n: v, d: dot(v, P([0, size / 2, 0])) });
        planes.push({ n: mul(v, -1), d: dot(mul(v, -1), P([0, -size / 2, 0])) });
        S.push({ shape: 'poly', obj: o.id, planes, beh: { t: 'refract', glass: str(o, 'glass', 'bk7') } });
        break;
      }
      case 'wall':
        S.push({ shape: 'rect', obj: o.id, c: P([0, num(o, 'h', 2.4) / 2, 0]), n, u, v: [0, 1, 0], hu: num(o, 'w', 2) / 2, hv: num(o, 'h', 2.4) / 2, beh: { t: 'material', m: mat(str(o, 'material', 'plaster')) } });
        break;
      case 'box':
        S.push({ shape: 'box', obj: o.id, c: P([0, num(o, 'h', 0.75) / 2, 0]), ax: [u, [0, 1, 0], R([0, 0, 1])], half: [num(o, 'w', 1) / 2, num(o, 'h', 0.75) / 2, num(o, 'd', 0.6) / 2], beh: { t: 'material', m: mat(str(o, 'material', 'wood')) } });
        break;
      case 'car':
        S.push({ shape: 'box', obj: o.id, c: P([0, 0.72, 0]), ax: [u, [0, 1, 0], R([0, 0, 1])], half: [0.88, 0.62, 2.2], beh: { t: 'material', m: MATERIALS.carbody } });
        break;
      case 'person':
        S.push({ shape: 'cyl', obj: o.id, base: o.pos, r: 0.22, h: num(o, 'height', 1.75), beh: { t: 'material', m: MATERIALS.skin } });
        break;
    }
  }
  return S;
}

// ---------------------------------------------------------------- intersections
const EPS = 1e-6;
function intersect(o: Vec3, d: Vec3, s: Surf): { t: number; n: Vec3 } | null {
  switch (s.shape) {
    case 'rect':
    case 'disk': {
      const dn = dot(d, s.n);
      if (Math.abs(dn) < 1e-12) return null;
      const t = dot(sub(s.c, o), s.n) / dn;
      if (t <= EPS) return null;
      const p = add(o, mul(d, t));
      const q = sub(p, s.c);
      if (s.shape === 'rect') {
        if (Math.abs(dot(q, s.u)) > s.hu || Math.abs(dot(q, s.v)) > s.hv) return null;
      } else if (dot(q, q) > s.r * s.r) return null;
      return { t, n: s.n };
    }
    case 'cap': {
      const C = add(s.vtx, mul(s.axis, s.concave ? s.R : -s.R));
      const oc = sub(o, C);
      const b = dot(oc, d);
      const c = dot(oc, oc) - s.R * s.R;
      const disc = b * b - c;
      if (disc < 0) return null;
      const sq = Math.sqrt(disc);
      for (const t of [-b - sq, -b + sq]) {
        if (t <= EPS) continue;
        const p = add(o, mul(d, t));
        const q = sub(p, s.vtx);
        const perp = sub(q, mul(s.axis, dot(q, s.axis)));
        if (dot(perp, perp) > s.ap * s.ap) continue;
        if (dot(sub(p, C), sub(s.vtx, C)) <= 0) continue;
        // normal facing the light side (towards the front, i.e. +axis side of the vertex)
        const nOut = s.concave ? norm(sub(C, p)) : norm(sub(p, C));
        return { t, n: nOut };
      }
      return null;
    }
    case 'cyl': {
      const ox = o[0] - s.base[0];
      const oz = o[2] - s.base[2];
      const a = d[0] * d[0] + d[2] * d[2];
      if (a < 1e-12) return null;
      const b = ox * d[0] + oz * d[2];
      const c = ox * ox + oz * oz - s.r * s.r;
      const disc = b * b - a * c;
      if (disc < 0) return null;
      const sq = Math.sqrt(disc);
      for (const t of [(-b - sq) / a, (-b + sq) / a]) {
        if (t <= EPS) continue;
        const y = o[1] + d[1] * t;
        if (y < s.base[1] || y > s.base[1] + s.h) continue;
        const px = ox + d[0] * t;
        const pz = oz + d[2] * t;
        return { t, n: norm([px, 0, pz]) };
      }
      return null;
    }
    case 'box': {
      let tmin = -Infinity;
      let tmax = Infinity;
      let nmin: Vec3 = [0, 1, 0];
      let nmax: Vec3 = [0, 1, 0];
      const rel = sub(s.c, o);
      for (let i = 0; i < 3; i++) {
        const ax = s.ax[i];
        const e = dot(ax, rel);
        const f = dot(ax, d);
        if (Math.abs(f) > 1e-12) {
          let t1 = (e + s.half[i]) / f;
          let t2 = (e - s.half[i]) / f;
          let n1 = mul(ax, -1);
          let n2 = ax;
          if (t1 > t2) {
            [t1, t2] = [t2, t1];
            [n1, n2] = [n2, n1];
          }
          if (t1 > tmin) {
            tmin = t1;
            nmin = n1;
          }
          if (t2 < tmax) {
            tmax = t2;
            nmax = n2;
          }
          if (tmin > tmax || tmax < EPS) return null;
        } else if (-e - s.half[i] > 0 || -e + s.half[i] < 0) return null;
      }
      if (tmin > EPS) return { t: tmin, n: nmin };
      if (tmax > EPS) return { t: tmax, n: mul(nmax, 1) };
      return null;
    }
    case 'poly': {
      let tE = -Infinity;
      let tX = Infinity;
      let nE: Vec3 = [0, 1, 0];
      let nX: Vec3 = [0, 1, 0];
      for (const pl of s.planes) {
        const dn = dot(pl.n, d);
        const dist = pl.d - dot(pl.n, o);
        if (Math.abs(dn) < 1e-12) {
          if (dist < 0) return null;
          continue;
        }
        const t = dist / dn;
        if (dn < 0) {
          if (t > tE) {
            tE = t;
            nE = pl.n;
          }
        } else if (t < tX) {
          tX = t;
          nX = pl.n;
        }
      }
      if (tE > tX) return null;
      if (tE > EPS) return { t: tE, n: nE };
      if (tX > EPS) return { t: tX, n: nX };
      return null;
    }
  }
}

function nearest(o: Vec3, d: Vec3, S: Surf[], skip?: string, maxT = Infinity): Hit | null {
  let best: Hit | null = null;
  for (const s of S) {
    if (skip && s.obj === skip) continue;
    const h = intersect(o, d, s);
    if (h && h.t < (best?.t ?? maxT)) best = { t: h.t, p: add(o, mul(d, h.t)), n: h.n, s };
  }
  return best;
}

/**
 * Transmission along a straight segment a→b for wavelength nm, or 0 if blocked.
 * Filters, polarizers and splitters attenuate; everything else blocks.
 */
function segmentT(a: Vec3, b: Vec3, S: Surf[], nm: number, polarized: boolean, ignore: string[]): number {
  const dvec = sub(b, a);
  const L = len(dvec);
  if (L < 1e-9) return 1;
  const d = mul(dvec, 1 / L);
  const hits: { t: number; s: Surf }[] = [];
  for (const s of S) {
    if (ignore.includes(s.obj)) continue;
    const h = intersect(a, d, s);
    if (h && h.t < L * (1 - 1e-7)) hits.push({ t: h.t, s });
  }
  if (!hits.length) return 1;
  hits.sort((x, y) => x.t - y.t);
  let T = 1;
  let pol: number | null = polarized ? 0 : null;
  for (const { s } of hits) {
    const b2 = s.beh;
    if (b2.t === 'filter') T *= filterT('custom', nm, b2.center, b2.width) * (b2.T / 0.9);
    else if (b2.t === 'polarizer') {
      if (pol === null) T *= 0.5;
      else T *= Math.cos((b2.angle - pol) * D2R) ** 2;
      pol = b2.angle;
    } else if (b2.t === 'splitter') T *= 1 - b2.ratio;
    else return 0;
    if (T < 1e-12) return 0;
  }
  return T;
}

// ---------------------------------------------------------------- phase functions and sampling
function hgPdf(g: number, cos: number) {
  return (1 - g * g) / (4 * Math.PI * Math.pow(1 + g * g - 2 * g * cos, 1.5));
}
function hgSample(g: number, d: Vec3, r: () => number): Vec3 {
  const u = r();
  const mu = Math.abs(g) < 1e-3 ? 2 * u - 1 : (1 + g * g - ((1 - g * g) / (1 - g + 2 * g * u)) ** 2) / (2 * g);
  const st = Math.sqrt(Math.max(0, 1 - mu * mu));
  const ph = r() * 2 * Math.PI;
  const [a, b] = basis(d);
  return norm(add(add(mul(d, mu), mul(a, st * Math.cos(ph))), mul(b, st * Math.sin(ph))));
}
function cosineSample(n: Vec3, r: () => number): Vec3 {
  const u1 = r();
  const ph = r() * 2 * Math.PI;
  const st = Math.sqrt(u1);
  const [a, b] = basis(n);
  return norm(add(add(mul(n, Math.sqrt(1 - u1)), mul(a, st * Math.cos(ph))), mul(b, st * Math.sin(ph))));
}
function lobeSample(axis: Vec3, sigma: number, r: () => number): Vec3 {
  if (sigma > 1.0) return cosineSample(axis, r);
  const th = sigma * Math.sqrt(-2 * Math.log(Math.max(1e-12, r())));
  const ph = r() * 2 * Math.PI;
  const [a, b] = basis(axis);
  return norm(add(add(mul(axis, Math.cos(th)), mul(a, Math.sin(th) * Math.cos(ph))), mul(b, Math.sin(th) * Math.sin(ph))));
}
function lobePdf(axis: Vec3, sigma: number, d: Vec3) {
  const c = dot(axis, d);
  if (c <= 0) return 0;
  if (sigma > 1.0) return c / Math.PI;
  const th = Math.acos(Math.min(1, c));
  return Math.exp((-th * th) / (2 * sigma * sigma)) / (2 * Math.PI * sigma * sigma);
}

// ---------------------------------------------------------------- main tracer
export interface TraceOptions {
  rays: number;
  maxBounces: number;
  recordRays: number;
  seed: number;
}

export function trace(objects: BenchObject[], sc: Scenario, env: Environment, opt: TraceOptions): TraceResult {
  const t0 = typeof performance !== 'undefined' ? performance.now() : 0;
  const S = buildSurfaces(objects, sc, env);
  const sources = objects.filter((o) => catalog(o.kind).category === 'source').map(sourceOf);
  const rxDefs = objects.filter((o) => catalog(o.kind).category === 'receiver').map(receiverOf);
  const cvel = 299792458;
  const rnd = mulberry(opt.seed);
  const mediumCache = new Map<number, MediumOptics>();
  const med = (nm: number) => {
    let m = mediumCache.get(nm);
    if (!m) mediumCache.set(nm, (m = mediumAt(env, nm)));
    return m;
  };
  const results: ReceiverResult[] = rxDefs.map((rx) => ({
    rx,
    perSource: sources.map(() => ({ gain: 0, current: 0, los: 0, diffuse: 0, scatter: 0, optics: 0, losVisible: false, inFov: false })),
    contribs: [],
  }));
  const respCache = new Map<string, number>();
  const resp = (rx: ReceiverDef, nm: number) => {
    const k = rx.id + nm;
    let v = respCache.get(k);
    if (v === undefined) {
      v = responsivity(rx.kind, nm, typeof rx.props.pde === 'number' ? (rx.props.pde as number) : 0.3) * filterT(rx.filter, nm);
      respCache.set(k, v);
    }
    return v;
  };

  const record = (ri: number, si: number, gain: number, current: number, delay: number, path: Contribution['path']) => {
    if (!(gain > 0)) return;
    const r = results[ri];
    const ps = r.perSource[si];
    ps.gain += gain;
    ps.current += current;
    ps[path] += gain;
    if (r.contribs.length < 60000) r.contribs.push({ src: si, delay, gain, current, path });
  };

  /** NEE: add the direct contribution from point p (emitting with directional density f(d) [1/sr]) to every receiver. */
  const nee = (p: Vec3, si: number, nm: number, weight: number, f: (d: Vec3) => number, pathLen: number, kind: Contribution['path'], ignore: string[], polarized: boolean) => {
    const m = med(nm);
    results.forEach((r, ri) => {
      const rx = r.rx;
      const dv = sub(rx.pos, p);
      const dist = len(dv);
      if (dist < 1e-6) return;
      const d = mul(dv, 1 / dist);
      const cosPsi = -dot(d, rx.n);
      if (cosPsi <= 0) return;
      const psi = Math.acos(Math.min(1, cosPsi));
      const g = rx.gain(psi);
      if (g <= 0) return;
      const fd = f(d);
      if (fd <= 0) return;
      const T = segmentT(p, rx.pos, S, nm, polarized, [...ignore, rx.id]);
      if (T <= 0) return;
      const att = m.c > 0 ? Math.exp(-m.c * dist) : 1;
      const H = weight * fd * ((rx.area * cosPsi) / (dist * dist)) * g * T * att;
      record(ri, si, H, H * resp(rx, nm), ((pathLen + dist) * m.nIndex) / cvel, kind);
    });
    neeViaMirrors(p, si, nm, weight, f, pathLen, ignore, polarized);
  };

  /**
   * First-order image method through every flat mirror and splitter: exact for planar reflectors, so
   * small detectors still see mirror paths without relying on lucky Monte Carlo rays.
   */
  const flats = S.filter((s): s is Extract<Surf, { shape: 'rect' }> => s.shape === 'rect' && (s.beh.t === 'mirror' || s.beh.t === 'splitter'));
  const neeViaMirrors = (p: Vec3, si: number, nm: number, weight: number, f: (d: Vec3) => number, pathLen: number, ignore: string[], polarized: boolean) => {
    if (!flats.length) return;
    const m = med(nm);
    results.forEach((r, ri) => {
      const rx = r.rx;
      for (const ms of flats) {
        if (ignore.includes(ms.obj)) continue;
        const sp = dot(sub(p, ms.c), ms.n);
        const sr = dot(sub(rx.pos, ms.c), ms.n);
        if (sp * sr <= 0 || (ms.front && sp <= 0)) continue;
        // the reflection point divides p → image(rx) in the ratio sp : sr
        const img = sub(rx.pos, mul(ms.n, 2 * sr));
        const mpt = add(p, mul(sub(img, p), sp / (sp + sr)));
        const q = sub(mpt, ms.c);
        if (Math.abs(dot(q, ms.u)) > ms.hu || Math.abs(dot(q, ms.v)) > ms.hv) continue;
        const L1 = len(sub(mpt, p));
        const L2 = len(sub(rx.pos, mpt));
        if (L1 < 1e-6 || L2 < 1e-6) continue;
        const dIn = mul(sub(rx.pos, mpt), 1 / L2);
        const cosPsi = -dot(dIn, rx.n);
        if (cosPsi <= 0) continue;
        const g = rx.gain(Math.acos(Math.min(1, cosPsi)));
        if (g <= 0) continue;
        const fd = f(mul(sub(mpt, p), 1 / L1));
        if (fd <= 0) continue;
        const T1 = segmentT(p, mpt, S, nm, polarized, [...ignore, ms.obj]);
        if (T1 <= 0) continue;
        const T2 = segmentT(mpt, rx.pos, S, nm, polarized, [ms.obj, rx.id]);
        if (T2 <= 0) continue;
        const R = ms.beh.t === 'mirror' ? ms.beh.R : (ms.beh as { ratio: number }).ratio;
        const L = L1 + L2;
        const att = m.c > 0 ? Math.exp(-m.c * L) : 1;
        const H = weight * fd * ((rx.area * cosPsi) / (L * L)) * g * T1 * T2 * R * att;
        record(ri, si, H, H * resp(rx, nm), ((pathLen + L) * m.nIndex) / cvel, 'optics');
      }
    });
  };

  // ---- 1. direct (LOS) next-event estimation from each source
  sources.forEach((s, si) => {
    for (const bin of s.bins) {
      nee(s.pos, si, bin.nm, bin.frac, (d) => pattern(s, d), 0, 'los', [s.id], s.polarized);
    }
    results.forEach((r, ri) => {
      const ps = r.perSource[si];
      ps.losVisible = ps.los > 0;
      const d = norm(sub(r.rx.pos, s.pos));
      ps.inFov = Math.acos(Math.min(1, -dot(d, r.rx.n))) <= r.rx.fov;
      void ri;
    });
  });

  // ---- 2. Monte Carlo rays
  const rays: RayPath[] = [];
  const capture = rxDefs.map((rx) => Math.sqrt((rx.area * rx.gmax) / Math.PI));
  const nPer = sources.length ? Math.max(200, Math.floor(opt.rays / sources.length)) : 0;
  sources.forEach((s, si) => {
    const binCdf: number[] = [];
    s.bins.reduce((acc, b) => (binCdf.push(acc + b.frac), acc + b.frac), 0);
    for (let k = 0; k < nPer; k++) {
      const u = rnd() * binCdf[binCdf.length - 1];
      const bin = s.bins[binCdf.findIndex((c) => u <= c)] ?? s.bins[0];
      const nm = bin.nm;
      const m = med(nm);
      let o = s.pos;
      let d = sampleSourceDir(s, rnd);
      let w = 1 / nPer; // fraction of source power carried (all bins together sum to 1)
      let pathLen = 0;
      let viaOptic = false;
      // specular events since the last diffuse event; a lone flat-mirror bounce is already counted by
      // the image method in nee(), so such rays must not be counted again when they hit a receiver
      let specN = 0;
      let onlyFlat = true;
      let pol: number | null = s.polarized ? 0 : null;
      let inGlass = false;
      const pts: Vec3[] = [o];
      const rec = rays.length < opt.recordRays;
      let hitRx = false;
      for (let bounce = 0; bounce < opt.maxBounces + 4; bounce++) {
        // receivers' capture disks
        let rxHit: { t: number; ri: number } | null = null;
        if (viaOptic) {
          rxDefs.forEach((rx, ri) => {
            const dn = dot(d, rx.n);
            if (dn >= 0) return;
            const t = dot(sub(rx.pos, o), rx.n) / dn;
            if (t <= EPS) return;
            const q = sub(add(o, mul(d, t)), rx.pos);
            if (dot(q, q) <= capture[ri] ** 2 && (!rxHit || t < rxHit.t)) rxHit = { t, ri };
          });
        }
        const h = nearest(o, d, S);
        const tSurf = h ? h.t : Infinity;
        // participating medium: scattering event?
        if (m.c > 0 && !inGlass) {
          const tFree = -Math.log(Math.max(1e-12, rnd())) / m.c;
          const limit = Math.min(tSurf, (rxHit as { t: number } | null)?.t ?? Infinity, 1e7);
          if (tFree < limit) {
            o = add(o, mul(d, tFree));
            pathLen += tFree;
            pts.push(o);
            w *= m.albedo;
            const dIn = d;
            nee(o, si, nm, w, (dd) => hgPdf(m.g, dot(dIn, dd)), pathLen, 'scatter', [], pol !== null);
            d = hgSample(m.g, d, rnd);
            viaOptic = false;
            specN = 0;
            onlyFlat = true;
            if (w < 1e-7 / nPer) break;
            continue;
          }
          if (!isFinite(limit)) break;
        }
        const rh = rxHit as { t: number; ri: number } | null;
        if (rh && rh.t < tSurf) {
          const rx = rxDefs[rh.ri];
          const p = add(o, mul(d, rh.t));
          pts.push(p);
          const cosPsi = -dot(d, rx.n);
          const psi = Math.acos(Math.min(1, cosPsi));
          const g = rx.gain(psi);
          if (g > 0 && !(specN === 1 && onlyFlat)) {
            // extinction is already accounted for by the sampled free paths
            const gain = w * (g / rx.gmax);
            record(rh.ri, si, gain, gain * resp(rx, nm), ((pathLen + rh.t) * m.nIndex) / cvel, 'optics');
            hitRx = true;
          }
          break;
        }
        if (!h) {
          pts.push(add(o, mul(d, Math.min(1e4, (sc.bounds.max[0] - sc.bounds.min[0]) * 2 + 10))));
          break;
        }
        const p = h.p;
        pts.push(p);
        pathLen += h.t;
        const beh = h.s.beh;
        const into = dot(d, h.n) < 0; // arriving from the side the normal points to
        if (h.s.front && !into && beh.t !== 'refract') break; // back of a mirror / RIS: absorbed
        const nf = into ? h.n : mul(h.n, -1); // normal facing the incoming ray
        let next: Vec3 | null = null;
        switch (beh.t) {
          case 'absorb':
            break;
          case 'material': {
            const mt = beh.m;
            const total = mt.rd + mt.rs;
            if (total <= 0) break;
            const dIn = d;
            const mirrorDir = reflect(dIn, nf);
            nee(
              p,
              si,
              nm,
              w,
              (dd) => {
                const c = dot(dd, nf);
                if (c <= 0) return 0;
                const ref = dot(dd, mirrorDir);
                return (mt.rd * c) / Math.PI + (mt.rs > 0 && ref > 0 ? (mt.rs * (mt.n + 2) * Math.pow(ref, mt.n) * c) / (2 * Math.PI) : 0);
              },
              pathLen,
              'diffuse',
              [h.s.obj],
              false,
            );
            w *= total;
            next = rnd() < mt.rd / total ? cosineSample(nf, rnd) : lobeSample(mirrorDir, Math.sqrt(2 / (mt.n + 2)), rnd);
            if (dot(next, nf) <= 0) next = cosineSample(nf, rnd);
            viaOptic = false;
            specN = 0;
            onlyFlat = true;
            pol = null;
            break;
          }
          case 'mirror':
            next = reflect(d, nf);
            w *= beh.R;
            viaOptic = true;
            specN++;
            if (h.s.shape !== 'rect') onlyFlat = false;
            break;
          case 'retro': {
            next = lobeSample(mul(d, -1), beh.spread, rnd);
            w *= beh.eff;
            viaOptic = true;
            specN++;
            onlyFlat = false;
            break;
          }
          case 'ris': {
            const tgt = beh.target ? norm(sub(beh.target, p)) : reflect(d, nf);
            next = dot(tgt, nf) > 0 ? lobeSample(tgt, beh.spread, rnd) : reflect(d, nf);
            w *= beh.eff;
            viaOptic = true;
            specN++;
            onlyFlat = false;
            break;
          }
          case 'thinlens': {
            const s0 = h.s as Surf & { c: Vec3; n: Vec3 };
            const axisN = s0.n;
            const sgn = dot(d, axisN) > 0 ? 1 : -1;
            const dn = Math.abs(dot(d, axisN));
            const slope = sub(mul(d, 1 / dn), mul(axisN, sgn));
            const hvec = sub(p, s0.c);
            const hp = sub(hvec, mul(axisN, dot(hvec, axisN)));
            const ns = sub(slope, mul(hp, 1 / beh.f));
            next = norm(add(mul(axisN, sgn), ns));
            w *= beh.eff;
            viaOptic = true;
            specN++;
            onlyFlat = false;
            break;
          }
          case 'diffuser': {
            const fwd = dot(d, h.n) > 0 ? h.n : mul(h.n, -1);
            const dIn = d;
            const sigma = beh.sigma;
            // transmitted lobe centred on the incoming direction, clipped to the forward side
            nee(p, si, nm, w * beh.eff, (dd) => (dot(dd, fwd) > 0 ? lobePdf(dIn, sigma, dd) : 0), pathLen, 'diffuse', [h.s.obj], false);
            next = lobeSample(dIn, sigma, rnd);
            if (dot(next, fwd) <= 0) next = dIn;
            w *= beh.eff;
            viaOptic = false;
            specN = 0;
            onlyFlat = true;
            pol = null;
            break;
          }
          case 'polarizer':
            w *= pol === null ? 0.5 : Math.cos((beh.angle - pol) * D2R) ** 2;
            pol = beh.angle;
            next = d;
            break;
          case 'filter':
            w *= filterT('custom', nm, beh.center, beh.width) * (beh.T / 0.9);
            next = d;
            break;
          case 'splitter':
            if (rnd() < beh.ratio) {
              next = reflect(d, nf);
              viaOptic = true;
              specN++;
            } else next = d;
            break;
          case 'refract': {
            const nGlass = glassIndex(beh.glass, nm);
            const n1 = inGlass ? nGlass : 1;
            const n2 = inGlass ? 1 : nGlass;
            const ni = inGlass ? mul(h.n, -1) : h.n; // h.n is outward
            const nn = dot(d, ni) < 0 ? ni : mul(ni, -1);
            const cosi = -dot(d, nn);
            const eta = n1 / n2;
            const k = 1 - eta * eta * (1 - cosi * cosi);
            if (k < 0) next = reflect(d, nn);
            else {
              next = norm(add(mul(d, eta), mul(nn, eta * cosi - Math.sqrt(k))));
              inGlass = !inGlass;
            }
            viaOptic = true;
            specN++;
            onlyFlat = false;
            break;
          }
        }
        if (!next) break;
        d = next;
        o = add(p, mul(d, 1e-6));
        if (w < 1e-6 / nPer) {
          if (rnd() < 0.5) break;
          w *= 2;
        }
      }
      if (rec) rays.push({ pts, nm, w: Math.min(1, w * nPer), hit: hitRx });
    }
  });

  const losLinks: TraceResult['losLinks'] = [];
  sources.forEach((s, si) =>
    results.forEach((r, ri) => {
      const ps = r.perSource[si];
      const blocked = !ps.losVisible && ps.inFov && pattern(s, norm(sub(r.rx.pos, s.pos))) > 0;
      if (ps.losVisible || blocked) losLinks.push({ from: s.pos, to: r.rx.pos, gain: ps.los, blocked, src: si, rx: ri });
    }),
  );

  const t1 = typeof performance !== 'undefined' ? performance.now() : 0;
  return { sources, receivers: results, rays, losLinks, stats: { rays: nPer * sources.length, ms: t1 - t0, surfaces: S.length } };
}

/**
 * Search the room surfaces for the best place to put a flat mirror that links source s to receiver r
 * (both must see the point, and it must be inside the source beam and the receiver FOV). Returns the
 * mirror position (slightly off the surface) and its facing (the bisector).
 */
export function findBouncePoint(objects: BenchObject[], sc: Scenario, env: Environment, srcId: string, rxId: string): { pos: Vec3; yaw: number; pitch: number; score: number } | null {
  const so = objects.find((o) => o.id === srcId);
  const ro = objects.find((o) => o.id === rxId);
  if (!so || !ro) return null;
  const S = buildSurfaces(objects, sc, env);
  const s = sourceOf(so);
  const rx = receiverOf(ro);
  let best: { pos: Vec3; n: Vec3; score: number } | null = null;
  const candidates: { p: Vec3; n: Vec3 }[] = [];
  for (const surf of S) {
    if (surf.shape !== 'rect' || surf.beh.t !== 'material') continue;
    const steps = 14;
    for (let i = 0; i <= steps; i++)
      for (let j = 0; j <= steps; j++) {
        const a = (i / steps - 0.5) * 2 * surf.hu * 0.95;
        const b = (j / steps - 0.5) * 2 * surf.hv * 0.95;
        const p = add(add(surf.c, mul(surf.u, a)), mul(surf.v, b));
        candidates.push({ p: add(p, mul(surf.n, 0.04)), n: surf.n });
        candidates.push({ p: add(p, mul(surf.n, -0.04)), n: mul(surf.n, -1) });
      }
  }
  for (const c of candidates) {
    const toS = sub(s.pos, c.p);
    const toR = sub(rx.pos, c.p);
    const dS = len(toS);
    const dR = len(toR);
    if (dS < 0.2 || dR < 0.2) continue;
    if (dot(toS, c.n) <= 0 || dot(toR, c.n) <= 0) continue;
    const I = pattern(s, mul(toS, -1 / dS));
    if (I <= 0) continue;
    const cosPsi = -dot(toR, rx.n) / dR; // angle between the receiver axis and the direction to the point
    if (cosPsi <= 0 || Math.acos(Math.min(1, cosPsi)) > rx.fov) continue;
    if (segmentT(c.p, s.pos, S, 550, false, [so.id]) <= 0 || segmentT(c.p, rx.pos, S, 550, false, [ro.id]) <= 0) continue;
    const score = (I * cosPsi) / ((dS + dR) * (dS + dR));
    if (!best || score > best.score) best = { pos: c.p, n: c.n, score };
  }
  if (!best) return null;
  const bis = norm(add(norm(sub(s.pos, best.pos)), norm(sub(rx.pos, best.pos))));
  const yp = yawPitchOf(bis);
  return { pos: best.pos, yaw: yp.yaw, pitch: yp.pitch, score: best.score };
}

/** Facing that points object at a target position. */
export function aimAt(from: Vec3, to: Vec3) {
  return yawPitchOf(sub(to, from));
}
/** Mirror facing that reflects light from a to b (bisector of the two directions). */
export function mirrorBetween(at: Vec3, a: Vec3, b: Vec3) {
  return yawPitchOf(add(norm(sub(a, at)), norm(sub(b, at))));
}

/**
 * Coverage map: received optical power [W] at an upward-facing detector (area 1 mm², FOV fov) on a
 * grid at height y, summed over all sources, LOS only, with shadows. Used for the floor heat-map.
 */
export function coverage(objects: BenchObject[], sc: Scenario, env: Environment, y: number, n = 44, fovDeg = 70): { grid: Float32Array; n: number; min: Vec3; max: Vec3; peak: number } {
  const S = buildSurfaces(objects, sc, env).filter((s) => s.obj !== 'floor' && s.obj !== 'ground');
  const sources = objects.filter((o) => catalog(o.kind).category === 'source').map(sourceOf);
  const lo = sc.bounds.min;
  const hi = sc.bounds.max;
  const grid = new Float32Array(n * n);
  const cosF = Math.cos(fovDeg * D2R);
  let peak = 0;
  for (let i = 0; i < n; i++)
    for (let j = 0; j < n; j++) {
      const p: Vec3 = [lo[0] + ((i + 0.5) / n) * (hi[0] - lo[0]), y, lo[2] + ((j + 0.5) / n) * (hi[2] - lo[2])];
      let P = 0;
      for (const s of sources) {
        const dv = sub(p, s.pos);
        const dist = len(dv);
        if (dist < 1e-3) continue;
        const d = mul(dv, 1 / dist);
        const cosPsi = -d[1];
        if (cosPsi < cosF) continue;
        const I = pattern(s, d);
        if (I <= 0) continue;
        const m = mediumAt(env, s.bins[0].nm);
        const T = segmentT(s.pos, p, S, s.bins[0].nm, s.polarized, [s.id]);
        if (T <= 0) continue;
        P += (s.power * I * 1e-6 * cosPsi * T * (m.c > 0 ? Math.exp(-m.c * dist) : 1)) / (dist * dist);
      }
      grid[j * n + i] = P;
      peak = Math.max(peak, P);
    }
  return { grid, n, min: lo, max: hi, peak };
}
