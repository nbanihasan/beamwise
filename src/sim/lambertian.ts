/**
 * Indoor optical wireless channel: Lambertian line-of-sight gain and first-order diffuse reflections.
 * References: Kahn & Barry, Proc. IEEE 1997; Komine & Nakagawa, IEEE TCE 2004; Barry et al., JSAC 1993.
 */
import { PHYS, rad } from './math';

export type Vec3 = [number, number, number];

const sub = (a: Vec3, b: Vec3): Vec3 => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
const dot = (a: Vec3, b: Vec3) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const norm = (a: Vec3) => Math.hypot(a[0], a[1], a[2]);

/** Lambertian order m = -ln 2 / ln cos(Φ½). Φ½ = 60° gives m = 1. */
export function lambertianOrder(semiAngleDeg: number): number {
  return -Math.LN2 / Math.log(Math.cos(rad(semiAngleDeg)));
}

/** Gain of an ideal non-imaging concentrator: g(ψ) = n² / sin²Ψc inside the FOV, else 0. */
export function concentratorGain(n: number, fovDeg: number): number {
  return (n * n) / Math.sin(rad(fovDeg)) ** 2;
}

export interface Emitter {
  pos: Vec3;
  normal: Vec3; // unit vector, direction of peak emission
  m: number; // Lambertian order
  power?: number; // optical power [W]
}

export interface Detector {
  pos: Vec3;
  normal: Vec3; // unit vector
  area: number; // physical detector area [m²]
  fovDeg: number; // half-angle field of view Ψc
  Ts?: number; // optical filter transmission
  n?: number; // concentrator refractive index (0 or undefined -> no concentrator)
}

export interface LosResult {
  H: number; // DC channel gain
  d: number; // distance [m]
  phiDeg: number; // irradiance (emission) angle
  psiDeg: number; // incidence angle
  delay: number; // propagation delay [s]
}

/** DC gain of the LOS link: H(0) = (m+1)A / (2π d²) cos^m(φ) Ts g(ψ) cos(ψ). */
export function losGain(tx: Emitter, rx: Detector): LosResult {
  const v = sub(rx.pos, tx.pos);
  const d = norm(v);
  const cosPhi = dot(v, tx.normal) / d;
  const cosPsi = -dot(v, rx.normal) / d;
  const psi = Math.acos(Math.min(1, Math.max(-1, cosPsi)));
  const phi = Math.acos(Math.min(1, Math.max(-1, cosPhi)));
  const res: LosResult = { H: 0, d, phiDeg: (phi * 180) / Math.PI, psiDeg: (psi * 180) / Math.PI, delay: d / PHYS.c };
  if (cosPhi <= 0 || cosPsi <= 0 || psi > rad(rx.fovDeg)) return res;
  const g = rx.n ? concentratorGain(rx.n, rx.fovDeg) : 1;
  const Ts = rx.Ts ?? 1;
  res.H = ((tx.m + 1) * rx.area) / (2 * Math.PI * d * d) * Math.pow(cosPhi, tx.m) * Ts * g * cosPsi;
  return res;
}

export interface Room {
  L: number; // x extent [m]
  W: number; // y extent [m]
  H: number; // z extent (ceiling height) [m]
}

/** The classic Komine & Nakagawa (2004) 5×5×3 m room with four LED luminaires. */
export const KOMINE_ROOM: Room = { L: 5, W: 5, H: 3 };
export const KOMINE_LEDS: Vec3[] = [
  [1.25, 1.25, 3],
  [1.25, 3.75, 3],
  [3.75, 1.25, 3],
  [3.75, 3.75, 3],
];

/**
 * Received optical power on a horizontal plane at height zRx, sampled on an nx×ny grid.
 * Returns row-major Float32Array (y major) of Pr in watts.
 */
export function powerGrid(
  room: Room,
  leds: Emitter[],
  rx: Omit<Detector, 'pos' | 'normal'>,
  zRx: number,
  nx = 41,
  ny = 41,
): { grid: Float32Array; min: number; max: number; mean: number } {
  const grid = new Float32Array(nx * ny);
  let min = Infinity;
  let max = -Infinity;
  let sum = 0;
  for (let j = 0; j < ny; j++) {
    for (let i = 0; i < nx; i++) {
      const pos: Vec3 = [(room.L * i) / (nx - 1), (room.W * j) / (ny - 1), zRx];
      let p = 0;
      for (const led of leds) p += (led.power ?? 1) * losGain(led, { ...rx, pos, normal: [0, 0, 1] }).H;
      grid[j * nx + i] = p;
      min = Math.min(min, p);
      max = Math.max(max, p);
      sum += p;
    }
  }
  return { grid, min, max, mean: sum / (nx * ny) };
}

export interface ImpulseResponse {
  dt: number; // bin width [s]
  t0: number; // time of first bin [s]
  h: Float64Array; // channel gain per bin
  losGain: number;
  diffuseGain: number;
  meanDelay: number;
  rmsDelay: number;
}

/**
 * LOS + first-order reflections from the four walls (Lambertian, m=1 re-emission).
 * dH = (m+1) A ρ dA cos^m(φ) cos(α) cos(β) Ts g(ψ) cos(ψ) / (2π² d1² d2²)
 */
