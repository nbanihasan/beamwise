import { describe, expect, it } from 'vitest';
import { trace, coverage, findBouncePoint } from './tracer';
import { analyse, MODS, CODES, EQS } from './link';
import { advise } from './advisor';
import { CATALOG } from './catalog';
import { DEFAULT_CHAIN, DEFAULT_ENV, DEFAULT_GOALS, SCENARIOS, makeObject } from './scenarios';
import type { BenchObject, Chain, Environment, Kind } from './types';
import { rng } from '@/sim/math';

/**
 * Adversarial fuzzing of the Optical Bench engine: random scenarios, hostile object placements
 * (inside walls, at the origin, stacked on each other), extreme property values and random modem
 * chains. Every number the UI shows must stay finite and physically sensible.
 */
const MEDIA: Environment['medium'][] = ['air', 'fog', 'water', 'vacuum'];
const AMB: Environment['ambient'][] = ['dark', 'night', 'indoor', 'window', 'daylight', 'underwater'];
const LINE: Chain['lineCode'][] = ['none', 'manchester', '4b6b', '8b10b'];
const MAC: Chain['mac'][] = ['p2p', 'tdma', 'ofdma', 'noma', 'csma'];

function pick<T>(u: () => number, a: readonly T[]): T {
  return a[Math.floor(u() * a.length)];
}

function randomObject(u: () => number, i: number, extreme: boolean): BenchObject {
  const entry = pick(u, CATALOG);
  const pos: [number, number, number] = extreme && u() < 0.3 ? [0, 0, 0] : [(u() - 0.5) * 12, u() * 4, (u() - 0.5) * 12];
  const props: Record<string, number | string> = { ...entry.defaults } as Record<string, number | string>;
  for (const p of entry.props) {
    if (p.type === 'num' && p.min !== undefined && p.max !== undefined) {
      const t = extreme ? pick(u, [0, 1, u()]) : u();
      props[p.key] = p.log ? p.min * Math.pow(p.max / p.min, t) : p.min + (p.max - p.min) * t;
    } else if (p.type === 'sel' && p.options?.length) {
      props[p.key] = pick(u, p.options).value;
    }
  }
  return makeObject(entry.kind as Kind, pos, { id: `o${i}`, yaw: (u() - 0.5) * 360, pitch: (u() - 0.5) * 180, props });
}

function finite(x: unknown, path: string, bad: string[]) {
  if (typeof x === 'number' && !Number.isFinite(x)) bad.push(`${path}=${x}`);
}

describe('Optical Bench fuzz', () => {
  it('stays finite and sensible over 250 random hostile setups', () => {
    const u = rng(20261103);
    const failures: string[] = [];
    for (let n = 0; n < 250; n++) {
      const sc = pick(u, SCENARIOS);
      const extreme = n % 3 === 0;
      const objects = [...sc.objects.map((o) => ({ ...o, props: { ...o.props } }))];
      const extra = Math.floor(u() * 6);
      for (let i = 0; i < extra; i++) objects.push(randomObject(u, i, extreme));
      if (u() < 0.15) objects.length = Math.floor(u() * objects.length); // sometimes strip things out, even everything
      const env: Environment = {
        ...DEFAULT_ENV,
        ...sc.env,
        medium: u() < 0.3 ? pick(u, MEDIA) : sc.env.medium,
        ambient: u() < 0.3 ? pick(u, AMB) : sc.env.ambient,
        visibilityKm: extreme ? pick(u, [0.01, 0.05, 50]) : 0.05 + u() * 20,
        turbulence: extreme ? pick(u, [0, 1]) : u(),
      };
      const chain: Chain = {
        ...DEFAULT_CHAIN,
        modulation: pick(u, Object.keys(MODS) as Chain['modulation'][]),
        coding: pick(u, Object.keys(CODES) as Chain['coding'][]),
        equalizer: pick(u, Object.keys(EQS) as Chain['equalizer'][]),
        lineCode: pick(u, LINE),
        mac: pick(u, MAC),
        mimo: u() < 0.3,
        interleaver: u() < 0.5,
        bitLoading: u() < 0.5,
        qam: pick(u, [2, 4, 16, 64, 256, 1024]),
        modIndex: extreme ? pick(u, [0, 1]) : u(),
        symbolRateMHz: extreme ? pick(u, [0, 0.001, 50000]) : pick(u, [0, 1, 20, 200]),
      };
      const tag = `#${n} ${sc.id} ${objects.map((o) => o.kind).join(',')} ${chain.modulation}/${chain.coding}/${chain.equalizer}`;
      try {
        const tr = trace(objects, sc, env, { rays: 1500, maxBounces: 4, recordRays: 20, seed: n + 1 });
        const an = analyse(tr, objects, chain, env, sc);
        const bad: string[] = [];
        for (const r of an.reports) {
          // −Infinity SNR / dBm (no light at all) and Infinity channel bandwidth (no delay spread) are deliberate
          // sentinels that the UI renders as "—" / "∞"; NaN or +Infinity there would be real bugs.
          const SENTINEL = new Set(['snrDb', 'snrEffDb', 'prxDbm', 'gainDb', 'bCh']);
          for (const [k, v] of Object.entries(r)) {
            if (SENTINEL.has(k) && typeof v === 'number' && !Number.isNaN(v) && (k === 'bCh' ? v > 0 : v < 0)) continue;
            finite(v, k, bad);
          }
          for (const [k, v] of Object.entries(r.noise)) finite(v, `noise.${k}`, bad);
          if (r.throughput < 0) bad.push(`throughput<0 (${r.throughput})`);
          if (r.prxW < 0) bad.push(`prxW<0 (${r.prxW})`);
          if (!(r.postBer >= 0 && r.postBer <= 0.5 + 1e-9)) bad.push(`postBer=${r.postBer}`);
          if (!(r.preBer >= 0 && r.preBer <= 0.5 + 1e-9)) bad.push(`preBer=${r.preBer}`);
          if (r.impulse.h.some((h) => !Number.isFinite(h))) bad.push('impulse NaN');
        }
        if (an.mimo) an.mimo.sv.forEach((s, i) => finite(s, `sv${i}`, bad));
        const adv = advise(sc, objects, tr, an, chain, DEFAULT_GOALS);
        if (!adv || !Array.isArray(adv.findings)) bad.push('advisor returned nothing');
        // everything the advisor says is shown verbatim to the user
        const text = JSON.stringify(adv);
        const leak = text.match(/.{0,40}(NaN|Infinity|undefined).{0,20}/);
        if (leak) bad.push(`advisor text: …${leak[0]}…`);
        if (bad.length) failures.push(`${tag}: ${bad.slice(0, 4).join('; ')}`);
      } catch (e) {
        failures.push(`${tag}: THREW ${(e as Error).message}`);
      }
    }
    expect(failures.slice(0, 12)).toEqual([]);
  }, 120_000);

  it('helpers survive degenerate geometry', () => {
    const sc = SCENARIOS[0];
    const same = [makeObject('led', [1, 2, 1], { id: 'a' }), makeObject('pin', [1, 2, 1], { id: 'b' })];
    expect(() => trace(same, sc, DEFAULT_ENV, { rays: 500, maxBounces: 3, recordRays: 0, seed: 1 })).not.toThrow();
    expect(() => findBouncePoint(same, sc, DEFAULT_ENV, 'a', 'b')).not.toThrow();
    const cov = coverage(sc.objects, sc, DEFAULT_ENV, 0.8, 8);
    expect(Array.from(cov.grid).every((v) => Number.isFinite(v))).toBe(true);
    expect(Number.isFinite(cov.peak)).toBe(true);
  });
});
