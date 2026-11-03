import { useMemo, useState, type ReactNode } from 'react';
import { Link } from 'react-router-dom';
import type { BenchObject, BenchState, Category, Chain, Kind, PropValue, Vec3 } from './types';
import { CATALOG, CATEGORY_LABEL, catalog, type PropSpec } from './catalog';
import type { Scenario } from './scenarios';
import { SCENARIOS } from './scenarios';
import type { Action } from './store';
import type { BenchAnalysis, LinkReport } from './link';
import { CODES, EQS, LIMIT_TEXT, LINECODES, MODS } from './link';
import type { Advice, Fix } from './advisor';
import { fmtRate } from './advisor';
import { aimAt, mirrorBetween } from './tracer';
import { AMBIENT } from './optics';
import { WATER_TYPES } from '@/sim/outdoor';
import { Plot } from '@/viz/Plot';
import { Select, Slider, Toggle } from '@/viz/controls';
import { lessonById } from '@/content/registry';
import { MATERIAL_OPTS } from './catalog';

const D = (n: number, d = 2) => (Math.abs(n) >= 1000 ? n.toExponential(2) : n.toFixed(d));

export function Glyph({ path, size = 22 }: { path: string; size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d={path} />
    </svg>
  );
}

// ------------------------------------------------------------------ library
export function Library({ onAdd, sc }: { onAdd: (k: Kind) => void; sc: Scenario }) {
  const [q, setQ] = useState('');
  const [open, setOpen] = useState<Record<Category, boolean>>({ source: true, receiver: true, optic: true, environment: sc.kind !== 'space' });
  const items = CATALOG.filter((c) => !q || `${c.label} ${c.blurb}`.toLowerCase().includes(q.toLowerCase()));
  return (
    <div className="bl">
      <input className="bl-search" placeholder="Search components…" value={q} onChange={(e) => setQ(e.target.value)} aria-label="Search components" />
      {(['source', 'receiver', 'optic', 'environment'] as Category[]).map((cat) => {
        const list = items.filter((i) => i.category === cat);
        if (!list.length) return null;
        return (
          <section key={cat} className={`bl-cat ${cat}`}>
            <button type="button" className="bl-cat-head" onClick={() => setOpen({ ...open, [cat]: !open[cat] })} aria-expanded={open[cat] || !!q}>
              <span>{CATEGORY_LABEL[cat]}</span>
              <span className="mono">{list.length}</span>
            </button>
            {(open[cat] || !!q) && (
              <div className="bl-grid">
                {list.map((c) => (
                  <button
                    key={c.kind}
                    type="button"
                    className="bl-item"
                    draggable
                    onDragStart={(e) => {
                      e.dataTransfer.setData('text/x-bench-kind', c.kind);
                      e.dataTransfer.effectAllowed = 'copy';
                    }}
                    onClick={() => onAdd(c.kind)}
                    title={`${c.label}: ${c.blurb} (click to add, or drag into the scene)`}
                  >
                    <Glyph path={c.glyph} />
                    <span>{c.label}</span>
                  </button>
                ))}
              </div>
            )}
          </section>
        );
      })}
      <p className="bl-hint">Click to add where you are looking, or drag into the scene. Drag objects to move them; hold Shift to change height.</p>
    </div>
  );
}

// ------------------------------------------------------------------ inspector
function NumField({ label, value, onChange, step = 0.05, unit }: { label: string; value: number; onChange: (v: number) => void; step?: number; unit?: string }) {
  return (
    <label className="bi-num">
      <span>{label}</span>
      <input type="number" value={Number(value.toFixed(4))} step={step} onChange={(e) => isFinite(+e.target.value) && onChange(+e.target.value)} />
      {unit && <em>{unit}</em>}
    </label>
  );
}

