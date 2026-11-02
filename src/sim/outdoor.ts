/**
 * Outdoor (FSO) and underwater (UWOC) channel models.
 * References: Kim et al., SPIE 2001 (visibility attenuation); Andrews & Phillips, Laser Beam Propagation
 * through Random Media (Rytov variance, gamma-gamma); Al-Habash et al., Opt. Eng. 2001;
 * Zeng et al., IEEE COMST 2017 and Mobley, Light and Water (1994) for seawater coefficients.
 */
import { gammaSample, gaussian, rng } from './math';

/** Kim model particle-size coefficient q as a function of visibility V [km]. */
export function kimQ(Vkm: number): number {
  if (Vkm > 50) return 1.6;
  if (Vkm > 6) return 1.3;
  if (Vkm > 1) return 0.16 * Vkm + 0.34;
  if (Vkm > 0.5) return Vkm - 0.5;
  return 0;
}

/** Atmospheric attenuation [dB/km] from visibility (Kim model). */
export function kimAttenuationDbPerKm(Vkm: number, wavelengthNm: number): number {
  const beta = (3.91 / Vkm) * Math.pow(wavelengthNm / 550, -kimQ(Vkm)); // 1/km
  return 4.343 * beta;
}

/** Rytov variance for a plane wave: σ_R² = 1.23 Cn² k^{7/6} L^{11/6}. */
export function rytovVariance(Cn2: number, wavelengthNm: number, Lm: number): number {
  const k = (2 * Math.PI) / (wavelengthNm * 1e-9);
  return 1.23 * Cn2 * Math.pow(k, 7 / 6) * Math.pow(Lm, 11 / 6);
}

/** Gamma-gamma α, β parameters (plane wave, zero inner scale). */
export function gammaGammaParams(sigmaR2: number) {
  const s = Math.pow(sigmaR2, 6 / 5); // σ_R^{12/5}
  const alpha = 1 / (Math.exp((0.49 * sigmaR2) / Math.pow(1 + 1.11 * s, 7 / 6)) - 1);
  const beta = 1 / (Math.exp((0.51 * sigmaR2) / Math.pow(1 + 0.69 * s, 5 / 6)) - 1);
  return { alpha, beta, scintillationIndex: 1 / alpha + 1 / beta + 1 / (alpha * beta) };
}

/** Draw normalised irradiance samples I (E[I] = 1) from a gamma-gamma distribution. */
export function gammaGammaSamples(alpha: number, beta: number, n: number, seed = 3): Float64Array {
  const u = rng(seed);
  const g = gaussian(u);
  const out = new Float64Array(n);
  for (let i = 0; i < n; i++) out[i] = gammaSample(alpha, 1 / alpha, u, g) * gammaSample(beta, 1 / beta, u, g);
  return out;
}

/** Log-normal (weak turbulence) normalised irradiance samples with scintillation index σ_I². */
export function lognormalSamples(sigmaI2: number, n: number, seed = 5): Float64Array {
  const u = rng(seed);
  const g = gaussian(u);
  const s2 = Math.log(1 + sigmaI2);
  const out = new Float64Array(n);
  for (let i = 0; i < n; i++) out[i] = Math.exp(Math.sqrt(s2) * g() - s2 / 2);
  return out;
}

/** Geometric loss for a diverging beam: fraction of power captured by aperture D at range L. */
export function geometricCapture(apertureM: number, divergenceMrad: number, Lm: number, beamWaistM = 0.01): number {
  const spot = beamWaistM + (divergenceMrad * 1e-3) * Lm;
  return Math.min(1, (apertureM / spot) ** 2);
}

export interface WaterType {
  id: string;
  name: string;
  a: number; // absorption [1/m]
  b: number; // scattering [1/m]
  c: number; // extinction = a + b [1/m]
  tint: string;
}

/** Representative extinction coefficients near 520 nm (Mobley 1994; widely reproduced in UWOC surveys). */
export const WATER_TYPES: WaterType[] = [
  { id: 'pure', name: 'Pure sea water', a: 0.053, b: 0.003, c: 0.056, tint: '#3fa9ff' },
  { id: 'clear', name: 'Clear ocean', a: 0.069, b: 0.08, c: 0.151, tint: '#2c8fd8' },
  { id: 'coastal', name: 'Coastal ocean', a: 0.088, b: 0.216, c: 0.305, tint: '#2a8a8a' },
  { id: 'harbor', name: 'Turbid harbour', a: 0.295, b: 1.875, c: 2.17, tint: '#4e6b3c' },
];

/** Beer-Lambert received power fraction exp(-c L). */
export const beerLambert = (c: number, Lm: number) => Math.exp(-c * Lm);
