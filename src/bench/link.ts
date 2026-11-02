/**
 * Optical Bench link engine: from traced optical power to SNR, bandwidth, BER and throughput for the
 * chosen modem chain. Models are the standard first-order ones from the OWC literature (shot +
 * background + thermal noise, APD excess noise, photon counting with dead time, first-order LED and
 * channel roll-off, OFDM bit loading, bounded-distance / union-bound / threshold FEC models, rolling-
 * shutter OCC). They are teaching-grade estimates: good for comparing designs, not for sign-off.
 */
import type { BenchObject, Chain, Coding, Environment, Equalizer, Modulation } from './types';
import type { Scenario } from './scenarios';
import type { ReceiverResult, TraceResult } from './tracer';
import { dot, len, norm, sub } from './tracer';
import { AMBIENT, filterT, responsivity } from './optics';
import { berPAM, berPPM, berQAM, excessNoise } from '@/sim/receiver';
import { logFactorial, Q } from '@/sim/math';
import { gammaGammaParams, rytovVariance } from '@/sim/outdoor';

const q = 1.602176634e-19;

export function Qinv(p: number): number {
  if (p >= 0.5) return 0;
  let lo = 0;
  let hi = 40;
  for (let i = 0; i < 80; i++) {
    const mid = (lo + hi) / 2;
    if (Q(mid) > p) lo = mid;
    else hi = mid;
  }
  return (lo + hi) / 2;
}

// ------------------------------------------------------------------ modulation table
export interface ModInfo {
  label: string;
  family: 'sc' | 'ppm' | 'ofdm' | 'qam' | 'csk' | 'camera';
  bits: number; // bits per symbol (single carrier); OFDM: per subcarrier max
  /** bandwidth expansion: chips per bit-symbol (Manchester 2, VPPM 2, PPM L) */
  expand: number;
  dimmable: boolean;
  dcBalanced: boolean;
  multilevel: boolean;
  note: string;
}

export const MODS: Record<Modulation, ModInfo> = {
  ook: { label: 'OOK-NRZ', family: 'sc', bits: 1, expand: 1, dimmable: false, dcBalanced: false, multilevel: false, note: 'Simplest IM/DD: light on for 1, dim for 0.' },
  manchester: { label: 'Manchester OOK', family: 'sc', bits: 1, expand: 2, dimmable: false, dcBalanced: true, multilevel: false, note: 'OOK with a guaranteed transition per bit: flicker-free, half the rate.' },
  vppm: { label: 'VPPM', family: 'sc', bits: 1, expand: 2, dimmable: true, dcBalanced: true, multilevel: false, note: 'Variable pulse-position: dimming by pulse width, data by position (802.15.7).' },
  ppm4: { label: '4-PPM', family: 'ppm', bits: 2, expand: 4, dimmable: false, dcBalanced: false, multilevel: false, note: 'One pulse in 4 slots: very power-efficient, bandwidth-hungry.' },
  ppm16: { label: '16-PPM', family: 'ppm', bits: 4, expand: 16, dimmable: false, dcBalanced: false, multilevel: false, note: 'Even more power-efficient: deep space and photon-counting links.' },
  pam4: { label: '4-PAM', family: 'sc', bits: 2, expand: 1, dimmable: false, dcBalanced: false, multilevel: true, note: 'Four brightness levels: 2 bits per symbol, needs linearity.' },
  pam8: { label: '8-PAM', family: 'sc', bits: 3, expand: 1, dimmable: false, dcBalanced: false, multilevel: true, note: 'Eight levels: 3 bits per symbol, needs high SNR and linearity.' },
  csk4: { label: '4-CSK', family: 'csk', bits: 2, expand: 1, dimmable: true, dcBalanced: true, multilevel: false, note: 'Colour-shift keying with RGB LEDs: constant total light (802.15.7 PHY III).' },
  csk16: { label: '16-CSK', family: 'csk', bits: 4, expand: 1, dimmable: true, dcBalanced: true, multilevel: true, note: '16 colours: 4 bits per symbol.' },
  cap16: { label: 'CAP-16', family: 'qam', bits: 4, expand: 1, dimmable: false, dcBalanced: true, multilevel: true, note: 'Carrierless amplitude/phase: QAM with filters instead of carriers.' },
  scfde: { label: 'SC-FDE (16-QAM)', family: 'qam', bits: 4, expand: 1, dimmable: false, dcBalanced: true, multilevel: true, note: 'Single carrier, equalised in the frequency domain: low PAPR.' },
  dco: { label: 'DCO-OFDM', family: 'ofdm', bits: 0, expand: 1, dimmable: false, dcBalanced: true, multilevel: true, note: 'OFDM on a DC bias: spectrally efficient, robust to multipath and LED roll-off.' },
  aco: { label: 'ACO-OFDM', family: 'ofdm', bits: 0, expand: 1, dimmable: false, dcBalanced: true, multilevel: true, note: 'Odd subcarriers only, clipped at zero: power-efficient, half the rate.' },
  adoofdm: { label: 'ADO-OFDM', family: 'ofdm', bits: 0, expand: 1, dimmable: false, dcBalanced: true, multilevel: true, note: 'ACO on odd + DCO on even subcarriers.' },
  uofdm: { label: 'U-OFDM', family: 'ofdm', bits: 0, expand: 1, dimmable: false, dcBalanced: true, multilevel: true, note: 'Positive and flipped-negative frames: unipolar without bias.' },
  rsook: { label: 'Rolling-shutter OOK', family: 'camera', bits: 1, expand: 1, dimmable: false, dcBalanced: false, multilevel: false, note: 'Camera rows sample the LED: stripes carry bits (OCC).' },
  ufsook: { label: 'UFSOOK / screen code', family: 'camera', bits: 1, expand: 1, dimmable: true, dcBalanced: true, multilevel: false, note: 'Undersampled frequency-shift OOK or screen barcodes: camera-friendly.' },
};

