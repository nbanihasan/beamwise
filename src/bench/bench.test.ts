import { describe, expect, it } from 'vitest';
import { trace, facing, aimAt, mirrorBetween, findBouncePoint } from './tracer';
import { analyse, postFec } from './link';
import { DEFAULT_CHAIN, DEFAULT_ENV, makeObject, scenarioById, type Scenario } from './scenarios';
import type { BenchObject } from './types';
import { losGain, lambertianOrder } from '@/sim/lambertian';

/** Empty space: no walls, no ground, no medium. */
const VOID: Scenario = { ...scenarioById('space'), kind: 'space', room: undefined };
const ENV = { ...DEFAULT_ENV, medium: 'vacuum' as const, ambient: 'dark' as const };
const opts = { rays: 20000, maxBounces: 6, recordRays: 0, seed: 7 };

function led(pos: [number, number, number], pitch = -90, props: Record<string, number | string> = {}): BenchObject {
  return makeObject('led', pos, { id: 'tx', pitch, props: { spectrum: 'green', power: 1, semi: 60, ...props } });
}
function pd(pos: [number, number, number], yaw = 0, pitch = 90, props: Record<string, number | string> = {}): BenchObject {
  return makeObject('pin', pos, { id: 'rx', yaw, pitch, props: { area: 100, fov: 89, concentrator: 'none', ...props } });
}

describe('Optical Bench tracer', () => {
  it('direct path matches the Lambertian LOS formula', () => {
    const objs = [led([0, 3, 0]), pd([0.8, 0.8, 0.5])];
    const r = trace(objs, VOID, ENV, opts).receivers[0].perSource[0];
    // same geometry in the z-up convention of sim/lambertian
    const ref = losGain(
      { pos: [0, 0, 3], normal: [0, 0, -1], m: lambertianOrder(60) },
      { pos: [0.8, 0.5, 0.8], normal: [0, 0, 1], area: 100e-6, fovDeg: 89 },
    );
    expect(r.los / ref.H).toBeCloseTo(1, 3);
  });

  it('facing / aim helpers agree', () => {
    const a = aimAt([0, 0, 0], [1, 1, 0]);
    const f = facing(a.yaw, a.pitch);
    expect(f[0]).toBeCloseTo(Math.SQRT1_2, 5);
    expect(f[1]).toBeCloseTo(Math.SQRT1_2, 5);
  });

  it('a mirror delivers light around a blocking wall (image-source check)', () => {
    // source and receiver at the same height facing a mirror plane at z = 2; a wall blocks the direct path
    const src = makeObject('laser', [-1, 1, 0], { id: 'tx', props: { power: 1, div: 300, spectrum: 'green' } });
    const m = mirrorBetween([0, 1, 2], [-1, 1, 0], [1, 1, 0]);
    const s2 = { ...src, ...aimAt([-1, 1, 0], [0, 1, 2]) };
    const rx = { ...pd([1, 1, 0]), ...aimAt([1, 1, 0], [0, 1, 2]) };
    const mirror = makeObject('mirror', [0, 1, 2], { id: 'm', yaw: m.yaw, pitch: m.pitch, props: { size: 3, refl: 1 } });
    const wall = makeObject('wall', [0, 0, 0], { id: 'w', yaw: 90, props: { w: 1, h: 3, material: 'black' } });
    const res = trace([s2, rx, mirror, wall], VOID, ENV, { ...opts, rays: 60000 });
    const ps = res.receivers[0].perSource[0];
    expect(ps.los).toBe(0);
    expect(ps.optics).toBeGreaterThan(0);
    // image source: same as a direct link of length |image − rx|
    const image = makeObject('laser', [-1, 1, 4], { id: 'tx', props: { power: 1, div: 300, spectrum: 'green' }, ...aimAt([-1, 1, 4], [0, 1, 2]) });
    const rxImg = { ...rx };
    const ref = trace([image, rxImg], VOID, ENV, opts).receivers[0].perSource[0].los;
    expect(ps.optics / ref).toBeGreaterThan(0.7);
    expect(ps.optics / ref).toBeLessThan(1.3);
  });

  it('a converging lens raises the power on a small detector', () => {
    const src = makeObject('laser', [0, 1, -2], { id: 'tx', props: { power: 1, div: 40, spectrum: 'red' } });
    const rx = pd([0, 1, 0.3], 180, 0, { area: 1, fov: 30 });
    const without = trace([src, rx], VOID, ENV, opts).receivers[0].perSource[0].gain;
    const lens = makeObject('lens', [0, 1, 0], { id: 'L', props: { size: 0.2, focal: 0.3 } });
    const withLens = trace([src, rx, lens], VOID, ENV, opts).receivers[0].perSource[0].gain;
    expect(withLens).toBeGreaterThan(5 * without);
  });

  it('crossed polarizers extinguish a polarized beam; aligned ones pass it', () => {
    const src = makeObject('laser', [0, 1, -1], { id: 'tx', props: { power: 1, div: 20, spectrum: 'red' } });
    const rx = pd([0, 1, 1], 180, 0);
    const p1 = makeObject('polarizer', [0, 1, 0], { id: 'p1', props: { size: 0.3, angle: 0 } });
    const p2 = makeObject('polarizer', [0, 1, 0.5], { id: 'p2', props: { size: 0.3, angle: 90 } });
    const crossed = trace([src, rx, p1, p2], VOID, ENV, opts).receivers[0].perSource[0].los;
    const aligned = trace([src, rx, p1, { ...p2, props: { ...p2.props, angle: 0 } }], VOID, ENV, opts).receivers[0].perSource[0].los;
    const open = trace([src, rx], VOID, ENV, opts).receivers[0].perSource[0].los;
    expect(crossed).toBeLessThan(1e-12);
    expect(aligned / open).toBeCloseTo(1, 3);
  });

  it('water attenuates the direct path as exp(−cL)', () => {
    const W = { ...ENV, medium: 'water' as const, waterType: 'clear' };
    const src = makeObject('laser', [0, 2, -5], { id: 'tx', props: { power: 1, div: 50, spectrum: 'green' } });
    const rx = pd([0, 2, 5], 180, 0);
    const wet = trace([src, rx], VOID, W, opts).receivers[0].perSource[0].los;
    const dry = trace([src, rx], VOID, ENV, opts).receivers[0].perSource[0].los;
    expect(wet / dry).toBeLessThan(Math.exp(-0.1 * 10));
    expect(wet / dry).toBeGreaterThan(Math.exp(-0.4 * 10));
  });

  it('the corridor scenario has no LOS, and a found bounce point creates a link', () => {
    const sc = scenarioById('corridor');
    const base = trace(sc.objects, sc, sc.env, { ...opts, rays: 4000 }).receivers[0].perSource[0];
    expect(base.los).toBe(0);
    const bp = findBouncePoint(sc.objects, sc, sc.env, 'tx', 'rx');
    expect(bp).not.toBeNull();
    const mirror = makeObject('mirror', bp!.pos, { id: 'm', yaw: bp!.yaw, pitch: bp!.pitch, props: { size: 0.6 } });
    const withMirror = trace([...sc.objects, mirror], sc, sc.env, { ...opts, rays: 20000 }).receivers[0].perSource[0];
    expect(withMirror.optics).toBeGreaterThan(0);
  });
});