export function impulseResponse(
  room: Room,
  tx: Emitter,
  rx: Detector,
  rho: number,
  patch = 0.1,
  dt = 0.25e-9,
  /** also reflect off the ceiling (z = H) and floor (z = 0); default: the four walls only */
  opts: {
    ceiling?: boolean;
    floor?: boolean;
    rhoCeiling?: number;
    rhoFloor?: number;
    /** the direct path is obstructed */
    losBlocked?: boolean;
    /** a reflection via surface point p is obstructed */
    blocked?: (p: Vec3) => boolean;
  } = {},
): ImpulseResponse {
  const contributions: { t: number; g: number }[] = [];
  const losRaw = losGain(tx, rx);
  const los = opts.losBlocked ? { ...losRaw, H: 0 } : losRaw;
  if (los.H > 0) contributions.push({ t: los.delay, g: los.H });

  type Surface = { origin: Vec3; u: Vec3; v: Vec3; lu: number; lv: number; normal: Vec3; rho: number };
  const walls: Surface[] = [
    { origin: [0, 0, 0], u: [0, 1, 0], v: [0, 0, 1], lu: room.W, lv: room.H, normal: [1, 0, 0], rho },
    { origin: [room.L, 0, 0], u: [0, 1, 0], v: [0, 0, 1], lu: room.W, lv: room.H, normal: [-1, 0, 0], rho },
    { origin: [0, 0, 0], u: [1, 0, 0], v: [0, 0, 1], lu: room.L, lv: room.H, normal: [0, 1, 0], rho },
    { origin: [0, room.W, 0], u: [1, 0, 0], v: [0, 0, 1], lu: room.L, lv: room.H, normal: [0, -1, 0], rho },
  ];
  if (opts.ceiling) walls.push({ origin: [0, 0, room.H], u: [1, 0, 0], v: [0, 1, 0], lu: room.L, lv: room.W, normal: [0, 0, -1], rho: opts.rhoCeiling ?? rho });
  if (opts.floor) walls.push({ origin: [0, 0, 0], u: [1, 0, 0], v: [0, 1, 0], lu: room.L, lv: room.W, normal: [0, 0, 1], rho: opts.rhoFloor ?? rho });
  const g = rx.n ? concentratorGain(rx.n, rx.fovDeg) : 1;
  const Ts = rx.Ts ?? 1;
  const dA = patch * patch;
  let diffuse = 0;
  for (const w of walls) {
    for (let a = patch / 2; a < w.lu; a += patch) {
      for (let b = patch / 2; b < w.lv; b += patch) {
        const p: Vec3 = [
          w.origin[0] + w.u[0] * a + w.v[0] * b,
          w.origin[1] + w.u[1] * a + w.v[1] * b,
          w.origin[2] + w.u[2] * a + w.v[2] * b,
        ];
        const v1 = sub(p, tx.pos);
        const d1 = norm(v1);
        const cosPhi = dot(v1, tx.normal) / d1;
        const cosAlpha = -dot(v1, w.normal) / d1;
        if (cosPhi <= 0 || cosAlpha <= 0) continue;
        const v2 = sub(rx.pos, p);
        const d2 = norm(v2);
        const cosBeta = dot(v2, w.normal) / d2;
        const cosPsi = -dot(v2, rx.normal) / d2;
        if (cosBeta <= 0 || cosPsi <= 0 || Math.acos(Math.min(1, cosPsi)) > rad(rx.fovDeg)) continue;
        if (opts.blocked?.(p)) continue;
        const dH =
          ((tx.m + 1) * rx.area * w.rho * dA * Math.pow(cosPhi, tx.m) * cosAlpha * cosBeta * Ts * g * cosPsi) /
          (2 * Math.PI * Math.PI * d1 * d1 * d2 * d2);
        contributions.push({ t: (d1 + d2) / PHYS.c, g: dH });
        diffuse += dH;
      }
    }
  }
  const tMin = Math.min(...contributions.map((c) => c.t), los.delay);
  const tMax = Math.max(...contributions.map((c) => c.t), tMin + dt);
  const nb = Math.ceil((tMax - tMin) / dt) + 2;
  const h = new Float64Array(nb);
  for (const c of contributions) h[Math.floor((c.t - tMin) / dt)] += c.g;
  const total = los.H + diffuse;
  let m1 = 0;
  let m2 = 0;
  for (const c of contributions) {
    m1 += c.t * c.g;
    m2 += c.t * c.t * c.g;
  }
  const meanDelay = total ? m1 / total : 0;
  const rmsDelay = total ? Math.sqrt(Math.max(0, m2 / total - meanDelay * meanDelay)) : 0;
  return { dt, t0: tMin, h, losGain: los.H, diffuseGain: diffuse, meanDelay, rmsDelay };
}

/** Rule-of-thumb maximum symbol rate before ISI dominates: R ≈ 1 / (10 τ_rms). */
export const isiLimitedRate = (rmsDelay: number) => (rmsDelay > 0 ? 1 / (10 * rmsDelay) : Infinity);