export const CODES: Record<Coding, { label: string; rate: number; note: string }> = {
  none: { label: 'None', rate: 1, note: 'Raw bits.' },
  hamming74: { label: 'Hamming (7,4)', rate: 4 / 7, note: 'Corrects 1 error per 7 bits.' },
  rs6432: { label: 'Reed–Solomon (64,32)', rate: 0.5, note: '802.15.7-style RS: 16 byte errors per block, great against bursts.' },
  rs255239: { label: 'Reed–Solomon (255,239)', rate: 239 / 255, note: 'Low-overhead RS (7 %), classic optical-fibre FEC.' },
  cc: { label: 'Convolutional K=7, r=½', rate: 0.5, note: 'Soft-decision Viterbi decoding.' },
  rscc: { label: 'RS + convolutional', rate: (223 / 255) * 0.5, note: 'Concatenated, as in 802.15.7 PHY I outdoor modes.' },
  ldpc12: { label: 'LDPC r=½', rate: 0.5, note: 'Near-capacity; G.9991, Wi-Fi/802.11bb.' },
  ldpc34: { label: 'LDPC r=¾', rate: 0.75, note: 'Less overhead, needs a better channel.' },
  ldpc56: { label: 'LDPC r=⅚', rate: 5 / 6, note: 'High-rate LDPC.' },
  turbo13: { label: 'Turbo r=⅓', rate: 1 / 3, note: 'Very strong, iterative, higher latency.' },
  polar12: { label: 'Polar r=½ (SCL)', rate: 0.5, note: 'Excellent at short blocks.' },
};

export const LINECODES = { none: { label: 'None', rate: 1 }, manchester: { label: 'Manchester', rate: 0.5 }, '4b6b': { label: '4B6B', rate: 4 / 6 }, '8b10b': { label: '8B10B', rate: 0.8 } } as const;

export const EQS: Record<Equalizer, { label: string; cap: number; enh: number; nonlin: boolean; note: string }> = {
  none: { label: 'None', cap: 0.7, enh: 0, nonlin: false, note: 'Threshold detection only.' },
  zf: { label: 'Zero-forcing FIR', cap: 1.6, enh: 1, nonlin: false, note: 'Inverts the channel; boosts noise.' },
  mmse: { label: 'MMSE FIR', cap: 1.8, enh: 0.5, nonlin: false, note: 'Balances ISI against noise.' },
  lms: { label: 'LMS adaptive', cap: 1.8, enh: 0.5, nonlin: false, note: 'Learns taps from training symbols.' },
  rls: { label: 'RLS adaptive', cap: 1.9, enh: 0.45, nonlin: false, note: 'Faster-converging adaptive filter.' },
  dfe: { label: 'Decision-feedback (DFE)', cap: 2.4, enh: 0.25, nonlin: false, note: 'Cancels post-cursor ISI without noise boost.' },
  volterra: { label: 'Volterra (DFE)', cap: 2.4, enh: 0.25, nonlin: true, note: 'Also removes LED non-linearity.' },
  mlp: { label: 'Neural net (MLP)', cap: 2.6, enh: 0.2, nonlin: true, note: 'Learned non-linear equaliser.' },
  lstm: { label: 'Neural net (LSTM)', cap: 2.8, enh: 0.2, nonlin: true, note: 'Recurrent network for long memory.' },
  mlse: { label: 'MLSE (Viterbi)', cap: 3.0, enh: 0, nonlin: false, note: 'Optimal sequence detection; costly.' },
  onetap: { label: 'One-tap (OFDM)', cap: 1, enh: 0, nonlin: false, note: 'Per-subcarrier gain: OFDM only.' },
};

const MAC_EFF = { p2p: 0.95, tdma: 0.85, ofdma: 0.9, noma: 0.92, csma: 0.7 } as const;

