/**
 * Spectral and material data for the Optical Bench. Values are typical, rounded figures meant for
 * teaching-grade estimates, not datasheet accuracy. Sources: detector datasheet trends (Si, InGaAs,
 * bialkali PMT), Pope & Fry-style pure-water absorption, Petzold's ocean phase function (g ≈ 0.924),
 * Cauchy fits of Schott glass indices, and the Kim visibility model for fog/haze.
 */
import type { Ambient, Environment } from './types';
import { WATER_TYPES } from '@/sim/outdoor';
import { kimAttenuationDbPerKm } from '@/sim/outdoor';

export interface Bin {
  nm: number;
  frac: number;
}

export const SPECTRUM_BINS: Record<string, Bin[]> = {
  white: [
    { nm: 450, frac: 0.28 },
    { nm: 530, frac: 0.25 },
    { nm: 580, frac: 0.3 },
    { nm: 640, frac: 0.17 },
  ],
  blue: [{ nm: 450, frac: 1 }],
  green: [{ nm: 520, frac: 1 }],
  red: [{ nm: 630, frac: 1 }],
  rgb: [
    { nm: 460, frac: 0.33 },
    { nm: 530, frac: 0.33 },
    { nm: 625, frac: 0.34 },
  ],
  ir850: [{ nm: 850, frac: 1 }],
  ir940: [{ nm: 940, frac: 1 }],
  uv365: [{ nm: 365, frac: 1 }],
  nir1550: [{ nm: 1550, frac: 1 }],
};

function interp(table: [number, number][], x: number): number {
  if (x <= table[0][0]) return table[0][1];
  for (let i = 1; i < table.length; i++) {
    if (x <= table[i][0]) {
      const [x0, y0] = table[i - 1];
      const [x1, y1] = table[i];
      return y0 + ((y1 - y0) * (x - x0)) / (x1 - x0);
    }
  }
  return table[table.length - 1][1];
}

const SI: [number, number][] = [
  [300, 0.05],
  [350, 0.12],
  [400, 0.18],
  [450, 0.26],
  [500, 0.31],
  [550, 0.36],
  [600, 0.4],
  [650, 0.44],
  [700, 0.47],
  [800, 0.55],
  [900, 0.6],
  [950, 0.55],
  [1000, 0.4],
  [1100, 0.05],
  [1200, 0],
];
const INGAAS: [number, number][] = [
  [850, 0],
  [900, 0.45],
  [1000, 0.7],
  [1300, 0.9],
  [1550, 1.0],
  [1650, 0.85],
  [1700, 0.1],
];
const BIALKALI_QE: [number, number][] = [
  [280, 0.15],
  [350, 0.27],
  [400, 0.28],
  [450, 0.24],
  [500, 0.16],
  [550, 0.07],
  [600, 0.02],
  [650, 0.004],
  [700, 0],
];
const SPAD_REL: [number, number][] = [
  [350, 0.6],
  [400, 0.9],
  [450, 1],
  [500, 0.88],
  [550, 0.72],
  [600, 0.56],
  [700, 0.32],
  [800, 0.15],
  [900, 0.07],
  [1000, 0.01],
  [1100, 0],
];

/** Responsivity in A/W (before any internal gain). */
export function responsivity(kind: string, nm: number, pde = 0.3): number {
  switch (kind) {
    case 'ingaas':
      return interp(INGAAS, nm);
    case 'pmt':
      return (interp(BIALKALI_QE, nm) * nm) / 1240;
    case 'spad':
    case 'sipm':
      return (pde * interp(SPAD_REL, nm) * nm) / 1240; // "electrons per photon" × energy conversion
    default:
      return interp(SI, nm);
  }
}

/** Optical filter transmission vs wavelength. */
export function filterT(filter: string, nm: number, center = 450, width = 40): number {
  const band = (c: number, w: number) => (Math.abs(nm - c) <= w / 2 ? 0.9 : Math.abs(nm - c) <= w ? 0.9 * (1 - (Math.abs(nm - c) - w / 2) / (w / 2)) : 0.002);
  switch (filter) {
    case 'blue':
      return band(450, 40);
    case 'green':
      return band(520, 40);
    case 'red':
      return band(630, 40);
    case 'ir':
      return nm > 780 ? 0.9 : 0.002;
    case 'nir':
      return band(1550, 30);
    case 'custom':
      return band(center, width);
    default:
      return 1;
  }
}

/** Broadband ambient irradiance at the receiver (W/m², 300–1700 nm) and its spectral weights. */
export const AMBIENT: Record<Ambient, { E: number; label: string; spectrum: Bin[] }> = {
  dark: { E: 0, label: 'Dark room', spectrum: [{ nm: 550, frac: 1 }] },
  night: { E: 0.002, label: 'Outdoors at night', spectrum: [{ nm: 589, frac: 0.6 }, { nm: 500, frac: 0.4 }] },
  indoor: {
    E: 1.5,
    label: 'Office lighting (~500 lux)',
    spectrum: [
      { nm: 450, frac: 0.25 },
      { nm: 550, frac: 0.45 },
      { nm: 620, frac: 0.25 },
      { nm: 850, frac: 0.05 },
    ],
  },
  window: {
    E: 40,
    label: 'Near a sunny window',
    spectrum: [
      { nm: 450, frac: 0.17 },
      { nm: 550, frac: 0.2 },
      { nm: 650, frac: 0.18 },
      { nm: 850, frac: 0.25 },
      { nm: 1000, frac: 0.12 },
      { nm: 1550, frac: 0.08 },
    ],
  },
  daylight: {
    E: 500,
    label: 'Outdoors in daylight',
    spectrum: [
      { nm: 450, frac: 0.15 },
      { nm: 550, frac: 0.18 },
      { nm: 650, frac: 0.16 },
      { nm: 850, frac: 0.24 },
      { nm: 1000, frac: 0.15 },
      { nm: 1550, frac: 0.12 },
    ],
  },
  underwater: {
    E: 20,
    label: 'Sunlit water (~10 m depth)',
    spectrum: [
      { nm: 450, frac: 0.45 },
      { nm: 500, frac: 0.4 },
      { nm: 550, frac: 0.15 },
    ],
  },
};

