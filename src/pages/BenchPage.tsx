import { useCallback, useDeferredValue, useEffect, useMemo, useRef, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { BenchCanvas, type Layers, type SceneApi, type ViewMode } from '@/bench/BenchScene';
import { AdvisorPanel, ChainPanel, EnvPanel, Inspector, Library, ResultsPanel, ScenarioPicker } from '@/bench/BenchPanels';
import { shareLink, useBench } from '@/bench/store';
import { makeObject, scenarioById } from '@/bench/scenarios';
import { catalog } from '@/bench/catalog';
import { aimAt, coverage, findBouncePoint, trace } from '@/bench/tracer';
import { analyse } from '@/bench/link';
import { advise, fmtRate, type Fix } from '@/bench/advisor';
import type { Kind, Vec3 } from '@/bench/types';
import './bench.css';

/**
 * The Optical Bench: pick a scenario, place components in 3D, and see the channel, the link budget,
 * the modem chain and a recommended design update live.
 */
type Tab = 'results' | 'chain' | 'advisor';
type MobileTab = 'scene' | 'library' | 'inspect' | Tab;

export default function BenchPage() {
  const { state, dispatch, canUndo, canRedo } = useBench();
  const sc = scenarioById(state.scenario);
  const [params, setParams] = useSearchParams();
  const wanted = params.get('scenario');
  // follow ?scenario= links (e.g. from the use-case gallery) even when the bench is already open
  useEffect(() => {
    if (wanted && wanted !== state.scenario && scenarioById(wanted).id === wanted) dispatch({ t: 'scenario', id: wanted });
  }, [wanted]); // eslint-disable-line react-hooks/exhaustive-deps
  const api = useRef<SceneApi | null>(null);
  const [tab, setTab] = useState<Tab>('results');
  const [mtab, setMtab] = useState<MobileTab>('scene');
  const [drawer, setDrawer] = useState(true);
  const [layers, setLayers] = useState<Layers>({ rays: true, los: true, coverage: false, labels: true });
  const [toast, setToast] = useState<string | null>(null);
  const [libOpen, setLibOpen] = useState(true);

  // ---- physics (deferred so dragging stays smooth)
  const deferred = useDeferredValue(state);
  const busy = deferred !== state;
  const tr = useMemo(() => {
    const big = sc.kind === 'indoor' || sc.kind === 'lab';
    return trace(deferred.objects, sc, deferred.env, { rays: big ? 6000 : 3000, maxBounces: 5, recordRays: big ? 140 : 120, seed: 11 });
  }, [deferred.objects, deferred.env, sc]);
  const an = useMemo(() => analyse(tr, deferred.objects, deferred.chain, deferred.env, sc), [tr, deferred.objects, deferred.chain, deferred.env, sc]);
  const advice = useMemo(() => advise(sc, deferred.objects, tr, an, deferred.chain, deferred.goals), [sc, deferred.objects, tr, an, deferred.chain, deferred.goals]);
  const cov = useMemo(() => (layers.coverage && sc.room ? coverage(deferred.objects, sc, deferred.env, sc.heights.desk, 48) : null), [layers.coverage, deferred.objects, deferred.env, sc]);

  const selected = state.objects.find((o) => o.id === state.selected) ?? null;
  const flash = useCallback((m: string) => {
    setToast(m);
    window.setTimeout(() => setToast((t) => (t === m ? null : t)), 3200);
  }, []);

  // ---- adding objects
  const add = useCallback(
    (kind: Kind, at?: Vec3) => {
      const c = catalog(kind);
      const h = { ceiling: sc.heights.ceiling, desk: sc.heights.desk, floor: 0, wall: sc.heights.free, free: sc.heights.free, pole: sc.heights.pole }[c.mount];
      const base: Vec3 = at ? [at[0], h, at[2]] : (api.current?.spawn(h) ?? [0, h, 0]);
      // nudge away from objects already at this spot
      const taken = (p: Vec3) => state.objects.some((o) => Math.hypot(o.pos[0] - p[0], o.pos[2] - p[2]) < sc.snap * 2 && Math.abs(o.pos[1] - p[1]) < 0.3);
      let pos: Vec3 = base;
      for (let i = 1; taken(pos) && i < 12; i++) pos = [base[0] + i * sc.snap * 2, base[1], base[2] + ((i % 2) * 2 - 1) * sc.snap];
      let obj = makeObject(kind, pos);
      // smart orientation: open scenes point new parts at their counterpart
      const sources = state.objects.filter((o) => catalog(o.kind).category === 'source');
      const receivers = state.objects.filter((o) => catalog(o.kind).category === 'receiver');
      const nearest = (list: typeof sources) => list.slice().sort((a, b) => Math.hypot(...(a.pos.map((v, i) => v - pos[i]) as Vec3)) - Math.hypot(...(b.pos.map((v, i) => v - pos[i]) as Vec3)))[0];
      const open = sc.kind !== 'indoor';
      if (c.category === 'receiver' && (open || c.mount === 'free') && sources.length) obj = { ...obj, ...aimAt(pos, nearest(sources).pos) };
      if (c.category === 'source' && (open || c.mount === 'free') && receivers.length) obj = { ...obj, ...aimAt(pos, nearest(receivers).pos) };
      if (c.category === 'optic' && sources.length) obj = { ...obj, ...aimAt(pos, nearest(sources).pos) };
      dispatch({ t: 'add', obj });
      flash(`Added ${c.label}. Drag it to move; Shift-drag to change height.`);
    },
    [sc, state.objects, dispatch, flash],
  );

  const bounce = useCallback(
    (src: string, rx: string) => {
      const bp = findBouncePoint(state.objects, sc, state.env, src, rx);
      if (!bp) {
        flash('No single-bounce path found from the room surfaces. Try moving the receiver or adding a RIS.');
        return;
      }
      const m = makeObject('mirror', bp.pos, { name: 'Bounce mirror', yaw: bp.yaw, pitch: bp.pitch, props: { size: sc.kind === 'lab' ? 0.1 : 0.5 } });
      dispatch({ t: 'add', obj: m });
      flash('Mirror placed at the best bounce point and aligned between transmitter and receiver.');
    },
    [state.objects, state.env, sc, dispatch, flash],
  );

  const onFix = useCallback(
    (f: Fix) => {
      if (f.chain) dispatch({ t: 'chain', patch: f.chain });
      if (f.patch) dispatch({ t: 'update', id: f.patch.id, patch: { props: f.patch.props } });
      if (f.swapKind) dispatch({ t: 'swapKind', id: f.swapKind.id, kind: f.swapKind.kind });
      if (f.aim) {
        const a = state.objects.find((o) => o.id === f.aim!.id);
        const b = state.objects.find((o) => o.id === f.aim!.at);
        if (a && b) dispatch({ t: 'update', id: a.id, patch: aimAt(a.pos, b.pos) });
      }
      if (f.bounce) bounce(f.bounce.src, f.bounce.rx);
      flash(`Applied: ${f.label}`);
    },
    [dispatch, state.objects, bounce, flash],
  );

  // ---- keyboard
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement;
      if (t && (t.tagName === 'INPUT' || t.tagName === 'SELECT' || t.tagName === 'TEXTAREA')) return;
      const mod = e.ctrlKey || e.metaKey;
      if (mod && e.key.toLowerCase() === 'z') {
        e.preventDefault();
        dispatch({ t: e.shiftKey ? 'redo' : 'undo' });
      } else if (mod && e.key.toLowerCase() === 'y') {
        e.preventDefault();
        dispatch({ t: 'redo' });
      } else if (!selected) return;
      else if (e.key === 'Delete' || e.key === 'Backspace') {
        e.preventDefault();
        dispatch({ t: 'remove', id: selected.id });
      } else if (mod && e.key.toLowerCase() === 'd') {
        e.preventDefault();
        dispatch({ t: 'duplicate', id: selected.id });
      } else if (e.key === 'Escape') dispatch({ t: 'select', id: null });
      else if (e.key.toLowerCase() === 'r') dispatch({ t: 'update', id: selected.id, patch: { yaw: ((selected.yaw + (e.shiftKey ? -15 : 15) + 540) % 360) - 180 } });
      else if (e.key.toLowerCase() === 't') dispatch({ t: 'update', id: selected.id, patch: { pitch: Math.max(-90, Math.min(90, selected.pitch + (e.shiftKey ? -15 : 15))) } });
      else if (e.key.startsWith('Arrow')) {
        e.preventDefault();
        const s = sc.snap * (e.shiftKey ? 5 : 1);
        const [x, y, z] = selected.pos;
        const p: Vec3 = e.key === 'ArrowLeft' ? [x - s, y, z] : e.key === 'ArrowRight' ? [x + s, y, z] : e.key === 'ArrowUp' ? (e.altKey ? [x, y + s, z] : [x, y, z - s]) : e.altKey ? [x, y - s, z] : [x, y, z + s];
        dispatch({ t: 'update', id: selected.id, patch: { pos: p } });
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [selected, dispatch, sc.snap]);

  const share = async () => {
    const url = shareLink(state);
    try {
      await navigator.clipboard.writeText(url);
      flash('Link copied: it contains the whole setup.');
    } catch {
      window.prompt('Copy this link to share the setup:', url);
    }
  };

  const onDrop = (e: React.DragEvent) => {
    const kind = e.dataTransfer.getData('text/x-bench-kind') as Kind;
    if (!kind) return;
    e.preventDefault();
    const c = catalog(kind);
    const h = { ceiling: sc.heights.ceiling, desk: sc.heights.desk, floor: 0, wall: sc.heights.free, free: sc.heights.free, pole: sc.heights.pole }[c.mount];
    const p = api.current?.screenToWorld(e.clientX, e.clientY, h);
    if (p) add(kind, [Math.round(p[0] / sc.snap) * sc.snap, h, Math.round(p[2] / sc.snap) * sc.snap]);
  };

  const best = an.reports.length ? an.reports.reduce((a, b) => (b.throughput > a.throughput ? b : a)) : null;
  const L = (k: keyof Layers, label: string) => (
    <button type="button" className={`bt-toggle ${layers[k] ? 'on' : ''}`} onClick={() => setLayers({ ...layers, [k]: !layers[k] })} aria-pressed={layers[k]}>
      {label}
    </button>
  );
  const panelTabs = (
    <div className="bd-tabs" role="tablist">
      {(['results', 'chain', 'advisor'] as Tab[]).map((t) => (
        <button key={t} type="button" role="tab" aria-selected={tab === t} className={tab === t ? 'on' : ''} onClick={() => (setTab(t), setDrawer(true))}>
          {t === 'results' ? 'Link quality' : t === 'chain' ? 'Modem chain' : 'Advisor'}
          {t === 'advisor' && advice.findings.some((f) => f.level === 'bad' || f.level === 'warn') && <i className="bd-dot" />}
        </button>
      ))}
      <span className="bd-headline">{advice.headline}</span>
      <button type="button" className="bd-collapse" onClick={() => setDrawer((d) => !d)} aria-label={drawer ? 'Collapse panel' : 'Expand panel'}>
        {drawer ? '▾' : '▴'}
      </button>
    </div>
  );
  const tabBody = (t: Tab) =>
    t === 'results' ? <ResultsPanel an={an} chain={state.chain} ms={tr.stats.ms} rays={tr.stats.rays} /> : t === 'chain' ? <ChainPanel chain={state.chain} dispatch={dispatch} report={an.reports[0]} /> : <AdvisorPanel advice={advice} state={state} dispatch={dispatch} onFix={onFix} />;

  return (
    <div className={`bench ${libOpen ? '' : 'nolib'} m-${mtab}`}>
      <div className="bt">
        <div className="bt-group">
          <span className="eyebrow">Optical Bench</span>
          <ScenarioPicker value={state.scenario} onPick={(id) => (dispatch({ t: 'scenario', id }), setParams({ scenario: id }, { replace: true }), flash(`Loaded “${scenarioById(id).name}”.`))} />
        </div>
        <div className="bt-group">
          {(['persp', 'top', 'front', 'side'] as ViewMode[]).map((v) => (
            <button key={v} type="button" className="bt-toggle" onClick={() => api.current?.view(v)}>
              {v === 'persp' ? '3D' : v[0].toUpperCase() + v.slice(1)}
            </button>
          ))}
        </div>
        <div className="bt-group">
          {L('rays', 'Rays')}
          {L('los', 'LOS')}
          {sc.room && L('coverage', 'Coverage')}
          {L('labels', 'Labels')}
        </div>
        <div className="bt-group">
          <button type="button" className="bt-toggle" disabled={!canUndo} onClick={() => dispatch({ t: 'undo' })} title="Undo (Ctrl+Z)">
            Undo
          </button>
          <button type="button" className="bt-toggle" disabled={!canRedo} onClick={() => dispatch({ t: 'redo' })} title="Redo (Ctrl+Y)">
            Redo
          </button>
          <button type="button" className="bt-toggle" onClick={() => dispatch({ t: 'scenario', id: state.scenario })}>
            Reset
          </button>
          <button type="button" className="bt-toggle" onClick={share}>
            Share
          </button>
        </div>
        <div className="bt-kpi" aria-live="polite">
          {best ? (
            <>
              <b>{best.throughput > 0 ? fmtRate(best.throughput) : 'no link'}</b>
              <span>best link · {busy ? 'updating…' : `${tr.stats.ms.toFixed(0)} ms`}</span>
            </>
          ) : (
            <span>add a transmitter and a receiver</span>
          )}
        </div>
      </div>

      <aside className="b-lib">
        <button type="button" className="b-lib-toggle" onClick={() => setLibOpen((o) => !o)} aria-label={libOpen ? 'Hide library' : 'Show library'}>
          {libOpen ? '‹' : '›'}
        </button>
        {libOpen && <Library onAdd={(k) => add(k)} sc={sc} />}
      </aside>

      <section className="b-stage" onDragOver={(e) => e.preventDefault()} onDrop={onDrop}>
        <BenchCanvas state={state} sc={sc} dispatch={dispatch} tr={tr} an={an} cov={cov} layers={layers} onApi={(a) => (api.current = a)} />
        {layers.coverage && cov && (
          <div className="b-legend">
            <span>Received power at desk height</span>
            <i />
            <span className="mono">
              {(10 * Math.log10(cov.peak * 1e-3 * 1000)).toFixed(0)} … {(10 * Math.log10(cov.peak * 1000)).toFixed(0)} dBm
            </span>
          </div>
        )}
        <div className="b-help">Drag to move · Shift-drag: height · Right-drag: pan · R/T: rotate · Del: delete</div>
        {toast && <div className="b-toast">{toast}</div>}
      </section>

      <aside className="b-insp">{selected ? <Inspector key={selected.id} o={selected} state={state} sc={sc} dispatch={dispatch} onBounce={bounce} /> : <EnvPanel state={state} sc={sc} dispatch={dispatch} />}</aside>

      <section className={`b-drawer ${drawer ? 'open' : ''}`}>
        {panelTabs}
        {drawer && <div className="bd-body">{tabBody(tab)}</div>}
      </section>

      <nav className="b-mtabs" aria-label="Bench panels">
        {(['scene', 'library', 'inspect', 'results', 'chain', 'advisor'] as MobileTab[]).map((t) => (
          <button key={t} type="button" className={mtab === t ? 'on' : ''} onClick={() => setMtab(t)}>
            {{ scene: '3D', library: 'Add', inspect: selected ? 'Edit' : 'Scene', results: 'Link', chain: 'Chain', advisor: 'Advice' }[t]}
          </button>
        ))}
      </nav>
      <div className="b-mbody">
        {mtab === 'library' && <Library onAdd={(k) => (add(k), setMtab('scene'))} sc={sc} />}
        {mtab === 'inspect' && (selected ? <Inspector key={selected.id} o={selected} state={state} sc={sc} dispatch={dispatch} onBounce={bounce} /> : <EnvPanel state={state} sc={sc} dispatch={dispatch} />)}
        {(mtab === 'results' || mtab === 'chain' || mtab === 'advisor') && tabBody(mtab)}
      </div>
    </div>
  );
}