// ------------------------------------------------------------------ FEC models
const lnC = (n: number, k: number) => logFactorial(n) - logFactorial(k) - logFactorial(n - k);
function bdd(n: number, t: number, ps: number) {
  if (ps <= 0) return 0;
  if (ps >= 0.5) return 0.5;
  let s = 0;
  for (let i = t + 1; i <= n; i++) s += i * Math.exp(lnC(n, i) + i * Math.log(ps) + (n - i) * Math.log1p(-ps));
  return Math.min(0.5, s / n);
}
const rsBer = (n: number, k: number, p: number) => bdd(n, (n - k) / 2, 1 - Math.pow(1 - p, 8)) * (128 / 255);
const CC: [number, number][] = [
  [10, 36],
  [12, 211],
  [14, 1404],
  [16, 11633],
  [18, 77433],
];
function ccBer(p: number) {
  if (p >= 0.3) return 0.5;
  const es = Qinv(p) ** 2 / 2;
  return Math.min(0.5, CC.reduce((s, [d, c]) => s + c * Q(Math.sqrt(2 * d * es)), 0));
}
const THRESH: Partial<Record<Coding, number>> = { ldpc12: 0.045, ldpc34: 0.016, ldpc56: 0.008, turbo13: 0.07, polar12: 0.035 };

export function postFec(coding: Coding, p: number): number {
  if (!(p > 0)) return 0;
  switch (coding) {
    case 'none':
      return p;
    case 'hamming74':
      return bdd(7, 1, p);
    case 'rs6432':
      return rsBer(64, 32, p);
    case 'rs255239':
      return rsBer(255, 239, p);
    case 'cc':
      return ccBer(p);
    case 'rscc':
      return rsBer(255, 223, ccBer(p));
    default: {
      const th = THRESH[coding]!;
      if (p >= th) return p;
      if (p <= 0.6 * th) return 1e-12;
      const f = (p - 0.6 * th) / (0.4 * th);
      return Math.pow(10, -12 + f * (12 + Math.log10(p)));
    }
  }
}

// ------------------------------------------------------------------ report
export type Limit = 'ok' | 'noise' | 'isi' | 'ambient' | 'blocked' | 'fov' | 'nosignal' | 'distortion' | 'camera' | 'saturated' | 'mismatch';

export interface LinkReport {
  rxId: string;
  name: string;
  kind: string;
  prxW: number;
  prxDbm: number;
  gainDb: number;
  shares: { los: number; diffuse: number; scatter: number; optics: number };
  iSig: number;
  iBg: number;
  noise: { shot: number; bg: number; thermal: number; dark: number; total: number };
  bLed: number;
  bRx: number;
  bCh: number;
  bSys: number;
  tauRms: number;
  rsHz: number;
  snrDb: number;
  snrEffDb: number;
  preBer: number;
  postBer: number;
  throughput: number;
  bitsPerSym: number;
  limit: Limit;
  warnings: string[];
  impulse: { t: number[]; h: number[] };
  subcarriers?: { f: number[]; snrDb: number[]; bits: number[] };
  camera?: { inView: number; rowsCovered: number; bitsPerFrame: number };
  scint?: { sigmaI2: number; marginDb: number; rytov: number };
  harvestW?: number;
  servingSource: number;
  rangeM: number;
}

export interface BenchAnalysis {
  reports: LinkReport[];
  mimo?: { H: number[][]; sv: number[]; cond: number; capacityBps: number };
  safety: string[];
}

function rxNum(r: ReceiverResult, k: string, d: number) {
  const v = r.rx.props[k];
  return typeof v === 'number' ? v : d;
}

/** Ambient photocurrent [A] for a receiver: E · A · sin²FOV · g · ∑ w R T. */
function ambientCurrent(r: ReceiverResult, env: Environment) {
  const amb = AMBIENT[env.ambient];
  if (!amb.E) return 0;
  const sin2 = Math.min(1, Math.sin(Math.min(r.rx.fov, Math.PI / 2)) ** 2);
  const pde = rxNum(r, 'pde', 0.3);
  let s = 0;
  for (const b of amb.spectrum) s += b.frac * responsivity(r.rx.kind, b.nm, pde) * filterT(r.rx.filter, b.nm);
  return amb.E * r.rx.area * sin2 * r.rx.gmax * s;
}

function impulse(r: ReceiverResult, sources: TraceResult['sources']) {
  const cs = r.contribs.filter((c) => c.current > 0);
  if (!cs.length) return { tau: 0, t: [0], h: [0], t0: 0 };
  let W = 0;
  let m1 = 0;
  let m2 = 0;
  let tmin = Infinity;
  let tmax = 0;
  for (const c of cs) {
    const w = c.current * (sources[c.src]?.power ?? 1);
    W += w;
    m1 += w * c.delay;
    m2 += w * c.delay * c.delay;
    tmin = Math.min(tmin, c.delay);
    tmax = Math.max(tmax, c.delay);
  }
  const mean = m1 / W;
  const tau = Math.sqrt(Math.max(0, m2 / W - mean * mean));
  const span = Math.max(tmax - tmin, 1e-12);
  const nb = 80;
  const h = new Array(nb).fill(0);
  for (const c of cs) h[Math.min(nb - 1, Math.floor(((c.delay - tmin) / span) * (nb - 1)))] += c.current * (sources[c.src]?.power ?? 1);
  const mx = Math.max(...h) || 1;
  return { tau, t: h.map((_, i) => tmin + (i / (nb - 1)) * span), h: h.map((v) => v / mx), t0: tmin };
}