function PropControl({ spec, value, onChange, objects, self }: { spec: PropSpec; value: PropValue; onChange: (v: PropValue) => void; objects: BenchObject[]; self: string }) {
  if (spec.type === 'sel') return <Select label={spec.label} value={String(value)} options={spec.options!} onChange={onChange} />;
  if (spec.type === 'bool') return <Toggle label={spec.label} checked={!!value} onChange={onChange} />;
  if (spec.type === 'target')
    return <Select label={spec.label} value={String(value || '')} options={[{ value: '', label: 'Plain mirror reflection' }, ...objects.filter((o) => o.id !== self && catalog(o.kind).category === 'receiver').map((o) => ({ value: o.id, label: o.name }))]} onChange={onChange} />;
  const v = typeof value === 'number' ? value : Number(value);
  return <Slider label={spec.label} value={v} min={spec.min!} max={spec.max!} step={spec.step} log={spec.log} unit={spec.unit} onChange={onChange} format={(x) => `${x >= 100 || spec.step === 1 ? Number(x.toPrecision(3)) : Number(x.toPrecision(3))}${spec.unit ? ` ${spec.unit}` : ''}`} />;
}

export function Inspector({ o, state, sc, dispatch, onBounce }: { o: BenchObject; state: BenchState; sc: Scenario; dispatch: (a: Action) => void; onBounce: (src: string, rx: string) => void }) {
  const c = catalog(o.kind);
  const [aim, setAim] = useState('');
  const [m1, setM1] = useState('');
  const [m2, setM2] = useState('');
  const others = state.objects.filter((x) => x.id !== o.id && catalog(x.kind).category !== 'environment');
  const set = (patch: Partial<BenchObject>, commit = true) => dispatch({ t: 'update', id: o.id, patch, commit });
  const setProp = (k: string, v: PropValue) => dispatch({ t: 'update', id: o.id, patch: { props: { [k]: v } }, commit: false });
  const env = c.category === 'environment';
  const lesson = c.lesson ? lessonById(c.lesson) : undefined;
  const sources = state.objects.filter((x) => catalog(x.kind).category === 'source');
  return (
    <div className="bi">
      <div className="bi-head">
        <span className={`bi-cat ${c.category}`}>
          <Glyph path={c.glyph} size={18} />
        </span>
        <input className="bi-name" value={o.name} onChange={(e) => set({ name: e.target.value })} aria-label="Name" />
      </div>
      <p className="bi-blurb">{c.blurb}</p>

      <div className="bi-section">
        <span className="eyebrow">Position (m)</span>
        <div className="bi-xyz">
          <NumField label="x" value={o.pos[0]} step={sc.snap} onChange={(v) => set({ pos: [v, o.pos[1], o.pos[2]] })} />
          <NumField label="y" value={o.pos[1]} step={sc.snap} onChange={(v) => set({ pos: [o.pos[0], v, o.pos[2]] })} />
          <NumField label="z" value={o.pos[2]} step={sc.snap} onChange={(v) => set({ pos: [o.pos[0], o.pos[1], v] })} />
        </div>
        {!env && sc.room && (
          <div className="bi-quick">
            <span className="small muted">Place at</span>
            <button type="button" className="chipbtn" onClick={() => set({ pos: [o.pos[0], sc.heights.ceiling, o.pos[2]], pitch: c.category === 'source' ? -90 : o.pitch })}>
              ceiling
            </button>
            <button type="button" className="chipbtn" onClick={() => set({ pos: [o.pos[0], sc.heights.desk, o.pos[2]], pitch: c.category === 'receiver' ? 90 : o.pitch })}>
              desk
            </button>
            <button type="button" className="chipbtn" onClick={() => set({ pos: [o.pos[0], sc.heights.free, o.pos[2]] })}>
              eye level
            </button>
          </div>
        )}
      </div>

      <div className="bi-section">
        <span className="eyebrow">Orientation</span>
        <Slider label="Yaw (turn)" value={o.yaw} min={-180} max={180} step={1} unit="°" onChange={(v) => set({ yaw: v }, false)} />
        {!env && <Slider label="Pitch (tilt)" value={o.pitch} min={-90} max={90} step={1} unit="°" onChange={(v) => set({ pitch: v }, false)} />}
        {!env && others.length > 0 && (
          <div className="bi-aim">
            <Select label="Point at" value={aim} options={[{ value: '', label: 'Choose an object…' }, ...others.map((x) => ({ value: x.id, label: x.name }))]} onChange={setAim} />
            <button
              type="button"
              className="btn small"
              disabled={!aim}
              onClick={() => {
                const t = state.objects.find((x) => x.id === aim);
                if (t) set(aimAt(o.pos, t.pos));
              }}
            >
              Aim
            </button>
          </div>
        )}
        {(o.kind === 'mirror' || o.kind === 'concave' || o.kind === 'convex' || o.kind === 'splitter' || o.kind === 'ris') && others.length > 1 && (
          <div className="bi-mirror">
            <span className="small muted">Reflect light from</span>
            <Select value={m1} options={[{ value: '', label: '…' }, ...others.map((x) => ({ value: x.id, label: x.name }))]} onChange={setM1} />
            <span className="small muted">to</span>
            <Select value={m2} options={[{ value: '', label: '…' }, ...others.map((x) => ({ value: x.id, label: x.name }))]} onChange={setM2} />
            <button
              type="button"
              className="btn small"
              disabled={!m1 || !m2 || m1 === m2}
              onClick={() => {
                const a = state.objects.find((x) => x.id === m1);
                const b = state.objects.find((x) => x.id === m2);
                if (a && b) set(mirrorBetween(o.pos, a.pos, b.pos));
                if (o.kind === 'ris' && b) setProp('target', b.id);
              }}
            >
              Align
            </button>
          </div>
        )}
      </div>

      {c.props.length > 0 && (
        <div className="bi-section">
          <span className="eyebrow">Properties</span>
          {c.props.map((spec) => (
            <PropControl key={spec.key} spec={spec} value={o.props[spec.key] ?? c.defaults[spec.key]} onChange={(v) => setProp(spec.key, v)} objects={state.objects} self={o.id} />
          ))}
          {c.props.some((p) => p.help) && <p className="small muted">{c.props.find((p) => p.help)?.help}</p>}
        </div>
      )}

      {c.category === 'receiver' && sources.length > 0 && (
        <div className="bi-section">
          <span className="eyebrow">Helpers</span>
          <button type="button" className="btn small" onClick={() => onBounce(sources[0].id, o.id)}>
            Find a bounce point (add mirror)
          </button>
        </div>
      )}

      <div className="bi-actions">
        <button type="button" className="btn small" onClick={() => dispatch({ t: 'duplicate', id: o.id })}>
          Duplicate
        </button>
        <button type="button" className="btn small danger" onClick={() => dispatch({ t: 'remove', id: o.id })}>
          Delete
        </button>
        {lesson && (
          <Link className="btn small" to={`/learn/${lesson.id}`}>
            Learn: {lesson.title.split(':')[0]}
          </Link>
        )}
      </div>
    </div>
  );
}

