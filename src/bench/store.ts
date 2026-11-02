import { useCallback, useEffect, useReducer } from 'react';
import type { BenchObject, BenchState, Chain, Environment, Goals, Kind, PropValue, Vec3 } from './types';
import { DEFAULT_CHAIN, DEFAULT_GOALS, makeObject, scenarioById } from './scenarios';
import { catalog } from './catalog';

/**
 * Bench state with undo/redo. Continuous edits (dragging, slider scrubbing) pass `commit: false` and
 * the first one of a gesture snapshots history, so one drag = one undo step.
 */
interface Hist {
  past: BenchState[];
  now: BenchState;
  future: BenchState[];
  gesture: boolean;
}

export type Action =
  | { t: 'scenario'; id: string }
  | { t: 'add'; obj: BenchObject }
  | { t: 'update'; id: string; patch: Partial<Omit<BenchObject, 'props'>> & { props?: Record<string, PropValue> }; commit?: boolean }
  | { t: 'swapKind'; id: string; kind: Kind }
  | { t: 'remove'; id: string }
  | { t: 'duplicate'; id: string }
  | { t: 'select'; id: string | null }
  | { t: 'env'; patch: Partial<Environment> }
  | { t: 'chain'; patch: Partial<Chain> }
  | { t: 'goals'; patch: Partial<Goals> }
  | { t: 'endGesture' }
  | { t: 'undo' }
  | { t: 'redo' }
  | { t: 'load'; state: BenchState };

export function initialState(id = 'office'): BenchState {
  const sc = scenarioById(id);
  return {
    scenario: sc.id,
    objects: sc.objects.map((o) => ({ ...o, pos: [...o.pos] as Vec3, props: { ...o.props } })),
    env: { ...sc.env },
    chain: { ...DEFAULT_CHAIN, ...(sc.chain ?? {}) },
    goals: { ...DEFAULT_GOALS, ...(sc.goals ?? {}) },
    selected: null,
  };
}

function apply(s: BenchState, a: Action): BenchState {
  switch (a.t) {
    case 'scenario':
      return initialState(a.id);
    case 'add':
      return { ...s, objects: [...s.objects, a.obj], selected: a.obj.id };
    case 'update':
      return {
        ...s,
        objects: s.objects.map((o) => (o.id === a.id ? { ...o, ...a.patch, props: a.patch.props ? { ...o.props, ...a.patch.props } : o.props } : o)),
      };
    case 'swapKind':
      return {
        ...s,
        objects: s.objects.map((o) => (o.id === a.id ? { ...o, kind: a.kind, name: o.name === catalog(o.kind).label ? catalog(a.kind).label : o.name, props: { ...catalog(a.kind).defaults, ...pick(o.props, ['fov', 'filter', 'concentrator']) } } : o)),
      };
    case 'remove':
      return { ...s, objects: s.objects.filter((o) => o.id !== a.id), selected: s.selected === a.id ? null : s.selected };
    case 'duplicate': {
      const o = s.objects.find((x) => x.id === a.id);
      if (!o) return s;
      const c = makeObject(o.kind, [o.pos[0] + 0.3, o.pos[1], o.pos[2] + 0.3], { yaw: o.yaw, pitch: o.pitch, name: `${o.name} copy`, props: { ...o.props } });
      return { ...s, objects: [...s.objects, c], selected: c.id };
    }
    case 'select':
      return { ...s, selected: a.id };
    case 'env':
      return { ...s, env: { ...s.env, ...a.patch } };
    case 'chain':
      return { ...s, chain: { ...s.chain, ...a.patch } };
    case 'goals':
      return { ...s, goals: { ...s.goals, ...a.patch } };
    case 'load':
      return a.state;
    default:
      return s;
  }
}

const pick = (o: Record<string, PropValue>, keys: string[]) => Object.fromEntries(keys.filter((k) => k in o).map((k) => [k, o[k]]));

function reducer(h: Hist, a: Action): Hist {
  if (a.t === 'undo') {
    if (!h.past.length) return h;
    return { past: h.past.slice(0, -1), now: h.past[h.past.length - 1], future: [h.now, ...h.future], gesture: false };
  }
  if (a.t === 'redo') {
    if (!h.future.length) return h;
    return { past: [...h.past, h.now], now: h.future[0], future: h.future.slice(1), gesture: false };
  }
  if (a.t === 'endGesture') return { ...h, gesture: false };
  const next = apply(h.now, a);
  if (next === h.now) return h;
  if (a.t === 'select') return { ...h, now: next };
  const continuous = a.t === 'update' && a.commit === false;
  if (continuous && h.gesture) return { ...h, now: next };
  return { past: [...h.past, h.now].slice(-80), now: next, future: [], gesture: continuous };
}

const KEY = 'lumen.bench.v1';

function loadInitial(): BenchState {
  try {
    const hash = window.location.hash;
    const m = hash.match(/[?&]s=([^&]+)/);
    if (m) return JSON.parse(decodeURIComponent(escape(atob(decodeURIComponent(m[1]))))) as BenchState;
    const sc = hash.match(/[?&]scenario=([^&]+)/);
    if (sc) return initialState(sc[1]);
    const raw = localStorage.getItem(KEY);
    if (raw) return JSON.parse(raw) as BenchState;
  } catch {
    /* fall through to the default scenario */
  }
  return initialState('office');
}

export function shareLink(s: BenchState): string {
  const json = JSON.stringify({ ...s, selected: null });
  const b64 = btoa(unescape(encodeURIComponent(json)));
  const base = window.location.href.split('#')[0];
  return `${base}#/bench?s=${encodeURIComponent(b64)}`;
}

export function useBench() {
  const [h, dispatch] = useReducer(reducer, undefined, () => ({ past: [], now: loadInitial(), future: [], gesture: false }));
  useEffect(() => {
    const t = setTimeout(() => {
      try {
        localStorage.setItem(KEY, JSON.stringify({ ...h.now, selected: null }));
      } catch {
        /* storage unavailable */
      }
    }, 400);
    return () => clearTimeout(t);
  }, [h.now]);
  const canUndo = h.past.length > 0;
  const canRedo = h.future.length > 0;
  const d = useCallback((a: Action) => dispatch(a), []);
  return { state: h.now, dispatch: d, canUndo, canRedo };
}