interface EvalIn {
  iMod: number; // signal current amplitude [A] (after internal gain)
  sigma2PerHz: number; // noise PSD [A²/Hz]
  bSys: number;
  bLed: number;
  chain: Chain;
  distSnrDb: number; // distortion ceiling
  scintDb: number;
  photon?: { lamS: number; lamB: number; dead: number; cells: number }; // photon counting rates [1/s]
}

interface EvalOut {
  rs: number;
  bits: number;
  snrDb: number;
  snrEffDb: number;
  pre: number;
  post: number;
  thr: number;
  sub?: LinkReport['subcarriers'];
  limit: Limit;
}

function evalAt(rs: number, x: EvalIn): EvalOut {
  const c = x.chain;
  const mod = MODS[c.modulation];
  const eq = EQS[c.equalizer];
  const codeRate = CODES[c.coding].rate;
  const lineRate = LINECODES[c.lineCode].rate;
  const mac = MAC_EFF[c.mac];
  const preEqGain = c.preEq === 'passive' ? 3 : c.preEq === 'digital' ? 1.8 : 1;
  const preEqLossDb = c.preEq === 'passive' ? 4.8 : c.preEq === 'digital' ? 2 : 0;
  // pre-equalisation stretches the LED part of the bandwidth budget; the rest (detector, channel) is unchanged
  const otherInv2 = Math.max(0, 1 / x.bSys ** 2 - 1 / x.bLed ** 2);
  const bSys = 1 / Math.sqrt(1 / (x.bLed * preEqGain) ** 2 + otherInv2);
  const distLin = 10 ** ((x.distSnrDb + (eq.nonlin ? 8 : 0)) / 10);
  let limit: Limit = 'noise';

  if (mod.family === 'ofdm') {
    const B = rs / 2;
    const noiseVar = x.sigma2PerHz * B;
    let snr = (x.iMod * x.iMod) / noiseVar;
    if (x.photon) snr = photonSnr(x.photon, 2 * B, c.modIndex);
    const factor = c.modulation === 'dco' ? 0.32 : c.modulation === 'aco' ? 0.5 : c.modulation === 'adoofdm' ? 0.4 : 0.5;
    const eff = c.modulation === 'dco' ? 1 : c.modulation === 'adoofdm' ? 0.75 : 0.5;
    const snrSub0 = snr * factor * 10 ** (-(preEqLossDb + x.scintDb) / 10);
    const N = 64;
    const Gamma = -Math.log(5 * 1e-3) / 1.5;
    const f: number[] = [];
    const snrK: number[] = [];
    const bitsK: number[] = [];
    let bitsTot = 0;
    let berAcc = 0;
    const Mmax = Math.max(4, c.qam);
    for (let k = 1; k <= N; k++) {
      const fk = (k / N) * B;
      const h2 = 1 / (1 + (fk / bSys) ** 2);
      const sk = 1 / (1 / (snrSub0 * h2) + 1 / distLin);
      f.push(fk);
      snrK.push(10 * Math.log10(sk));
      let b = c.bitLoading ? Math.min(Math.log2(Mmax), Math.floor(Math.log2(1 + sk / Gamma))) : Math.log2(Mmax);
      if (c.bitLoading && b === 1) b = 1;
      b = Math.max(0, b);
      bitsK.push(b);
      bitsTot += b;
      if (b > 0) berAcc += b * berQAM(sk, 2 ** Math.max(1, b) < 4 ? 4 : 2 ** b);
    }
    const pre = bitsTot > 0 ? Math.min(0.5, berAcc / bitsTot) : 0.5;
    const post = postFec(c.coding, pre);
    const thr = (bitsTot / N) * B * eff * 0.94 * codeRate * mac * lineRate;
    const lowCarriers = bitsK.filter((b) => b === 0).length;
    limit = lowCarriers > N / 2 ? 'isi' : 'noise';
    if (snrSub0 > distLin) limit = 'distortion';
    return { rs, bits: bitsTot / N, snrDb: 10 * Math.log10(snr), snrEffDb: 10 * Math.log10(snrSub0), pre, post, thr: post <= c.targetBer ? thr : 0, sub: { f, snrDb: snrK, bits: bitsK }, limit };
  }

  // single carrier / PPM / CSK / QAM-family
  const chipRate = rs * mod.expand;
  const Bn = 0.6 * chipRate;
  let snr = (x.iMod * x.iMod) / (x.sigma2PerHz * Bn);
  if (x.photon) snr = photonSnr(x.photon, chipRate, c.modIndex);
  const D = chipRate / bSys;
  const xq = D / eq.cap;
  let penaltyDb = xq < 1 ? -10 * Math.log10(1 - 0.85 * xq * xq) : Infinity;
  penaltyDb += 10 * Math.log10(1 + eq.enh * D * D);
  penaltyDb += preEqLossDb + x.scintDb;
  if (c.equalizer === 'onetap') penaltyDb += xq < 1 ? 0 : Infinity;
  let snrEff = snr * 10 ** (-penaltyDb / 10);
  if (mod.multilevel) snrEff = 1 / (1 / snrEff + 1 / distLin);
  if (!isFinite(penaltyDb)) {
    limit = 'isi';
    snrEff = 0;
  } else if (penaltyDb > 6) limit = 'isi';
  else if (mod.multilevel && snrEff > distLin * 0.5) limit = 'distortion';
  let pre: number;
  switch (mod.family) {
    case 'ppm':
      pre = berPPM(snr * 10 ** (-penaltyDb / 10) / mod.expand, mod.expand);
      break;
    case 'qam':
      pre = berQAM(snrEff * 0.5, 16);
      break;
    case 'csk':
      pre = berQAM(snrEff * 0.5, 2 ** mod.bits);
      break;
    default:
      pre = mod.bits === 1 ? Q(Math.sqrt(snrEff)) : berPAM(snrEff, 2 ** mod.bits);
  }
  if (!(snrEff > 0)) pre = 0.5;
  pre = Math.min(0.5, pre);
  const post = postFec(c.coding, pre);
  const thr = rs * mod.bits * codeRate * lineRate * mac;
  return { rs, bits: mod.bits, snrDb: 10 * Math.log10(Math.max(1e-30, snr)), snrEffDb: 10 * Math.log10(Math.max(1e-30, snrEff)), pre, post, thr: post <= c.targetBer ? thr : 0, limit };
}