// ------------------------------------------------------------------ environment
export function EnvPanel({ state, sc, dispatch }: { state: BenchState; sc: Scenario; dispatch: (a: Action) => void }) {
  const env = state.env;
  const setEnv = (patch: Partial<BenchState['env']>) => dispatch({ t: 'env', patch });
  return (
    <div className="bi">
      <span className="eyebrow">Scenario</span>
      <h3 className="be-title">{sc.name}</h3>
      <p className="bi-blurb">{sc.blurb}</p>
      <div className="be-challenge">
        <span className="eyebrow">Challenge</span>
        <p>{sc.challenge}</p>
      </div>
      <div className="bi-section">
        <span className="eyebrow">Environment</span>
        <Select label="Ambient light" value={env.ambient} options={(Object.keys(AMBIENT) as (keyof typeof AMBIENT)[]).map((k) => ({ value: k, label: `${AMBIENT[k].label} · ${AMBIENT[k].E} W/m²` }))} onChange={(v) => setEnv({ ambient: v })} />
        {sc.kind !== 'space' && sc.kind !== 'underwater' && (
          <>
            <Select label="Medium" value={env.medium} options={[{ value: 'air', label: 'Air' }, { value: 'fog', label: 'Fog / haze' }]} onChange={(v) => setEnv({ medium: v })} />
            <Slider label="Visibility" value={env.visibilityKm} min={0.05} max={50} log onChange={(v) => setEnv({ visibilityKm: v })} format={(v) => (v < 1 ? `${(v * 1000).toFixed(0)} m` : `${v.toFixed(1)} km`)} />
          </>
        )}
        {sc.kind === 'underwater' && <Select label="Water type" value={env.waterType} options={WATER_TYPES.map((w) => ({ value: w.id, label: `${w.name} (c = ${w.c} m⁻¹)` }))} onChange={(v) => setEnv({ waterType: v })} />}
        {(sc.kind === 'outdoor' || sc.kind === 'underwater') && <Slider label="Turbulence" value={env.turbulence} min={0} max={1} step={0.01} onChange={(v) => setEnv({ turbulence: v })} format={(v) => (v < 0.2 ? 'weak' : v < 0.6 ? 'moderate' : 'strong')} />}
        {sc.room && (
          <>
            <Select label="Walls" value={env.wallMaterial} options={MATERIAL_OPTS} onChange={(v) => setEnv({ wallMaterial: v })} />
            <Select label="Ceiling" value={env.ceilingMaterial} options={MATERIAL_OPTS} onChange={(v) => setEnv({ ceilingMaterial: v })} />
            <Select label="Floor" value={env.floorMaterial} options={MATERIAL_OPTS} onChange={(v) => setEnv({ floorMaterial: v })} />
          </>
        )}
      </div>
      <p className="small muted">Select an object to edit it. Keys: Delete, Ctrl+D duplicate, Ctrl+Z / Ctrl+Y undo/redo, R/T rotate, arrows nudge.</p>
    </div>
  );
}