export interface Material {
  rd: number;
  rs: number;
  n: number;
  color: string;
}
export const MATERIALS: Record<string, Material> = {
  plaster: { rd: 0.8, rs: 0.02, n: 2, color: '#d8d4cc' },
  wood: { rd: 0.45, rs: 0.08, n: 8, color: '#8a6040' },
  tile: { rd: 0.35, rs: 0.3, n: 40, color: '#c9d6e0' },
  concrete: { rd: 0.35, rs: 0.02, n: 2, color: '#77787c' },
  carpet: { rd: 0.15, rs: 0, n: 1, color: '#4a3e46' },
  metal: { rd: 0.1, rs: 0.6, n: 18, color: '#aab0ba' },
  glass: { rd: 0.0, rs: 0.08, n: 600, color: '#9cc7e8' },
  black: { rd: 0.04, rs: 0, n: 1, color: '#16161a' },
  asphalt: { rd: 0.1, rs: 0.02, n: 4, color: '#1e1f24' },
  sand: { rd: 0.3, rs: 0, n: 1, color: '#6b6448' },
  skin: { rd: 0.35, rs: 0.02, n: 4, color: '#596079' },
  carbody: { rd: 0.15, rs: 0.4, n: 30, color: '#c8ccd4' },
};

/** Cauchy dispersion n(λ) = A + B/λ² (λ in µm), fitted to the F and C lines. */
export const GLASS: Record<string, { A: number; B: number }> = {
  bk7: { A: 1.5044, B: 0.00424 },
  f2: { A: 1.5942, B: 0.00895 },
  sf11: { A: 1.7389, B: 0.01597 },
};
export const glassIndex = (g: string, nm: number) => {
  const c = GLASS[g] ?? GLASS.bk7;
  const um = nm / 1000;
  return c.A + c.B / (um * um);
};

const PURE_WATER_A: [number, number][] = [
  [350, 0.011],
  [400, 0.0066],
  [450, 0.0092],
  [500, 0.0204],
  [520, 0.04],
  [550, 0.0565],
  [600, 0.2224],
  [650, 0.34],
  [700, 0.65],
  [800, 2.0],
  [850, 4.3],
  [940, 27],
  [1000, 40],
  [1550, 1000],
];

export interface MediumOptics {
  c: number; // extinction m⁻¹
  albedo: number; // b / c
  g: number; // HG asymmetry
  nIndex: number; // refractive index (propagation delay)
}

/** Extinction, albedo and phase-function asymmetry of the scenario medium at wavelength nm. */
export function mediumAt(env: Environment, nm: number): MediumOptics {
  switch (env.medium) {
    case 'vacuum':
      return { c: 0, albedo: 0, g: 0, nIndex: 1 };
    case 'water': {
      const w = WATER_TYPES.find((x) => x.id === env.waterType) ?? WATER_TYPES[1];
      const a = Math.max(0.005, w.a - interp(PURE_WATER_A, 520) + interp(PURE_WATER_A, nm));
      const b = w.b * Math.pow(520 / nm, 1.0);
      return { c: a + b, albedo: b / (a + b), g: 0.924, nIndex: 1.33 };
    }
    case 'fog':
    case 'air':
    default: {
      const c = kimAttenuationDbPerKm(Math.max(0.02, env.visibilityKm), nm) / 4343; // dB/km → m⁻¹ (natural)
      return { c, albedo: env.medium === 'fog' || env.visibilityKm < 2 ? 0.98 : 0.9, g: 0.85, nIndex: 1 };
    }
  }
}

/** Wavelength → display colour (visible approximation; IR/UV mapped to accents). */
export function nmColor(nm: number): string {
  if (nm < 380) return '#b48cff';
  if (nm > 780) return nm > 1200 ? '#ff7a5c' : '#ff4d7a';
  let r = 0;
  let g = 0;
  let b = 0;
  if (nm < 440) {
    r = (440 - nm) / 60;
    b = 1;
  } else if (nm < 490) {
    g = (nm - 440) / 50;
    b = 1;
  } else if (nm < 510) {
    g = 1;
    b = (510 - nm) / 20;
  } else if (nm < 580) {
    r = (nm - 510) / 70;
    g = 1;
  } else if (nm < 645) {
    r = 1;
    g = (645 - nm) / 65;
  } else r = 1;
  const f = (x: number) => Math.round(255 * Math.pow(Math.min(1, x), 0.8));
  return `rgb(${f(r)},${f(g)},${f(b)})`;
}