/** Equivalent electrical SNR of a photon-counting OOK decision: ((K1−K0)/(√K1+√K0))². */
function photonSnr(p: NonNullable<EvalIn['photon']>, chipRate: number, m: number) {
  const T = 1 / chipRate;
  const sat = (l: number) => l / (1 + (l * p.dead) / p.cells);
  const K1 = sat(p.lamS * (1 + m) + p.lamB) * T;
  const K0 = sat(p.lamS * (1 - m) + p.lamB) * T;
  const x = (K1 - K0) / (Math.sqrt(K1) + Math.sqrt(K0) + 1e-12);
  return x * x;
}

export function analyse(tr: TraceResult, objects: BenchObject[], chain: Chain, env: Environment, sc: Scenario): BenchAnalysis {
  const safety: string[] = [];
  for (const s of tr.sources) {
    if (!s.laser) continue;
    const nm = s.bins[0].nm;
    const ael = nm >= 1400 ? 0.01 : nm >= 700 ? 0.0008 : 0.00039;
    if (s.power > ael) safety.push(`${s.name}: ${(s.power * 1000).toPrecision(2)} mW at ${nm} nm is above the Class 1 limit (≈ ${(ael * 1000).toPrecision(2)} mW for a collimated beam). Use a diffuser, lower power or ${nm < 1400 ? 'move to 1550 nm' : 'enclose the beam'}.`);
  }

  const reports: LinkReport[] = tr.receivers.map((r) => {
    const kind = r.rx.kind;
    const warnings: string[] = [];
    // signal
    let iAvg = 0;
    let prx = 0;
    let serving = -1;
    let best = 0;
    const shares = { los: 0, diffuse: 0, scatter: 0, optics: 0 };
    r.perSource.forEach((ps, si) => {
      const P = tr.sources[si].power;
      iAvg += ps.current * P;
      prx += ps.gain * P;
      shares.los += ps.los * P;
      shares.diffuse += ps.diffuse * P;
      shares.scatter += ps.scatter * P;
      shares.optics += ps.optics * P;
      if (ps.current * P > best) {
        best = ps.current * P;
        serving = si;
      }
    });
    const tot = Math.max(1e-300, shares.los + shares.diffuse + shares.scatter + shares.optics);
    (Object.keys(shares) as (keyof typeof shares)[]).forEach((k) => (shares[k] /= tot));
    const src = serving >= 0 ? tr.sources[serving] : tr.sources[0];
    const rangeM = src ? len(sub(r.rx.pos, src.pos)) : 0;
    const ir = impulse(r, tr.sources);
    const iBg = ambientCurrent(r, env);
    // bandwidths
    const whiteBlue = src && src.bins.length >= 4 && r.rx.filter === 'blue';
    const bLed = (src?.bwMHz ?? 5) * 1e6 * (whiteBlue ? 4 : 1);
    const bRx =
      kind === 'spad'
        ? 1 / (2 * Math.PI * rxNum(r, 'dead', 20) * 1e-9) * 3
        : kind === 'sipm'
          ? 1.2e9
          : kind === 'camera'
            ? 1 / (rxNum(r, 'rowUs', 18) * 1e-6)
            : rxNum(r, 'bw', 50) * 1e6;
    const bCh = ir.tau > 0 ? 1 / (2 * Math.PI * ir.tau) : Infinity;
    const bSys = 1 / Math.sqrt(1 / bLed ** 2 + 1 / bRx ** 2 + (isFinite(bCh) ? 1 / bCh ** 2 : 0));
    // gain and noise
    const M = kind === 'apd' ? rxNum(r, 'gain', 30) : kind === 'pmt' ? rxNum(r, 'gain', 1e6) : 1;
    const F = kind === 'apd' ? excessNoise(M, 0.02) : kind === 'pmt' ? 1.3 : 1;
    const iDark = kind === 'apd' ? 1e-9 : kind === 'pmt' ? 1e-15 : kind === 'solar' ? 1e-6 : 1e-10;
    const inoise = kind === 'pmt' ? 1e-12 : rxNum(r, 'noise', 5) * 1e-12;
    const shotPsd = 2 * q * iAvg * M * M * F;
    const bgPsd = 2 * q * iBg * M * M * F;
    const darkPsd = 2 * q * iDark * M * M * F;
    const thermPsd = inoise * inoise;
    const sigma2PerHz = shotPsd + bgPsd + darkPsd + thermPsd;
    const iMod = chain.modIndex * iAvg * M;
    let photon: EvalIn['photon'];
    let saturated = false;
    if (kind === 'spad' || kind === 'sipm') {
      photon = { lamS: iAvg / q, lamB: iBg / q + rxNum(r, 'dcr', 1000), dead: rxNum(r, 'dead', 20) * 1e-9, cells: kind === 'sipm' ? rxNum(r, 'cells', 4774) : 1 };
      const satRatio = ((photon.lamS + photon.lamB) * photon.dead) / photon.cells;
      saturated = satRatio > 1;
      if (saturated) warnings.push(`Saturated: ${((photon.lamS + photon.lamB) / 1e6).toPrecision(2)} M counts/s against ${(photon.cells / photon.dead / 1e6).toPrecision(2)} M/s capacity. Add a filter, narrow the FOV or use a PIN.`);
    }
    // turbulence fade margin (outdoor / water, long links)
    let scintDb = 0;
    let scint: LinkReport['scint'];
    if ((sc.kind === 'outdoor' || sc.kind === 'underwater') && env.turbulence > 0 && rangeM > 20 && src) {
      const Cn2 = sc.kind === 'underwater' ? 10 ** (-15 + 3 * env.turbulence) : 10 ** (-17 + 5 * env.turbulence);
      const nm = src.bins[0].nm;
      const rytov = rytovVariance(Cn2, nm, rangeM);
      const D = 2 * Math.sqrt((r.rx.area * r.rx.gmax) / Math.PI);
      const k = (2 * Math.PI) / (nm * 1e-9);
      const Aav = Math.pow(1 + (1.062 * k * D * D) / (4 * rangeM), -7 / 6);
      const si = Math.min(3, gammaGammaParams(Math.max(1e-4, rytov)).scintillationIndex * Aav);
      const s2 = Math.log(1 + si);
      const ith = Math.exp(-s2 / 2 - 3.09 * Math.sqrt(s2));
      const marginDb = -10 * Math.log10(ith);
      scintDb = 2 * marginDb;
      scint = { sigmaI2: si, marginDb, rytov };
      if (marginDb > 3) warnings.push(`Scintillation (σ²_I ≈ ${si.toFixed(2)}) needs ≈ ${marginDb.toFixed(1)} dB of fade margin at 10⁻³ outage. A larger aperture averages it out; interleaving rides through fades.`);
    }
    // signal-to-distortion ceiling from LED/laser non-linearity; grows as the modulation depth shrinks
    const distSnrDb = (src?.laser ? 40 : src?.kind === 'microled' ? 37 : 34) - 10 * chain.modIndex;
    const base: Omit<LinkReport, 'rsHz' | 'snrDb' | 'snrEffDb' | 'preBer' | 'postBer' | 'throughput' | 'bitsPerSym' | 'limit'> = {
      rxId: r.rx.id,
      name: r.rx.name,
      kind,
      prxW: prx,
      prxDbm: 10 * Math.log10(Math.max(1e-300, prx * 1000)),
      gainDb: 10 * Math.log10(Math.max(1e-300, src ? prx / Math.max(1e-300, tr.sources.reduce((s, x) => s + x.power, 0)) : 0)),
      shares,
      iSig: iAvg * M,
      iBg: iBg * M,
      noise: { shot: shotPsd, bg: bgPsd, thermal: thermPsd, dark: darkPsd, total: sigma2PerHz },
      bLed,
      bRx,
      bCh,
      bSys,
      tauRms: ir.tau,
      warnings,
      impulse: { t: ir.t, h: ir.h },
      scint,
      servingSource: serving,
      rangeM,
    };

    // ---- no signal at all
    if (!(iAvg > 0)) {
      const anyInFov = r.perSource.some((p) => p.inFov);
      const blocked = r.perSource.some((p) => p.inFov && !p.losVisible);
      if (prx > 0 && src) {
        const nm = src.bins[0].nm;
        warnings.push(
          r.rx.filter !== 'none'
            ? `Light arrives (${(10 * Math.log10(prx * 1000)).toFixed(1)} dBm) but the ${r.rx.filter} filter blocks ${nm} nm. Match the filter to the source.`
            : `Light arrives (${(10 * Math.log10(prx * 1000)).toFixed(1)} dBm) but this detector is blind at ${nm} nm.${nm > 1100 ? ' Silicon stops near 1100 nm: use an InGaAs detector.' : nm < 400 ? ' Use a UV-enhanced detector.' : ''}`,
        );
        return { ...base, rsHz: 0, snrDb: -Infinity, snrEffDb: -Infinity, preBer: 0.5, postBer: 0.5, throughput: 0, bitsPerSym: 0, limit: 'mismatch' };
      }
      return { ...base, rsHz: 0, snrDb: -Infinity, snrEffDb: -Infinity, preBer: 0.5, postBer: 0.5, throughput: 0, bitsPerSym: 0, limit: tr.sources.length === 0 ? 'nosignal' : blocked ? 'blocked' : anyInFov ? 'nosignal' : 'fov' };
    }

    // ---- camera receivers (OCC)
    if (kind === 'camera') {
      const fps = rxNum(r, 'fps', 30);
      const rows = rxNum(r, 'rows', 1080);
      const rowUs = rxNum(r, 'rowUs', 18);
      const pix = (2 * r.rx.fov) / rows;
      let inView = 0;
      let rowsCovered = 0;
      let bitsPerFrame = 0;
      let bestSnr = 0;
      // per-pixel photon budget: source radiance × pixel solid angle × lens aperture × exposure
      const aperture = 3e-6; // ≈ 2 mm entrance pupil (phone camera)
      const tExp = 1 / (4 * fps);
      const ePhoton = 3.6e-19; // J, ~550 nm
      const ambRad = (AMBIENT[env.ambient].E * 0.05) / Math.PI; // screen/lamp surface reflects ~5 % of the room light
      tr.sources.forEach((s, si) => {
        const d = norm(sub(s.pos, r.rx.pos));
        const ang = Math.acos(Math.min(1, dot(d, r.rx.n)));
        if (ang > r.rx.fov || !(r.perSource[si].gain > 0)) return;
        inView++;
        const o = objects.find((x) => x.id === s.id);
        const sizeM = s.kind === 'screen' ? (o?.props.w as number) ?? 0.5 : s.kind === 'panel' ? 0.6 : s.kind === 'streetlamp' ? 0.5 : s.kind === 'headlight' ? 0.3 : 0.03;
        const dist = len(sub(s.pos, r.rx.pos));
        const covered = Math.min(rows, sizeM / dist / pix);
        rowsCovered = Math.max(rowsCovered, covered);
        const radiance = s.power / (Math.PI * sizeM * sizeM * (s.kind === 'screen' ? 0.58 : 0.8));
        const nSig = (radiance * pix * pix * aperture * tExp) / ePhoton;
        const nBg = (ambRad * pix * pix * aperture * tExp) / ePhoton;
        bestSnr = Math.max(bestSnr, (chain.modIndex * nSig) ** 2 / (nSig + nBg + 25));
        if (s.kind === 'screen') {
          const blockPx = ((o?.props.block as number) ?? 24) as number;
          const blockM = (sizeM * blockPx) / 1920;
          const blockPix = blockM / dist / pix;
          const usable = blockPix >= 3 ? Math.floor(covered / Math.max(3, blockPix)) : 0;
          bitsPerFrame += usable * usable * 0.56 * 2 * 0.5;
        } else if (chain.modulation === 'rsook') {
          bitsPerFrame += Math.floor(covered / 4);
        } else bitsPerFrame += 0.5;
      });
      const contrastDb = 10 * Math.log10(Math.max(1e-12, bestSnr));
      const rate = chain.modulation === 'rsook' ? Math.min(bitsPerFrame * fps * 0.8, 1 / (rowUs * 1e-6 * 4)) : bitsPerFrame * Math.min(fps / 2, 30);
      // decisions per pixel block; blur and inter-block interference cap the useful SNR
      const pre = Math.max(1e-6, Q(Math.sqrt(Math.min(bestSnr, 400))));
      const post = postFec(chain.coding, pre);
      const thr = post <= chain.targetBer ? rate * CODES[chain.coding].rate : 0;
      if (MODS[chain.modulation].family !== 'camera') warnings.push('Cameras sample at the frame or row rate: use rolling-shutter OOK or UFSOOK / screen codes. The estimate assumes a camera scheme.');
      return { ...base, rsHz: rate, snrDb: contrastDb, snrEffDb: contrastDb, preBer: pre, postBer: post, throughput: thr, bitsPerSym: 1, limit: inView ? 'camera' : 'fov', camera: { inView, rowsCovered, bitsPerFrame } };
    }

    if (MODS[chain.modulation].family === 'camera') warnings.push('Camera modulations need a camera receiver; evaluated as OOK instead.');
    const chainEff = MODS[chain.modulation].family === 'camera' ? { ...chain, modulation: 'ook' as Modulation } : chain;
    if (chainEff.equalizer === 'onetap' && MODS[chainEff.modulation].family !== 'ofdm') warnings.push('One-tap equalisation only works with OFDM: pick a time-domain equaliser for single-carrier schemes.');
    const x: EvalIn = { iMod, sigma2PerHz, bSys, bLed, chain: chainEff, distSnrDb, scintDb, photon };

    // ---- symbol rate: fixed or auto (maximise throughput meeting the target)
    let out: EvalOut;
    if (chain.symbolRateMHz > 0) out = evalAt(chain.symbolRateMHz * 1e6, x);
    else {
      const hi = Math.min(4e10, Math.max(1e4, 12 * bSys));
      let bestOut: EvalOut | null = null;
      for (let lr = 3; lr <= Math.log10(hi); lr += 0.04) {
        const o = evalAt(10 ** lr, x);
        if (!bestOut || o.thr > bestOut.thr) bestOut = o;
      }
      out = bestOut!;
      if (!(out.thr > 0)) out = evalAt(Math.max(1e3, bSys * 0.5), x);
    }
    if (kind === 'solar') base.harvestW = iAvg * 0.5;
    if (iBg > 50 * iAvg && out.limit === 'noise') out.limit = 'ambient';
    if (saturated) out.limit = 'saturated';
    if (out.thr > 0 && out.post <= chain.targetBer && out.limit === 'noise') out.limit = 'ok';
    if (!chain.interleaver && (env.turbulence > 0.3 || chain.mac === 'csma') && (sc.kind === 'outdoor' || sc.kind === 'underwater')) warnings.push('No interleaver: fades and blockage cause bursts that defeat the FEC.');
    return { ...base, rsHz: out.rs, snrDb: out.snrDb, snrEffDb: out.snrEffDb, preBer: out.pre, postBer: out.post, throughput: out.thr, bitsPerSym: out.bits, limit: out.limit, subcarriers: out.sub };
  });

  // ---- MIMO
  let mimo: BenchAnalysis['mimo'];
  if (chain.mimo && tr.sources.length >= 2 && tr.receivers.length >= 2) {
    const H = tr.receivers.map((r) => r.perSource.map((ps, si) => ps.current * tr.sources[si].power * chain.modIndex));
    const sv = svd2(H);
    const cond = sv[0] / Math.max(1e-30, sv[sv.length - 1]);
    const rep = reports[0];
    const B = Math.min(...reports.map((x) => x.bSys));
    const n2 = rep.noise.total * B;
    const capacityBps = sv.reduce((s, v) => s + B * Math.log2(1 + (v * v) / (sv.length * n2) / 2.7), 0);
    mimo = { H, sv, cond, capacityBps };
  }
  return { reports, mimo, safety };
}