export function ScenarioPicker({ value, onPick }: { value: string; onPick: (id: string) => void }) {
  return <Select value={value} options={SCENARIOS.map((s) => ({ value: s.id, label: s.name }))} onChange={onPick} />;
}

// ------------------------------------------------------------------ results
function Stat({ k, v, tone }: { k: ReactNode; v: ReactNode; tone?: string }) {
  return (
    <div className={`bs ${tone ?? ''}`}>
      <span>{k}</span>
      <b>{v}</b>
    </div>
  );
}

function ber(x: number) {
  if (!(x > 1e-12)) return '< 10⁻¹²';
  if (x >= 0.1) return x.toFixed(2);
  return x.toExponential(1);
}

function ReportCard({ r, chain }: { r: LinkReport; chain: Chain }) {
  const tone = r.limit === 'ok' ? 'good' : r.throughput > 0 ? 'warn' : 'bad';
  const noiseTot = r.noise.total || 1;
  const bars = [
    { k: 'signal shot', v: r.noise.shot, c: 'var(--c2)' },
    { k: 'ambient shot', v: r.noise.bg, c: 'var(--c4)' },
    { k: 'thermal', v: r.noise.thermal, c: 'var(--c1)' },
    { k: 'dark', v: r.noise.dark, c: 'var(--c5)' },
  ];
  const sh = r.shares;
  return (
    <article className={`br-card ${tone}`}>
      <header>
        <div>
          <span className="eyebrow">{r.kind.toUpperCase()}</span>
          <h4>{r.name}</h4>
        </div>
        <div className="br-rate">
          <b>{r.throughput > 0 ? fmtRate(r.throughput) : '—'}</b>
          <span className={`br-limit ${tone}`}>{LIMIT_TEXT[r.limit]}</span>
        </div>
      </header>
      <div className="br-stats">
        <Stat k="Received" v={isFinite(r.prxDbm) ? `${r.prxDbm.toFixed(1)} dBm` : '—'} />
        <Stat k="Channel gain" v={isFinite(r.gainDb) ? `${r.gainDb.toFixed(1)} dB` : '—'} />
        <Stat k="SNR (elec.)" v={isFinite(r.snrDb) ? `${r.snrDb.toFixed(1)} dB` : '—'} tone={r.snrDb > 15 ? 'good' : r.snrDb > 6 ? 'warn' : 'bad'} />
        <Stat k="BER pre → post FEC" v={`${ber(r.preBer)} → ${ber(r.postBer)}`} tone={r.postBer <= chain.targetBer ? 'good' : 'bad'} />
        <Stat k="Symbol rate" v={r.rsHz > 0 ? fmtRate(r.rsHz).replace('b/s', 'Bd') : '—'} />
        <Stat k="System bandwidth" v={`${(r.bSys / 1e6).toPrecision(3)} MHz`} />
        <Stat k="Delay spread τ_rms" v={r.tauRms > 0 ? `${(r.tauRms * 1e9).toPrecision(3)} ns` : '—'} />
        <Stat k="Range" v={r.rangeM >= 1000 ? `${(r.rangeM / 1000).toPrecision(4)} km` : `${r.rangeM.toFixed(2)} m`} />
        {r.harvestW !== undefined && <Stat k="Harvested power" v={`${(r.harvestW * 1000).toPrecision(3)} mW`} tone="good" />}
        {r.scint && <Stat k="Scintillation σ²_I" v={`${r.scint.sigmaI2.toFixed(2)} (${r.scint.marginDb.toFixed(1)} dB margin)`} />}
      </div>
      <div className="br-bars">
        <span className="eyebrow">Where the light came from</span>
        <div className="br-bar">
          {[
            { k: 'LOS', v: sh.los, c: 'var(--c2)' },
            { k: 'reflections', v: sh.diffuse, c: 'var(--c1)' },
            { k: 'scattering', v: sh.scatter, c: 'var(--c5)' },
            { k: 'optics (mirrors, lenses)', v: sh.optics, c: 'var(--c3)' },
          ]
            .filter((b) => b.v > 0.005)
            .map((b) => (
              <i key={b.k} style={{ width: `${b.v * 100}%`, background: b.c }} title={`${b.k}: ${(b.v * 100).toFixed(1)} %`} />
            ))}
        </div>
        <div className="br-legend">
          {sh.los > 0.005 && <span style={{ ['--c' as string]: 'var(--c2)' }}>LOS {(sh.los * 100).toFixed(0)} %</span>}
          {sh.diffuse > 0.005 && <span style={{ ['--c' as string]: 'var(--c1)' }}>reflections {(sh.diffuse * 100).toFixed(0)} %</span>}
          {sh.scatter > 0.005 && <span style={{ ['--c' as string]: 'var(--c5)' }}>scattering {(sh.scatter * 100).toFixed(0)} %</span>}
          {sh.optics > 0.005 && <span style={{ ['--c' as string]: 'var(--c3)' }}>optics {(sh.optics * 100).toFixed(0)} %</span>}
        </div>
        <span className="eyebrow">Noise power</span>
        <div className="br-bar">
          {bars
            .filter((b) => b.v / noiseTot > 0.005)
            .map((b) => (
              <i key={b.k} style={{ width: `${(b.v / noiseTot) * 100}%`, background: b.c }} title={`${b.k}: ${((b.v / noiseTot) * 100).toFixed(1)} %`} />
            ))}
        </div>
        <div className="br-legend">
          {bars
            .filter((b) => b.v / noiseTot > 0.005)
            .map((b) => (
              <span key={b.k} style={{ ['--c' as string]: b.c }}>
                {b.k} {((b.v / noiseTot) * 100).toFixed(0)} %
              </span>
            ))}
        </div>
      </div>
      <div className="br-plots">
        {r.impulse.h.length > 1 && r.tauRms > 0 && (
          <Plot
            title="Impulse response"
            series={[{ x: r.impulse.t.map((t) => (t - r.impulse.t[0]) * 1e9), y: r.impulse.h, kind: 'stem', color: 'var(--c2)' }]}
            xLabel="excess delay (ns)"
            y={[0, 1.05]}
            height={120}
          />
        )}
        {r.subcarriers && (
          <Plot
            title="OFDM: SNR and bits per subcarrier"
            series={[
              { x: r.subcarriers.f.map((f) => f / 1e6), y: r.subcarriers.snrDb, color: 'var(--c1)', label: 'SNR (dB)' },
              { x: r.subcarriers.f.map((f) => f / 1e6), y: r.subcarriers.bits.map((b) => b * 4), kind: 'step', color: 'var(--c2)', label: 'bits × 4' },
            ]}
            xLabel="frequency (MHz)"
            height={130}
            legend
          />
        )}
      </div>
      {r.warnings.length > 0 && (
        <ul className="br-warn">
          {r.warnings.map((w, i) => (
            <li key={i}>{w}</li>
          ))}
        </ul>
      )}
    </article>
  );
}

