/**
 * Receiver noise and detector models: PIN, APD, SPAD, PMT.
 * References: Komine & Nakagawa 2004; Kahn & Barry 1997; Huang et al., IEEE Commun. Mag. 2024 (SPAD);
 * Agrawal, Fiber-Optic Communication Systems (APD excess noise, McIntyre).
 */
import { PHYS, Q, poissonCdf } from './math';

/** Responsivity R = η q λ / (h c)  [A/W]. */
export function responsivity(quantumEfficiency: number, wavelengthNm: number): number {
  return (quantumEfficiency * PHYS.q * wavelengthNm * 1e-9) / (PHYS.h * PHYS.c);
}

/** McIntyre excess noise factor F(M) = k M + (1-k)(2 - 1/M). */
export function excessNoise(M: number, kA: number): number {
  return kA * M + (1 - kA) * (2 - 1 / M);
}

export interface NoiseInputs {
  R: number; // responsivity [A/W]
  Pr: number; // average received signal power [W]
  Ibg: number; // background (ambient) photocurrent [A]
  Idark?: number; // dark current [A]
  B: number; // noise bandwidth [Hz]
  T?: number; // temperature [K]
  RL?: number; // load / feedback resistance [Ω]
  inputNoise?: number; // amplifier input current noise density [A/√Hz] (overrides RL)
  M?: number; // avalanche gain
  kA?: number; // ionisation ratio
}

export interface NoiseBudget {
  signalCurrent: number; // M R Pr [A]
  shot: number; // variance [A²]
  background: number; // variance [A²]
  thermal: number; // variance [A²]
  total: number;
  snr: number; // electrical SNR = (M R Pr)² / σ²
}

/** Shot + background + thermal noise for PIN (M=1) or APD (M>1). */
export function noiseBudget(p: NoiseInputs): NoiseBudget {
  const M = p.M ?? 1;
  const F = M > 1 ? excessNoise(M, p.kA ?? 0.02) : 1;
  const T = p.T ?? 300;
  const Is = p.R * p.Pr;
  const shot = 2 * PHYS.q * (Is + (p.Idark ?? 0)) * M * M * F * p.B;
  const background = 2 * PHYS.q * p.Ibg * M * M * F * p.B;
  const thermal = p.inputNoise !== undefined ? p.inputNoise ** 2 * p.B : (4 * PHYS.k * T * p.B) / (p.RL ?? 10e3);
  const total = shot + background + thermal;
  const sig = M * Is;
  return { signalCurrent: sig, shot, background, thermal, total, snr: (sig * sig) / total };
}

/** Find the APD gain maximising SNR (brute force over a log grid). */
export function optimalApdGain(p: Omit<NoiseInputs, 'M'>, maxM = 1000): { M: number; snr: number } {
  let best = { M: 1, snr: noiseBudget({ ...p, M: 1 }).snr };
  for (let e = 0; e <= Math.log10(maxM); e += 0.01) {
    const M = Math.pow(10, e);
    const snr = noiseBudget({ ...p, M }).snr;
    if (snr > best.snr) best = { M, snr };
  }
  return best;
}

/** Photon arrival rate [photons/s] for optical power P at wavelength λ. */
export function photonRate(P: number, wavelengthNm: number): number {
  return (P * wavelengthNm * 1e-9) / (PHYS.h * PHYS.c);
}

/** Non-paralysable dead-time count rate: λ_det = λ / (1 + λ τ_d). */
export function deadTimeRate(lambda: number, deadTime: number): number {
  return lambda / (1 + lambda * deadTime);
}

export interface SpadParams {
  pde: number; // photon detection efficiency
  deadTime: number; // [s]
  darkRate: number; // dark counts per SPAD [cps]
  nSpads: number; // array size
}

/**
 * OOK BER for a photon-counting SPAD array with optimum integer threshold.
 * Counts approximated as Poisson with dead-time-saturated mean (good away from deep saturation).
 */
export function spadOokBer(Pavg: number, wavelengthNm: number, bitRate: number, sp: SpadParams, extinction = 0) {
  const Tb = 1 / bitRate;
  const perSpad = (P: number) => sp.pde * photonRate(P / sp.nSpads, wavelengthNm) + sp.darkRate;
  const P1 = (2 * Pavg) / (1 + extinction);
  const P0 = P1 * extinction;
  const l1 = deadTimeRate(perSpad(P1), sp.deadTime) * sp.nSpads * Tb;
  const l0 = deadTimeRate(perSpad(P0), sp.deadTime) * sp.nSpads * Tb;
  let best = { ber: 0.5, threshold: 0, l0, l1 };
  const hi = Math.ceil(l1 + 6 * Math.sqrt(l1) + 5);
  for (let th = 1; th <= hi; th++) {
    const pe = 0.5 * (1 - poissonCdf(th - 1, l0)) + 0.5 * poissonCdf(th - 1, l1);
    if (pe < best.ber) best = { ber: pe, threshold: th, l0, l1 };
  }
  return best;
}

// ---------- Bit-error-rate formulas (electrical SNR = (R·P_avg)² / σ²) ----------

/** OOK-NRZ with midpoint threshold: BER = Q(√SNR). */
export const berOOK = (snr: number) => Q(Math.sqrt(snr));

/** M-PAM (levels evenly spaced between 0 and 2·P_avg, Gray coded). */
export function berPAM(snr: number, M: number): number {
  const k = Math.log2(M);
  return ((2 * (M - 1)) / (M * k)) * Q(Math.sqrt(snr) / (M - 1));
}

/** L-PPM hard-decision symbol error approx (Kahn & Barry): Q(√(SNR · L log2 L / 2)). */
export function berPPM(snr: number, L: number): number {
  const ser = Q(Math.sqrt((snr * L * Math.log2(L)) / 2));
  return ((L / 2) / (L - 1)) * ser;
}

/** Square M-QAM BER (Gray) as a function of per-subcarrier SNR γ. */
export function berQAM(gamma: number, M: number): number {
  const k = Math.log2(M);
  return Math.min(0.5, (4 / k) * (1 - 1 / Math.sqrt(M)) * Q(Math.sqrt((3 * gamma) / (M - 1))));
}

/** Transimpedance amplifier -3 dB bandwidth (single-pole op-amp): f ≈ √(GBW / (2π R_F C_T)). */
export function tiaBandwidth(gbw: number, Rf: number, Ct: number): number {
  return Math.sqrt(gbw / (2 * Math.PI * Rf * Ct));
}