/** Singular values via eigenvalues of HᵀH (Jacobi). */
function svd2(H: number[][]): number[] {
  const n = H[0].length;
  const A = Array.from({ length: n }, (_, i) => Array.from({ length: n }, (_, j) => H.reduce((s, row) => s + row[i] * row[j], 0)));
  for (let sweep = 0; sweep < 60; sweep++) {
    let off = 0;
    for (let p = 0; p < n; p++)
      for (let qq = p + 1; qq < n; qq++) {
        off += A[p][qq] ** 2;
        if (Math.abs(A[p][qq]) < 1e-300) continue;
        const th = (A[qq][qq] - A[p][p]) / (2 * A[p][qq]);
        const t = Math.sign(th || 1) / (Math.abs(th) + Math.sqrt(th * th + 1));
        const c = 1 / Math.sqrt(t * t + 1);
        const s = t * c;
        for (let k = 0; k < n; k++) {
          const akp = A[k][p];
          const akq = A[k][qq];
          A[k][p] = c * akp - s * akq;
          A[k][qq] = s * akp + c * akq;
        }
        for (let k = 0; k < n; k++) {
          const apk = A[p][k];
          const aqk = A[qq][k];
          A[p][k] = c * apk - s * aqk;
          A[qq][k] = s * apk + c * aqk;
        }
      }
    if (off < 1e-60) break;
  }
  return A.map((r, i) => Math.sqrt(Math.max(0, r[i]))).sort((a, b) => b - a);
}

export const LIMIT_TEXT: Record<Limit, string> = {
  ok: 'Link up (BER target met)',
  noise: 'Noise-limited',
  isi: 'Bandwidth / ISI-limited',
  ambient: 'Ambient-light-limited',
  blocked: 'Line of sight blocked',
  fov: 'Transmitter outside the field of view',
  nosignal: 'No light arrives',
  distortion: 'Distortion-limited (LED non-linearity)',
  camera: 'Camera link',
  saturated: 'Detector saturated',
  mismatch: 'Chain mismatch',
};