describe('Optical Bench link engine', () => {
  it('FEC models are monotonic and improve on raw BER below threshold', () => {
    for (const c of ['hamming74', 'rs6432', 'cc', 'ldpc12'] as const) {
      expect(postFec(c, 1e-4)).toBeLessThan(1e-4);
      expect(postFec(c, 1e-5)).toBeLessThanOrEqual(postFec(c, 1e-3));
    }
    expect(postFec('none', 1e-3)).toBe(1e-3);
  });

  it('the office scenario delivers a working LiFi link', () => {
    const sc = scenarioById('office');
    const tr = trace(sc.objects, sc, sc.env, { ...opts, rays: 3000 });
    const a = analyse(tr, sc.objects, DEFAULT_CHAIN, sc.env, sc);
    expect(a.reports.length).toBe(2);
    expect(a.reports[0].throughput).toBeGreaterThan(1e6);
    expect(a.reports[0].tauRms).toBeGreaterThan(0);
  });

  it('a narrower receiver FOV with a concentrator raises SNR outdoors', () => {
    const sc = scenarioById('street');
    const chain = { ...DEFAULT_CHAIN, modulation: 'ook' as const, symbolRateMHz: 1, equalizer: 'none' as const };
    const wide = sc.objects.map((o) => (o.id === 'rx' ? { ...o, props: { ...o.props, fov: 60, concentrator: 'none' } } : o));
    const narrow = sc.objects.map((o) => (o.id === 'rx' ? { ...o, props: { ...o.props, fov: 10, concentrator: 'lens' } } : o));
    const aw = analyse(trace(wide, sc, sc.env, { ...opts, rays: 2000 }), wide, chain, sc.env, sc).reports[0];
    const an = analyse(trace(narrow, sc, sc.env, { ...opts, rays: 2000 }), narrow, chain, sc.env, sc).reports[0];
    expect(an.snrDb).toBeGreaterThan(aw.snrDb);
  });
});

import { SCENARIOS } from './scenarios';
import { advise } from './advisor';
import { initialState } from './store';

describe('every scenario runs end to end', () => {
  for (const sc of SCENARIOS) {
    it(`${sc.id}: trace → analyse → advise without NaN`, () => {
      const st = initialState(sc.id);
      const tr = trace(st.objects, sc, st.env, { rays: 1500, maxBounces: 4, recordRays: 20, seed: 3 });
      const an = analyse(tr, st.objects, st.chain, st.env, sc);
      const adv = advise(sc, st.objects, tr, an, st.chain, st.goals);
      for (const r of an.reports) {
        expect(Number.isNaN(r.throughput)).toBe(false);
        expect(Number.isNaN(r.prxW)).toBe(false);
        expect(Number.isNaN(r.snrDb)).toBe(false);
        expect(Number.isNaN(r.postBer)).toBe(false);
      }
      expect(adv.blueprint.length).toBeGreaterThan(10);
      // eslint-disable-next-line no-console
      console.log(sc.id, an.reports.map((r) => `${r.name}: ${(r.throughput / 1e6).toPrecision(3)} Mb/s, ${r.prxDbm.toFixed(1)} dBm, SNR ${r.snrDb.toFixed(1)} dB, ${r.limit}`).join(' | '));
    });
  }
});