export function ResultsPanel({ an, chain, ms, rays }: { an: BenchAnalysis | null; chain: Chain; ms: number; rays: number }) {
  if (!an) return <p className="muted">Tracing…</p>;
  if (!an.reports.length) return <p className="muted">Add a receiver to see link quality.</p>;
  return (
    <div className="br">
      <div className="br-grid">
        {an.reports.map((r) => (
          <ReportCard key={r.rxId} r={r} chain={chain} />
        ))}
      </div>
      {an.mimo && (
        <article className="br-card">
          <header>
            <div>
              <span className="eyebrow">MIMO</span>
              <h4>Channel matrix (signal current per W)</h4>
            </div>
            <div className="br-rate">
              <b>{fmtRate(an.mimo.capacityBps)}</b>
              <span className="br-limit">{an.mimo.cond > 1e4 ? "rank-deficient (streams not separable)" : `cond. ${an.mimo.cond.toFixed(1)}`}</span>
            </div>
          </header>
          <table className="br-mimo">
            <tbody>
              {an.mimo.H.map((row, i) => (
                <tr key={i}>
                  {row.map((v, j) => (
                    <td key={j} style={{ background: `color-mix(in srgb, var(--c2) ${Math.round((100 * v) / Math.max(1e-30, Math.max(...an.mimo!.H.flat())))}%, transparent)` }}>
                      {v.toExponential(1)}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
          <p className="small muted">Singular values: {an.mimo.sv.map((s) => s.toExponential(1)).join(', ')}. A large condition number means the streams cannot be separated.</p>
        </article>
      )}
      <p className="small muted">
        {rays.toLocaleString()} rays traced in {ms.toFixed(0)} ms. Direct paths, wall reflections, scattering and flat-mirror paths are computed exactly (next-event estimation); curved optics, lenses
        and prisms use the Monte Carlo rays. Teaching-grade first-order models: compare designs, don’t sign off on them.
      </p>
    </div>
  );
}

// ------------------------------------------------------------------ modem chain
const OPT = <T extends string>(rec: Record<T, { label: string }>) => (Object.keys(rec) as T[]).map((k) => ({ value: k, label: rec[k].label }));

function Block({ n, title, children, note }: { n: string; title: string; children: ReactNode; note?: string }) {
  return (
    <div className="bc-block">
      <div className="bc-block-head">
        <span className="mono">{n}</span>
        <b>{title}</b>
      </div>
      <div className="bc-block-body">{children}</div>
      {note && <p className="bc-note">{note}</p>}
    </div>
  );
}

export function ChainPanel({ chain, dispatch, report }: { chain: Chain; dispatch: (a: Action) => void; report?: LinkReport }) {
  const set = (patch: Partial<Chain>) => dispatch({ t: 'chain', patch });
  const mod = MODS[chain.modulation];
  const isOfdm = mod.family === 'ofdm';
  const modOpts = useMemo(
    () =>
      (Object.keys(MODS) as Chain['modulation'][]).map((k) => ({
        value: k,
        label: MODS[k].label,
        group: { sc: 'Single carrier', ppm: 'Pulse position', qam: 'QAM-based', csk: 'Colour', ofdm: 'Multi-carrier (OFDM)', camera: 'Camera (OCC)' }[MODS[k].family],
      })),
    [],
  );
  return (
    <div className="bc">
      <div className="bc-lane">
        <span className="bc-lane-label">Transmitter</span>
        <div className="bc-row">
          <Block n="01" title="Channel coding" note={CODES[chain.coding].note}>
            <Select value={chain.coding} options={OPT(CODES)} onChange={(v) => set({ coding: v })} />
          </Block>
          <Block n="02" title="Interleaver" note="Spreads burst errors across codewords.">
            <Toggle label="Enabled" checked={chain.interleaver} onChange={(v) => set({ interleaver: v })} />
          </Block>
          <Block n="03" title="Line code (RLL)" note="DC balance and clock transitions: no flicker.">
            <Select value={chain.lineCode} options={OPT(LINECODES)} onChange={(v) => set({ lineCode: v })} />
          </Block>
          <Block n="04" title="Modulation" note={mod.note}>
            <Select value={chain.modulation} options={modOpts} onChange={(v) => set({ modulation: v, ...(MODS[v].family === 'ofdm' && chain.equalizer !== 'onetap' ? { equalizer: 'onetap' } : MODS[v].family !== 'ofdm' && chain.equalizer === 'onetap' ? { equalizer: 'dfe' } : {}) })} />
            {(isOfdm || chain.modulation === 'cap16') && (
              <>
                <Select label="Max QAM order" value={String(chain.qam)} options={[4, 16, 64, 256, 1024].map((m) => ({ value: String(m), label: `${m}-QAM` }))} onChange={(v) => set({ qam: +v })} />
                {isOfdm && <Toggle label="Adaptive bit loading" checked={chain.bitLoading} onChange={(v) => set({ bitLoading: v })} />}
              </>
            )}
          </Block>
          <Block n="05" title="Symbol rate" note={chain.symbolRateMHz ? 'Fixed by you.' : 'Auto: the fastest rate that still meets the BER target.'}>
            <Toggle label="Auto" checked={chain.symbolRateMHz === 0} onChange={(v) => set({ symbolRateMHz: v ? 0 : Math.max(0.01, (report?.rsHz ?? 1e6) / 1e6) })} />
            {chain.symbolRateMHz > 0 && <Slider label="Rate" value={chain.symbolRateMHz} min={0.001} max={20000} log onChange={(v) => set({ symbolRateMHz: v })} format={(v) => fmtRate(v * 1e6).replace('b/s', 'Bd')} />}
          </Block>
          <Block n="06" title="DAC, pre-emphasis & driver" note="Pre-equalisation boosts high frequencies to stretch LED bandwidth.">
            <Select value={chain.preEq} options={[{ value: 'none', label: 'None' }, { value: 'passive', label: 'Passive RC pre-equaliser (×3 BW, −4.8 dB)' }, { value: 'digital', label: 'Digital pre-emphasis (×1.8 BW, −2 dB)' }]} onChange={(v) => set({ preEq: v })} />
            <Slider label="Modulation index" value={chain.modIndex} min={0.05} max={1} step={0.01} onChange={(v) => set({ modIndex: v })} />
          </Block>
        </div>
      </div>
      <div className="bc-lane">
        <span className="bc-lane-label">Receiver</span>
        <div className="bc-row">
          <Block n="07" title="Synchronisation" note="Frame start and sampling instant.">
            <Select value={chain.sync} options={[{ value: 'preamble', label: 'Preamble correlation' }, { value: 'gardner', label: 'Preamble + Gardner timing loop' }, { value: 'pilots', label: 'Preamble + pilot tones' }]} onChange={(v) => set({ sync: v })} />
          </Block>
          <Block n="08" title="Equaliser" note={EQS[chain.equalizer].note}>
            <Select value={chain.equalizer} options={(Object.keys(EQS) as Chain['equalizer'][]).map((k) => ({ value: k, label: EQS[k].label, group: ['volterra', 'mlp', 'lstm'].includes(k) ? 'Non-linear' : k === 'onetap' ? 'OFDM' : 'Linear / sequence' }))} onChange={(v) => set({ equalizer: v })} />
          </Block>
          <Block n="09" title="Detection & decoding" note="Soft decisions feed the FEC decoder.">
            <Select label="Target post-FEC BER" value={String(chain.targetBer)} options={['1e-3', '1e-5', '1e-6', '1e-9'].map((v) => ({ value: String(+v), label: v }))} onChange={(v) => set({ targetBer: +v })} />
          </Block>
          <Block n="10" title="Multiple access & MIMO" note="How receivers share the light.">
            <Select value={chain.mac} options={[{ value: 'p2p', label: 'Point-to-point' }, { value: 'tdma', label: 'TDMA' }, { value: 'ofdma', label: 'OFDMA' }, { value: 'noma', label: 'NOMA' }, { value: 'csma', label: 'CSMA/CA' }]} onChange={(v) => set({ mac: v })} />
            <Toggle label="Spatial multiplexing (MIMO)" checked={chain.mimo} onChange={(v) => set({ mimo: v })} />
          </Block>
        </div>
      </div>
    </div>
  );
}

// ------------------------------------------------------------------ advisor
export function AdvisorPanel({ advice, state, dispatch, onFix }: { advice: Advice | null; state: BenchState; dispatch: (a: Action) => void; onFix: (f: Fix) => void }) {
  if (!advice) return <p className="muted">Analysing…</p>;
  const g = state.goals;
  const setG = (patch: Partial<BenchState['goals']>) => dispatch({ t: 'goals', patch });
  const applyAll = () => {
    const patch: Partial<Chain> = {};
    advice.blueprint.forEach((r) => r.chain && Object.assign(patch, r.chain));
    dispatch({ t: 'chain', patch });
  };
  return (
    <div className="ba">
      <div className="ba-goals">
        <Slider label="Goal data rate" value={g.targetMbps} min={0.001} max={100000} log onChange={(v) => setG({ targetMbps: v })} format={(v) => fmtRate(v * 1e6)} />
        <Select label="Mobility" value={g.mobility} options={[{ value: 'static', label: 'Static' }, { value: 'walking', label: 'Walking user' }, { value: 'vehicle', label: 'Vehicle' }]} onChange={(v) => setG({ mobility: v })} />
        <Toggle label="Must also provide lighting" checked={g.illumination} onChange={(v) => setG({ illumination: v })} />
      </div>
      <p className="ba-headline">{advice.headline}</p>
      <div className="ba-findings">
        {advice.findings.map((f, i) => (
          <div key={i} className={`ba-f ${f.level}`}>
            <b>{f.title}</b>
            <p>{f.text}</p>
            {f.fixes.length > 0 && (
              <div className="ba-fixes">
                {f.fixes.map((x, j) => (
                  <button key={j} type="button" className="chipbtn" onClick={() => onFix(x)}>
                    {x.label}
                  </button>
                ))}
              </div>
            )}
          </div>
        ))}
      </div>
      <div className="ba-bp-head">
        <span className="eyebrow">Recommended system blueprint</span>
        <button type="button" className="btn small primary" onClick={applyAll}>
          Apply recommended chain
        </button>
      </div>
      <ol className="ba-bp">
        {advice.blueprint.map((r, i) => {
          const differs = !!r.chain && Object.entries(r.chain).some(([k, v]) => state.chain[k as keyof Chain] !== v);
          return (
          <li key={i} className={r.group}>
            <span className="ba-bp-block">{r.block}</span>
            <span className="ba-bp-choice">
              {r.choice}
              {r.current && differs && <em> (now: {r.current})</em>}
            </span>
            <span className="ba-bp-why">{r.why}</span>
            {differs && (
              <button type="button" className="chipbtn" onClick={() => dispatch({ t: 'chain', patch: r.chain! })}>
                Apply
              </button>
            )}
          </li>
          );
        })}
      </ol>
    </div>
  );
}

export type { Vec3 };
export { D };
